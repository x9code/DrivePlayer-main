import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { IoPersonCircleOutline, IoHeart, IoMusicalNotes, IoLogOutOutline, IoStatsChart, IoCameraReverse } from 'react-icons/io5';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ProfileScreen = ({ likedSongsCount, playlistsCount }) => {
    const { user, logout, updateUser } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState(user.username || user.email.split('@')[0]);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 300 * 1024) {
            alert("Image must be smaller than 300KB");
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await axios.post(`${API_BASE}/api/user/avatar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                updateUser({ avatar_path: res.data.avatarPath });
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };


    const handleUsernameUpdate = async () => {
        if (!newUsername.trim()) return;

        try {
            const res = await axios.put(`${API_BASE}/api/user/profile`, { username: newUsername });
            if (res.data.success) {
                updateUser({ username: res.data.username });
                setIsEditingUsername(false);
            }
        } catch (error) {
            console.error("Update failed", error);
            alert("Failed to update username");
        }
    };

    if (!user) return null;

    return (
        <div className="w-full h-full flex flex-col items-center justify-start pt-20 p-8 text-white animate-in fade-in zoom-in duration-500">

            {/* Top Right Actions */}
            <div className="absolute top-28 right-6 flex items-center gap-4">
                <button
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-all border border-white/5 hover:border-red-500/20 active:scale-95 group"
                    title="Sign Out"
                >
                    <IoLogOutOutline size={18} />
                    <span className="text-sm font-medium">Sign Out</span>
                </button>
            </div>

            {/* Profile Header */}
            <div className="flex flex-col items-center mb-12">
                <div
                    className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 p-1 shadow-2xl shadow-purple-500/20 mb-6 relative group cursor-pointer"
                    onClick={() => fileInputRef.current.click()}
                >
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden relative">
                        {user.avatar_path ? (
                            <img
                                src={`${API_BASE}${user.avatar_path}`}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                        ) : (
                            <span className="text-4xl font-bold text-white/90">
                                {user.email[0].toUpperCase()}
                            </span>
                        )}

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <IoCameraReverse className="text-white text-2xl" />
                        </div>

                        {/* Loading */}
                        {isUploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Hidden Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />
                </div>
                {isEditingUsername ? (
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xl font-bold focus:outline-none focus:border-primary"
                            autoFocus
                        />
                        <button onClick={handleUsernameUpdate} className="text-green-500 hover:text-green-400 text-sm">Save</button>
                        <button onClick={() => setIsEditingUsername(false)} className="text-zinc-500 hover:text-zinc-400 text-sm">Cancel</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mb-2 group">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            {user.username || user.email.split('@')[0]}
                        </h1>
                        <button onClick={() => setIsEditingUsername(true)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-opacity text-sm">
                            Edit
                        </button>
                    </div>
                )}
                <p className="text-zinc-500 font-mono text-sm">{user.email}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-12">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-5 hover:bg-white/10 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                        <IoHeart size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Liked Songs</p>
                        <p className="text-3xl font-bold">{likedSongsCount}</p>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-5 hover:bg-white/10 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                        <IoMusicalNotes size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-400 text-xs uppercase tracking-wider font-bold mb-1">Playlists</p>
                        <p className="text-3xl font-bold">{playlistsCount}</p>
                    </div>
                </div>
            </div>



            <div className="mt-auto text-zinc-600 text-xs pb-4">
                DrivePlayer v1.0 • Connected as User #{user.id}
            </div>
        </div>
    );
};

export default ProfileScreen;
