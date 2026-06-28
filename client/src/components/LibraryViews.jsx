import React, { useMemo, useState, useEffect, useRef } from 'react';
import { IoDiscOutline, IoPersonOutline, IoMusicalNote, IoPlay, IoEllipsisVertical, IoCloudDownloadOutline, IoAlbumsOutline, IoShuffle, IoHeart, IoHeartOutline, IoAddCircleOutline } from 'react-icons/io5';

const AlbumCard = React.memo(({ album, onAlbumClick, onPlay, onShuffle }) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const [imageError, setImageError] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div
            onClick={() => onAlbumClick(album.name)}
            className="group bg-white/5 hover:bg-white/10 rounded-[2rem] p-3 transition-all duration-500 cursor-pointer flex flex-col gap-3 shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 relative"
        >
            <div className="w-full aspect-square bg-zinc-800 rounded-2xl shadow-lg flex items-center justify-center overflow-hidden relative">
                {album.firstSongId && !imageError ? (
                    <img
                        src={`${API_BASE}/api/thumbnail/${album.firstSongId}`}
                        alt={album.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                        <IoDiscOutline className="text-5xl text-white/20 group-hover:text-white/40 transition-colors" />
                    </div>
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                {/* Action Buttons (Bottom-Right) */}
                <div className="absolute right-3 bottom-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out z-10 flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onShuffle(album.songs);
                        }}
                        className="bg-white/20 backdrop-blur-md rounded-full p-2.5 text-white shadow-xl hover:scale-110 transition-transform hover:bg-primary hover:text-black border border-white/10"
                        title="Shuffle Album"
                    >
                        <IoShuffle size={18} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlay(album.songs);
                        }}
                        className="bg-white rounded-full p-2.5 text-black shadow-xl hover:scale-110 transition-transform hover:bg-primary border border-white/10"
                        title="Play Album"
                    >
                        <IoPlay size={18} className="pl-0.5" />
                    </button>
                </div>
            </div>

            {/* Footer: Album Info + 3-Dot Menu */}
            <div className="flex items-start justify-between gap-2 px-1 pb-1">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <h3 className="font-bold text-[15px] leading-tight text-white line-clamp-2 w-full" title={album.name}>{album.name}</h3>
                    <p className="text-[11px] text-zinc-400 font-medium">{album.count} songs</p>
                </div>

                {/* 3-Dot Menu */}
                <div className="relative shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="text-zinc-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        title="More Options"
                    >
                        <IoEllipsisVertical size={16} />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden p-1.5 z-[70] shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`${API_BASE}/api/download/album?name=${encodeURIComponent(album.name)}`, '_blank');
                                        setShowMenu(false);
                                    }}
                                    className="w-full text-left px-3 py-3 rounded-xl text-sm text-zinc-300 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors font-medium"
                                >
                                    <IoCloudDownloadOutline size={18} className="text-primary" />
                                    <span>Download ZIP</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

const AlbumRow = React.memo(({ album, onAlbumClick, onPlay, onShuffle }) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const [imageError, setImageError] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div
            onClick={() => onAlbumClick(album.name)}
            className="group grid grid-cols-[48px_1fr_100px] items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-200 border border-transparent hover:bg-white/5 hover:border-white/5"
        >
            {/* Icon/Cover */}
            <div className="relative w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-zinc-800/50 shadow-md">
                {album.firstSongId && !imageError ? (
                    <img
                        src={`${API_BASE}/api/thumbnail/${album.firstSongId}`}
                        alt={album.name}
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                        <IoDiscOutline className="text-xl text-white/20" />
                    </div>
                )}
            </div>

            {/* Name */}
            <div className="flex flex-col min-w-0">
                <h4 className="font-medium text-[15px] text-gray-200 group-hover:text-white truncate" title={album.name}>
                    {album.name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <IoAlbumsOutline size={12} />
                    <span>{album.count} songs</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 relative">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onShuffle(album.songs);
                    }}
                    className="p-2 text-zinc-400 hover:text-primary transition-colors hover:bg-white/5 rounded-full"
                    title="Shuffle"
                >
                    <IoShuffle size={18} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay(album.songs);
                    }}
                    className="p-2 text-zinc-400 hover:text-primary transition-colors hover:bg-white/5 rounded-full"
                    title="Play"
                >
                    <IoPlay size={18} className="pl-0.5" />
                </button>

                {/* 3-Dot Menu */}
                <div className="relative shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="More Options"
                    >
                        <IoEllipsisVertical size={18} />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                            <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden p-1 z-[70] shadow-xl animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`${API_BASE}/api/download/album?name=${encodeURIComponent(album.name)}`, '_blank');
                                        setShowMenu(false);
                                    }}
                                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-white/10 hover:text-white flex items-center gap-3 transition-colors font-medium"
                                >
                                    <IoCloudDownloadOutline size={16} className="text-primary" />
                                    <span>Download ZIP</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

export const AlbumGrid = ({ files, onAlbumClick, onPlay, onShuffle, viewMode = 'grid' }) => {
    const albums = useMemo(() => {
        const map = {};
        files.forEach(f => {
            if (f.mimeType === 'application/vnd.google-apps.folder') return;
            // Prefer embedded metadata, fallback to folder/filename
            const albumName = f.album || "Unknown Album";
            if (!map[albumName]) {
                map[albumName] = {
                    name: albumName,
                    count: 0,
                    firstSongId: null,
                    songs: []
                };
            }
            map[albumName].count++;
            map[albumName].songs.push(f);
            // Use the first song's ID for album art
            if (!map[albumName].firstSongId && f.id) {
                map[albumName].firstSongId = f.id;
            }
        });
        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    }, [files]);

    return (
        <div className={viewMode === 'grid'
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
            : "flex flex-col gap-1 p-4"
        }>
            {albums.map(album => (
                viewMode === 'grid' ? (
                    <AlbumCard
                        key={album.name}
                        album={album}
                        onAlbumClick={onAlbumClick}
                        onPlay={onPlay}
                        onShuffle={onShuffle}
                    />
                ) : (
                    <AlbumRow
                        key={album.name}
                        album={album}
                        onAlbumClick={onAlbumClick}
                        onPlay={onPlay}
                        onShuffle={onShuffle}
                    />
                )
            ))}
        </div>
    );
};

// --- Artist Image Cache (client-side, per-session) ---
const artistImageCache = {};

const ArtistCard = React.memo(({ artist, onArtistClick, onPlay, onShuffle }) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const [imageUrl, setImageUrl] = useState(artistImageCache[artist.name] || null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageFailed, setImageFailed] = useState(artistImageCache[artist.name] === 'none');

    // Fetch artist image on mount
    React.useEffect(() => {
        if (imageUrl || imageFailed) return; // Already have it or failed

        const fetchImage = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/artist/image?name=${encodeURIComponent(artist.name)}`);
                if (res.ok) {
                    const data = await res.json();
                    artistImageCache[artist.name] = data.imageUrl;
                    setImageUrl(data.imageUrl);
                    return;
                }
            } catch { /* fall through to album art */ }

            // Fallback: Use album art from the first song
            if (artist.songs?.length > 0) {
                const firstSongId = artist.songs[0].id;
                if (firstSongId) {
                    const fallbackUrl = `${API_BASE}/api/thumbnail/${firstSongId}`;
                    artistImageCache[artist.name] = fallbackUrl;
                    setImageUrl(fallbackUrl);
                    return;
                }
            }

            artistImageCache[artist.name] = 'none';
            setImageFailed(true);
        };

        fetchImage();
    }, [artist.name]);

    return (
        <div
            onClick={() => onArtistClick(artist.name)}
            className="group bg-white/5 hover:bg-white/10 rounded-[2rem] p-3 transition-all duration-500 cursor-pointer flex flex-col gap-3 shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:-translate-y-1 relative"
        >
            <div className="w-full aspect-square bg-zinc-800 rounded-2xl shadow-lg flex items-center justify-center overflow-hidden relative">
                {imageUrl && !imageFailed ? (
                    <>
                        <img
                            src={imageUrl}
                            alt={artist.name}
                            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => setImageLoaded(true)}
                            onError={() => {
                                setImageFailed(true);
                                artistImageCache[artist.name] = 'none';
                            }}
                        />
                        {!imageLoaded && (
                            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-600 flex items-center justify-center animate-pulse">
                                <IoPersonOutline className="text-5xl text-white/20" />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                        <IoPersonOutline className="text-5xl text-white/20 group-hover:text-white/40 transition-colors" />
                    </div>
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                {/* Action Buttons (Bottom-Right) */}
                <div className="absolute right-3 bottom-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out z-10 flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onShuffle(artist.songs);
                        }}
                        className="bg-white/20 backdrop-blur-md rounded-full p-2.5 text-white shadow-xl hover:scale-110 transition-transform hover:bg-primary hover:text-black border border-white/10"
                        title="Shuffle Artist"
                    >
                        <IoShuffle size={18} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlay(artist.songs);
                        }}
                        className="bg-white rounded-full p-2.5 text-black shadow-xl hover:scale-110 transition-transform hover:bg-primary border border-white/10"
                        title="Play Artist"
                    >
                        <IoPlay size={18} className="pl-0.5" />
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-0.5 px-1 pb-1">
                <h3 className="font-bold text-[15px] leading-tight text-white line-clamp-2 w-full" title={artist.name}>{artist.name}</h3>
                <p className="text-[11px] text-zinc-400 font-medium">{artist.count} songs</p>
            </div>
        </div>
    );
});

export const ArtistGrid = ({ files, onArtistClick, onPlay, onShuffle }) => {
    const artists = useMemo(() => {
        const map = {};

        files.forEach(f => {
            if (f.mimeType === 'application/vnd.google-apps.folder') return;

            // ONLY use embedded metadata - the whole point of metadata scan!
            if (!f.artist || f.artist === 'Unknown Artist') {
                return; // Skip files without proper artist metadata
            }

            // Split multi-artist strings by common delimiters
            const artistNames = f.artist
                .split(/[;,\/]|\s+feat\.?\s+|\s+ft\.?\s+|\s+&\s+/i)
                .map(a => a.trim())
                .filter(a => a.length > 0);

            artistNames.forEach(artistName => {
                if (!map[artistName]) {
                    map[artistName] = {
                        name: artistName,
                        count: 0,
                        songs: []
                    };
                }
                map[artistName].count++;
                map[artistName].songs.push(f);
            });
        });

        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    }, [files]);

    return (
        <div className="p-4">
            {artists.length === 0 ? (
                <div className="text-center py-20">
                    <IoPersonOutline className="text-6xl text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-xl text-zinc-400 mb-2">No Artists Found</h3>
                    <p className="text-sm text-zinc-500">
                        Waiting for metadata scan to complete.<br />
                        Check the scan progress in the sidebar.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {artists.map(artist => (
                        <ArtistCard
                            key={artist.name}
                            artist={artist}
                            onArtistClick={onArtistClick}
                            onPlay={onPlay}
                            onShuffle={onShuffle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const ArtistEqualizer = () => (
    <div className="flex items-end gap-[3px] h-4 w-5 justify-center">
        <div className="w-[3px] bg-white rounded-t-full" style={{ animation: 'equalize 0.8s infinite', animationDelay: '0s' }} />
        <div className="w-[3px] bg-white rounded-t-full" style={{ animation: 'equalize 0.8s infinite', animationDelay: '0.2s' }} />
        <div className="w-[3px] bg-white rounded-t-full" style={{ animation: 'equalize 0.8s infinite', animationDelay: '0.4s' }} />
    </div>
);

// Shared song row used in both Popular and See-All views
const ArtistSongRow = ({ file, index, isCurrent, onPlay, isLiked, toggleLike, onAddPlaylist, playCount, cleanTitle }) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const title = file.title || (cleanTitle ? cleanTitle(file.name) : file.name.replace(/\.(mp3|m4a|flac|wav)$/i, ''));

    return (
        <div
            onClick={() => onPlay(file)}
            className={`group grid grid-cols-[32px_1fr_auto] md:grid-cols-[48px_1fr_auto] items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent
                ${isCurrent ? 'bg-white/10 border-white/8' : 'hover:bg-white/5 hover:border-white/5'}`}
        >
            {/* Index / Equalizer */}
            <div className="text-zinc-500 text-center text-xs font-semibold flex justify-center items-center">
                {isCurrent ? (
                    <ArtistEqualizer />
                ) : (
                    <>
                        <span className="group-hover:hidden tabular-nums">{index + 1}</span>
                        <IoPlay size={13} className="hidden group-hover:block text-white" />
                    </>
                )}
            </div>

            {/* Thumbnail + Title */}
            <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shadow-md">
                    <img
                        src={`${API_BASE}/api/thumbnail/${file.id}`}
                        alt={title}
                        className="w-full h-full object-cover"
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                </div>
                <div className="min-w-0">
                    <p className={`truncate font-medium text-[14px] leading-snug ${isCurrent ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                        {title}
                    </p>
                    {file.album && (
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">{file.album}</p>
                    )}
                </div>
            </div>

            {/* Actions + plays */}
            <div className="flex items-center justify-end gap-1 md:gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(file); }}
                    className={`transition-all duration-200 hover:scale-110 focus:outline-none p-1.5 rounded-full
                        ${isLiked ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white'}`}
                    title={isLiked ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                    {isLiked ? <IoHeart size={15} /> : <IoHeartOutline size={15} />}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onAddPlaylist(file); }}
                    className="opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 focus:outline-none text-zinc-500 hover:text-white p-1.5 rounded-full"
                    title="Add to Playlist"
                >
                    <IoAddCircleOutline size={17} />
                </button>
                {playCount > 0 && (
                    <span className="hidden md:inline text-[11px] text-zinc-500 min-w-[44px] text-right tabular-nums">
                        {playCount.toLocaleString()}
                    </span>
                )}
                <span className="hidden md:inline text-[11px] text-zinc-500 min-w-[40px] text-right tabular-nums">
                    {formatDuration(file.duration) || formatSize(file.size)}
                </span>
            </div>
        </div>
    );
};

// Mini album card for the Albums section
const ArtistAlbumCard = ({ album, onPlay }) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const [imgFailed, setImgFailed] = useState(false);

    return (
        <div
            onClick={() => onPlay(album.songs)}
            className="group cursor-pointer flex flex-col gap-2"
        >
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-zinc-800 shadow-lg">
                {album.firstSongId && !imgFailed ? (
                    <img
                        src={`${API_BASE}/api/thumbnail/${album.firstSongId}`}
                        alt={album.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={() => setImgFailed(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
                        <IoDiscOutline className="text-4xl text-white/20" />
                    </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-white rounded-full p-2.5 shadow-xl">
                        <IoPlay size={16} className="text-black pl-0.5" />
                    </div>
                </div>
            </div>
            <div className="px-0.5">
                <p className="font-semibold text-[13px] text-white truncate">{album.name}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                    {album.year ? `${album.year} · ` : ''}{album.count} {album.count === 1 ? 'song' : 'songs'}
                </p>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────
// ArtistPage — Spotify-style artist detail view
// ─────────────────────────────────────────────────────────
export const ArtistPage = ({
    files,
    artistName,
    currentSong,
    onPlay,
    likedSongs = [],
    toggleLike,
    onAddPlaylist,
    playCounts = {},
    cleanTitle,
    onArtistPlay,
    onArtistShuffle,
}) => {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const [heroImageUrl, setHeroImageUrl] = useState(artistImageCache[artistName] || null);
    const [heroFailed, setHeroFailed] = useState(artistImageCache[artistName] === 'none');
    const [heroLoaded, setHeroLoaded] = useState(false);
    const [showAllSongs, setShowAllSongs] = useState(false);
    const [artistBio, setArtistBio] = useState(null);
    const [bioLoading, setBioLoading] = useState(true);

    const songs = useMemo(
        () => files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'),
        [files]
    );

    // Top songs — sorted by play count desc, then by name
    const topSongs = useMemo(() => {
        return [...songs].sort((a, b) => {
            const ca = playCounts[a.id] || 0;
            const cb = playCounts[b.id] || 0;
            return cb - ca || (a.title || a.name).localeCompare(b.title || b.name);
        });
    }, [songs, playCounts]);

    // Albums — grouped by file.album, sorted newest → oldest
    const albums = useMemo(() => {
        const map = {};

        // Helper: extract a 4-digit year from any common metadata field
        const extractYear = (f) => {
            const raw = f.year || f.date || f.releaseDate || f.originalDate || '';
            if (!raw) return null;
            const str = String(raw).trim();
            // "2023", "2023-01-15", "2023/01/15", "01/01/2023" etc.
            const m = str.match(/\b(19|20)\d{2}\b/);
            return m ? parseInt(m[0], 10) : null;
        };

        songs.forEach(f => {
            const name = f.album || 'Unknown Album';
            if (!map[name]) {
                map[name] = { name, count: 0, firstSongId: null, songs: [], year: null };
            }
            map[name].count++;
            map[name].songs.push(f);
            if (!map[name].firstSongId) map[name].firstSongId = f.id;
            // Keep the earliest year found across tracks (album year = oldest track year)
            const y = extractYear(f);
            if (y && (!map[name].year || y < map[name].year)) map[name].year = y;
        });

        return Object.values(map).sort((a, b) => {
            // "Unknown Album" always goes last
            const aUnk = a.name === 'Unknown Album';
            const bUnk = b.name === 'Unknown Album';
            if (aUnk && !bUnk) return 1;
            if (!aUnk && bUnk) return -1;

            // Both have year → newest first
            if (a.year && b.year) return b.year - a.year;

            // Only one has year → the one with year comes first
            if (a.year && !b.year) return -1;
            if (!a.year && b.year) return 1;

            // Neither has year → alphabetical
            return a.name.localeCompare(b.name);
        });
    }, [songs]);


    // Fetch artist image (reuse module-level cache)
    useEffect(() => {
        if (heroImageUrl || heroFailed) return;
        const doFetch = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/artist/image?name=${encodeURIComponent(artistName)}`);
                if (res.ok) {
                    const data = await res.json();
                    artistImageCache[artistName] = data.imageUrl;
                    setHeroImageUrl(data.imageUrl);
                    return;
                }
            } catch { /* fall through */ }
            if (songs.length > 0 && songs[0].id) {
                const fb = `${API_BASE}/api/thumbnail/${songs[0].id}`;
                artistImageCache[artistName] = fb;
                setHeroImageUrl(fb);
                return;
            }
            artistImageCache[artistName] = 'none';
            setHeroFailed(true);
        };
        doFetch();
    }, [artistName, songs]);

    // Fetch artist bio from Wikipedia (no key needed, CORS-enabled)
    useEffect(() => {
        setBioLoading(true);
        setArtistBio(null);
        const controller = new AbortController();
        const { signal } = controller;

        const fetchBio = async () => {
            try {
                // 1️⃣ Try the direct Wikipedia page summary endpoint
                const directUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`;
                const directRes = await fetch(directUrl, { signal });
                if (directRes.ok) {
                    const data = await directRes.json();
                    // Confirm it's a person/musician page, not a disambiguation
                    if (data.extract && data.type !== 'disambiguation') {
                        setArtistBio(data.extract);
                        setBioLoading(false);
                        return;
                    }
                }

                // 2️⃣ Fallback: search Wikipedia for "{artist} musician"
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(artistName + ' musician')}&format=json&origin=*&srlimit=1`;
                const searchRes = await fetch(searchUrl, { signal });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    const topResult = searchData?.query?.search?.[0];
                    if (topResult) {
                        // Load the summary of the top result
                        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topResult.title)}`;
                        const summaryRes = await fetch(summaryUrl, { signal });
                        if (summaryRes.ok) {
                            const summaryData = await summaryRes.json();
                            if (summaryData.extract && summaryData.type !== 'disambiguation') {
                                setArtistBio(summaryData.extract);
                                setBioLoading(false);
                                return;
                            }
                        }
                    }
                }
            } catch (e) {
                if (e.name !== 'AbortError') console.warn('[ArtistPage] Bio fetch failed:', e);
            }
            setBioLoading(false);
        };

        fetchBio();
        return () => controller.abort();
    }, [artistName]);


    const displayedSongs = showAllSongs ? topSongs : topSongs.slice(0, 5);
    const totalPlays = songs.reduce((acc, f) => acc + (playCounts[f.id] || 0), 0);

    return (
        <div className="min-h-full animate-in fade-in duration-500">

            {/* ── HERO ─────────────────────────────────────── */}
            <div className="relative w-full overflow-hidden" style={{ minHeight: '340px', height: 'clamp(280px, 40vh, 440px)' }}>
                {/* Blurred bg */}
                {heroImageUrl && !heroFailed && (
                    <img
                        src={heroImageUrl} alt="" aria-hidden
                        onLoad={() => setHeroLoaded(true)}
                        onError={() => setHeroFailed(true)}
                        className={`absolute inset-0 w-full h-full object-cover scale-110 blur-2xl transition-opacity duration-700 ${heroLoaded ? 'opacity-60' : 'opacity-0'}`}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 pointer-events-none" />

                {/* Content */}
                <div className="relative z-10 flex flex-col md:flex-row items-end gap-6 px-6 md:px-10 pb-8 h-full pt-12 md:pt-0">
                    {/* Circular artist photo */}
                    <div className="relative shrink-0 w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden shadow-[0_12px_50px_rgba(0,0,0,0.8)] border-2 border-white/10 bg-zinc-800 flex items-center justify-center">
                        {heroImageUrl && !heroFailed ? (
                            <img
                                src={heroImageUrl} alt={artistName}
                                className={`w-full h-full object-cover transition-opacity duration-500 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
                                onLoad={() => setHeroLoaded(true)}
                                onError={() => setHeroFailed(true)}
                            />
                        ) : (
                            <IoPersonOutline className="text-6xl text-white/20" />
                        )}
                    </div>

                    {/* Text + actions */}
                    <div className="flex flex-col gap-2 min-w-0 pb-1">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Artist</span>
                        <h1 className="font-black text-white leading-none tracking-tight drop-shadow-2xl"
                            style={{ fontSize: 'clamp(2.2rem, 7vw, 5.5rem)' }}>
                            {artistName}
                        </h1>
                        <p className="text-sm text-white/50 font-medium">
                            {songs.length} {songs.length === 1 ? 'song' : 'songs'}
                            {totalPlays > 0 && ` · ${totalPlays.toLocaleString()} plays`}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                            <button
                                onClick={() => onArtistPlay && onArtistPlay(topSongs)}
                                className="flex items-center gap-2 bg-white text-black font-bold text-sm px-7 py-3 rounded-full hover:scale-105 hover:bg-white/90 transition-all duration-200 shadow-xl"
                            >
                                <IoPlay size={16} className="pl-0.5" />
                                Play
                            </button>
                            <button
                                onClick={() => onArtistShuffle && onArtistShuffle(topSongs)}
                                className="flex items-center gap-2 bg-white/10 backdrop-blur-md text-white font-semibold text-sm px-5 py-3 rounded-full hover:scale-105 hover:bg-white/20 transition-all duration-200 border border-white/20 shadow-lg"
                            >
                                <IoShuffle size={16} />
                                Shuffle
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BODY ─────────────────────────────────────── */}
            <div className="px-4 md:px-10 pb-8">

                {/* ── POPULAR SONGS ─────────────────────────── */}
                <section className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Popular</h2>
                        {songs.length > 5 && (
                            <button
                                onClick={() => setShowAllSongs(v => !v)}
                                className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-white/5"
                            >
                                {showAllSongs ? 'Show Less' : 'See All'}
                            </button>
                        )}
                    </div>

                    {/* Column header */}
                    <div className="grid grid-cols-[32px_1fr_auto] md:grid-cols-[48px_1fr_auto] items-center gap-3 px-3 pb-2 border-b border-white/5 text-zinc-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <span className="text-center">#</span>
                        <span>Title</span>
                        <span className="text-right pr-1 hidden md:block">Plays</span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        {displayedSongs.map((file, index) => (
                            <ArtistSongRow
                                key={file.id}
                                file={file}
                                index={index}
                                isCurrent={currentSong?.id === file.id}
                                onPlay={onPlay}
                                isLiked={likedSongs.some(s => s.id === file.id)}
                                toggleLike={toggleLike}
                                onAddPlaylist={onAddPlaylist}
                                playCount={playCounts[file.id]}
                                cleanTitle={cleanTitle}
                            />
                        ))}
                    </div>
                </section>

                {/* ── ALBUMS ────────────────────────────────── */}
                {albums.length > 0 && (
                    <section className="mt-12">
                        <h2 className="text-xl font-bold text-white mb-5">
                            {albums.length === 1 ? 'Album' : 'Albums'}
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {albums.map(album => (
                                <ArtistAlbumCard
                                    key={album.name}
                                    album={album}
                                    onPlay={onArtistPlay}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── ABOUT ─────────────────────────────────── */}
                <section className="mt-14 mb-6">
                    <h2 className="text-xl font-bold text-white mb-5">About</h2>

                    <div className="relative rounded-3xl overflow-hidden bg-zinc-900/60 border border-white/5 shadow-xl">
                        {/* Blurred hero photo as about-section background */}
                        {heroImageUrl && !heroFailed && (
                            <img
                                src={heroImageUrl} alt="" aria-hidden
                                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-20 scale-110"
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black/90 pointer-events-none" />

                        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start">
                            {/* Large photo */}
                            <div className="shrink-0 w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden bg-zinc-800 shadow-2xl border border-white/10">
                                {heroImageUrl && !heroFailed ? (
                                    <img src={heroImageUrl} alt={artistName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <IoPersonOutline className="text-4xl text-white/20" />
                                    </div>
                                )}
                            </div>

                            {/* Bio text + stats */}
                            <div className="flex flex-col gap-4 min-w-0 flex-1">
                                <h3 className="text-2xl font-black text-white">{artistName}</h3>

                                {/* Stats row */}
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold text-lg">{songs.length}</span>
                                        <span className="text-zinc-500 text-xs uppercase tracking-wider">Songs</span>
                                    </div>
                                    <div className="w-px bg-white/10 self-stretch" />
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold text-lg">{albums.length}</span>
                                        <span className="text-zinc-500 text-xs uppercase tracking-wider">Albums</span>
                                    </div>
                                    {totalPlays > 0 && (
                                        <>
                                            <div className="w-px bg-white/10 self-stretch" />
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-lg">{totalPlays.toLocaleString()}</span>
                                                <span className="text-zinc-500 text-xs uppercase tracking-wider">Total Plays</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Bio */}
                                {bioLoading ? (
                                    <div className="flex gap-2 items-center text-zinc-600 text-sm">
                                        <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                                        Loading bio…
                                    </div>
                                ) : artistBio ? (
                                    <p className="text-zinc-300 text-sm leading-relaxed line-clamp-6">{artistBio}</p>
                                ) : (
                                    <p className="text-zinc-500 text-sm italic">
                                        No biography available for {artistName}.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};
