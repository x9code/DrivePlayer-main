import React, { useMemo, useState } from 'react';
import { IoDiscOutline, IoPersonOutline, IoMusicalNote, IoPlay, IoEllipsisVertical, IoCloudDownloadOutline, IoAlbumsOutline } from 'react-icons/io5';

const AlbumCard = React.memo(({ album, onAlbumClick }) => {
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

                {/* Compact Play Button (Bottom-Right) */}
                <div className="absolute right-2 bottom-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out z-10">
                    <div
                        className="bg-white/90 rounded-full p-2 text-black shadow-xl hover:scale-105 transition-transform hover:bg-white"
                        title="Play Album"
                    >
                        <IoPlay size={16} className="pl-0.5 text-black" />
                    </div>
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

const AlbumRow = React.memo(({ album, onAlbumClick }) => {
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

export const AlbumGrid = ({ files, onAlbumClick, viewMode = 'grid' }) => {
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
                    <AlbumCard key={album.name} album={album} onAlbumClick={onAlbumClick} />
                ) : (
                    <AlbumRow key={album.name} album={album} onAlbumClick={onAlbumClick} />
                )
            ))}
        </div>
    );
};

export const ArtistGrid = ({ files, onArtistClick }) => {
    const artists = useMemo(() => {
        const map = {};

        files.forEach(f => {
            if (f.mimeType === 'application/vnd.google-apps.folder') return;

            // ONLY use embedded metadata - the whole point of metadata scan!
            if (!f.artist || f.artist === 'Unknown Artist') {
                return; // Skip files without proper artist metadata
            }

            const artistName = f.artist;

            if (!map[artistName]) {
                map[artistName] = {
                    name: artistName,
                    count: 0,
                    art: null,
                    songs: []
                };
            }
            map[artistName].count++;
            map[artistName].songs.push(f);
            if (!map[artistName].art && f.thumbnailLink) {
                map[artistName].art = f.thumbnailLink;
            }
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
                        <div
                            key={artist.name}
                            onClick={() => onArtistClick(artist.name)}
                            className="group bg-white/5 hover:bg-white/10 rounded-full p-4 transition-all cursor-pointer flex flex-col items-center text-center gap-2 aspect-square justify-center"
                        >
                            <div className="w-24 h-24 rounded-full bg-zinc-800 shadow-lg flex items-center justify-center overflow-hidden mb-2 relative">
                                {artist.art ? (
                                    <img src={artist.art} alt={artist.name} className="w-full h-full object-cover" />
                                ) : (
                                    <IoPersonOutline className="text-3xl text-zinc-600 group-hover:text-primary transition-colors" />
                                )}
                            </div>
                            <div className="w-full overflow-hidden px-2">
                                <h3 className="font-bold text-white truncate w-full" title={artist.name}>{artist.name}</h3>
                                <p className="text-xs text-zinc-400">{artist.count} songs</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
