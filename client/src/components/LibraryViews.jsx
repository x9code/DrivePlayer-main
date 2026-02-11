import React, { useMemo } from 'react';
import { IoDiscOutline, IoPersonOutline, IoMusicalNote } from 'react-icons/io5';

export const AlbumGrid = ({ files, onAlbumClick }) => {
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
                    art: null, // Could find art from one of the songs?
                    songs: []
                };
            }
            map[albumName].count++;
            map[albumName].songs.push(f);
            // Try to find a song with a thumbnail to use as album art
            if (!map[albumName].art && f.thumbnailLink) {
                map[albumName].art = f.thumbnailLink;
            }
        });
        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    }, [files]);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
            {albums.map(album => (
                <div
                    key={album.name}
                    onClick={() => onAlbumClick(album.name)}
                    className="group bg-white/5 hover:bg-white/10 rounded-xl p-4 transition-all cursor-pointer flex flex-col items-center text-center gap-3"
                >
                    <div className="w-full aspect-square bg-zinc-800 rounded-lg shadow-lg flex items-center justify-center overflow-hidden relative">
                        {album.art ? (
                            <img src={album.art} alt={album.name} className="w-full h-full object-cover" />
                        ) : (
                            <IoDiscOutline className="text-4xl text-zinc-600 group-hover:text-primary transition-colors" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </div>
                    <div className="w-full overflow-hidden">
                        <h3 className="font-bold text-white truncate w-full" title={album.name}>{album.name}</h3>
                        <p className="text-xs text-zinc-400">{album.count} songs</p>
                    </div>
                </div>
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
