import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { Analytics } from "@vercel/analytics/react"
import { BrowserRouter, useLocation } from 'react-router-dom'; // [NEW]
import axios from 'axios';
import Player from './components/Player'
import SongList from './components/SongList'
import { IoSearchOutline, IoCloseOutline, IoHeart, IoHeartOutline, IoSettingsOutline, IoArrowBack, IoFilterOutline, IoChevronDown, IoChevronUp, IoPlay, IoLibrary, IoCloudDownloadOutline, IoGridOutline, IoListOutline } from 'react-icons/io5'
import SettingsModal from './components/SettingsModal'
import AddToPlaylistModal from './components/AddToPlaylistModal'

import LibraryModal from './components/LibraryModal'
import Sidebar from './components/Sidebar' // [NEW]
import ConfirmModal from './components/ConfirmModal'
import { AlbumGrid, ArtistGrid } from './components/LibraryViews'
import HorizontalFolderNavigation from './components/HorizontalFolderNavigation'

import { cleanTitle } from './utils/format';
import ProfileScreen from './components/ProfileScreen'; // [NEW]

import { AuthProvider, useAuth } from './context/AuthContext'; // [NEW]
import AuthScreen from './components/AuthScreen'; // [NEW]
import ResetPasswordScreen from './components/ResetPasswordScreen'; // [NEW]

import { useTheme } from './hooks/useTheme';
import { useLibrary } from './hooks/useLibrary';

// Environment variable for API URL (Production vs Dev)
const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper: normalized string used for \"Name\" sorting
function getSongSortName(file) {
  if (!file) return '';
  const base = (file.title || file.name || '').toString();
  return base
    .replace(/^\d+[\s._-]*/, '') // strip leading track numbers like \"01 - \"
    .trim()
    .toLowerCase();
}

function AppContent() {
  const { user, token, logout, loading: authLoading } = useAuth(); // [NEW] Auth Hook

  const {
    themeColor, gradientEnabled, setGradientEnabled, extractColor, defaultColor, setDefaultColor, useAlbumColor, setUseAlbumColor
  } = useTheme();

  const {
    files, loading, currentFolderId, currentFolderName,
    likedSongs, playlists, playCounts,
    setCurrentFolderId, setCurrentFolderName, setFiles, setLoading,
    fetchFiles, searchFiles, refreshPlaylists, setLikedSongs,
    rootFolderId, scrollPositions
  } = useLibrary(token);

  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Extract color on song change or toggle change
  useEffect(() => {
    extractColor(currentSong?.id);
  }, [currentSong?.id, useAlbumColor]);
  const mainScrollRef = useRef(null); // Ref for main scroll container
  const isGoingBack = useRef(false); // Track if navigating back

  // Disable browser's auto scroll restoration — we manage it ourselves
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    // Reset scroll on page load/refresh
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, []);
  // --- Queue System ---
  const [queue, setQueue] = useState([]);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Mobile Detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      setSearchQuery('');
      setIsSearching(false);
      setCurrentFolderId('favorites');
      setFiles(likedSongs);
      setCurrentFolderName('Favorites');
      loading && setLoading(false);
      window.history.pushState({ folderId: 'favorites' }, '', '?folder=favorites');
    } else if (id === 'charts') {
      setSearchQuery('');
      setIsSearching(false);
      setCurrentFolderId('charts');
      fetchFiles('charts');
      setCurrentFolderName('Top 20 Charts');
      window.history.pushState({ folderId: 'charts' }, '', '?folder=charts');
    } else if (id === 'profile') {
      setSearchQuery('');
      setIsSearching(false);
      setCurrentFolderId('profile');
      setCurrentFolderName('Profile');
      loading && setLoading(false);
      window.history.pushState({ folderId: 'profile' }, '', '?folder=profile');
    } else if (id.startsWith('lib:')) {
      handleFolderClick(id);
    } else {
      const playlist = playlists.find(p => p.id === String(id));
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
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'once' | 'count' | 'infinite'
  const [repeatCount, setRepeatCount] = useState(3); // Number for 'count' mode
  const repeatRemaining = useRef(0); // Tracks remaining repeats during playback
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [songToAdd, setSongToAdd] = useState(null);
  // showSortMenu moved to Sorting State section

  // Root UI States
  const [refreshTrigger, setRefreshTrigger] = useState(Date.now());
  const [uploadingFolderId, setUploadingFolderId] = useState(null);

  const handleCoverUpload = async (id, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large! Please upload a cover smaller than 5MB.");
      return;
    }

    const formData = new FormData();
    formData.append('folderId', id);
    formData.append('image', file);

    setUploadingFolderId(id);
    try {
      await axios.post(`${API_BASE}/api/folder/cover`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setRefreshTrigger(Date.now());
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload cover.");
    } finally {
      setUploadingFolderId(null);
    }
  };



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
          valA = getSongSortName(a);
          valB = getSongSortName(b);
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

  // Handle Search
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

  // Navigation Logic
  const handleFolderClick = (folderId) => {
    // Save current scroll position
    if (mainScrollRef.current) {
      const key = currentFolderId || 'root';
      scrollPositions.current[key] = mainScrollRef.current.scrollTop;
    }

    if (isSearching) {
      setSearchQuery('');
      setIsSearching(false);
    }

    isGoingBack.current = false;
    setFiles([]);
    setLoading(true);
    window.history.pushState({ folderId }, '', `?folder=${folderId}`);
    setCurrentFolderId(folderId);
    fetchFiles(folderId);
  };

  const handleBack = () => {
    if (isSearching) {
      clearSearch();
      return;
    }
    // Save current scroll before going back
    if (mainScrollRef.current) {
      const key = currentFolderId || 'root';
      scrollPositions.current[key] = mainScrollRef.current.scrollTop;
    }
    isGoingBack.current = true;
    window.history.back();
  };

  // Restore scroll position after files load
  useEffect(() => {
    if (loading || !mainScrollRef.current) return;

    const key = currentFolderId || 'root';
    if (isGoingBack.current && scrollPositions.current[key] !== undefined) {
      // Going back: restore saved position
      requestAnimationFrame(() => {
        if (mainScrollRef.current) {
          mainScrollRef.current.scrollTop = scrollPositions.current[key];
        }
      });
      isGoingBack.current = false;
    } else if (!isGoingBack.current) {
      // Going forward: scroll to top
      mainScrollRef.current.scrollTop = 0;
    }
  }, [loading, currentFolderId]);

  // Mark as "going back" when browser back/forward button is used
  useEffect(() => {
    const onPopState = () => {
      // Save current scroll before navigating
      if (mainScrollRef.current) {
        const key = currentFolderId || 'root';
        scrollPositions.current[key] = mainScrollRef.current.scrollTop;
      }
      isGoingBack.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentFolderId]);

  // Playback Handlers
  const handlePlay = (song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      const currentSongs = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      setQueue(currentSongs);
      setCurrentSong({ ...song, title: song.title || cleanTitleCallback(song.name) });
      setIsPlaying(true);
    }
  };

  const handleFolderPlay = async (folderId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/files/recursive?folderId=${folderId}`);
      const songList = res.data.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      if (songList.length > 0) {
        setQueue(songList);
        setIsShuffle(true);
        const randomIndex = Math.floor(Math.random() * songList.length);
        const randomSong = songList[randomIndex];
        setCurrentSong({ ...randomSong, title: randomSong.title || cleanTitleCallback(randomSong.name) });
        setIsPlaying(true);
      }
    } catch (e) { console.error(e); }
  };

  const handleShufflePlay = async () => {
    const songList = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (songList.length > 0) {
      setQueue(songList);
      const randomIndex = Math.floor(Math.random() * songList.length);
      setCurrentSong(songList[randomIndex]);
      setIsPlaying(true);
      setIsShuffle(true);
      return;
    }

    const rootId = rootFolderId.current || currentFolderId;
    if (rootId) {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/files/recursive?folderId=${rootId}`);
        const allSongs = res.data.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        if (allSongs.length > 0) {
          setQueue(allSongs);
          setIsShuffle(true);
          const randomIndex = Math.floor(Math.random() * allSongs.length);
          setCurrentSong({ ...allSongs[randomIndex], title: allSongs[randomIndex].title || cleanTitleCallback(allSongs[randomIndex].name) });
          setIsPlaying(true);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
  };

  const handleNext = (auto = false) => {
    if (!currentSong) return;
    const activeList = queue.length > 0 ? queue : sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (activeList.length === 0) return;

    // Handle repeat modes on auto-advance (song ended naturally)
    if (auto) {
      if (repeatMode === 'infinite') {
        // Always replay
        setIsPlaying(true);
        return;
      }
      if (repeatMode === 'once') {
        if (repeatRemaining.current > 0) {
          repeatRemaining.current--;
          setIsPlaying(true);
          return;
        }
        // Exhausted — fall through to next song
      }
      if (repeatMode === 'count') {
        if (repeatRemaining.current > 0) {
          repeatRemaining.current--;
          setIsPlaying(true);
          return;
        }
        // Exhausted — fall through to next song
      }
    }

    if (isShuffle) {
      let randomIndex = Math.floor(Math.random() * activeList.length);
      if (activeList.length > 1 && activeList[randomIndex].id === currentSong.id) {
        randomIndex = (randomIndex + 1) % activeList.length;
      }
      setCurrentSong(activeList[randomIndex]);
      setIsPlaying(true);
      return;
    }

    const currentIndex = activeList.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % activeList.length;
    if (nextIndex === 0 && repeatMode === 'off' && auto) {
      setIsPlaying(false);
      return;
    }
    setCurrentSong({ ...activeList[nextIndex], title: activeList[nextIndex].title || cleanTitleCallback(activeList[nextIndex].name) });
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
    const prevIndex = (currentIndex - 1 + activeList.length) % activeList.length;
    setCurrentSong({ ...activeList[prevIndex], title: activeList[prevIndex].title || cleanTitleCallback(activeList[prevIndex].name) });
    setIsPlaying(true);
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      const order = ['off', 'once', 'count', 'infinite'];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      // Reset remaining counter when switching modes
      if (next === 'once') repeatRemaining.current = 1;
      else if (next === 'count') repeatRemaining.current = repeatCount;
      else repeatRemaining.current = 0;
      return next;
    });
  };

  // Reset repeat remaining when song changes
  useEffect(() => {
    if (repeatMode === 'once') repeatRemaining.current = 1;
    else if (repeatMode === 'count') repeatRemaining.current = repeatCount;
  }, [currentSong?.id]);

  // Update remaining when repeatCount changes in 'count' mode
  useEffect(() => {
    if (repeatMode === 'count') repeatRemaining.current = repeatCount;
  }, [repeatCount]);

  const handleAlbumPlay = (songs) => {
    if (!songs || songs.length === 0) return;
    setQueue(songs);
    setIsShuffle(false);
    setCurrentSong({ ...songs[0], title: songs[0].title || cleanTitleCallback(songs[0].name) });
    setIsPlaying(true);
  };

  const handleAlbumShuffle = (songs) => {
    if (!songs || songs.length === 0) return;
    setQueue(songs);
    setIsShuffle(true);
    const randomIndex = Math.floor(Math.random() * songs.length);
    const randomSong = songs[randomIndex];
    setCurrentSong({ ...randomSong, title: randomSong.title || cleanTitleCallback(randomSong.name) });
    setIsPlaying(true);
  };

  const handleArtistPlay = (songs) => {
    if (!songs || songs.length === 0) return;
    setQueue(songs);
    setIsShuffle(false);
    setCurrentSong({ ...songs[0], title: songs[0].title || cleanTitleCallback(songs[0].name) });
    setIsPlaying(true);
  };

  const handleArtistShuffle = (songs) => {
    if (!songs || songs.length === 0) return;
    setQueue(songs);
    setIsShuffle(true);
    const randomIndex = Math.floor(Math.random() * songs.length);
    const randomSong = songs[randomIndex];
    setCurrentSong({ ...randomSong, title: randomSong.title || cleanTitleCallback(randomSong.name) });
    setIsPlaying(true);
  };

  const handleSortChange = (option) => {
    if (sortOption === option) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOption(option);
      setSortDirection('asc');
    }
  };

  const handleRenamePlaylist = (id, newName) => {
    axios.put(`${API_BASE}/api/playlists/${id}`, { name: newName }).then(refreshPlaylists).catch(console.error);
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('driveplayer_sidebar_collapsed') === 'true');

  useEffect(() => {
    localStorage.setItem('driveplayer_sidebar_collapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  const sidebarCollapsedWidth = 80; // px, should match Sidebar collapsedWidth
  const sidebarExpandedWidth = 256; // px, should match Sidebar expandedWidth

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  useEffect(() => {
    const handleSongEnded = () => handleNext(true);
    window.addEventListener('audio-ended', handleSongEnded);
    return () => window.removeEventListener('audio-ended', handleSongEnded);
  }, [currentSong, isShuffle, repeatMode, queue]);

  useEffect(() => {
    if (currentSong && isPlaying) {
      const timer = setTimeout(() => {
        setPlayCounts(prev => ({ ...prev, [currentSong.id]: (prev[currentSong.id] || 0) + 1 }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentSong?.id]);

  const headerLeft = !isMobile ? (isSidebarCollapsed ? sidebarCollapsedWidth : sidebarExpandedWidth) : 0;

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
        <div className="fixed top-0 left-0 bottom-0 z-50 transition-all duration-300">
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
      <header
        className="fixed top-0 right-0 z-40 h-20 flex items-center px-6 justify-between transition-all duration-300 glass-surface"
        style={{ left: `${headerLeft}px` }}
      >
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
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-2xl overflow-hidden p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl"
                  style={{
                    background: `
                      radial-gradient(circle at 0% 0%, rgba(${themeColor},0.28) 0%, transparent 55%),
                      radial-gradient(circle at 100% 0%, rgba(${themeColor},0.18) 0%, transparent 55%),
                      linear-gradient(180deg, rgba(15,15,15,0.96), rgba(5,5,5,0.98))
                    `
                  }}
                >
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

          {/* Download Folder Button - Only show when inside a real Drive folder */}
          {currentFolderId &&
            !['profile', 'favorites', 'charts'].includes(currentFolderId) &&
            !currentFolderId.startsWith('lib:') && (
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
            onPlay={handleAlbumPlay}
            onShuffle={handleAlbumShuffle}
            viewMode={viewMode}
          />
        ) : currentFolderId === 'lib:artists' ? (
          <ArtistGrid
            files={files}
            onArtistClick={(name) => handleFolderClick('lib:artist:' + encodeURIComponent(name))}
            onPlay={handleArtistPlay}
            onShuffle={handleArtistShuffle}
          />
        ) : ((currentFolderId === null || currentFolderId === rootFolderId.current) && files.some(f => f.mimeType === 'application/vnd.google-apps.folder')) ? (
          <HorizontalFolderNavigation
            folders={files.filter(f => f.mimeType === 'application/vnd.google-apps.folder')}
            onFolderClick={handleFolderClick}
            onFolderPlay={handleFolderPlay}
            onCoverUpload={handleCoverUpload}
            refreshTrigger={refreshTrigger}
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
            onCoverUpload={handleCoverUpload}
            uploadingFolderId={uploadingFolderId}
            refreshTrigger={refreshTrigger}
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
        repeatCount={repeatCount}
        repeatRemaining={repeatRemaining}
        onRepeatCountChange={setRepeatCount}
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
            defaultColor={defaultColor}
            onSetDefaultColor={setDefaultColor}
            useAlbumColor={useAlbumColor}
            onSetUseAlbumColor={setUseAlbumColor}
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
            playlists={playlists}
            onPlaylistUpdate={refreshPlaylists}
          />
        )
      }

      {
        songToAdd && (
          <AddToPlaylistModal
            song={songToAdd}
            playlists={playlists}
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
    <BrowserRouter>
      <AuthProvider>
        <AppWrapper />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppWrapper() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Loading...</div>;

  // Allow reset password route without auth
  if (location.pathname.startsWith('/reset-password')) {
    return <ResetPasswordScreen />;
  }

  if (!user) return <AuthScreen />;

  return <AppContent />;
}

export default App;
