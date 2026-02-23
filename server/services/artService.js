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
        // Only process audio files
        const audioFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        if (audioFiles.length === 0) return;

        console.log(`[ArtService] Checking ${audioFiles.length} files for art enrichment...`);
        let updated = 0;
        let propagated = 0;
        let onlineFound = 0;

        // 1. Group by Album (Key: "Artist - Album")
        const albumGroups = {};
        const singles = [];

        for (const file of audioFiles) {
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

        // 2. Process Albums
        for (const [key, group] of Object.entries(albumGroups)) {
            // Check if ANY file in this group has artwork (Local)
            const existingArtFile = group.find(f => f.picture && !f.picture.includes('googleusercontent.com'));
            const lowResArtFile = group.find(f => f.picture || f.thumbnailLink);

            let artUrl = null;

            if (existingArtFile) {
                artUrl = existingArtFile.picture;
            } else if (lowResArtFile) {
                artUrl = lowResArtFile.picture || lowResArtFile.thumbnailLink;
            }

            // [NEW] If NO local art found, try iTunes for the group
            if (!artUrl) {
                const first = group[0];
                artUrl = await this.fetchAlbumArt(first.artist, first.album, first.title);
                if (artUrl) onlineFound++;
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
            }
        }

        // 3. Process Singles (Unknown Album)
        for (const file of singles) {
            if (!file.picture) {
                const artUrl = await this.fetchAlbumArt(file.artist, null, file.title || file.name);
                if (artUrl) {
                    file.picture = artUrl;
                    await LibraryService.updateField(file.id, 'picture', artUrl);
                    updated++;
                    onlineFound++;
                }
            }
        }

        console.log(`[ArtService] Batch Complete. Updated: ${updated} (Online Found: ${onlineFound}), Propagated: ${propagated}`);
    }
}

module.exports = new ArtService();
