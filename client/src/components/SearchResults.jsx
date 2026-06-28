import React, { useMemo } from 'react';
import {
    IoMusicalNote, IoPersonOutline, IoDiscOutline,
    IoFolderOpenOutline, IoPlay, IoHeart, IoHeartOutline,
    IoAddCircleOutline, IoCloudDownloadOutline, IoSearchOutline
} from 'react-icons/io5';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── helpers ──────────────────────────────────────────────────────────────────
const cleanFileName = (name) =>
    name.replace(/\.(mp3|m4a|flac|wav|ogg|aac|opus)$/i, '').replace(/^\d+[\.\-\s]+/, '').trim();

// ─── Song row ─────────────────────────────────────────────────────────────────
const SearchSongRow = ({ file, index, isCurrent, onPlay, isLiked, toggleLike, onAddPlaylist, onArtistClick, cleanTitle }) => {
    const title = file.title || (cleanTitle ? cleanTitle(file.name) : cleanFileName(file.name));
    return (
        <div
            onClick={() => onPlay(file)}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border border-transparent
                ${isCurrent ? 'bg-white/10 border-white/8' : 'hover:bg-white/5 hover:border-white/5'}`}
        >
            {/* Thumbnail */}
            <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shadow">
                <img
                    src={`${API_BASE}/api/thumbnail/${file.id}`}
                    alt={title}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <IoPlay size={14} className="text-white opacity-0 group-hover:opacity-100 pl-0.5" />
                </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className={`truncate text-sm font-medium leading-snug ${isCurrent ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                    {title}
                </p>
                <div className="flex items-center gap-1 text-xs text-zinc-500 truncate mt-0.5">
                    {file.artist && file.artist !== 'Unknown Artist' && onArtistClick ? (
                        <button
                            onClick={e => { e.stopPropagation(); onArtistClick(file.artist.split(/[;,\/]\s*/)[0].trim()); }}
                            className="hover:text-white hover:underline transition-colors truncate"
                        >
                            {file.artist}
                        </button>
                    ) : (
                        <span className="truncate">{file.artist || 'Unknown Artist'}</span>
                    )}
                    {file.album && <><span className="shrink-0">·</span><span className="truncate">{file.album}</span></>}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={e => { e.stopPropagation(); toggleLike(file); }}
                    className={`p-1.5 rounded-full transition-all hover:scale-110 focus:outline-none
                        ${isLiked ? 'text-white opacity-100' : 'text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-white'}`}
                    title={isLiked ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                    {isLiked ? <IoHeart size={15} /> : <IoHeartOutline size={15} />}
                </button>
                <button
                    onClick={e => { e.stopPropagation(); onAddPlaylist(file); }}
                    className="p-1.5 rounded-full text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-white transition-all hover:scale-110 focus:outline-none"
                    title="Add to Playlist"
                >
                    <IoAddCircleOutline size={17} />
                </button>
                <button
                    onClick={e => { e.stopPropagation(); window.open(`${API_BASE}/api/download/${file.id}`, '_blank'); }}
                    className="hidden md:block p-1.5 rounded-full text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-white transition-all hover:scale-110 focus:outline-none"
                    title="Download"
                >
                    <IoCloudDownloadOutline size={16} />
                </button>
            </div>
        </div>
    );
};

// ─── Artist chip ──────────────────────────────────────────────────────────────
const SearchArtistChip = ({ name, songCount, onArtistClick }) => {
    return (
        <div
            onClick={() => onArtistClick(name)}
            className="group cursor-pointer flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-200"
        >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-900 flex items-center justify-center border border-white/10 shadow-lg">
                <IoPersonOutline size={28} className="text-white/30" />
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-white group-hover:underline truncate max-w-[90px]">{name}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{songCount} {songCount === 1 ? 'song' : 'songs'}</p>
            </div>
        </div>
    );
};

// ─── Album chip ───────────────────────────────────────────────────────────────
const SearchAlbumChip = ({ album, onAlbumPlay, onFolderClick }) => {
    const [imgFailed, setImgFailed] = React.useState(false);
    return (
        <div
            onClick={() => onFolderClick ? onFolderClick('lib:album:' + encodeURIComponent(album.name)) : onAlbumPlay(album.songs)}
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
                        <IoDiscOutline className="text-3xl text-white/20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all bg-white rounded-full p-2 shadow-xl">
                        <IoPlay size={14} className="text-black pl-0.5" />
                    </div>
                </div>
            </div>
            <div className="px-0.5">
                <p className="font-semibold text-[13px] text-white truncate">{album.name}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                    {album.artist || ''}{album.artist && album.year ? ' · ' : ''}{album.year || ''}
                </p>
            </div>
        </div>
    );
};

// ─── Folder chip ──────────────────────────────────────────────────────────────
const SearchFolderChip = ({ folder, onFolderClick }) => {
    return (
        <div
            onClick={() => onFolderClick(folder.id)}
            className="group cursor-pointer flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-200"
        >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0">
                <IoFolderOpenOutline size={20} className="text-white/50" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate group-hover:underline">{folder.name}</p>
                <p className="text-[11px] text-zinc-500">Folder</p>
            </div>
            <IoPlay size={14} className="text-zinc-600 group-hover:text-white ml-auto shrink-0 transition-colors" />
        </div>
    );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, label, count }) => (
    <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-zinc-400 shrink-0" />
        <h2 className="text-base font-bold text-white">{label}</h2>
        <span className="text-xs text-zinc-600 font-medium ml-1">{count}</span>
    </div>
);

// ─── Main SearchResults component ─────────────────────────────────────────────
const SearchResults = ({
    query,
    files,
    loading,
    currentSong,
    onPlay,
    likedSongs = [],
    toggleLike,
    onAddPlaylist,
    playCounts = {},
    cleanTitle,
    onArtistClick,
    onFolderClick,
    onAlbumPlay,
}) => {
    // Partition results by type
    const { songs, folders, albumMap, artistMap } = useMemo(() => {
        const songs = [];
        const folders = [];
        const albumMap = {};
        const artistMap = {};

        files.forEach(f => {
            if (f.mimeType === 'application/vnd.google-apps.folder') {
                folders.push(f);
                return;
            }
            songs.push(f);

            // Build album map
            if (f.album) {
                if (!albumMap[f.album]) {
                    albumMap[f.album] = {
                        name: f.album,
                        firstSongId: f.id,
                        artist: f.artist || null,
                        year: f.year || null,
                        songs: [],
                    };
                }
                albumMap[f.album].songs.push(f);
            }

            // Build artist map
            if (f.artist && f.artist !== 'Unknown Artist') {
                const names = f.artist.split(/[;,\/]\s*/);
                names.forEach(name => {
                    const n = name.trim();
                    if (!n) return;
                    if (!artistMap[n]) artistMap[n] = { name: n, songs: [] };
                    artistMap[n].songs.push(f);
                });
            }
        });

        return { songs, folders, albumMap, artistMap };
    }, [files]);

    const albums = Object.values(albumMap);
    const artists = Object.values(artistMap);

    const isEmpty = songs.length === 0 && folders.length === 0;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-10 h-10 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                <p className="text-zinc-500 text-sm">Searching…</p>
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-zinc-500">
                <IoSearchOutline size={48} className="opacity-30" />
                <div className="text-center">
                    <p className="text-lg font-semibold text-zinc-400">No results for "{query}"</p>
                    <p className="text-sm mt-1">Try a different song, album, artist, or folder name</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-4 md:px-10 pb-40 pt-6 space-y-10">

            {/* ── ARTISTS ───────────────────────────────── */}
            {artists.length > 0 && (
                <section>
                    <SectionHeader icon={IoPersonOutline} label="Artists" count={artists.length} />
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                        {artists.map(a => (
                            <SearchArtistChip
                                key={a.name}
                                name={a.name}
                                songCount={a.songs.length}
                                onArtistClick={onArtistClick}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ── ALBUMS ───────────────────────────────── */}
            {albums.length > 0 && (
                <section>
                    <SectionHeader icon={IoDiscOutline} label="Albums" count={albums.length} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {albums.map(album => (
                            <SearchAlbumChip
                                key={album.name}
                                album={album}
                                onAlbumPlay={onAlbumPlay}
                                onFolderClick={onFolderClick}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ── SONGS ───────────────────────────────── */}
            {songs.length > 0 && (
                <section>
                    <SectionHeader icon={IoMusicalNote} label="Songs" count={songs.length} />

                    {/* Column header */}
                    <div className="grid grid-cols-[1fr_auto] gap-3 px-3 pb-2 border-b border-white/5 text-zinc-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <span>Title</span>
                        <span className="text-right">Actions</span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        {songs.map((file, index) => (
                            <SearchSongRow
                                key={file.id}
                                file={file}
                                index={index}
                                isCurrent={currentSong?.id === file.id}
                                onPlay={onPlay}
                                isLiked={likedSongs.some(s => s.id === file.id)}
                                toggleLike={toggleLike}
                                onAddPlaylist={onAddPlaylist}
                                onArtistClick={onArtistClick}
                                cleanTitle={cleanTitle}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ── FOLDERS ──────────────────────────────── */}
            {folders.length > 0 && (
                <section>
                    <SectionHeader icon={IoFolderOpenOutline} label="Folders" count={folders.length} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {folders.map(f => (
                            <SearchFolderChip
                                key={f.id}
                                folder={f}
                                onFolderClick={onFolderClick}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default SearchResults;
