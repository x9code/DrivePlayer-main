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

class MetadataService {
    constructor(driveService, cacheService, cacheDir) {
        this.driveService = driveService;
        this.cacheService = cacheService;
        this.cacheDir = cacheDir;
    }

    /**
     * Main entry point: Get or parse metadata
     * Checks cache first, then parses if needed
     * @param {string} fileId - Google Drive file ID
     * @returns {Promise<Object>} Normalized metadata
     */
    async getOrParseMetadata(fileId, force = false) {
        // Check cache first (unless forced)
        if (!force && this.cacheService.has(fileId)) {
            const cached = this.cacheService.get(fileId);
            console.log(`[Metadata] Cache hit for ${fileId}`);
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

            // Cache the result
            await this.cacheService.set(fileId, metadata);

            return metadata;
        } catch (error) {
            console.error(`[Metadata] Error parsing ${fileId}:`, error.message);

            // Return safe defaults on error
            return this.getSafeDefaults(fileId, error);
        }
    }

    /**
     * Parse metadata from audio file
     * Downloads necessary ranges and extracts tags
     * @param {string} fileId - Google Drive file ID
     * @param {Object} fileInfo - File information (name, size, mimeType)
     * @returns {Promise<Object>} Parsed metadata
     */
    async parseMetadata(fileId, fileInfo) {
        const { name, size, mimeType } = fileInfo;

        console.log(`[Metadata] Parsing ${name} (${size} bytes, ${mimeType})`);

        try {
            // Download both header and footer for complete tag extraction
            const { stream, size: downloadedSize } = await this.driveService.downloadMetadataRanges(fileId, size);

            console.log(`[Metadata] Downloaded ${downloadedSize} bytes for parsing`);

            // Parse using music-metadata
            const normalized = normalizeMimeType(mimeType);
            const parsed = await parseStream(stream, { mimeType: normalized }, {
                skipPostHeaders: true,
                skipCovers: false // We want artwork info
            });

            console.log(`[Metadata] Parse complete. Has picture:`, !!parsed.common?.picture?.[0]);

            // Extract and sanitize metadata
            const metadata = this.extractMetadata(parsed, name, mimeType, size);

            // Handle artwork extraction to disk
            const picture = parsed.common?.picture?.[0];
            if (picture) {
                console.log(`[Metadata] Extracting artwork (${picture.format}, ${picture.data.length} bytes)`);
                try {
                    await this.saveArtwork(fileId, picture);
                    metadata.artwork = true;
                    console.log(`[Metadata] Artwork saved successfully`);
                } catch (artError) {
                    console.error(`[Metadata] Failed to save artwork:`, artError.message);
                    metadata.artwork = false;
                }
            } else {
                console.log(`[Metadata] No embedded artwork found`);
                metadata.artwork = false;
            }

            console.log(`[Metadata] Successfully parsed ${fileId}:`, {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album
            });

            return metadata;
        } catch (error) {
            console.error(`[Metadata] Parse error for ${fileId}:`, error.message);

            // Apply fallbacks using filename only
            return this.applyFilenameFallbacks(name, mimeType, size);
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
        const title = sanitizeString(common.title)
            || parseFilename(filename)
            || "Unknown Title";

        const artist = sanitizeString(common.artist)
            || sanitizeString(common.albumartist)
            || parseArtistFromFilename(filename)
            || "Unknown Artist";

        const album = sanitizeString(common.album)
            || "Unknown Album";

        const duration = sanitizeDuration(format.duration || 0);

        // Check if artwork exists
        const hasArtwork = common.picture && common.picture.length > 0;

        return {
            title,
            artist,
            album,
            duration,
            artwork: hasArtwork,
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
