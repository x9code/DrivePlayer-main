import { IoHome, IoHeart, IoMusicalNote, IoAdd, IoTrashOutline, IoLibrary, IoDiscOutline, IoPeopleOutline, IoSyncOutline, IoLogoGoogle, IoStatsChart, IoPersonCircleOutline } from 'react-icons/io5';
import PlaylistCover from './PlaylistCover';
import axios from 'axios';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || '';

// --- Scan Progress Component ---
const ScanProgress = ({ isCollapsed }) => {
    const [status, setStatus] = useState({ active: false, current: 0, total: 0 });

    useEffect(() => {
        let interval;
        const checkStatus = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/metadata/status/progress`);
                setStatus(res.data);

                if (res.data.active) {
                    interval = setTimeout(checkStatus, 2000);
                } else {
                    interval = setTimeout(checkStatus, 10000);
                }
            } catch (e) {
                interval = setTimeout(checkStatus, 15000);
            }
        };

        checkStatus();
        return () => clearTimeout(interval);
    }, []);

    const cachedCount = status.cached || 0;
    const pending = Math.max(0, status.total - cachedCount);
    const percent = status.total > 0 ? (status.current / status.total) * 100 : 0;
    const isComplete = !status.active && pending === 0 && status.total > 0;
    const isIdle = !status.active;

    const startScan = async () => {
        try {
            setStatus(prev => ({ ...prev, active: true })); // Optimistic update
            await axios.post(`${API_BASE}/api/metadata/rescan`);
        } catch (e) {
            console.error("Scan start failed", e);
            setStatus(prev => ({ ...prev, active: false }));
        }
    };

    if (isCollapsed) return null; // Hide completely when collapsed

    // Minimal View when complete/idle
    if (isComplete || isIdle) {
        return (
            <div className="px-4 py-3 border-t border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between group">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <IoSyncOutline className={status.active ? "animate-spin text-primary" : "text-zinc-600"} />
                    <span>{cachedCount} files cached</span>
                </div>

                <button
                    onClick={startScan}
                    className="text-[10px] text-zinc-600 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                    title="Rescan Library"
                >
                    Rescan
                </button>
            </div>
        );
    }

    // Active Scan View (Progress Bar)
    return (
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span className="flex items-center gap-2">
                    <IoSyncOutline className="animate-spin text-primary" />
                    <span>Scanning Library...</span>
                </span>
                <span>{Math.round(percent)}%</span>
            </div>

            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <div className="mt-2 text-[10px] text-zinc-600 truncate flex justify-between items-center">
                <span>{status.current} / {status.total}</span>
            </div>
        </div>
    );
};

const Sidebar = ({
    playlists,
    currentFolderId,
    onNavigate,
    onCreatePlaylist,
    onDeletePlaylist,
    isCollapsed,
    onToggle,
    className = "",
    user // [NEW]
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const playlistScrollRef = useRef(null);
    const savedScrollPosition = useRef(0);
    const [isHovered, setIsHovered] = useState(false);

    const effectiveCollapsed = isCollapsed && !isHovered;

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        if (newPlaylistName.trim()) {
            onCreatePlaylist(newPlaylistName);
            setNewPlaylistName('');
            setIsCreating(false);
        }
    };

    // Restore scroll position when playlists change  
    useEffect(() => {
        if (playlistScrollRef.current && savedScrollPosition.current > 0) {
            setTimeout(() => {
                if (playlistScrollRef.current) {
                    playlistScrollRef.current.scrollTop = savedScrollPosition.current;
                }
            }, 50);
        }
    }, [playlists]);

    const collapsedWidth = 80; // Tailwind w-20 (5rem)
    const expandedWidth = 256; // Tailwind w-64 (16rem)

    return (
        <motion.aside
            layout
            className={`bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col h-full ${className}`}
            initial={{ width: isCollapsed ? collapsedWidth : expandedWidth }}
            animate={{ width: effectiveCollapsed ? collapsedWidth : expandedWidth }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Logo area */}
            <div className={`h-20 flex items-center transition-all duration-300 ${effectiveCollapsed ? 'justify-center p-0' : 'px-6'}`}>
                <div
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/5"
                >
                    <IoLogoGoogle className="text-primary text-xl shrink-0 drop-shadow-[0_0_8px_rgba(var(--theme-color),0.5)]" />
                </div>
            </div>

            {/* Main Nav */}
            <nav className={`flex flex-col gap-1 ${effectiveCollapsed ? 'px-2 items-center' : 'px-3'}`}>
                <NavItem
                    icon={<IoHome size={20} />}
                    label="Home"
                    active={!currentFolderId && currentFolderId !== 'favorites' && !currentFolderId?.startsWith('lib:')}
                    onClick={() => onNavigate(null)}
                    isCollapsed={effectiveCollapsed}
                />
                <NavItem
                    icon={<IoHeart size={20} />}
                    label="Favorites"
                    active={currentFolderId === 'favorites'}
                    onClick={() => onNavigate('favorites')}
                    isCollapsed={effectiveCollapsed}
                />
                <NavItem
                    icon={<IoStatsChart size={20} />}
                    label="Charts"
                    active={currentFolderId === 'charts'}
                    onClick={() => onNavigate('charts')}
                    isCollapsed={effectiveCollapsed}
                />
            </nav>

            <div className={`my-4 border-b border-white/5 ${effectiveCollapsed ? 'mx-4' : 'mx-6'}`}></div>

            {/* Library Nav */}
            {!effectiveCollapsed && (
                <div className="px-6 mb-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Library</span>
                </div>
            )}
            <nav className={`flex flex-col gap-1 ${effectiveCollapsed ? 'px-2 items-center' : 'px-3'}`}>
                <NavItem
                    icon={<IoMusicalNote size={20} />}
                    label="Songs"
                    active={currentFolderId === 'lib:songs'}
                    onClick={() => onNavigate('lib:songs')}
                    isCollapsed={effectiveCollapsed}
                />
                <NavItem
                    icon={<IoDiscOutline size={20} />}
                    label="Albums"
                    active={currentFolderId === 'lib:albums'}
                    onClick={() => onNavigate('lib:albums')}
                    isCollapsed={effectiveCollapsed}
                />
                <NavItem
                    icon={<IoPeopleOutline size={20} />}
                    label="Artists"
                    active={currentFolderId === 'lib:artists'}
                    onClick={() => onNavigate('lib:artists')}
                    isCollapsed={effectiveCollapsed}
                />
            </nav>

            <div className={`my-4 border-b border-white/5 ${effectiveCollapsed ? 'mx-4' : 'mx-6'}`}></div>

            {/* Playlists Header */}
            {!effectiveCollapsed ? (
                <div className="px-6 flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Playlists</span>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Create Playlist"
                    >
                        <IoAdd size={18} />
                    </button>
                </div>
            ) : (
                <div className="flex justify-center mb-2">
                    <button
                        onClick={() => {
                            if (isCollapsed) onToggle();
                            setTimeout(() => setIsCreating(true), 300);
                        }}
                        className="text-zinc-400 hover:text-white transition-colors p-2"
                        title="Create Playlist"
                    >
                        <IoAdd size={20} />
                    </button>
                </div>
            )}

            {/* Create Playlist Input */}
            {isCreating && !effectiveCollapsed && (
                <form onSubmit={handleCreateSubmit} className="px-3 mb-2 animate-in fade-in slide-in-from-top-2">
                    <div className="relative">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Playlist Name"
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-primary/50"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onBlur={() => !newPlaylistName && setIsCreating(false)}
                            onKeyDown={(e) => e.key === 'Escape' && setIsCreating(false)}
                        />
                    </div>
                </form>
            )}

            {/* Playlists List */}
            <div
                ref={playlistScrollRef}
                className={`flex-1 overflow-y-auto custom-scrollbar pb-6 space-y-1 ${effectiveCollapsed ? 'px-2' : 'px-3'}`}
                onScroll={(e) => {
                    // Save scroll position as user scrolls
                    savedScrollPosition.current = e.target.scrollTop;
                }}
            >
                {playlists.map(playlist => (
                    <PlaylistItem
                        key={playlist.id}
                        playlist={playlist}
                        active={currentFolderId === playlist.id}
                        onClick={() => onNavigate(playlist.id)}
                        onDelete={(e) => onDeletePlaylist(e, playlist.id)}
                        isCollapsed={effectiveCollapsed}
                    />
                ))}
            </div>

            {/* Profile Nav (Bottom) */}
            <div className={`mt-auto ${effectiveCollapsed ? 'px-2' : 'px-3'} mb-2 border-t border-white/5 pt-2`}>
                <NavItem
                    icon={user?.avatar_path ? (
                        <div className="w-5 h-5 rounded-full overflow-hidden border border-white/20">
                            <img src={`${API_BASE}${user.avatar_path}`} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <IoPersonCircleOutline size={20} />
                    )}
                    label="Profile"
                    active={currentFolderId === 'profile'}
                    onClick={() => onNavigate('profile')}
                    isCollapsed={effectiveCollapsed}
                />
            </div>

            {/* Scan Progress */}
            <ScanProgress isCollapsed={effectiveCollapsed} />
        </motion.aside>
    );
};

const NavItem = ({ icon, label, active, onClick, isCollapsed }) => (
    <motion.button
        layout="position"
        onClick={onClick}
        className={`flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium transition-colors duration-200
            ${active
                ? 'bg-primary/20 text-primary'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }
            ${isCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : 'px-3'}`}
        title={isCollapsed ? label : ''}
    >
        {icon}
        {!isCollapsed && (
            <motion.span
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
            >
                {label}
            </motion.span>
        )}
    </motion.button>
);



const PlaylistItem = ({ playlist, active, onClick, onDelete, isCollapsed }) => (
    <motion.div
        layout="position"
        onClick={onClick}
        className={`group flex items-center rounded-lg text-sm transition-colors duration-200 cursor-pointer
            ${active
                ? 'bg-white/10 text-white'
                : 'text-zinc-300 hover:text-white hover:bg-white/5'
            }
            ${isCollapsed ? 'justify-center p-1 w-12 h-12 mx-auto mb-1' : 'justify-between px-3 py-2 w-full'}`}
        title={isCollapsed ? playlist.name : ''}
    >
        <div className={`flex items-center ${isCollapsed ? 'justify-center w-full h-full' : 'gap-3 truncate'}`}>
            <div className={`rounded overflow-hidden shrink-0 ${active ? 'opacity-100' : 'opacity-100'} ${isCollapsed ? 'w-full h-full' : 'w-8 h-8'}`}>
                <PlaylistCover playlist={playlist} className="w-full h-full object-cover" />
            </div>
            {!isCollapsed && (
                <motion.span
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="truncate"
                >
                    {playlist.name}
                </motion.span>
            )}
        </div>

        {!isCollapsed && (
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                title="Delete"
            >
                <IoTrashOutline size={14} />
            </button>
        )}
    </motion.div>
);

export default Sidebar;
