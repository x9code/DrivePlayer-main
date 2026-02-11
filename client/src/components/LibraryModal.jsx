import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoMusicalNote, IoTrashOutline, IoArrowBack, IoPlay, IoPencil } from 'react-icons/io5';
import { PlaylistManager } from '../utils/PlaylistManager';
import SongList from './SongList';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const LibraryModal = ({ onClose, onPlay, currentSong, cleanTitle, likedSongs, toggleLike }) => {
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [cacheBuster, setCacheBuster] = useState(Date.now());

    const handleCoverUpload = async (playlistId, file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert("Image too large (Max 5MB)");
            return;
        }

        const formData = new FormData();
        formData.append('folderId', playlistId); // Reusing logic
        formData.append('image', file);

        try {
            await axios.post(`${API_BASE}/api/folder/cover`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCacheBuster(Date.now()); // Force refresh
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload cover");
        }
    };

    const refreshPlaylists = () => {
        setPlaylists(PlaylistManager.getAll());
    };

    useEffect(() => {
        refreshPlaylists();
    }, []);

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;
        PlaylistManager.create(newPlaylistName);
        refreshPlaylists();
        setNewPlaylistName('');
        setIsCreating(false);
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (confirm("Delete this playlist?")) {
            PlaylistManager.delete(id);
            refreshPlaylists();
            if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
        }
    };

    const handlePlaylistClick = (playlist) => {
        setSelectedPlaylist(playlist);
    };

    const handleBack = () => {
        setSelectedPlaylist(null);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-4">
                    {selectedPlaylist ? (
                        <button onClick={handleBack} className="text-zinc-400 hover:text-white transition-colors">
                            <IoArrowBack size={24} />
                        </button>
                    ) : (
                        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                            <IoMusicalNote size={24} />
                        </div>
                    )}

                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {selectedPlaylist ? selectedPlaylist.name : 'Your Library'}
                        </h2>
                        <p className="text-xs text-zinc-400">
                            {selectedPlaylist
                                ? `${selectedPlaylist.songs.length} songs`
                                : `${playlists.length} playlists`
                            }
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                    <IoClose size={24} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                {/* Playlist View (Details) */}
                {selectedPlaylist ? (
                    <div>
                        {/* Play Button for Playlist */}
                        {selectedPlaylist.songs.length > 0 && (
                            <div className="mb-6 flex gap-4">
                                <button
                                    onClick={() => onPlay(selectedPlaylist.songs[0])} // Should ideally play full playlist queue
                                    className="bg-primary text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                                >
                                    <IoPlay size={20} /> Play All
                                </button>
                            </div>
                        )}

                        <SongList
                            files={selectedPlaylist.songs}
                            currentSong={currentSong}
                            onPlay={onPlay}
                            // Disable folder clicks inside playlist (shouldn't have folders anyway)
                            onFolderClick={() => { }}
                            onFolderPlay={() => { }}
                            loading={false}
                            cleanTitle={cleanTitle}
                            likedSongs={likedSongs}
                            toggleLike={toggleLike}
                        />
                    </div>
                ) : (
                    /* Playlist Grid */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

                        {/* Create New Card */}
                        <div
                            onClick={() => setIsCreating(true)}
                            className="aspect-square bg-white/5 border border-white/5 border-dashed rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group"
                        >
                            <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-primary group-hover:text-black flex items-center justify-center transition-colors">
                                <IoAdd size={24} />
                            </div>
                            <span className="font-medium text-zinc-400 group-hover:text-white">New Playlist</span>
                        </div>

                        {/* Playlist Cards */}
                        {playlists.map(playlist => {
                            // Cover Logic
                            const customCoverUrl = `${API_BASE}/api/folder/cover/${playlist.id}?t=${Date.now()}`; // specific caching might be better but this works for now if we use a state
                            // Better: use a single cacheBuster state for the whole list or per item. 
                            // Let's use a state in the component.

                            return (
                                <PlaylistCard
                                    key={playlist.id}
                                    playlist={playlist}
                                    onClick={handlePlaylistClick}
                                    onDelete={handleDelete}
                                    onUpload={handleCoverUpload}
                                    cacheBuster={cacheBuster}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Modal Overlay */}
            {isCreating && (
                <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4">Create Playlist</h3>
                        <form onSubmit={handleCreate} className="flex flex-col gap-4">
                            <input
                                autoFocus
                                type="text"
                                placeholder="My Awesome Mix"
                                value={newPlaylistName}
                                onChange={e => setNewPlaylistName(e.target.value)}
                                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-primary text-black font-bold px-6 py-2 rounded-xl"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-component for performance and cleaner logic
const PlaylistCard = ({ playlist, onClick, onDelete, onUpload, cacheBuster }) => {
    const defaultCover = playlist.songs.length > 0
        ? `${import.meta.env.VITE_API_URL || ''}/api/thumbnail/${playlist.songs[0].id}`
        : null;

    const customCoverUrl = `${import.meta.env.VITE_API_URL || ''}/api/folder/cover/${playlist.id}?t=${cacheBuster}`;
    const [imgSrc, setImgSrc] = useState(customCoverUrl);
    const [uploading, setUploading] = useState(false);

    // Reset when cacheBuster changes
    useEffect(() => {
        setImgSrc(`${import.meta.env.VITE_API_URL || ''}/api/folder/cover/${playlist.id}?t=${cacheBuster}`);
    }, [cacheBuster, playlist.id]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        await onUpload(playlist.id, file);
        setUploading(false);
    };

    return (
        <div
            onClick={() => onClick(playlist)}
            className="group relative aspect-square bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:scale-[1.02] transition-all cursor-pointer shadow-lg"
        >
            {/* Gradient Cover or Image */}
            <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center overflow-hidden">
                {imgSrc || defaultCover ? (
                    <img
                        src={imgSrc}
                        onError={(e) => {
                            if (defaultCover && e.target.src !== defaultCover) {
                                e.target.src = defaultCover;
                                e.target.onerror = null; // Prevent infinite loop if default also fails
                            } else {
                                // Fallback to icon if both fail
                                e.target.style.display = 'none';
                            }
                        }}
                        alt={playlist.name}
                        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${uploading ? 'opacity-50 blur-sm' : ''}`}
                    />
                ) : null}

                {/* Fallback Icon (if image hidden or null) */}
                <IoMusicalNote size={48} className="text-white/10 absolute pointer-events-none" />

                {/* Loading Spinner */}
                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {/* Edit Cover Button */}
            <label
                onClick={(e) => e.stopPropagation()}
                className="absolute top-2 left-2 p-2 bg-black/50 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-20"
                title="Change Cover"
            >
                <IoPencil size={14} className="text-white" />
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </label>

            {/* Info */}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <h3 className="font-bold text-white truncate shadow-sm">{playlist.name}</h3>
                <p className="text-xs text-zinc-300 shadow-sm">{playlist.songs.length} songs</p>
            </div>

            {/* Delete Button */}
            <button
                onClick={(e) => onDelete(e, playlist.id)}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
                title="Delete Playlist"
            >
                <IoTrashOutline size={16} className="text-white" />
            </button>
        </div>
    );
};

export default LibraryModal;
