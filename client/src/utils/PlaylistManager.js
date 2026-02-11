/**
 * PlaylistManager.js
 * Helper utility to manage playlists in localStorage.
 * 
 * Data Structure:
 * key: 'driveplayer_playlists'
 * value: [
 *   {
 *     id: string (UUID),
 *     name: string,
 *     created: number (timestamp),
 *     songs: [ ...songObjects ]
 *   }
 * ]
 */

const STORAGE_KEY = 'driveplayer_playlists';

export const PlaylistManager = {
    getAll: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Failed to load playlists", e);
            return [];
        }
    },

    saveAll: (playlists) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
        } catch (e) {
            console.error("Failed to save playlists", e);
        }
    },

    create: (name) => {
        const playlists = PlaylistManager.getAll();
        const newPlaylist = {
            id: crypto.randomUUID(),
            name: name.trim() || 'Untitled Playlist',
            created: Date.now(),
            songs: []
        };
        playlists.push(newPlaylist);
        PlaylistManager.saveAll(playlists);
        return newPlaylist;
    },

    delete: (id) => {
        const playlists = PlaylistManager.getAll();
        const filtered = playlists.filter(p => p.id !== id);
        PlaylistManager.saveAll(filtered);
        return filtered;
    },

    addSong: (playlistId, song) => {
        const playlists = PlaylistManager.getAll();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            // Check for duplicates? For now, allow key-based dedup if needed, 
            // but users might want same song twice. Let's allow it or dedupe by ID.
            // Let's dedupe by ID to be clean for now.
            if (!playlist.songs.find(s => s.id === song.id)) {
                playlist.songs.push(song);
                PlaylistManager.saveAll(playlists);
            }
        }
        return playlists;
    },

    removeSong: (playlistId, songId) => {
        const playlists = PlaylistManager.getAll();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            playlist.songs = playlist.songs.filter(s => s.id !== songId);
            PlaylistManager.saveAll(playlists);
        }
        return playlists;
    },

    rename: (id, newName) => {
        const playlists = PlaylistManager.getAll();
        const playlist = playlists.find(p => p.id === id);
        if (playlist) {
            playlist.name = newName.trim();
            PlaylistManager.saveAll(playlists);
        }
        return playlists;
    }
};
