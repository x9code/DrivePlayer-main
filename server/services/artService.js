const LibraryService = require('./libraryService');

class ArtService {
    constructor() {
        // Deezer integration removed as per user request
    }

    /**
     * Fetch album art URL using Deezer API
     * @deprecated Integration removed
     * @returns {Promise<string|null>} Always returns null
     */
    async fetchAlbumArt(artist, album, title) {
        return null;
    }

    /**
     * Process a batch of files to find missing art
     * Optimized with Album-Level Deduplication
     * Only propagates existing local art, does NOT fetch from external APIs.
     * (To be called by MetadataService or SyncService)
     */
    async enrichMissingArt(files) {
        console.log(`[ArtService] Checking ${files.length} files for art enrichment (Local Propagation Only)...`);
        let updated = 0;
        let skipped = 0;
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
                // We have low res, use it to fill gaps
                artUrl = lowResArtFile.picture || lowResArtFile.thumbnailLink;
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

        console.log(`[ArtService] Batch Complete. Updated: ${updated} (Propagated: ${propagated}), Skipped: ${skipped + singles.length}`);
    }
}

module.exports = new ArtService();
