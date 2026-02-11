import React, { useState, useEffect } from 'react';
import { IoMusicalNote, IoMusicalNotes } from 'react-icons/io5';

// Use environment variable for API URL
const API_BASE = import.meta.env.VITE_API_URL || '';

const PlaylistCover = ({ playlist, className = "", style = {}, refreshTrigger = null }) => {
    const [hasCustomCover, setHasCustomCover] = useState(true);
    const [imageLoading, setImageLoading] = useState(true);

    // Reset when playlist changes
    useEffect(() => {
        setHasCustomCover(true);
        setImageLoading(true);
    }, [playlist.id, refreshTrigger]);

    const customCoverUrl = `${API_BASE}/api/folder/cover/${playlist.id}${refreshTrigger ? `?t=${refreshTrigger}` : ''}`;

    // Helper to render fallback content
    const renderFallback = () => {
        // Collage (4+ songs)
        if (playlist.songs && playlist.songs.length >= 4) {
            return (
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    {playlist.songs.slice(0, 4).map((song, i) => (
                        <div key={i} className="relative w-full h-full overflow-hidden border-[0.5px] border-black/10">
                            <img
                                src={`${API_BASE}/api/thumbnail/${song.id}`}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <div className="absolute inset-0 -z-10 bg-zinc-700 flex items-center justify-center">
                                <IoMusicalNote className="text-white/20 text-[10px]" />
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // Single Art (1-3 songs)
        if (playlist.songs && playlist.songs.length > 0) {
            return (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <img
                        src={`${API_BASE}/api/thumbnail/${playlist.songs[0].id}`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 -z-10 bg-zinc-800 flex items-center justify-center">
                        <IoMusicalNote className="text-zinc-600 text-4xl" />
                    </div>
                </div>
            );
        }

        // Default
        return (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                <IoMusicalNotes className="text-zinc-600 w-1/3 h-1/3" />
            </div>
        );
    };

    return (
        <div className={`relative overflow-hidden bg-zinc-800 ${className}`} style={style}>
            {/* 1. Underlying Fallback (Always Rendered initially) */}
            <div className="absolute inset-0 z-0">
                {renderFallback()}
            </div>

            {/* 2. Custom Cover (Overlaid) */}
            {hasCustomCover && (
                <img
                    src={customCoverUrl}
                    alt={playlist.name}
                    className={`absolute inset-0 z-10 w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setImageLoading(false)}
                    onError={() => setHasCustomCover(false)}
                />
            )}
        </div>
    );
};

export default PlaylistCover;
