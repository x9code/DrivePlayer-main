import React, { useState } from 'react';
import { IoPlay, IoArrowBack, IoTimeOutline, IoFilterOutline, IoPencil, IoChevronDown, IoChevronUp, IoHeart, IoHeartOutline } from 'react-icons/io5';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FolderCard = React.memo(({ folder, onFolderClick, onFolderPlay, uploading, customCoverUrl, defaultCover, handleCoverUpload }) => {
    return (
        <div
            onClick={() => onFolderClick(folder.id)}
            className="group bg-white/5 backdrop-blur-2xl border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-500 p-4 rounded-3xl cursor-pointer flex flex-col gap-4 shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:-translate-y-1 relative"
        >
            <div className="relative w-full aspect-square rounded-2xl shadow-lg flex items-center justify-center overflow-hidden bg-zinc-800/50">
                <img
                    src={customCoverUrl}
                    onError={(e) => { e.target.onerror = null; e.target.src = defaultCover; }}
                    alt={folder.name}
                    className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 ${uploading === folder.id ? 'opacity-50 blur-sm' : ''} will-change-transform`}
                />

                {/* Loading Spinner during Upload */}
                {uploading === folder.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Edit Button (Top-Left) */}
                <label
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-3 top-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full p-2.5 shadow-lg hover:scale-105 cursor-pointer border border-white/10"
                    title="Change Cover Image"
                >
                    <IoPencil size={16} />
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleCoverUpload(folder.id, e.target.files[0])}
                    />
                </label>

                {/* Play Button (Bottom-Right) */}
                <div className="absolute right-3 bottom-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out z-10">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onFolderPlay(folder.id);
                        }}
                        className="bg-white/90 rounded-full p-3.5 text-black shadow-xl hover:scale-105 transition-transform hover:bg-white"
                        title="Play Folder (Shuffle)"
                    >
                        <IoPlay size={22} className="pl-0.5 text-black" />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-0.5 px-1">
                <h4 className="font-semibold text-base text-gray-100 truncate w-full" title={folder.name}>{folder.name}</h4>
                <p className="text-xs font-medium text-gray-400">Folder</p>
            </div>
        </div>
    );
});

const Equalizer = () => (
    <div className="flex items-end gap-[3px] h-4 w-5 justify-center">
        <div className="w-[3px] bg-primary rounded-t-full" style={{ animation: 'equalize 0.8s infinite', animationDelay: '0s' }}></div>
        <div className="w-[3px] bg-primary rounded-t-full" style={{ animation: 'equalize 0.8s infinite', animationDelay: '0.2s' }}></div>
        <div className="w-[3px] bg-primary rounded-t-full" style={{ animation: 'equalize 0.8s infinite', animationDelay: '0.4s' }}></div>
    </div>
);

const SongRow = React.memo(({ file, index, isCurrent, onPlay, cleanTitle, formatSize, isLiked, toggleLike }) => {
    return (
        <div
            onClick={() => onPlay(file)}
            className={`group grid grid-cols-[32px_1fr_100px] md:grid-cols-[48px_1fr_120px] items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-300 border border-transparent 
                ${isCurrent ? 'bg-white/10 backdrop-blur-md border-white/5 shadow-lg' : 'hover:bg-white/5 hover:backdrop-blur-sm hover:border-white/5'}
            `}
        >
            {/* Play/Index Column */}
            <div className="text-zinc-400 text-center text-xs font-semibold flex justify-center items-center h-full">
                {isCurrent ? (
                    <Equalizer />
                ) : (
                    <>
                        <span className="group-hover:hidden font-variant-numeric tabular-nums">{index + 1}</span>
                        <IoPlay size={14} className="hidden group-hover:block text-white ml-0.5" />
                    </>
                )}
            </div>

            {/* Title Column */}
            <div className="flex items-center gap-4 min-w-0">
                <div className="flex-1 min-w-0">
                    <h4 className={`truncate font-medium text-[15px] leading-snug ${isCurrent ? 'text-primary' : 'text-gray-200 group-hover:text-white'}`}>
                        {cleanTitle(file.name)}
                    </h4>
                </div>
            </div>

            {/* Size/Duration Column */}
            <div className="text-xs font-medium text-zinc-500 group-hover:text-zinc-400 text-right font-variant-numeric tabular-nums flex items-center justify-end gap-1">
                <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(file); }}
                    className={`mr-4 transition-all duration-200 hover:scale-110 focus:outline-none
                        ${isLiked
                            ? 'opacity-100 text-primary'
                            : 'opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white'}
                    `}
                    title={isLiked ? "Remove from Favorites" : "Add to Favorites"}
                >
                    {isLiked ? <IoHeart size={16} /> : <IoHeartOutline size={16} />}
                </button>
                {formatSize(file.size)}
            </div>
        </div>
    );
});

const SongList = ({ files, currentSong, onPlay, onFolderClick, onFolderPlay, loading, cleanTitle, likedSongs = [], toggleLike }) => {

    const [uploading, setUploading] = useState(null); // folderId being uploaded to
    const [cacheBuster, setCacheBuster] = useState(Date.now()); // Force image refresh

    const handleCoverUpload = async (folderId, file) => {
        if (!file) return;

        // Validation: 5MB Limit
        if (file.size > 5 * 1024 * 1024) {
            alert("Image is too large! Please upload a cover smaller than 5MB.");
            return;
        }

        const formData = new FormData();
        formData.append('folderId', folderId);
        formData.append('image', file);

        setUploading(folderId);

        try {
            await axios.post(`${API_BASE}/api/folder/cover`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Success: Update cache buster to refresh images
            setCacheBuster(Date.now());
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload cover.");
        } finally {
            setUploading(null);
        }
    };

    // Separate content
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const songs = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // Format Bytes
    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-40 pt-4 px-5 md:px-10">

            {/* Folder Grid (Spotify Cards) */}
            {folders.length > 0 && (
                <div className="mb-14">
                    <h3 className="text-xl font-bold mb-6 text-white/90 px-1">Folders</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {folders.map(folder => {
                            // Deterministic cover selection (Fallback)
                            const hash = folder.name.split("").reduce((a, b) => {
                                a = ((a << 5) - a) + b.charCodeAt(0);
                                return a & a;
                            }, 0);
                            const coverIndex = (Math.abs(hash) % 4) + 1;
                            const defaultCover = `/covers/${coverIndex}.png`;
                            const customCoverUrl = `${API_BASE}/api/folder/cover/${folder.id}?t=${cacheBuster}`;

                            return (
                                <FolderCard
                                    key={folder.id}
                                    folder={folder}
                                    onFolderClick={onFolderClick}
                                    onFolderPlay={onFolderPlay}
                                    uploading={uploading}
                                    customCoverUrl={customCoverUrl}
                                    defaultCover={defaultCover}
                                    handleCoverUpload={handleCoverUpload}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Song List Table */}
            {songs.length > 0 && (
                <div>
                    {/* Table Header */}
                    <div className="grid grid-cols-[32px_1fr_100px] md:grid-cols-[48px_1fr_120px] items-center gap-4 px-4 py-3 border-b border-white/5 text-zinc-500 text-xs font-semibold mb-2 uppercase tracking-widest">
                        <span className="text-center">#</span>
                        <span className="pl-1">Title</span>
                        <span className="text-right flex items-center justify-end gap-1"><IoTimeOutline size={14} /> Size</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        {songs.map((file, index) => (
                            <SongRow
                                key={file.id}
                                file={file}
                                index={index}
                                isCurrent={currentSong?.id === file.id}
                                onPlay={onPlay}
                                cleanTitle={cleanTitle}
                                formatSize={formatSize}
                                isLiked={likedSongs.some(s => s.id === file.id)}
                                toggleLike={toggleLike}
                            />
                        ))}
                    </div>
                </div>
            )}

            {loading && (
                <div className="text-center py-20 text-zinc-500 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                </div>
            )}

            {!loading && files.length === 0 && (
                <div className="text-center py-32 text-zinc-500">
                    <p className="text-lg font-medium">No contents found</p>
                    <p className="text-sm">Try exploring other folders</p>
                </div>
            )}
        </div>
    );
};

export default SongList;
