import { IoHome, IoHeart, IoMusicalNote, IoAdd, IoTrashOutline, IoLibrary, IoDiscOutline, IoPeopleOutline, IoSyncOutline, IoLogoGoogle, IoStatsChart, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import PlaylistCover from './PlaylistCover';
import axios from 'axios';
import { useEffect, useState } from 'react';

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

    return (
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span className="flex items-center gap-2">
                    {status.active ? (
                        <IoSyncOutline className="animate-spin text-primary" />
                    ) : isComplete ? (
                        <IoSyncOutline className="text-green-500" />
                    ) : (
                        <IoSyncOutline className="text-yellow-500" />
                    )}

                    {status.active ? "Scanning Library..." :
                        isComplete ? "Scanning Completed" :
                            pending > 0 ? `${pending} files unscanned` : "Scan Paused"}
                </span>
                <span>{status.active ? `${Math.round(percent)}%` : ''}</span>
            </div>

            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-300 ease-out ${status.active ? 'bg-primary' : isComplete ? 'bg-green-500' : 'bg-yellow-500'}`}
                    style={{ width: `${status.active ? percent : isComplete ? 100 : (cachedCount / status.total * 100)}%` }}
                />
            </div>

            <div className="mt-2 text-[10px] text-zinc-600 truncate flex justify-between items-center">
                <span>{status.active ? `${status.current} / ${status.total}` : `${cachedCount} / ${status.total} cached`}</span>

                {isIdle && (
                    <button
                        onClick={startScan}
                        className="text-primary hover:text-white hover:underline cursor-pointer"
                    >
                        {pending > 0 ? "Resume Scan" : "Rescan"}
                    </button>
                )}

                {status.errors > 0 && <span className="text-red-400">{status.errors} errors</span>}
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
    className = ""
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        if (newPlaylistName.trim()) {
            onCreatePlaylist(newPlaylistName);
            setNewPlaylistName('');
            setIsCreating(false);
        }
    };

    return (
        <aside className={`bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} ${className}`}>
            {/* Logo area */}
            <div className={`h-20 flex items-center transition-all duration-300 ${isCollapsed ? 'justify-center p-0' : 'px-6'}`}>
                <button
                    onClick={() => onToggle()}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/5 hover:bg-white/10 transition-colors group"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? (
                        <IoLogoGoogle className="text-primary text-xl shrink-0 drop-shadow-[0_0_8px_rgba(var(--theme-color),0.5)]" />
                    ) : (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <IoChevronBack className="text-white text-xl absolute opacity-0 group-hover:opacity-100 transition-opacity" />
                            <IoLogoGoogle className="text-primary text-xl shrink-0 drop-shadow-[0_0_8px_rgba(var(--theme-color),0.5)] absolute opacity-100 group-hover:opacity-0 transition-opacity" />
                        </div>
                    )}
                </button>
            </div>

            {/* Main Nav */}
            <nav className={`flex flex-col gap-1 ${isCollapsed ? 'px-2 items-center' : 'px-3'}`}>
                <NavItem
                    icon={<IoHome size={20} />}
                    label="Home"
                    active={!currentFolderId && currentFolderId !== 'favorites' && !currentFolderId?.startsWith('lib:')}
                    onClick={() => onNavigate(null)}
                    isCollapsed={isCollapsed}
                />
                <NavItem
                    icon={<IoHeart size={20} />}
                    label="Favorites"
                    active={currentFolderId === 'favorites'}
                    onClick={() => onNavigate('favorites')}
                    isCollapsed={isCollapsed}
                />
                <NavItem
                    icon={<IoStatsChart size={20} />}
                    label="Charts"
                    active={currentFolderId === 'charts'}
                    onClick={() => onNavigate('charts')}
                    isCollapsed={isCollapsed}
                />
            </nav>

            <div className={`my-4 border-b border-white/5 ${isCollapsed ? 'mx-4' : 'mx-6'}`}></div>

            {/* Library Nav */}
            {!isCollapsed && (
                <div className="px-6 mb-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Library</span>
                </div>
            )}
            <nav className={`flex flex-col gap-1 ${isCollapsed ? 'px-2 items-center' : 'px-3'}`}>
                <NavItem
                    icon={<IoMusicalNote size={20} />}
                    label="Songs"
                    active={currentFolderId === 'lib:songs'}
                    onClick={() => onNavigate('lib:songs')}
                    isCollapsed={isCollapsed}
                />
                <NavItem
                    icon={<IoDiscOutline size={20} />}
                    label="Albums"
                    active={currentFolderId === 'lib:albums'}
                    onClick={() => onNavigate('lib:albums')}
                    isCollapsed={isCollapsed}
                />
                <NavItem
                    icon={<IoPeopleOutline size={20} />}
                    label="Artists"
                    active={currentFolderId === 'lib:artists'}
                    onClick={() => onNavigate('lib:artists')}
                    isCollapsed={isCollapsed}
                />
            </nav>

            <div className={`my-4 border-b border-white/5 ${isCollapsed ? 'mx-4' : 'mx-6'}`}></div>

            {/* Playlists Header */}
            {!isCollapsed ? (
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
            {isCreating && !isCollapsed && (
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
            <div className={`flex-1 overflow-y-auto custom-scrollbar pb-6 space-y-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                {playlists.map(playlist => (
                    <PlaylistItem
                        key={playlist.id}
                        playlist={playlist}
                        active={currentFolderId === playlist.id}
                        onClick={() => onNavigate(playlist.id)}
                        onDelete={(e) => onDeletePlaylist(e, playlist.id)}
                        isCollapsed={isCollapsed}
                    />
                ))}
            </div>

            {/* Scan Progress */}
            <ScanProgress isCollapsed={isCollapsed} />
        </aside>
    );
};

const NavItem = ({ icon, label, active, onClick, isCollapsed }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${active
                ? 'bg-primary/20 text-primary'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }
            ${isCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : 'px-3'}`}
        title={isCollapsed ? label : ''}
    >
        {icon}
        {!isCollapsed && <span>{label}</span>}
    </button>
);



const PlaylistItem = ({ playlist, active, onClick, onDelete, isCollapsed }) => (
    <div
        onClick={onClick}
        className={`group flex items-center rounded-lg text-sm transition-all duration-200 cursor-pointer
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
            {!isCollapsed && <span className="truncate">{playlist.name}</span>}
        </div>

        {!isCollapsed && (
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 transition-all"
                title="Delete"
            >
                <IoTrashOutline size={14} />
            </button>
        )}
    </div>
);

export default Sidebar;
