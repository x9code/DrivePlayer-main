import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useLibrary(token) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [currentFolderName, setCurrentFolderName] = useState('Library');
    const [likedSongs, setLikedSongs] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [playCounts, setPlayCounts] = useState(() => {
        const saved = localStorage.getItem('driveplayer_playcounts');
        try {
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const rootFolderId = useRef(null);
    const fileCache = useRef({});
    const scrollPositions = useRef({});

    useEffect(() => {
        localStorage.setItem('driveplayer_playcounts', JSON.stringify(playCounts));
    }, [playCounts]);

    const refreshFavorites = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_BASE}/api/favorites`);
            setLikedSongs(res.data);
        } catch (e) { console.error(e); }
    }, [token]);

    const refreshPlaylists = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_BASE}/api/playlists`);
            setPlaylists(res.data);
        } catch (e) { console.error(e); }
    }, [token]);

    useEffect(() => {
        refreshFavorites();
        refreshPlaylists();
    }, [refreshFavorites, refreshPlaylists]);

    const fetchFiles = useCallback(async (folderId = null) => {
        const cacheKey = folderId || 'root';

        if (fileCache.current[cacheKey]) {
            setFiles(fileCache.current[cacheKey].files);
            setCurrentFolderName(fileCache.current[cacheKey].folderName);
            setLoading(false);
            return;
        }

        if (folderId === 'favorites') {
            setFiles(likedSongs);
            setCurrentFolderName('Favorites');
            setLoading(false);
            return;
        }

        // Special Case: Playlists [NEW]
        const playlist = playlists.find(p => p.id === String(folderId));
        if (playlist) {
            setFiles([]);
            setCurrentFolderName(playlist.name);
            setLoading(false);
            return;
        }

        // Special Case: Charts [NEW]
        if (folderId === 'charts') {
            setLoading(true);
            try {
                let root = rootFolderId.current;
                if (!root) {
                    const rootRes = await axios.get(`${API_BASE}/api/files`);
                    root = rootRes.data.folderId;
                    rootFolderId.current = root;
                }
                const res = await axios.get(`${API_BASE}/api/files/recursive?folderId=${root}`);
                const songs = res.data.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
                songs.sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0));
                setFiles(songs.slice(0, 20));
                setCurrentFolderName('Top 20 Charts');
            } catch (error) {
                console.error("Charts fetch error", error);
            } finally {
                setLoading(false);
            }
            return;
        }

        // Special Case: Library Views [NEW]
        if (folderId && folderId.startsWith('lib:')) {
            setLoading(true);
            try {
                let root = rootFolderId.current;
                if (!root) {
                    const rootRes = await axios.get(`${API_BASE}/api/files`);
                    root = rootRes.data.folderId;
                    rootFolderId.current = root;
                }
                const res = await axios.get(`${API_BASE}/api/files/recursive?folderId=${root}`);
                const allFiles = res.data.files;

                if (folderId === 'lib:songs') {
                    setCurrentFolderName('All Songs');
                    setFiles(allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'));
                } else if (folderId === 'lib:albums') {
                    setCurrentFolderName('Albums');
                    setFiles(allFiles);
                } else if (folderId === 'lib:artists') {
                    setCurrentFolderName('Artists');
                    setFiles(allFiles);
                } else if (folderId.startsWith('lib:artist:')) {
                    const artistName = decodeURIComponent(folderId.substring('lib:artist:'.length));
                    setCurrentFolderName(artistName);
                    setFiles(allFiles.filter(f => {
                        if (!f.artist) return false;
                        if (f.artist === artistName) return true;
                        const artists = f.artist.split(/[,\/]|\s+feat\.?\s+|\s+ft\.?\s+|\s+&\s+/i).map(a => a.trim());
                        return artists.includes(artistName);
                    }));
                } else if (folderId.startsWith('lib:album:')) {
                    const albumData = folderId.split(':');
                    const album = decodeURIComponent(albumData[2]);
                    setCurrentFolderName(album);
                    setFiles(allFiles.filter(f => (f.album || "Unknown Album") === album));
                }
            } catch (error) {
                console.error("Library fetch error:", error);
            } finally {
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        try {
            const url = folderId ? `${API_BASE}/api/files?folderId=${folderId}` : `${API_BASE}/api/files`;
            const res = await axios.get(url);
            const fetchedFiles = res.data.files || [];
            setFiles(fetchedFiles);
            setCurrentFolderName(res.data.folderName || 'Library');

            if (!folderId && res.data.folderId) {
                rootFolderId.current = res.data.folderId;
                setCurrentFolderId(res.data.folderId);
            }
            fileCache.current[cacheKey] = { files: fetchedFiles, folderName: res.data.folderName || 'Library' };
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [likedSongs, playlists, playCounts]);

    useEffect(() => {
        // Handle PopState (Back Button)
        const handlePopState = (event) => {
            const state = event.state;
            if (state && state.folderId) {
                if (state.folderId === 'favorites') {
                    setCurrentFolderId('favorites');
                    setFiles(likedSongs);
                    setCurrentFolderName('Favorites');
                    setLoading(false);
                } else if (state.folderId === 'charts') {
                    setCurrentFolderId('charts');
                    fetchFiles('charts');
                } else {
                    setCurrentFolderId(state.folderId);
                    fetchFiles(state.folderId);
                }
            } else if (state && state.folderId === 'profile') {
                setCurrentFolderId('profile');
                setCurrentFolderName('Profile');
                setLoading(false);
            } else {
                setCurrentFolderId(null);
                fetchFiles(null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [likedSongs, fetchFiles]);

    useEffect(() => {
        // Initial Fetch
        const params = new URLSearchParams(window.location.search);
        const folderId = params.get('folder');
        if (folderId) {
            setCurrentFolderId(folderId);
            fetchFiles(folderId);
        } else {
            fetchFiles();
        }
    }, []);

    const searchFiles = useCallback(async (query) => {
        if (!query.trim()) {
            fetchFiles(currentFolderId);
            return;
        }
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
            setFiles(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [currentFolderId, fetchFiles]);

    return {
        files, loading, currentFolderId, currentFolderName,
        likedSongs, playlists, playCounts,
        setCurrentFolderId, setCurrentFolderName, setFiles, setLoading,
        fetchFiles, searchFiles, refreshPlaylists, setLikedSongs,
        rootFolderId, scrollPositions // Adding these for completeness
    };
}
