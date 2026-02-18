import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { Analytics } from "@vercel/analytics/react"
import axios from 'axios'
import Player from './components/Player'
import SongList from './components/SongList'
import { IoSearchOutline, IoCloseOutline, IoHeart, IoHeartOutline, IoSettingsOutline, IoArrowBack, IoFilterOutline, IoChevronDown, IoChevronUp, IoPlay, IoLibrary, IoCloudDownloadOutline, IoGridOutline, IoListOutline } from 'react-icons/io5'
import SettingsModal from './components/SettingsModal'
import AddToPlaylistModal from './components/AddToPlaylistModal'

import LibraryModal from './components/LibraryModal'
import Sidebar from './components/Sidebar' // [NEW]
import { PlaylistManager } from './utils/PlaylistManager' // [NEW]
import ConfirmModal from './components/ConfirmModal'
import { AlbumGrid, ArtistGrid } from './components/LibraryViews'

import { cleanTitle } from './utils/format';
import ProfileScreen from './components/ProfileScreen'; // [NEW]

import { AuthProvider, useAuth } from './context/AuthContext'; // [NEW]
import AuthScreen from './components/AuthScreen'; // [NEW]

// Environment variable for API URL (Production vs Dev)
const API_BASE = import.meta.env.VITE_API_URL || '';

function AppContent() {
  const { user, token, logout, loading: authLoading } = useAuth(); // [NEW] Auth Hook



  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [currentFolderName, setCurrentFolderName] = useState('Library'); // Default title
  const rootFolderId = useRef(null); // Track root folder ID to hide back button
  const mainScrollRef = useRef(null); // Ref for main scroll container
  // --- Queue System ---
  const [queue, setQueue] = useState([]);

  // Favorites State (Now fetched from API)
  const [likedSongs, setLikedSongs] = useState([]);

  // Fetch Favorites on Auth
  useEffect(() => {
    if (user) {
      axios.get(`${API_BASE}/api/favorites`).then(res => setLikedSongs(res.data)).catch(console.error);
    }
  }, [user]);

  // Playlist State [NEW]
  const [playlists, setPlaylists] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Play Counts State (Persisted in localStorage)
  const [playCounts, setPlayCounts] = useState(() => {
    const saved = localStorage.getItem('driveplayer_playcounts');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to parse play counts", e);
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('driveplayer_playcounts', JSON.stringify(playCounts));
  }, [playCounts]);

  const refreshPlaylists = useCallback(() => {
    if (user) {
      axios.get(`${API_BASE}/api/playlists`).then(res => setPlaylists(res.data)).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    refreshPlaylists();
  }, [refreshPlaylists]);

  const handleCreatePlaylist = async (name) => {
    try {
      await axios.post(`${API_BASE}/api/playlists`, { id: Date.now().toString(), name });
      refreshPlaylists();
    } catch (e) { console.error(e); }
  };

  const handleDeletePlaylist = (e, id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Playlist?',
      message: 'This action cannot be undone. Are you sure you want to delete this playlist?',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_BASE}/api/playlists/${id}`);
          refreshPlaylists();
          if (currentFolderId === id) handleGoHome();
        } catch (e) { console.error(e); }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleGoHome = () => {
    setSearchQuery('');
    setIsSearching(false);
    setCurrentFolderId(null);
    setCurrentFolderName('Library');
    fetchFiles(null);
    window.history.pushState({}, '', '/');
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
  };

  // Nav helper for Sidebar
  const handleSidebarNavigate = (id) => {
    if (id === null) {
      handleGoHome();
    } else if (id === 'favorites') {
      // Manually trigger favorite view logic
      setSearchQuery('');
      setIsSearching(false);
      setCurrentFolderId('favorites');
      setFiles(likedSongs);
      setCurrentFolderName('Favorites');
      loading && setLoading(false); // Ensure loading is off
      window.history.pushState({ folderId: 'favorites' }, '', '?folder=favorites');
    } else if (id === 'charts') {
      // Charts View
      setSearchQuery('');
      setIsSearching(false);
      setCurrentFolderId('charts');
      // Fetch and sort logic is inside fetchFiles or handled here
      fetchFiles('charts');
      setCurrentFolderName('Top 20 Charts');
      setCurrentFolderName('Top 20 Charts');
      window.history.pushState({ folderId: 'charts' }, '', '?folder=charts');
    } else if (id === 'profile') {
      // Profile View
      setSearchQuery('');
      setIsSearching(false);
      setCurrentFolderId('profile');
      setCurrentFolderName('Profile');
      loading && setLoading(false);
      window.history.pushState({ folderId: 'profile' }, '', '?folder=profile');
    } else if (id.startsWith('lib:')) {
      // Library routes (Songs, Albums, Artists)
      handleFolderClick(id);
    } else {
      // Playlist
      const playlist = playlists.find(p => p.id === String(id)); // Ensure string comparison
      if (playlist) {
        setSearchQuery('');
        setIsSearching(false);
        setCurrentFolderId(id);
        setFiles(playlist.songs || []);
        setCurrentFolderName(playlist.name);
        setLoading(false);
        window.history.pushState({ folderId: id }, '', `?folder=${id}`);
      }
    }
  };

  // Theme State
  const [themeColor, setThemeColor] = useState('224, 133, 224'); // Default Pink-Lavender

  useEffect(() => {
    // Apply theme to CSS variable
    document.documentElement.style.setProperty('--theme-color', themeColor);
  }, [themeColor]);

  // Gradient Background State
  const [gradientEnabled, setGradientEnabled] = useState(() => {
    return localStorage.getItem('driveplayer_gradient') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('driveplayer_gradient', gradientEnabled);
  }, [gradientEnabled]);



  // Mobile Detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Extract Vibrant Color from Album Art
  useEffect(() => {
    if (!currentSong) {
      setThemeColor('224, 133, 224');
      return;
    }

    // Debounce to improve performance on rapid skips
    const timer = setTimeout(() => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = `${API_BASE}/api/thumbnail/${currentSong.id}`;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 10;
          canvas.height = 10;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 10, 10);

          const imageData = ctx.getImageData(0, 0, 10, 10).data;
          let maxScore = -1;
          let bestR = 29, bestG = 185, bestB = 84;

          for (let i = 0; i < imageData.length; i += 4) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];

            // Calculate HSL components
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const l = (max + min) / 2 / 255;
            const delta = max - min;
            const s = (max === min) ? 0 : delta / (1 - Math.abs(2 * l - 1));

            // Score: Favor Saturation, penalize extremely dark/light pixels
            // We want l between 0.15 and 0.9 (avoid pitch black and pure white)
            if (l < 0.15 || l > 0.9) continue;

            const score = s * 10; // Prioritize saturation heavily

            if (score > maxScore) {
              maxScore = score;
              bestR = r;
              bestG = g;
              bestB = b;
            }
          }

          // Post-process: Force minimum brightness
          const [finalR, finalG, finalB] = forceBrightColor(bestR, bestG, bestB);
          setThemeColor(`${finalR}, ${finalG}, ${finalB}`);

        } catch (e) {
          console.warn("Color extraction failed", e);
          setThemeColor('224, 133, 224');
        }
      };

      img.onerror = () => {
        setThemeColor('224, 133, 224');
      };
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [currentSong]);

  // Helper: Boost lightness if too dark (RGB -> HSL -> RGB)
  const forceBrightColor = (r, g, b) => {
    // 1. Convert to HSL
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    // 2. Boost Lightness if needed (Ensure at least 50% lightness)
    if (l < 0.5) l = 0.55;

    // 3. Convert back to RGB
    let r1, g1, b1;
    if (s === 0) {
      r1 = g1 = b1 = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r1 = hue2rgb(p, q, h + 1 / 3);
      g1 = hue2rgb(p, q, h);
      b1 = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r1 * 255), Math.round(g1 * 255), Math.round(b1 * 255)];
  };

  const toggleLike = async (song) => {
    if (!song) return;
    const exists = (likedSongs || []).find(s => s.id === song.id);

    // Optimistic Update
    setLikedSongs(prev => exists ? prev.filter(s => s.id !== song.id) : [...prev, song]);

    try {
      if (exists) {
        await axios.delete(`${API_BASE}/api/favorites/${song.id}`);
      } else {
        await axios.post(`${API_BASE}/api/favorites/${song.id}`);
      }
    } catch (e) {
      console.error("Failed to toggle like", e);
      // Revert on failure (could improve this)
    }
  };

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0: Off, 1: All, 2: One
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [songToAdd, setSongToAdd] = useState(null);
  // showSortMenu moved to Sorting State section



  // Sorting State
  const [sortOption, setSortOption] = useState('name'); // 'name', 'date', 'size'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);

  // View Mode State (Grid/List)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('driveplayer_view_mode') || 'grid');

  useEffect(() => {
    localStorage.setItem('driveplayer_view_mode', viewMode);
  }, [viewMode]);

  const searchTimeout = useRef(null);
  const fileCache = useRef({}); // Cache for folder contents
  const scrollPositions = useRef({}); // Track scroll positions by folder ID

  // Sorting Logic
  const sortedFiles = useMemo(() => {
    if (!files || !Array.isArray(files)) return [];
    // 1. Separate folders and files
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    let songs = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // 2. Sort Songs
    songs.sort((a, b) => {
      let valA, valB;

      switch (sortOption) {
        case 'date':
          valA = new Date(a.createdTime || 0).getTime();
          valB = new Date(b.createdTime || 0).getTime();
          break;
        case 'size':
          valA = parseInt(a.size || 0);
          valB = parseInt(b.size || 0);
          break;
        case 'name':
        default:
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // 3. Return combined (Folders always first)
    return [...folders, ...songs];
  }, [files, sortOption, sortDirection]);

  // --- Title Cleaning Logic ---

  const TITLE_SUFFIXES = useMemo(() => ['remix', 'mix', 'live', 'edit', 'version', 'ver', 'cover', 'official', 'video', 'audio', 'lyrics', 'remastered', 'instrumental'], []);

  // Helper: Find common terms (likely Artists) to help parsing
  const getCommonArtistTerms = useMemo(() => {
    const songs = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    const termCounts = {};
    const threshold = 2;

    songs.forEach(s => {
      const name = s.name.replace(/\.[^/.]+$/, "").replace(/^\d+[\.\-\s]+/, "");
      const parts = name.split(' - ').map(p => p.trim());
      parts.forEach(p => {
        // Exclude terms that are actually suffixes/tags
        const lowerP = p.toLowerCase();
        const isSuffix = TITLE_SUFFIXES.some(suffix => lowerP.includes(suffix));

        if (p.length > 2 && !/^\d+$/.test(p) && !isSuffix) {
          termCounts[p] = (termCounts[p] || 0) + 1;
        }
      });
    });

    const common = new Set();
    Object.entries(termCounts).forEach(([term, count]) => {
      if (count >= threshold) common.add(term.toLowerCase());
    });
    return common;
  }, [sortedFiles, TITLE_SUFFIXES]);

  const cleanTitleCallback = useCallback((fileName) => {
    return cleanTitle(fileName, getCommonArtistTerms);
  }, [getCommonArtistTerms]);

  // Fetch files (songs + folders)
  const fetchFiles = async (folderId = null) => {
    const cacheKey = folderId || 'root';

    // Scroll saving moved to handleFolderClick/navigation events

    // 1. Check Cache
    if (fileCache.current[cacheKey]) {

      setFiles(fileCache.current[cacheKey].files);
      setCurrentFolderName(fileCache.current[cacheKey].folderName);
      setLoading(false);
      return;
    }

    // Special Case: Favorites
    if (folderId === 'favorites') {
      setFiles(likedSongs);
      setCurrentFolderName('Favorites');
      setLoading(false);
      return;
    }

    // Special Case: Playlists [NEW]
    const playlist = playlists.find(p => p.id === String(folderId));
    if (playlist) {
      // Fetch songs for this playlist (TODO: Backend endpoint for playlist songs)
      // For now, if we don't have a backend endpoint returning songs with the playlist, 
      // we might need to change how we fetch.
      // Assuming GET /api/playlists returns metadata, we need to fetch items.
      // Let's assume for now we don't have song list in 'playlists' state efficiently yet.
      // We'll rely on a future update to fetch playlist contents.
      // TEMPORARY: Just clear or show empty until we implement GET /api/playlists/:id
      setFiles([]);
      setCurrentFolderName(playlist.name);
      setLoading(false);
      return;
    }

    // Special Case: Charts [NEW]
    if (folderId === 'charts') {
      setLoading(true);
      try {
        // Ensure we have root ID or just fetch all recursive
        let root = rootFolderId.current;
        if (!root) {
          const rootRes = await axios.get(`${API_BASE}/api/files`);
          root = rootRes.data.folderId;
          rootFolderId.current = root;
        }

        const res = await axios.get(`${API_BASE}/api/files/recursive?folderId=${root}`);
        let allFiles = res.data.files;

        // Filter songs
        const songs = allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        // Sort by Play Count (Descending)
        songs.sort((a, b) => {
          const countA = playCounts[a.id] || 0;
          const countB = playCounts[b.id] || 0;
          return countB - countA;
        });

        // Top 20
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
        // Ensure we have root ID
        let root = rootFolderId.current;
        if (!root) {
          // Quick fetch to get root ID if missing
          const rootRes = await axios.get(`${API_BASE}/api/files`);
          root = rootRes.data.folderId;
          rootFolderId.current = root;
        }

        // Always fetch all files recursively for library views
        // TODO: Cache this response specifically for library?
        const res = await axios.get(`${API_BASE}/api/files/recursive?folderId=${root}`);
        let allFiles = res.data.files;
        // Filter out folders from the song list perspectives
        // (Albums view might use them, but our current AlbumGrid uses file.album metadata string)

        if (folderId === 'lib:songs') {
          setCurrentFolderName('All Songs');
          setFiles(allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'));
        } else if (folderId === 'lib:albums') {
          setCurrentFolderName('Albums');
          setFiles(allFiles); // Pass all, Grid handles grouping
        } else if (folderId === 'lib:artists') {
          setCurrentFolderName('Artists');
          setFiles(allFiles);
        } else if (folderId.startsWith('lib:artist:')) {
          const artistName = decodeURIComponent(folderId.substring('lib:artist:'.length));
          setCurrentFolderName(artistName);
          // Filter by artist - Handle multi-artist strings
          setFiles(allFiles.filter(f => {
            if (!f.artist) return false;
            // Check if exact match OR if it's one of the split artists
            if (f.artist === artistName) return true;

            const artists = f.artist
              .split(/[;,\/]|\s+feat\.?\s+|\s+ft\.?\s+|\s+&\s+/i)
              .map(a => a.trim());
            return artists.includes(artistName);
          }));
        } else if (folderId.startsWith('lib:album:')) {
          const album = decodeURIComponent(folderId.split(':')[2]);
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
      const url = folderId
        ? `${API_BASE}/api/files?folderId=${folderId}`
        : `${API_BASE}/api/files`;

      const res = await axios.get(url);
      setFiles(res.data.files || []);
      setCurrentFolderName(res.data.folderName || 'Library');

      // 2. Update Cache
      fileCache.current[cacheKey] = { files: res.data.files, folderName: res.data.folderName || 'Library' };

      // Update current folder id if not set (initial load)
      if (!folderId && res.data.folderId) {
        if (!rootFolderId.current) {
          rootFolderId.current = res.data.folderId;
        }
        setCurrentFolderId(res.data.folderId);
        // Also cache under the actual ID for future reference
        fileCache.current[res.data.folderId] = { files: res.data.files, folderName: res.data.folderName || 'Library' };
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  // Search function
  const searchFiles = async (query) => {
    if (!query.trim()) {
      setIsSearching(false);
      fetchFiles(currentFolderId);
      return;
    }

    setLoading(true);
    setIsSearching(true);
    try {
      const res = await axios.get(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
      setFiles(res.data || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      searchFiles(q);
    }, 500);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    fetchFiles(currentFolderId);
  };

  useEffect(() => {
    // Check URL params on load
    const params = new URLSearchParams(window.location.search);
    const folderId = params.get('folder');



    if (folderId) {
      setCurrentFolderId(folderId);
      fetchFiles(folderId);
    } else {
      fetchFiles();
    }
  }, []);
  // Disable browser's automatic scroll restoration - REMOVED to let browser handle history
  // useEffect(() => {
  //   if ('scrollRestoration' in window.history) {
  //     window.history.scrollRestoration = 'manual';
  //   }
  // }, []);

  // Handle scroll position on folder change
  useLayoutEffect(() => {
    if (mainScrollRef.current) {
      const scrollContainer = mainScrollRef.current;
      const key = currentFolderId || 'root';
      const savedPosition = scrollPositions.current[key];

      console.log(`[Scroll Restore] Key: ${key}, Saved: ${savedPosition}, Loading: ${loading}`);

      if (savedPosition !== undefined) {
        // Restore saved position
        console.log(`[Scroll Restore] Restoring to ${savedPosition}`);
        scrollContainer.scrollTop = savedPosition;
      } else {
        // No saved position -> Scroll to top ONLY if not loading (prevents jump)
        // If loading, we keep the previous scroll position until new content arrives
        if (!loading) {
          console.log(`[Scroll Restore] No saved position & Loaded. Resetting to 0`);
          scrollContainer.scrollTop = 0;
        }
      }
    }
  }, [currentFolderId, loading]);

  // Helper to save current scroll position
  const saveScrollPosition = () => {
    if (mainScrollRef.current) {
      const key = currentFolderId || 'root';
      const scrollTop = mainScrollRef.current.scrollTop;
      if (scrollTop > 0) {
        console.log(`[Scroll Save] Saving ${scrollTop} for key: ${key}`);
        scrollPositions.current[key] = scrollTop;
      }
    }
  };

  // Handle Browser Back Button (Android Gesture)
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      // We don't save here because the view has likely already changed or about to. 
      // The browser might have already restored scroll if we didn't disable it.

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
          fetchFiles(state.folderId);
        }
      } else if (state && state.folderId === 'profile') {
        setCurrentFolderId('profile');
        setCurrentFolderName('Profile');
        setLoading(false);
      } else {
        // Back to root
        setCurrentFolderId(null);
        fetchFiles(null);
        // Ensure files are reset to root if we were in favorites without a real ID
        if (!state) fetchFiles(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [likedSongs]);

  const handleFolderClick = (folderId) => {
    // Save scroll position BEFORE changing state/view
    saveScrollPosition();

    if (isSearching) {
      setSearchQuery('');
      setIsSearching(false);
    }

    // Show loading immediately for visual feedback
    setLoading(true);

    // Push state so Back button works
    window.history.pushState({ folderId }, '', `?folder=${folderId}`);

    // Internal update
    setCurrentFolderId(folderId);
    fetchFiles(folderId);
  };

  // Reset Scroll on Folder Change
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [files]);

  // Listen for song ended event to auto-play next
  useEffect(() => {
    const handleSongEnded = () => {
      handleNext(true); // Auto advance
    };
    window.addEventListener('audio-ended', handleSongEnded);
    return () => window.removeEventListener('audio-ended', handleSongEnded);
  }, [currentSong, isShuffle, repeatMode, queue]); // queue dependency is important here

  // Track Play Counts
  useEffect(() => {
    if (currentSong && isPlaying) {
      // Simple logic: If a song STARTS playing, count it.
      // Ideally we'd wait for 30s or end, but for simplicity:

      // We use a timeout to ensure it's not just a skip
      const timer = setTimeout(() => {
        setPlayCounts(prev => ({
          ...prev,
          [currentSong.id]: (prev[currentSong.id] || 0) + 1
        }));
      }, 5000); // 5 seconds threshold to count as a play

      return () => clearTimeout(timer);
    }
  }, [currentSong?.id]); // Only trigger on ID change (new song)



  // Handle Play (Single Song Click in Current View)
  const handlePlay = (song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      // Set Queue to current view's songs
      const currentSongs = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      setQueue(currentSongs);

      // Inject clean title if missing (using context-aware cleaner)
      const cleanedTitle = cleanTitleCallback(song.name);
      const songWithTitle = {
        ...song,
        title: song.title || cleanedTitle
      };

      setCurrentSong(songWithTitle);
      setIsPlaying(true);
    }
  };

  // Handle Folder Play (Background Queue)
  const handleFolderPlay = async (folderId) => {
    // 1. Fetch files specifically for this folder
    // Note: We do NOT navigate (pushState/setCurrentFolderId)
    // We do NOT setFiles (so view stays same)

    try {
      const url = `${API_BASE}/api/files/recursive?folderId=${folderId}`;
      const res = await axios.get(url);

      const fetchedFiles = res.data.files;
      // Filter for songs (already filtered by backend, but safe to keep)
      const songList = fetchedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

      if (songList.length > 0) {
        // 2. Set Queue & Start Shuffle Play
        setQueue(songList);
        setIsShuffle(true);

        const randomIndex = Math.floor(Math.random() * songList.length);
        const randomSong = songList[randomIndex];
        // Inject clean title
        setCurrentSong({ ...randomSong, title: randomSong.title || cleanTitleCallback(randomSong.name) });
        setIsPlaying(true);
      } else {
        alert("No audio files found in this folder.");
      }
    } catch (error) {
      console.error("Error fetching folder for playback:", error);
    }
  };

  const handleBack = () => {
    if (isSearching) {
      clearSearch();
      return;
    }
    // Trigger browser back, which triggers 'popstate' listener above
    window.history.back();
  };


  const handleNext = (auto = false) => {
    if (!currentSong) return;

    // Use QUEUE if available, otherwise fallback to sortedFiles (legacy/safety)
    const activeList = queue.length > 0 ? queue : sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    if (activeList.length === 0) return;

    // Repeat One logic
    if (repeatMode === 2 && auto) {
      // Re-find current song to be safe
      const currentIndex = activeList.findIndex(s => s.id === currentSong.id);
      if (currentIndex !== -1) setCurrentSong(activeList[currentIndex]);
      setIsPlaying(true);
      return;
    }

    if (isShuffle) {
      let randomIndex = Math.floor(Math.random() * activeList.length);
      // Avoid repeating same song if possible
      if (activeList.length > 1 && activeList[randomIndex].id === currentSong.id) {
        randomIndex = (randomIndex + 1) % activeList.length;
      }
      setCurrentSong(activeList[randomIndex]);
      setIsPlaying(true);
      return;
    }

    // Normal Sequence
    const currentIndex = activeList.findIndex(s => s.id === currentSong.id);
    // If song not in queue (e.g. queue changed), start from 0
    const startIdx = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (startIdx + 1) % activeList.length;

    // Stop at end if Repeat is Off
    if (nextIndex === 0 && repeatMode === 0 && auto) {
      setIsPlaying(false);
      return;
    }

    const nextSong = activeList[nextIndex];
    // Inject clean title
    setCurrentSong({ ...nextSong, title: nextSong.title || cleanTitleCallback(nextSong.name) });
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (!currentSong) return;
    const activeList = queue.length > 0 ? queue : sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (activeList.length === 0) return;

    if (isShuffle) {
      let randomIndex = Math.floor(Math.random() * activeList.length);
      setCurrentSong(activeList[randomIndex]);
      setIsPlaying(true);
      return;
    }

    const currentIndex = activeList.findIndex(s => s.id === currentSong.id);
    const startIdx = currentIndex === -1 ? 0 : currentIndex;
    const prevIndex = (startIdx - 1 + activeList.length) % activeList.length;
    const prevSong = activeList[prevIndex];
    // Inject clean title
    setCurrentSong({ ...prevSong, title: prevSong.title || cleanTitleCallback(prevSong.name) });
    setIsPlaying(true);
  };

  const handleShufflePlay = async () => {
    // Determine context: use current view
    const songList = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // Case 1: Current view has songs
    if (songList.length > 0) {
      setQueue(songList);
      const randomIndex = Math.floor(Math.random() * songList.length);
      setCurrentSong(songList[randomIndex]);
      setIsPlaying(true);
      setIsShuffle(true);
      return;
    }

    // Case 2: Current view has NO songs (e.g. Root or empty folder), do GLOBAL RECURSIVE SHUFFLE
    const rootId = rootFolderId.current || currentFolderId;

    if (rootId) {
      setLoading(true);
      try {
        console.log("Starting Global Shuffle from Root:", rootId);

        // TODO: distinct loading state for "Scanning Library..."
        // For now, the spinner appears, which is good.

        const url = `${API_BASE}/api/files/recursive?folderId=${rootId}`;
        const res = await axios.get(url);

        const fetchedFiles = res.data.files;
        const allSongs = fetchedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        if (allSongs.length > 0) {
          console.log(`Global Shuffle: Queued ${allSongs.length} songs.`);
          setQueue(allSongs);
          setIsShuffle(true);

          const randomIndex = Math.floor(Math.random() * allSongs.length);
          const randomSong = allSongs[randomIndex];
          // Inject clean title
          setCurrentSong({ ...randomSong, title: randomSong.title || cleanTitleCallback(randomSong.name) });
          setIsPlaying(true);
        } else {
          alert("No songs found in your library.");
        }
      } catch (error) {
        console.error("Error doing global shuffle:", error);
        alert(`Failed to shuffle library: ${error.response?.data?.error || error.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      console.warn("Cannot shuffle: Root ID unknown.");
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev + 1) % 3);
  };

  const handleSortChange = (option) => {
    if (sortOption === option) {
      // Toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOption(option);
      setSortDirection('asc'); // Default to asc for new option
    }
  };





  const handleRenamePlaylist = (id, newName) => {
    PlaylistManager.rename(id, newName);
    refreshPlaylists();
  };

  // Sidebar Collapse State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('driveplayer_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('driveplayer_sidebar_collapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  return (
    <div className="min-h-screen bg-transparent text-white selection:bg-primary selection:text-black relative z-0">
      {/* Base Background Layer (Always Black) */}
      <div className="fixed inset-0 bg-darker -z-50" />

      {/* Dynamic Background Gradient (Conditional) */}
      <div
        className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 -z-10 ${gradientEnabled ? 'opacity-100' : 'opacity-0'}`}
        style={{
          background: window.innerWidth < 768
            ? `linear-gradient(180deg, rgba(${themeColor}, 0.15) 0%, rgba(5,5,5,1) 100%)`
            : `
            linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 160px),
            radial-gradient(circle at 50% -30%, rgba(${themeColor}, 0.5) 0%, transparent 90%),
            radial-gradient(circle at 0% 0%, rgba(${themeColor}, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 100% 0%, rgba(${themeColor}, 0.2) 0%, transparent 50%),
            linear-gradient(180deg, rgba(${themeColor}, 0.1) 0%, rgba(5,5,5,1) 100%)
          `
        }}
      />

      {/* Sidebar (Desktop) */}
      {!isMobile && (
        <div className={`fixed top-0 left-0 bottom-0 z-50 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
          <Sidebar
            playlists={playlists}
            currentFolderId={currentFolderId}
            onNavigate={handleSidebarNavigate}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            isCollapsed={isSidebarCollapsed}
            onToggle={toggleSidebar}
            user={user} // [NEW]
          />
        </div>
      )}

      {/* Header - Glassmorphism Refined */}
      <header className={`fixed top-0 right-0 z-50 h-20 flex items-center px-6 justify-between transition-all duration-300 glass-surface ${!isMobile ? (isSidebarCollapsed ? 'left-20' : 'left-64') : 'left-0'}`}>
        <div className="flex items-center gap-3 min-w-0 mr-4">
          {((currentFolderId && currentFolderId !== rootFolderId.current) || isSearching) && (
            <button onClick={handleBack} className="glass-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-105 shrink-0" title="Go Back">
              <IoArrowBack size={20} />
            </button>
          )}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight hidden md:block truncate drop-shadow-sm">{currentFolderName || 'DrivePlayer'}</h1>
          </div>
        </div>

        {/* Search Bar - VisionOS Style */}
        <div className="relative w-full max-w-sm mx-4 hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IoSearchOutline className="text-white/40 text-lg" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-2.5 rounded-full leading-5 bg-white/5 border border-white/10 text-gray-200 placeholder-white/30 focus:outline-none focus:bg-white/10 focus:ring-1 focus:ring-white/20 transition-all backdrop-blur-md shadow-lg"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              <IoCloseOutline size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">

          {/* Sort Button - Only show if there are files to sort */}
          {sortedFiles.some(f => f.mimeType !== 'application/vnd.google-apps.folder') && (
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="glass-button w-10 h-10 sm:w-auto rounded-full sm:px-4 flex items-center justify-center gap-2 text-zinc-300 hover:text-white hover:scale-105"
                title="Sort"
              >
                <IoFilterOutline size={20} />
                <span className="hidden sm:inline text-sm font-medium">Sort</span>
              </button>

              {/* Dropdown */}
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 glass-panel rounded-2xl overflow-hidden p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200 shadow-2xl ring-1 ring-white/10">
                  <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sort By</div>
                  {['name', 'date', 'size'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        handleSortChange(opt);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors
                                  ${sortOption === opt ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                              `}
                    >
                      <span className="capitalize">{opt}</span>
                      {sortOption === opt && (
                        sortDirection === 'asc' ? <IoChevronUp size={14} /> : <IoChevronDown size={14} />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {/* Backdrop for closing menu */}
              {showSortMenu && (
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
              )}
            </div>
          )}

          {/* [NEW] View Toggle (Grid/List) - Only show if current view has folders */}
          {(files || []).some(f => f.mimeType === 'application/vnd.google-apps.folder') && (
            <div className="relative">
              <button
                onClick={() => setShowViewMenu(!showViewMenu)}
                className="glass-button w-10 h-10 sm:w-auto rounded-full sm:px-4 flex items-center justify-center gap-2 text-zinc-300 hover:text-white hover:scale-105"
                title="View"
              >
                {viewMode === 'grid' ? <IoGridOutline size={18} /> : <IoListOutline size={18} />}
                <span className="hidden sm:inline text-sm font-medium">{viewMode === 'grid' ? 'Grid' : 'List'}</span>
              </button>

              {/* View Dropdown */}
              {showViewMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 glass-panel rounded-2xl overflow-hidden p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200 shadow-2xl ring-1 ring-white/10">
                  <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">View Mode</div>
                  {[
                    { id: 'grid', label: 'Grid', icon: IoGridOutline },
                    { id: 'list', label: 'List', icon: IoListOutline }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setViewMode(opt.id);
                        setShowViewMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors
                                  ${viewMode === opt.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                              `}
                    >
                      <opt.icon size={16} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Backdrop */}
              {showViewMenu && (
                <div className="fixed inset-0 z-40" onClick={() => setShowViewMenu(false)}></div>
              )}
            </div>
          )}

          {/* Shuffle Button (Compact) */}
          <button
            onClick={handleShufflePlay}
            className="glass-button w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:scale-105"
            title="Shuffle Play"
          >
            <IoPlay size={20} className="pl-0.5" />
          </button>

          {/* Download Folder Button - Only show when inside a folder */}
          {currentFolderId && (
            <button
              onClick={() => window.open(`${API_BASE}/api/download/folder/${currentFolderId}`, '_blank')}
              className="glass-button w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:scale-105"
              title="Download Folder as ZIP"
            >
              <IoCloudDownloadOutline size={20} />
            </button>
          )}

          {/* Library Button - Mobile Only */}
          {isMobile && (
            <button
              onClick={() => setShowLibrary(true)}
              className="glass-button w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:scale-105"
              title="Your Library"
            >
              <IoLibrary className="text-xl" />
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="glass-button w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:scale-105"
            title="Settings"
          >
            <IoSettingsOutline className="text-xl" />
          </button>



          {isMobile && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearching(false);
                setCurrentFolderId('favorites');
                setFiles(likedSongs);
                window.history.pushState({ folderId: 'favorites' }, '', '?folder=favorites');
              }}
              className={`glass-button w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 ${currentFolderId === 'favorites' ? 'text-primary bg-primary/10 border-primary/50' : 'text-zinc-300 hover:text-white'}`}
              title="Favorites"
            >
              {currentFolderId === 'favorites' ? <IoHeart className="text-xl" /> : <IoHeartOutline className="text-xl" />}
            </button>
          )}
        </div>

      </header>



      {/* Main Content - Fixed Layout for Glass Effect */}
      <main ref={mainScrollRef} className={`fixed inset-0 pt-20 overflow-y-auto custom-scrollbar pb-32 z-0 transition-all duration-300 ${!isMobile ? (isSidebarCollapsed ? 'pl-20' : 'pl-64') : ''}`}>

        {currentFolderId === 'profile' ? (
          <ProfileScreen likedSongsCount={(likedSongs || []).length} playlistsCount={(playlists || []).length} />
        ) : currentFolderId === 'lib:albums' ? (
          <AlbumGrid
            files={files} // Use raw files for grid grouping
            onAlbumClick={(name) => handleFolderClick('lib:album:' + encodeURIComponent(name))}
            viewMode={viewMode}
          />
        ) : currentFolderId === 'lib:artists' ? (
          <ArtistGrid
            files={files}
            onArtistClick={(name) => handleFolderClick('lib:artist:' + encodeURIComponent(name))}
          />
        ) : (
          <SongList
            files={currentFolderId === 'charts' ? files : sortedFiles}
            playCounts={playCounts}
            loading={loading}
            currentSong={currentSong}
            onPlay={handlePlay}
            onFolderClick={handleFolderClick}
            onFolderPlay={handleFolderPlay}
            cleanTitle={cleanTitleCallback}
            likedSongs={likedSongs}
            toggleLike={toggleLike}
            onAddPlaylist={(song) => setSongToAdd(song)}
            activePlaylist={playlists.find(p => p.id === currentFolderId)}
            onRenamePlaylist={handleRenamePlaylist}
            viewMode={viewMode}
          />
        )}
      </main>

      {/* Player */}
      <Player
        currentSong={currentSong}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onNext={handleNext}
        onPrev={handlePrev}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        onShuffleToggle={() => setIsShuffle(!isShuffle)}
        onRepeatToggle={toggleRepeat}
        cleanTitle={cleanTitle}
        likedSongs={likedSongs}
        toggleLike={toggleLike}
        themeColor={themeColor}
        hasSidebar={!isMobile}
        onAddPlaylist={(song) => setSongToAdd(song)}
      />

      {/* Modals */}
      {
        showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            gradientEnabled={gradientEnabled}
            onToggleGradient={() => setGradientEnabled(!gradientEnabled)}
          />
        )
      }

      {
        showLibrary && (
          <LibraryModal
            onClose={() => setShowLibrary(false)}
            onPlay={handlePlay}
            currentSong={currentSong}
            cleanTitle={cleanTitle}
            likedSongs={likedSongs}
            toggleLike={toggleLike}
          />
        )
      }

      {
        songToAdd && (
          <AddToPlaylistModal
            song={songToAdd}
            onClose={() => setSongToAdd(null)}
            onPlaylistUpdate={() => {
              refreshPlaylists();
            }}
          />
        )
      }

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />


      <Analytics />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppWrapper />
    </AuthProvider>
  );
}

function AppWrapper() {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <AuthScreen />;

  return <AppContent />;
}

export default App;
