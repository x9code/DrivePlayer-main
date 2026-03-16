/**
 * Metadata Service
 * Core metadata extraction using music-metadata library
 * Implements fallback chain, sanitization, and caching
 */

const { parseStream } = require('music-metadata');
const fs = require('fs');
const path = require('path');
const {
    sanitizeString,
    parseFilename,
    parseArtistFromFilename,
    sanitizeDuration,
    normalizeMimeType
} = require('../utils/sanitizer');

const ArtService = require('./artService');

class MetadataService {
    constructor(driveService, cacheService, cacheDir, libraryService) {
        this.driveService = driveService;
        this.cacheService = cacheService;
        this.cacheDir = cacheDir;
        this.libraryService = libraryService;

        this.persistentCache = {};
        this.folderCovers = {};
        this.manualCovers = new Set();
        this.manualCoversDir = path.join(__dirname, '..', 'custom_covers');

        this.scanStatus = {
            active: false,
            total: 0,
            current: 0,
            enriched: 0,
            errors: 0
        };
    }

    async init() {
        await this.loadPersistence();
        await this.loadFolderCovers();
        this.loadManualCovers();
    }

    /**
     * Scan custom_covers directory for manually set artwork
     */
    loadManualCovers() {
        try {
            if (!fs.existsSync(this.manualCoversDir)) {
                fs.mkdirSync(this.manualCoversDir, { recursive: true });
            }
            const files = fs.readdirSync(this.manualCoversDir);
            this.manualCovers = new Set(
                files
                    .filter(f => f.endsWith('.png'))
                    .map(f => f.replace('.png', ''))
            );
            console.log(`[Metadata] Detected ${this.manualCovers.size} manual folder covers.`);
        } catch (error) {
            console.error('[Metadata] Error loading manual covers:', error.message);
        }
    }

    registerManualCover(folderId) {
        this.manualCovers.add(folderId);
    }

    unregisterManualCover(folderId) {
        this.manualCovers.delete(folderId);
    }

    /**
     * Get number of cached items
     */
    get cachedCount() {
        return Object.keys(this.persistentCache).length;
    }

    /**
     * Load persistent metadata from disk
     */
    async loadPersistence() {
        try {
            if (this.libraryService) {
                this.persistentCache = await this.libraryService.getMetadataCache();
                console.log(`[Metadata] Loaded ${Object.keys(this.persistentCache).length} entries from DB persistence.`);
            }
        } catch (error) {
            console.error('[Metadata] Error loading DB persistence:', error.message);
            this.persistentCache = {};
        }
    }

    /**
     * Save persistent metadata to disk
     */
    async savePersistence(fileId, metadata) {
        if (!fileId || !metadata) return; // Ignore legacy empty calls
        try {
            if (this.libraryService) {
                await this.libraryService.setMetadataCache(fileId, metadata);
            }
        } catch (error) {
            console.error('[Metadata] Error saving DB persistence:', error.message);
        }
    }

    /**
     * Load folder covers from disk
     */
    async loadFolderCovers() {
        try {
            if (this.libraryService) {
                this.folderCovers = await this.libraryService.getFolderCovers();
                console.log(`[Metadata] Loaded ${Object.keys(this.folderCovers).length} folder covers from DB.`);
            }
        } catch (error) {
            console.error('[Metadata] Error loading folder covers from DB:', error.message);
            this.folderCovers = {};
        }
    }

    /**
     * Save folder covers to disk
     */
    async saveFolderCovers() {
        try {
            if (this.libraryService) {
                await this.libraryService.setFolderCoversBatch(this.folderCovers);
            }
        } catch (error) {
            console.error('[Metadata] Error saving folder covers to DB:', error.message);
        }
    }

    /**
     * Update folder covers based on file list
     * Finds the first song in each folder and sets it as cover
     * @param {Array} files - List of files (must include parent property)
     */
    updateFolderCovers(files) {
        let changed = false;

        // 1. Build Index: Parent -> Children (Files & Folders)
        const childrenMap = {}; // parentId -> [items]

        files.forEach(f => {
            // We need parent ID to build the tree
            if (f.parent) {
                if (!childrenMap[f.parent]) {
                    childrenMap[f.parent] = [];
                }
                childrenMap[f.parent].push(f);
            }
        });

        // 2. Recursive Resolver
        // Returns an Array of File IDs that could serve as covers
        const resolveCover = (folderId, depth = 0, collected = new Set()) => {
            if (depth > 5 || collected.size >= 5) return Array.from(collected);

            const children = childrenMap[folderId] || [];

            // A. Check for DIRECT files first
            const directFiles = children.filter(c => c.mimeType !== 'application/vnd.google-apps.folder');

            // Preference 1: Direct files WITH embedded artwork (found via scan)
            const artFiles = directFiles.filter(f => {
                const meta = this.persistentCache[f.id];
                return meta && meta.artwork === true;
            });
            artFiles.forEach(f => { if (collected.size < 5) collected.add(f.id); });

            // Preference 2: Direct files with Google Drive thumbnailLink (fallback if no embedded art yet)
            if (collected.size < 5) {
                const thumbFiles = directFiles.filter(f => f.thumbnailLink);
                thumbFiles.forEach(f => { if (collected.size < 5) collected.add(f.id); });
            }

            // Preference 3: Sub-folders (Bubble Up)
            if (collected.size < 5) {
                const subFolders = children.filter(c => c.mimeType === 'application/vnd.google-apps.folder');

                for (const sub of subFolders) {
                    const subCovers = this.folderCovers[sub.id];
                    if (subCovers) {
                        const ids = Array.isArray(subCovers) ? subCovers : (typeof subCovers === 'string' ? subCovers.split(',') : [subCovers]);
                        ids.forEach(id => { if (collected.size < 5 && id) collected.add(id); });
                    } else {
                        resolveCover(sub.id, depth + 1, collected);
                    }
                    if (collected.size >= 5) break;
                }
            }

            // Preference 4: Greedy Fallback - Always include the first few songs if we don't have enough art
            if (collected.size < 5) {
                // Add first few audio files (to let frontend try to fetch art)
                const audioFiles = directFiles.slice(0, 5);
                audioFiles.forEach(f => { if (collected.size < 5) collected.add(f.id); });
            }

            return Array.from(collected);
        };

        // 3. Process all folders found in this batch + their parents (via childrenMap)
        Object.keys(childrenMap).forEach(folderId => {
            // SKIP folders with manual covers
            if (this.manualCovers.has(folderId)) {
                // If we previously had a calculated cover, remove it (manual takes precedence)
                if (this.folderCovers[folderId]) {
                    delete this.folderCovers[folderId];
                    changed = true;
                }
                return;
            }

            const idealCovers = resolveCover(folderId);

            if (idealCovers.length > 0) {
                // Update if different from current
                const currentCovers = this.folderCovers[folderId];
                const currentStr = Array.isArray(currentCovers) ? currentCovers.join(',') : (currentCovers || '');
                const nextStr = idealCovers.join(',');

                if (currentStr !== nextStr) {
                    this.folderCovers[folderId] = idealCovers;
                    changed = true;
                }
            }
        });

        if (changed) {
            this.saveFolderCovers();
            console.log('[Metadata] Updated folder covers cache (Recursive Bubble-up)');
        }
    }

    /**
     * Main entry point: Get or parse metadata
     * Checks persistent cache first, then memory cache, then parses
     * @param {string} fileId - Google Drive file ID
     * @returns {Promise<Object>} Normalized metadata
     */
    async getOrParseMetadata(fileId, force = false) {
        // 1. Check Persistent Cache (Fastest, survives restart)
        if (!force && this.persistentCache[fileId]) {
            return this.persistentCache[fileId];
        }

        // 2. Check Memory Cache (Legacy)
        if (!force && this.cacheService.has(fileId)) {
            const cached = this.cacheService.get(fileId);
            return cached;
        }

        if (force) {
            console.log(`[Metadata] Force refreshing metadata for ${fileId}`);
        } else {
            console.log(`[Metadata] Cache miss for ${fileId}, parsing...`);
        }

        try {
            // Get file info from Drive
            const fileInfo = await this.driveService.getFileMetadata(fileId);

            // Parse metadata
            const metadata = await this.parseMetadata(fileId, fileInfo);

            // Save to Persistent Cache
            this.persistentCache[fileId] = metadata;
            await this.savePersistence(fileId, metadata);

            // Cache the result in memory too
            await this.cacheService.set(fileId, metadata);

            // [NEW] Sync with DB
            if (this.libraryService) {
                await this.libraryService.updateMetadata(fileId, metadata);
            }

            return metadata;
        } catch (error) {
            console.error(`[Metadata] Error parsing ${fileId}:`, error.message);
            return this.getSafeDefaults(fileId, error);
        }
    }

    /**
     * Parse metadata from audio file
     * Uses optimized small-range download
     * @param {string} fileId - Google Drive file ID
     * @param {Object} fileInfo - File information (name, size, mimeType)
     * @returns {Promise<Object>} Parsed metadata
     */
    async parseMetadata(fileId, fileInfo) {
        const { name, size, mimeType } = fileInfo;
        console.log(`[Metadata] Parsing ${name} (${size} bytes, ${mimeType})`);

        // Prevent Drive API 403 errors by explicitly skipping Google Workspace 
        // documents and folders (they cannot be downloaded via ?alt=media)
        if (mimeType === 'application/vnd.google-apps.folder' || mimeType.startsWith('application/vnd.google-apps')) {
            console.log(`[Metadata] Skipping metadata download for Google Drive native file/folder: ${name}`);
            return this.applyFilenameFallbacks(name, mimeType, size);
        }

        try {
            // Optimized Download: Header + Footer only (~68KB total)
            const { stream, size: downloadedSize } = await this.driveService.downloadOptimizedMetadata(fileId, size);
            console.log(`[Metadata] Downloaded ${downloadedSize} bytes for parsing`);

            // Parse using music-metadata
            const normalized = normalizeMimeType(mimeType);
            const parsed = await parseStream(stream, { mimeType: normalized }, {
                skipPostHeaders: true,
                skipCovers: false // We still want artwork if in header
            });

            console.log(`[Metadata] Parse complete. Has picture:`, !!parsed.common?.picture?.[0]);

            // Extract and sanitize metadata
            const metadata = this.extractMetadata(parsed, name, mimeType, size);

            // Extract Artwork (only if found in the small chunk)
            const picture = parsed.common?.picture?.[0];
            if (picture) {
                try {
                    await this.saveArtwork(fileId, picture);
                    metadata.artwork = true;
                } catch (artError) {
                    console.error(`[Metadata] Failed to save artwork:`, artError.message);
                    metadata.artwork = false;
                }
            } else {
                metadata.artwork = false;
            }

            return metadata;
        } catch (error) {
            // CRITICAL: Do NOT cache network/rate-limit errors as "unknown metadata"
            if (error.message.includes('403') || error.message.includes('429') || error.message.includes('quota') || error.message.includes('Rate Limit')) {
                console.warn(`[Metadata] Rate/Quota limit hit for ${fileId}, bubbling up error.`);
                throw error; // Let the caller handle it (count as error, don't cache)
            }

            console.error(`[Metadata] Parse error for ${fileId}:`, error.message);
            return this.applyFilenameFallbacks(name, mimeType, size);
        }
    }

    /**
     * Improve a list of files with metadata in the background
     * This is the "Smart Scan" logic
     * @param {Array} files - List of file objects
     * @param {boolean} force - Whether to overwrite existing cache
     */
    async enrichFiles(files, force = false) {
        console.log(`[Metadata] Starting enrichment for ${files.length} files... (Force: ${force})`);

        // [FIX] Update folder covers immediately so UI can display fallbacks during the long scan
        this.updateFolderCovers(files);

        // Filter out folders first
        const songs = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        // PREVENT RACE CONDITION: Don't start if already scanning
        if (this.scanStatus && this.scanStatus.active) {
            console.log(`[Metadata] Scan already in progress (Current: ${this.scanStatus.current}/${this.scanStatus.total}). Skipping new request.`);
            return;
        }

        // Initialize Status
        this.scanStatus = {
            active: true,
            total: songs.length,
            current: 0,
            enriched: 0,
            errors: 0
        };

        // Pre-enrich the songs array with cached/fallback data so ArtService has tags
        // (Fast in-memory operation)
        const enrichedSongs = this.enrichList(songs);

        let updatedCount = 0;

        // Process with concurrency (User requested high speed)
        const CONCURRENCY = 5; // Back to 5, now that we handle errors properly

        for (let i = 0; i < songs.length; i += CONCURRENCY) {
            const chunk = songs.slice(i, i + CONCURRENCY);

            await Promise.all(chunk.map(async (file, index) => {
                // Update global processed count (approximate is fine for UI)
                const globalIndex = i + index;
                this.scanStatus.current = globalIndex + 1;

                // Skip if already has good metadata (heuristic) UNLESS forced
                if (!force && this.persistentCache[file.id]) {
                    // Already cached
                    // [NEW] Ensure DB is synced even if cached (Critical for consistency)
                    if (this.libraryService) {
                        await this.libraryService.updateMetadata(file.id, this.persistentCache[file.id]);
                    }
                    return;
                }

                try {
                    // Pass force=true to getOrParseMetadata if we are forcing enrichment
                    await this.getOrParseMetadata(file.id, force);
                    updatedCount++;
                    this.scanStatus.enriched++;
                } catch (e) {
                    console.error(`[Metadata] Failed to enrich ${file.name}:`, e.message);
                    this.scanStatus.errors++;
                }
            }));

            // Small breather to prevent complete API lockout
            await new Promise(r => setTimeout(r, 50));
        }

        // Phase 2: Enrich with Online Art (Async, don't block main flow too long)
        console.log('[Metadata] Checks for missing online art...');
        await ArtService.enrichMissingArt(enrichedSongs);

        this.scanStatus.active = false;

        console.log(`[Metadata] Enrichment complete. Updated ${updatedCount} files.`);

        // Re-evaluate folder covers now that we have fresh metadata AND online art
        this.updateFolderCovers(files);

        // IMPORTANT: Clear recursive cache to force re-fetch with enriched metadata
        this.clearRecursiveCache();
    }

    /**
     * Clear all cached recursive file lists
     * Called after metadata enrichment to ensure fresh data on next fetch
     */
    clearRecursiveCache() {
        if (!this.cacheService) return;

        try {
            // Get all cache keys and filter for recursive_files_ prefix
            const allKeys = this.cacheService.getAllKeys ? this.cacheService.getAllKeys() : [];
            const recursiveKeys = allKeys.filter(key => key.startsWith('recursive_files_'));

            recursiveKeys.forEach(key => {
                this.cacheService.delete(key);
                console.log(`[Metadata] Cleared cache: ${key}`);
            });

            console.log(`[Metadata] Cleared ${recursiveKeys.length} recursive caches`);
        } catch (error) {
            console.error('[Metadata] Error clearing recursive cache:', error.message);
        }
    }

    /**
     * Extract and sanitize metadata from parsed result
     * Applies fallback chain
     * @param {Object} parsed - music-metadata parse result
     * @param {string} filename - Original filename
     * @param {string} mimeType - MIME type
     * @param {number} fileSize - File size in bytes
     * @returns {Object} Normalized metadata
     */
    extractMetadata(parsed, filename, mimeType, fileSize) {
        const common = parsed.common || {};
        const format = parsed.format || {};

        // Apply fallback chain with sanitization
        // Apply fallback chain with sanitization
        let title = sanitizeString(common.title);

        // [NEW] Heuristic: If Title tag exists but looks like a filename (contains " - " or starts with "01 "), 
        // trust our sanitizer more than the tag. This fixes "Lana Del Rey - Title" as a title.
        if (title && (title.includes(' - ') || title.match(/^\d+[\s._-]/))) {
            const clean = parseFilename(title);
            // If sanitizer extracted a meaningful part (shorter), use it
            if (clean && clean.length < title.length && clean.length > 1) {
                title = clean;
            }
        }

        title = title || parseFilename(filename) || "Unknown Title";

        let artist = sanitizeString(common.artist)
            || sanitizeString(common.albumartist);

        // [NEW] Replace ; separators with commas so they render properly
        if (artist && artist.includes(';')) {
            artist = artist.replace(/;\s*/g, ', ');
        }

        // [NEW] Fallback for artist if missing or literally "Unknown Artist"
        if (!artist || artist.toLowerCase() === 'unknown artist' || artist.toLowerCase() === 'unknown') {
            const parsedArtist = parseArtistFromFilename(filename);
            if (parsedArtist) {
                artist = parsedArtist;
            } else if (artist && artist.toLowerCase() === 'unknown artist') {
                artist = null; // Clear it to allow the generic "Unknown Artist" assignment below
            }
        }

        artist = artist || "Unknown Artist";

        const album = sanitizeString(common.album) || null;

        const year = common.year || (common.date ? String(common.date).substring(0, 4) : null);
        const genre = common.genre && common.genre.length > 0 ? common.genre.join(', ') : null;
        const track = common.track && common.track.no ? common.track.no : null;

        const duration = sanitizeDuration(format.duration || 0);

        // Check if artwork exists
        const hasArtwork = common.picture && common.picture.length > 0;

        return {
            title,
            artist,
            album,
            year,
            genre,
            track,
            duration,
            artwork: hasArtwork,
            picture: hasArtwork ? null : null, // We'll populate this via ArtService or Drive Thumbnail
            fileSize: fileSize,
            mimeType: normalizeMimeType(mimeType),
            filename: filename,
            // Audio Quality Details
            sampleRate: format.sampleRate,
            bitrate: format.bitrate,
            codec: format.codec,
            bitsPerSample: format.bitsPerSample || 16 // Default to 16 if missing (common)
        };
    }

    /**
     * Save artwork to disk cache
     * @param {string} fileId - File ID
     * @param {Object} picture - Picture object from music-metadata
     */
    async saveArtwork(fileId, picture) {
        try {
            // Ensure cache directory exists
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
                console.log(`[Metadata] Created cache directory: ${this.cacheDir}`);
            }

            const artworkPath = path.join(this.cacheDir, `${fileId}`);
            fs.writeFileSync(artworkPath, picture.data);
            console.log(`[Metadata] Saved artwork for ${fileId} (${picture.format}, ${picture.data.length} bytes)`);
        } catch (error) {
            console.error(`[Metadata] Error saving artwork for ${fileId}:`, error.message);
            console.error(`[Metadata] Cache directory:`, this.cacheDir);
            throw error; // Re-throw so caller knows it failed
        }
    }

    /**
     * Apply fallbacks using only filename (when parsing fails)
     * @param {string} filename - Original filename
     * @param {string} mimeType - MIME type
     * @param {number} fileSize - File size
     * @returns {Object} Metadata with filename-based fallbacks
     */
    applyFilenameFallbacks(filename, mimeType, fileSize) {
        console.log(`[Metadata] Applying filename fallbacks for ${filename}`);

        return {
            title: parseFilename(filename) || "Unknown Title",
            artist: parseArtistFromFilename(filename) || "Unknown Artist",
            album: "Unknown Album",
            duration: 0,
            artwork: false,
            fileSize: fileSize,
            mimeType: normalizeMimeType(mimeType),
            filename: filename
        };
    }

    /**
     * Get safe default metadata (last resort)
     * @param {string} fileId - File ID
     * @param {Error} error - Original error
     * @returns {Object} Safe default metadata
     */
    getSafeDefaults(fileId, error) {
        console.error(`[Metadata] Returning safe defaults for ${fileId} due to error:`, error.message);

        return {
            title: "Unknown Title",
            artist: "Unknown Artist",
            album: "Unknown Album",
            duration: 0,
            artwork: false,
            fileSize: 0,
            mimeType: "audio/mpeg",
            filename: fileId,
            error: error.message
        };
    }

    /**
     * Batch fetch metadata for multiple files
     * Useful for pre-caching folder contents
     * @param {Array<string>} fileIds - Array of file IDs
     * @param {number} concurrency - Max concurrent operations
     * @returns {Promise<Map<string, Object>>} Map of fileId to metadata
     */
    async batchGetMetadata(fileIds, concurrency = 2) {
        const results = new Map();
        const queue = [...fileIds];

        const worker = async () => {
            while (queue.length > 0) {
                const fileId = queue.shift();
                try {
                    const metadata = await this.getOrParseMetadata(fileId);
                    results.set(fileId, metadata);
                } catch (error) {
                    console.error(`[Metadata] Batch fetch error for ${fileId}:`, error.message);
                    results.set(fileId, this.getSafeDefaults(fileId, error));
                }
            }
        };

        // Create worker pool
        const workers = Array(concurrency).fill(null).map(() => worker());
        await Promise.all(workers);

        return results;
    }

    /**
     * Efficiently merge cached metadata into a list of files
     * Used for list APIs to providing titles/artists without individual lookups
     * @param {Array} files - Array of Drive file objects
     * @returns {Array} Enriched files
     */
    enrichList(files) {
        return files.map(file => {
            let enriched = { ...file };

            // [NEW] Strict Bypass for Folders so they don't get "Unknown Artist" tags
            if (enriched.mimeType === 'application/vnd.google-apps.folder') {
                enriched.hasCustomCover = this.manualCovers.has(enriched.id);
                const covers = this.folderCovers[enriched.id];
                if (covers) {
                    enriched.coverSongIds = Array.isArray(covers) ? covers : (typeof covers === 'string' ? covers.split(',') : [covers]);
                }
                return enriched;
            }

            const cached = this.persistentCache[file.id];

            if (cached) {
                // Merge cached metadata
                enriched = {
                    ...enriched,
                    title: cached.title,
                    artist: cached.artist,
                    album: cached.album,
                    duration: cached.duration,
                    artwork: cached.artwork || false,
                    hasMetadata: true
                };
            }

            // Fallback: If artist/album/title missing, try parsing from filename
            if (!enriched.artist || enriched.artist === 'Unknown Artist') {
                enriched.artist = parseArtistFromFilename(enriched.name) || 'Unknown Artist';
            }
            if (!enriched.title || enriched.title === 'Unknown Title') {
                enriched.title = parseFilename(enriched.name) || 'Unknown Title';
            }
            if (!enriched.album) {
                enriched.album = 'Unknown Album';
            }

            // Inject Folder Cover if it's a folder (redundancy check)
            if (enriched.mimeType === 'application/vnd.google-apps.folder') {
                const covers = this.folderCovers[enriched.id];
                if (covers) {
                    enriched.coverSongIds = Array.isArray(covers) ? covers : (typeof covers === 'string' ? covers.split(',') : [covers]);
                }
            }

            // Ensure picture property is populated from Drive thumbnail if not in metadata
            if (!enriched.picture && enriched.thumbnailLink) {
                enriched.picture = enriched.thumbnailLink;
            }

            return enriched;
        });
    }

    /**
     * Invalidate cache for a specific file
     * Useful when file is updated
     * @param {string} fileId - File ID to invalidate
     */
    async invalidateCache(fileId) {
        await this.cacheService.delete(fileId);
        console.log(`[Metadata] Cache invalidated for ${fileId}`);
    }
}

module.exports = MetadataService;
