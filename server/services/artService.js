const LibraryService = require('./libraryService');
const axios = require('axios');

class ArtService {
    constructor() {
        // Deezer integration removed as per user request
    }

    /**
     * Fetch album art URL using iTunes API
     * @param {string} artist
     * @param {string} album
     * @param {string} title
     * @returns {Promise<string|null>} Artwork URL
     */
    async fetchAlbumArt(artist, album, title) {
        if (!artist || artist === 'Unknown Artist') return null;

        // Prefer Album search if possible, else Title
        const term = (album && album !== 'Unknown Album') ? `${artist} ${album}` : `${artist} ${title}`;

        try {
            const res = await axios.get('https://itunes.apple.com/search', {
                params: { term, entity: 'musicTrack', limit: 1 },
                timeout: 5000
            });

            if (res.data?.results?.length > 0) {
                const track = res.data.results[0];
                // Replace 100x100 with 600x600 for HD
                return track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : null;
            }
        } catch (e) {
            console.warn(`[ArtService] iTunes fetch failed for "${term}":`, e.message);
        }
        return null;
    }

    /**
     * Process a batch of files to find missing art
     * Optimized with Album-Level Deduplication
     * @param {Array} files
     */
    async enrichMissingArt(files) {
        // Disabled by user request: Do not fetch art from iTunes or externally
        // Ensure the app only uses pre-existing embedded album art.
        return;
    }
}

module.exports = new ArtService();
