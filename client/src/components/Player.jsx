import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
    IoPlay, IoPause, IoPlaySkipForward, IoPlaySkipBack, IoShuffle, IoRepeat,
    IoHeart, IoHeartOutline, IoVolumeHigh, IoVolumeMute,
    IoChevronDown, IoResize, IoExpand, IoMusicalNotes
} from 'react-icons/io5';

// Use environment variable for API URL in production (Vercel), fall back to relative path (proxy) in dev
const API_BASE = import.meta.env.VITE_API_URL || '';

const Player = ({ currentSong, isPlaying, setIsPlaying, onNext, onPrev, isShuffle, repeatMode, onShuffleToggle, onRepeatToggle, cleanTitle, likedSongs = [], toggleLike, themeColor }) => {
    const audioRef = useRef(null);
    const prevVolumeRef = useRef(1);
    const [progress, setProgress] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(1);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [meta, setMeta] = useState({ title: null, artist: null });

    // Lock Body Scroll when Expanded
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isExpanded]);

    const isLiked = useMemo(() => {
        if (!currentSong) return false;
        return likedSongs.some(s => s.id === currentSong.id);
    }, [currentSong, likedSongs]);



    const [artError, setArtError] = useState(false);

    // Reset error state on new song
    useEffect(() => {
        if (currentSong) setArtError(false);
    }, [currentSong]);

    useEffect(() => {
        if (currentSong) {
            setMeta({ title: null, artist: null });
            fetch(`${API_BASE}/api/metadata/${currentSong.id}`)
                .then(res => res.json())
                .then(data => {
                    setMeta(data);
                })
                .catch(err => console.error("Metadata fetch error:", err));
        }
    }, [currentSong]);

    useEffect(() => {
        if (currentSong && audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(e => console.error("Playback failed", e));
            } else {
                audioRef.current.pause();
            }

            const handleFS = () => setIsFullScreen(!!document.fullscreenElement);
            document.addEventListener('fullscreenchange', handleFS);

            const titleText = meta.title || (cleanTitle ? cleanTitle(currentSong.name) : currentSong.name);
            const artistText = meta.artist || 'DrivePlayer';
            document.title = isPlaying ? `${titleText} • ${artistText}` : 'DrivePlayer';

            // MediaSession API
            if ('mediaSession' in navigator) {
                const folderId = currentSong.parents && currentSong.parents[0] ? currentSong.parents[0] : '';
                const artUrl = new URL(`${API_BASE}/api/thumbnail/${currentSong.id}?folderId=${folderId}`, window.location.origin).href;

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: titleText,
                    artist: artistText,
                    album: meta.album || 'DrivePlayer',
                    artwork: [
                        { src: artUrl, sizes: '96x96', type: 'image/png' },
                        { src: artUrl, sizes: '128x128', type: 'image/png' },
                        { src: artUrl, sizes: '192x192', type: 'image/png' },
                        { src: artUrl, sizes: '256x256', type: 'image/png' },
                        { src: artUrl, sizes: '384x384', type: 'image/png' },
                        { src: artUrl, sizes: '512x512', type: 'image/png' },
                    ]
                });

                navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

                navigator.mediaSession.setActionHandler('play', () => {
                    setIsPlaying(true);
                    audioRef.current.play();
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    setIsPlaying(false);
                    audioRef.current.pause();
                });
                navigator.mediaSession.setActionHandler('previoustrack', () => onPrev());
                navigator.mediaSession.setActionHandler('nexttrack', () => onNext(false));
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.seekTime && audioRef.current) {
                        audioRef.current.currentTime = details.seekTime;
                        setProgress(details.seekTime);
                    }
                });
            }

            return () => {
                document.removeEventListener('fullscreenchange', handleFS);
            };
        }
    }, [currentSong, isPlaying, meta, onNext, onPrev, setIsPlaying]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!currentSong || !audioRef.current) return;
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    setIsPlaying(prev => !prev);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
                    setProgress(audioRef.current.currentTime);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
                    setProgress(audioRef.current.currentTime);
                    break;
                case 'KeyN': onNext(false); break;
                case 'KeyP': onPrev(); break;
                case 'KeyF':
                    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(console.log);
                    else if (document.exitFullscreen) document.exitFullscreen();
                    break;
                default: break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSong, setIsPlaying, onNext, onPrev]);







    const handleTimeUpdate = () => {
        const current = audioRef.current.currentTime;
        const dur = audioRef.current.duration;
        setProgress(current);
        setDuration(dur);
    };

    const handleSeek = (e) => {
        const time = e.target.value;
        audioRef.current.currentTime = time;
        setProgress(time);
    };

    const handleVolume = (e) => {
        const vol = e.target.value;
        setVolume(vol);
        audioRef.current.volume = vol;
    };

    const togglePlay = (e) => {
        e.stopPropagation();
        setIsPlaying(!isPlaying);
    };

    const formatTime = (time) => {
        if (!time) return '0:00';
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    const handlePlayerClick = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        setIsExpanded(prev => !prev);
    };

    if (!currentSong) return null;

    return (
        <>
            {/* FLOATING CAPSULE PLAYER (Mini) */}
            <div
                className={`fixed z-50 transition-all duration-700 cubic-bezier(0.32, 0.72, 0, 1) overflow-hidden
                    left-1/2 -translate-x-1/2 shadow-2xl
                    ${isExpanded
                        ? 'bottom-0 w-full h-full rounded-none' // Expanded
                        : 'bottom-6 w-[92vw] md:w-[600px] h-20 rounded-[32px] bg-black/40 backdrop-blur-3xl border border-white/10 hover:scale-[1.02] active:scale-[0.98]' // Mini
                    } text-white`}
                onClick={handlePlayerClick}
                style={{
                    willChange: 'width, height, bottom, border-radius',
                    background: isExpanded
                        ? `radial-gradient(circle at 50% 30%, rgba(${themeColor || '80, 80, 80'}, 0.25), rgba(0, 0, 0, 0.95))`
                        : undefined
                }}
            >

                {/* Liquid Glass Background */}
                {isExpanded && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                        {/* 1. Deep Ambient Blur (Liquid Base) */}
                        {!artError && (
                            <img
                                src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                                alt=""
                                className="w-full h-full object-cover blur-[120px] scale-150 opacity-50 saturate-150 animate-pulse-slow transition-all duration-1000"
                            />
                        )}
                        {/* 2. Glass Shine Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/80 mix-blend-overlay"></div>
                    </div>
                )}

                {/* --- MINI CONTENT --- */}
                <div className={`absolute inset-0 flex items-center justify-between px-2 pr-6 transition-all duration-500 ease-out ${isExpanded ? 'opacity-0 pointer-events-none scale-90 translate-y-4' : 'opacity-100 scale-100 translate-y-0 delay-100'}`}>

                    {/* Left: Art & Text */}
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <div className="w-16 h-16 p-1 flex-shrink-0">
                            <div className="relative w-full h-full rounded-full overflow-hidden shadow-md">
                                {/* Fallback Icon (always behind) */}
                                <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                                    <IoMusicalNotes className="text-zinc-500 text-2xl animate-pulse" />
                                </div>
                                {/* Album Art */}
                                {!artError && (
                                    <img
                                        key={currentSong.id} // Force remount on song change
                                        src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                                        alt="Art"
                                        className="relative w-full h-full object-cover rounded-full animate-[spin_10s_linear_infinite]"
                                        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                                        onError={() => setArtError(true)}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <h3 className="font-semibold text-sm truncate text-white">{meta.title || (cleanTitle ? cleanTitle(currentSong.name) : currentSong.name)}</h3>
                            <p className="text-zinc-400 text-xs truncate">{meta.artist || 'Unknown Artist'}</p>
                        </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }}
                            className={`transition-colors hidden sm:block ${isLiked ? 'text-primary' : 'text-zinc-400 hover:text-white'}`}
                        >
                            {isLiked ? <IoHeart size={20} /> : <IoHeartOutline size={20} />}
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-zinc-300 hover:text-white hidden sm:block">
                            <IoPlaySkipBack size={20} />
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                            className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                        >
                            {isPlaying ? <IoPause size={18} /> : <IoPlay size={20} className="pl-0.5" />}
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-zinc-300 hover:text-white">
                            <IoPlaySkipForward size={20} />
                        </button>
                    </div>

                    {/* Progress Bar (Attached to bottom of capsule) */}
                    <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary shadow-[0_0_10px_rgba(29,185,84,0.5)]"
                            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                        />
                    </div>
                </div>


                {/* --- EXPANDED CONTENT --- */}
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 transition-all duration-300 delay-100 ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-95'}`}>

                    {/* Header */}
                    <div className="absolute top-8 left-8 right-8 flex justify-between items-center text-zinc-400 z-20">
                        <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="glass-button w-10 h-10 rounded-full flex items-center justify-center hover:text-white">
                            <IoChevronDown size={24} />
                        </button>

                        <div className="flex gap-3">
                            {/* Settings Toggle */}


                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                                    else if (document.exitFullscreen) document.exitFullscreen();
                                }}
                                className="glass-button w-10 h-10 rounded-full flex items-center justify-center hover:text-white"
                            >
                                {isFullScreen ? <IoResize size={18} /> : <IoExpand size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Main Content Container with Staggered Entry */}
                    <div className={`flex flex-col items-center w-full max-w-md gap-8 z-10 transition-all duration-700 delay-100 ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                        {/* Artwork */}
                        <div className="w-72 h-72 md:w-96 md:h-96 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden bg-black/20 ring-1 ring-white/10 group relative transform transition-transform duration-500 hover:scale-[1.02] isolation-isolate">
                            {/* Like Button Overlay */}
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }}
                                className={`absolute top-4 right-4 z-20 p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg
                                    ${isLiked
                                        ? 'bg-black/30 text-primary shadow-primary/20 scale-105'
                                        : 'bg-black/20 text-white/70 hover:bg-black/40 hover:text-white hover:scale-105'}
                                `}
                            >
                                {isLiked ? <IoHeart size={22} /> : <IoHeartOutline size={22} />}
                            </button>

                            {!artError ? (
                                <img
                                    src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                                    alt="Art"
                                    className="w-full h-full object-cover rounded-3xl transition-transform duration-700 group-hover:scale-105"
                                    onError={() => setArtError(true)}
                                />
                            ) : (
                                <div className="w-full h-full rounded-3xl flex items-center justify-center text-zinc-600">
                                    <IoMusicalNotes size={64} />
                                </div>
                            )}
                        </div>

                        {/* Text */}
                        <div className="text-center space-y-1">
                            <div className="flex items-center justify-center gap-3">
                                <h2 className="text-3xl font-bold text-white truncate max-w-xs">{meta.title || (cleanTitle ? cleanTitle(currentSong.name) : currentSong.name)}</h2>
                            </div>
                            <p className="text-lg text-zinc-400 font-medium">{meta.artist || 'Unknown Artist'}</p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full space-y-2 group">
                            <div className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer relative overflow-visible">
                                <input
                                    type="range"
                                    min="0"
                                    max={duration || 0}
                                    value={progress || 0}
                                    onChange={handleSeek}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                />
                                <div
                                    className="h-full bg-primary rounded-full relative"
                                    style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                                >
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity scale-0 group-hover:scale-100"></div>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-zinc-500 font-mono">
                                <span>{formatTime(progress)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Main Controls */}
                        <div className="flex items-center justify-between w-full max-w-xs px-4">
                            <button onClick={(e) => { e.stopPropagation(); onShuffleToggle(); }} className={`transition-colors ${isShuffle ? 'text-primary' : 'text-zinc-500 hover:text-white'}`}>
                                <IoShuffle size={24} />
                            </button>

                            <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-white hover:scale-110 transition-transform">
                                <IoPlaySkipBack size={32} />
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                                className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                            >
                                {isPlaying ? <IoPause size={32} /> : <IoPlay size={36} className="pl-1" />}
                            </button>

                            <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-white hover:scale-110 transition-transform">
                                <IoPlaySkipForward size={32} />
                            </button>

                            <button onClick={(e) => { e.stopPropagation(); onRepeatToggle(); }} className={`transition-colors ${repeatMode > 0 ? 'text-primary' : 'text-zinc-500 hover:text-white'} relative`}>
                                <IoRepeat size={24} />
                                {repeatMode === 2 && <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-black px-1 rounded-full font-bold">1</span>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Audio Element */}
                {currentSong && (
                    <audio
                        ref={audioRef}
                        crossOrigin="anonymous"
                        src={`${API_BASE}/api/stream/${currentSong.id}`}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => onNext(true)}
                        autoPlay
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                )}
            </div>
        </>
    );
};

export default Player;
