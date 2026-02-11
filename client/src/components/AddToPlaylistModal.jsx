import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoMusicalNote } from 'react-icons/io5';
import { PlaylistManager } from '../utils/PlaylistManager';

const AddToPlaylistModal = ({ song, onClose, onPlaylistUpdate }) => {
    const [playlists, setPlaylists] = useState([]);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        setPlaylists(PlaylistManager.getAll());
    }, []);

    const [toast, setToast] = useState(null); // { message, type }

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;

        const newPlaylist = PlaylistManager.create(newPlaylistName);
        setPlaylists(PlaylistManager.getAll()); // Refresh list
        setNewPlaylistName('');
        setIsCreating(false);
        setToast({ message: `Playlist "${newPlaylistName}" created!`, type: 'success' });
    };

    const handleSelect = (playlist) => {
        PlaylistManager.addSong(playlist.id, song);
        onPlaylistUpdate(); // Notify App to refresh if needed
        setToast({ message: `Added to "${playlist.name}"`, type: 'success' });

        // Delay closing slightly to show success
        setTimeout(() => {
            onClose();
        }, 800);
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">

                {/* Toast Notification */}
                {toast && (
                    <div className="absolute top-0 left-0 right-0 bg-primary text-black text-center text-sm font-bold py-2 animate-in slide-in-from-top-full z-50">
                        {toast.message}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                >
                    <IoClose size={24} />
                </button>

                <h3 className="text-lg font-bold text-white mb-1">Add to Playlist</h3>
                <p className="text-xs text-zinc-400 mb-6 truncate">
                    {song.name}
                </p>

                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto mb-4 pr-1 custom-scrollbar">
                    {playlists.map(playlist => (
                        <button
                            key={playlist.id}
                            onClick={() => handleSelect(playlist)}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 hover:scale-[1.02] transition-all text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                                <IoMusicalNote size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-white">{playlist.name}</span>
                                <span className="text-[10px] text-zinc-500">{playlist.songs.length} songs</span>
                            </div>
                        </button>
                    ))}

                    {playlists.length === 0 && (
                        <div className="text-center py-4 text-zinc-500 text-sm">
                            No playlists yet. Create one!
                        </div>
                    )}
                </div>

                {isCreating ? (
                    <form onSubmit={handleCreate} className="flex gap-2 animate-in slide-in-from-bottom-2">
                        <input
                            type="text"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            placeholder="Playlist Name"
                            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="bg-primary text-black font-bold px-4 rounded-xl text-sm hover:opacity-90"
                        >
                            Create
                        </button>
                    </form>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        <IoAdd size={18} />
                        Create New Playlist
                    </button>
                )}
            </div>
        </div>
    );
};

export default AddToPlaylistModal;
