const axios = require('axios');
const LibraryService = require('./libraryService');

class ArtService {
    constructor() {
        this.DEEZER_API = 'https://api.deezer.com/search';
        this.cache = new Map(); // Simple in-memory cache for this session
    }

    /**
     * Fetch album art URL using Deezer API
     * Strategies:
     * 1. Artist + Album
     * 1. Strict Search (artist:"..." album:"...")
     * 2. Loose Search (q="..." fallback)
     * 3. Artist Cleaning (Handle "feat.", "&", etc.)
     * @param {string} artist 
     * @param {string} album 
     * @param {string} title 
     * @returns {Promise<string|null>} URL or null
     */
    async fetchAlbumArt(artist, album, title) {
        if (!artist) return null;

        // Cleanup inputs
        let cleanArtist = artist.replace(/unknown artist/i, '').trim();
        let cleanAlbum = album ? album.replace(/unknown album/i, '').trim() : '';
        const cleanTitle = title ? title.replace(/unknown title/i, '').trim() : '';

        // Advanced Artist Cleaning: "Kygo & Ava Max" -> "Kygo"
        // Split by common separators and take the first part
        const separators = [' & ', ' x ', ' feat. ', ' ft. ', ' featuring ', ';', ','];
        let primaryArtist = cleanArtist;
        for (const sep of separators) {
            if (primaryArtist.toLowerCase().includes(sep)) {
                primaryArtist = primaryArtist.split(new RegExp(sep, 'i'))[0].trim();
                break;
            }
        }

        // Clean Album: Remove things like "(Original Score...)" if it's too long or complex? 
        // For now, keep it simple but maybe remove [Deluxe] etc? 
        // Let's stick to the raw album for strict search first.

        if (!cleanArtist) return null;

        const useAlbum = !!cleanAlbum;
        const useTitle = !useAlbum && !!cleanTitle;

        if (!useAlbum && !useTitle) {
            console.log(`[ArtService] Skipping: Not enough info (Artist: "${cleanArtist}")`);
            return null;
        }

        const key = useAlbum
            ? `album:${cleanArtist}-${cleanAlbum}`.toLowerCase()
            : `song:${cleanArtist}-${cleanTitle}`.toLowerCase();

        if (this.cache.has(key)) {
            // console.log(`[ArtService] Cache hit for: ${key}`);
            return this.cache.get(key);
        }

        console.log(`[ArtService] Fetching from Deezer: ${primaryArtist} - ${useAlbum ? cleanAlbum : cleanTitle}`);

        const makeRequest = async (query) => {
            try {
                const response = await axios.get(this.DEEZER_API, {
                    params: { q: query, limit: 1 },
                    timeout: 10000
                });

                if (response.data.data && response.data.data.length > 0) {
                    const item = response.data.data[0];
                    return item.album ? (item.album.cover_xl || item.album.cover_big || item.album.cover_medium) : null;
                }
            } catch (error) {
                if (error.response && (error.response.status === 429 || error.response.status === 403)) throw error;
                if (error.code !== 'ECONNABORTED') console.error(`[ArtService] Error:`, error.message);
            }
            return null;
        };

        try {
            // Strategy 1: Strict Search with Primary Artist
            let query = `artist:"${primaryArtist}"`;
            if (useAlbum) {
                query += ` album:"${cleanAlbum}"`;
            } else {
                query += ` track:"${cleanTitle}"`;
            }

            let artUrl = await makeRequest(query);

            // Strategy 2: Loose Search (Fallback)
            // If strict failed, try a general query "Kygo Whatever"
            if (!artUrl) {
                console.log(`[ArtService] Strict search failed. Trying loose search...`);
                const looseQuery = `${primaryArtist} ${useAlbum ? cleanAlbum : cleanTitle}`;
                artUrl = await makeRequest(looseQuery);
            }

            // Strategy 3: Album Only Search (Last Resort)
            // The user requested to prioritize finding the album art, even if artist doesn't match perfectly.
            if (!artUrl && useAlbum && cleanAlbum.length > 3) {
                console.log(`[ArtService] Loose search failed. Trying Album-only search for: "${cleanAlbum}"`);
                artUrl = await makeRequest(`album:"${cleanAlbum}"`);
            }

            if (artUrl) {
                console.log(`[ArtService] Found artwork: ${artUrl}`);
                this.cache.set(key, artUrl);
                return artUrl;
            } else {
                console.log(`[ArtService] No results found on Deezer.`);
            }

        } catch (error) {
            if (error.response && (error.response.status === 429 || error.response.status === 403)) {
                throw error;
            }
        }

        this.cache.set(key, null);
        return null;
    }

    /**
     * Process a batch of files to find missing art
     * Optimized with Album-Level Deduplication
     * (To be called by MetadataService or SyncService)
     */
    async enrichMissingArt(files) {
        console.log(`[ArtService] Checking ${files.length} files for art enrichment...`);
        let updated = 0;
        let skipped = 0;
        let apiCalls = 0;
        let propagated = 0;

        // 1. Group by Album (Key: "Artist - Album")
        const albumGroups = {};
        const singles = [];

        for (const file of files) {
            // Skip if file already has art (unless we want to propagate it?)
            // We include files WITH art in the group so we can use them as source!

            const hasArtist = !!file.artist && file.artist !== 'Unknown Artist';
            const hasAlbum = !!file.album && file.album !== 'Unknown Album';

            if (hasArtist && hasAlbum) {
                const key = `${file.artist} - ${file.album}`.toLowerCase();
                if (!albumGroups[key]) albumGroups[key] = [];
                albumGroups[key].push(file);
            } else {
                singles.push(file);
            }
        }

        console.log(`[ArtService] Grouped into ${Object.keys(albumGroups).length} albums and ${singles.length} singles/unknowns.`);

        // 2. Process Albums
        for (const [key, group] of Object.entries(albumGroups)) {
            // Checks if ANY file in this group has artwork
            const existingArtFile = group.find(f => f.picture && !f.picture.includes('googleusercontent.com')); // Prefer high-res
            const lowResArtFile = group.find(f => f.picture || f.thumbnailLink); // Fallback

            let artUrl = null;

            if (existingArtFile) {
                artUrl = existingArtFile.picture;
                // console.log(`[ArtService] Found valid art in group for "${key}". Propagating...`);
            } else if (lowResArtFile) {
                // We have low res, but maybe we want to upgrade it?
                // For now, let's treat it as "needs fetch" if we are in strict upgrade mode, 
                // but user asked to be strict about NOT overwriting if exists.
                // So we respect it.
                artUrl = lowResArtFile.picture || lowResArtFile.thumbnailLink;
            }

            // If no art found in group, we fetch ONCE
            if (!artUrl) {
                // Find a representative file to search with
                const rep = group[0];
                try {
                    // console.log(`[ArtService] Fetching art for album: "${key}"`);
                    // Rate Limit Sleep
                    await new Promise(r => setTimeout(r, 1000));

                    artUrl = await this.fetchAlbumArt(rep.artist, rep.album, rep.title);
                    apiCalls++;
                } catch (error) {
                    console.error(`[ArtService] Album fetch error: ${error.message}`);
                }
            }

            // Apply to ALL missing in group
            if (artUrl) {
                for (const file of group) {
                    if (!file.picture) {
                        file.picture = artUrl;
                        await LibraryService.updateField(file.id, 'picture', artUrl);
                        updated++;
                        propagated++;
                    }
                }
            } else {
                skipped += group.filter(f => !f.picture).length;
            }
        }

        // 3. Process Singles (Old Logic)
        for (const file of singles) {
            if (file.picture || file.thumbnailLink) {
                skipped++;
                continue;
            }

            const hasArtist = !!file.artist && file.artist !== 'Unknown Artist';
            const hasTitle = !!file.title && file.title !== 'Unknown Title';

            if (hasArtist && hasTitle) {
                await new Promise(r => setTimeout(r, 1000));
                try {
                    const artUrl = await this.fetchAlbumArt(file.artist, null, file.title);
                    apiCalls++;
                    if (artUrl) {
                        file.picture = artUrl;
                        await LibraryService.updateField(file.id, 'picture', artUrl);
                        updated++;
                    } else {
                        skipped++;
                    }
                } catch (e) { skipped++; }
            } else {
                skipped++;
            }
        }

        console.log(`[ArtService] Batch Complete. Updated: ${updated} (Propagated: ${propagated}), Skipped: ${skipped}, API Calls: ${apiCalls}`);
    }
}

module.exports = new ArtService();
