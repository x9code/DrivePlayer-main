import React, { useRef, useEffect, useState, useMemo } from 'react';
import { IoPlay, IoPause, IoPlaySkipBack, IoPlaySkipForward, IoShuffle, IoRepeat, IoVolumeHigh, IoVolumeMute, IoChevronDown, IoList, IoHeart, IoHeartOutline, IoMusicalNotes, IoResize, IoExpand, IoMusicalNote, IoAddCircleOutline, IoInformationCircleOutline } from 'react-icons/io5';
import Lyrics from './Lyrics';

// Use environment variable for API URL in production (Vercel), fall back to relative path (proxy) in dev
const API_BASE = import.meta.env.VITE_API_URL || '';

import { cleanTitle } from '../utils/format';

const Player = ({ currentSong, isPlaying, setIsPlaying, onNext, onPrev, isShuffle, repeatMode, onShuffleToggle, onRepeatToggle, likedSongs = [], toggleLike, themeColor, hasSidebar = false, onAddPlaylist }) => {
    const audioRef = useRef(null);
    const prevVolumeRef = useRef(1);
    const [progress, setProgress] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [volume, setVolume] = React.useState(1);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isLosslessModalOpen, setIsLosslessModalOpen] = useState(false);
    const [meta, setMeta] = useState({ title: null, artist: null });
    const [showInfo, setShowInfo] = useState(false);
    const [lyricsStatus, setLyricsStatus] = useState('loading');



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

    // Lyrics State
    const [showLyrics, setShowLyrics] = useState(() => {
        return localStorage.getItem('driveplayer_lyrics_show') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('driveplayer_lyrics_show', showLyrics);
    }, [showLyrics]);



    // Audio Ref for Lyrics Sync on new song
    useEffect(() => {
        if (currentSong) setArtError(false);
    }, [currentSong]);

    useEffect(() => {
        if (currentSong) {
            setMeta({ title: null, artist: null });
            setLyricsStatus('loading'); // Reset lyrics availability on new song
            fetch(`${API_BASE}/api/metadata/${currentSong.id}`)
                .then(res => res.json())
                .then(data => {
                    setMeta(data);
                })
                .catch(err => console.error("Metadata fetch error:", err));
        }
    }, [currentSong]);

    const displayMeta = useMemo(() => {
        if (!currentSong) return { title: '', artist: '' };

        const cleaned = cleanTitle(currentSong.name);

        // Priority: 1. currentSong.title (from list), 2. meta.title (fetched async), 3. cleanTitle(filename)
        let titleText = currentSong.title || meta.title || cleaned;

        // TRUST THE SOURCE: If we have a title from App.jsx or Metadata, use it.
        // Only revert to local cleaning if we have NO title at all.
        if (titleText) {
            return { title: titleText, artist: currentSong.artist || meta.artist || 'Unknown Artist' };
        }

        // Fallback to local cleaning if absolutely necessary
        if (cleaned) {
            titleText = cleaned;
        }

        const artistText = currentSong.artist || meta.artist || 'Unknown Artist';

        return { title: titleText, artist: artistText };
    }, [currentSong, meta]);

    useEffect(() => {
        if (currentSong && audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(e => console.error("Playback failed", e));
            } else {
                audioRef.current.pause();
            }

            const handleFS = () => setIsFullScreen(!!document.fullscreenElement);
            document.addEventListener('fullscreenchange', handleFS);

            document.title = isPlaying ? `${displayMeta.title} • ${displayMeta.artist}` : 'DrivePlayer';

            // MediaSession API
            if ('mediaSession' in navigator) {
                const folderId = currentSong.parents && currentSong.parents[0] ? currentSong.parents[0] : '';
                const artUrl = new URL(`${API_BASE}/api/thumbnail/${currentSong.id}?folderId=${folderId}`, window.location.origin).href;

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: displayMeta.title,
                    artist: displayMeta.artist,
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
    }, [currentSong, isPlaying, displayMeta, onNext, onPrev, setIsPlaying, meta.album]);

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
                case 'KeyB':
                    setIsExpanded(prev => !prev);
                    break;
                case 'KeyN': onNext(false); break;
                case 'KeyP': onPrev(); break;
                case 'KeyF':
                    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(console.log);
                    else if (document.exitFullscreen) document.exitFullscreen();
                    break;
                case 'PageDown':
                    if (isExpanded) setIsExpanded(false);
                    break;
                case 'PageUp':
                    if (!isExpanded) setIsExpanded(true);
                    break;
                default: break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSong, setIsPlaying, onNext, onPrev, isExpanded]);





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
        if (!isExpanded) setIsExpanded(true); // Only expand, never collapse on click
    };

    if (!currentSong) return null;

    return (
        <>
            {/* FLOATING CAPSULE PLAYER (Mini) */}
            <div
                className={`fixed z-50 transition-all duration-700 cubic-bezier(0.32, 0.72, 0, 1) overflow-hidden
                    left-0 right-0 mx-auto
                    ${isExpanded
                        ? 'bottom-0 w-full h-full rounded-none border-none' // Expanded: Fully cover screen (animate up)
                        : 'bottom-6 w-[92vw] md:w-[600px] h-20 rounded-[32px] bg-black/40 backdrop-blur-3xl border border-white/10 hover:scale-[1.02] active:scale-[0.98]' // Mini
                    } text-white`}
                onClick={handlePlayerClick}
                style={{
                    willChange: 'bottom, width, height, border-radius',
                    background: isExpanded
                        ? '#000000'
                        : undefined,
                    boxShadow: !isExpanded
                        ? `0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(${themeColor || '255,255,255'}, 0.25)`
                        : undefined
                }}
            >

                {/* Liquid Glass Background */}
                <div className={`absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-black transition-opacity duration-1000 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                    {/* 1. Deep Ambient Blur (Liquid Base) */}
                    {!artError && (
                        <img
                            src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                            alt=""
                            className="w-full h-full object-cover blur-[120px] opacity-30 saturate-150 animate-pulse-slower transition-transform duration-[20s] ease-in-out scale-150"
                        />
                    )}
                    {/* 2. Glass Shine Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-black/40 to-black/90 mix-blend-overlay"></div>
                </div>

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
                            <div className="flex items-center gap-2 overflow-hidden w-full">
                                <h3 className="font-semibold text-sm truncate text-white min-w-0">{displayMeta.title}</h3>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAddPlaylist(currentSong); }}
                                    className="text-zinc-400 hover:text-white transition-colors shrink-0 mt-[3px]"
                                    title="Add to Playlist"
                                >
                                    <IoAddCircleOutline size={18} />
                                </button>
                            </div>
                            <p className="text-zinc-400 text-xs truncate">{displayMeta.artist}</p>
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
                <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] delay-100 p-8 ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-95'}`}>

                    {/* Header */}
                    <div className="absolute top-8 left-8 right-8 flex justify-between items-center text-zinc-400 z-20">
                        <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="glass-button w-10 h-10 rounded-full flex items-center justify-center hover:text-white">
                            <IoChevronDown size={24} />
                        </button>

                        <div className="flex gap-3">
                            {/* Lyrics Toggle */}
                            {lyricsStatus !== 'unavailable' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowLyrics(!showLyrics); setShowInfo(false); }}
                                    className={`glass-button h-10 px-4 rounded-full flex items-center justify-center gap-2 transition-all ${showLyrics ? 'bg-primary/20 text-primary border-primary/30' : 'hover:text-white'}`}
                                >
                                    <IoMusicalNote size={16} />
                                    <span className="text-xs font-bold">Lyrics</span>
                                </button>
                            )}

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

                    {/* Main Content — CSS Grid layout for smooth column animation */}
                    <div
                        className={`w-full h-full z-10 grid items-stretch transition-[grid-template-columns,opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                        style={{
                            gridTemplateColumns: showLyrics ? '2fr 3fr' : '1fr 0fr',
                            gap: showLyrics ? '2rem' : '0px',
                            maxWidth: showLyrics ? '72rem' : '28rem',
                            margin: '0 auto',
                            transition: 'grid-template-columns 0.7s cubic-bezier(0.2,0.8,0.2,1), gap 0.7s cubic-bezier(0.2,0.8,0.2,1), max-width 0.7s cubic-bezier(0.2,0.8,0.2,1), opacity 0.7s cubic-bezier(0.2,0.8,0.2,1), transform 0.7s cubic-bezier(0.2,0.8,0.2,1)',
                        }}
                    >

                        {/* LEFT COLUMN: Album Art + Controls */}
                        <div className="flex flex-col items-center justify-center gap-6 min-w-0 will-change-transform">

                            {/* Artwork Container */}
                            <div className="relative flex items-center justify-center">

                                {/* Album Art Container with Perspective */}
                                <div className={`relative group transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${showLyrics ? 'w-60 h-60 md:w-72 md:h-72' : 'w-72 h-72 md:w-96 md:h-96'}`} style={{ perspective: '1200px' }}>

                                    {/* 3D Flipper Layer */}
                                    <div
                                        className="w-full h-full relative duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform"
                                        style={{ transformStyle: 'preserve-3d', transform: showInfo ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                                    >
                                        {/* =======================
                                            FRONT FACE (Album Art)
                                            ======================= */}
                                        <div
                                            className="absolute inset-0 w-full h-full rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden bg-black/20 ring-1 ring-white/10"
                                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                                        >
                                            {/* Like Button Overlay (Top Right) */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }}
                                                className={`absolute top-4 right-4 z-40 p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg
                                                    ${isLiked
                                                        ? 'bg-black/30 text-primary shadow-primary/20 scale-105'
                                                        : 'bg-black/20 text-white/70 hover:bg-black/40 hover:text-white hover:scale-105'}
                                                `}
                                            >
                                                {isLiked ? <IoHeart size={22} /> : <IoHeartOutline size={22} />}
                                            </button>

                                            {/* Info Button Overlay (Bottom Left) */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowInfo(true); }}
                                                className={`absolute bottom-4 left-4 z-40 p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg bg-black/30 text-white/70 hover:bg-black/50 hover:text-white hover:scale-105`}
                                                title="Song Info"
                                            >
                                                <IoInformationCircleOutline size={22} />
                                            </button>

                                            {!artError ? (
                                                <img
                                                    src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                                                    alt="Art"
                                                    className="w-full h-full object-cover"
                                                    onError={() => setArtError(true)}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900">
                                                    <IoMusicalNotes size={64} />
                                                </div>
                                            )}
                                        </div>

                                        {/* =======================
                                            BACK FACE (Song Info)
                                            ======================= */}
                                        <div
                                            className="absolute inset-0 w-full h-full rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 overflow-hidden flex flex-col pointer-events-auto"
                                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {/* Gradient Background */}
                                            <div className="absolute inset-0 -z-10 bg-black pointer-events-none">
                                                {!artError && (
                                                    <img
                                                        src={`${API_BASE}/api/thumbnail/${currentSong.id}`}
                                                        alt=""
                                                        className="w-full h-full object-cover blur-3xl opacity-60 saturate-150 scale-125"
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/90"></div>
                                            </div>

                                            {/* Header: Title and Like button */}
                                            <div className="relative z-10 flex items-center justify-between px-6 py-3 shrink-0 border-b border-white/10">
                                                <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest">Song Info</h3>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }}
                                                    className={`p-2 rounded-full transition-all duration-300 shadow-lg
                                                        ${isLiked
                                                            ? 'bg-black/40 text-primary shadow-primary/20 scale-105'
                                                            : 'bg-black/20 text-white/70 hover:bg-black/40 hover:text-white hover:scale-105'}
                                                    `}
                                                >
                                                    {isLiked ? <IoHeart size={18} /> : <IoHeartOutline size={18} />}
                                                </button>
                                            </div>

                                            {/* Content body */}
                                            <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto pb-16 text-left" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                                <div>
                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Title</span>
                                                    <p className="text-[15px] text-zinc-100 font-semibold leading-tight">{displayMeta.title}</p>
                                                </div>

                                                <div className="flex gap-4">
                                                    <div className="flex-[2]">
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Artist</span>
                                                        <p className="text-[15px] text-zinc-100 font-semibold leading-tight truncate">{displayMeta.artist}</p>
                                                    </div>
                                                    {meta.year && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Year</span>
                                                            <p className="text-[15px] text-zinc-100 font-semibold leading-tight">{meta.year}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-4">
                                                    {meta.album && (
                                                        <div className="flex-[2] min-w-0">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Album</span>
                                                            <p className="text-[15px] text-zinc-100 font-semibold leading-tight truncate">{meta.album}</p>
                                                        </div>
                                                    )}
                                                    {meta.track && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Track</span>
                                                            <p className="text-[15px] text-zinc-100 font-semibold leading-tight">{meta.track}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {meta.genre && (
                                                    <div>
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Genre</span>
                                                        <p className="text-[14px] text-zinc-100 font-semibold leading-tight truncate">{meta.genre}</p>
                                                    </div>
                                                )}

                                                <div className="flex gap-4">
                                                    {duration > 0 && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Duration</span>
                                                            <p className="text-[14px] text-zinc-100 font-semibold">{formatTime(duration)}</p>
                                                        </div>
                                                    )}
                                                    {meta.codec && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Codec</span>
                                                            <p className="text-[14px] text-zinc-100 font-semibold uppercase">{meta.codec}</p>
                                                        </div>
                                                    )}
                                                    {meta.bitrate && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Bitrate</span>
                                                            <p className="text-[14px] text-zinc-100 font-semibold">{Math.round(meta.bitrate / 1000)} kbps</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-4">
                                                    {meta.sampleRate && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Sample</span>
                                                            <p className="text-[14px] text-zinc-100 font-semibold">{(meta.sampleRate / 1000).toFixed(1)} kHz</p>
                                                        </div>
                                                    )}
                                                    {meta.bitsPerSample && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Depth</span>
                                                            <p className="text-[14px] text-zinc-100 font-semibold">{meta.bitsPerSample}-bit</p>
                                                        </div>
                                                    )}
                                                    {currentSong?.size && (
                                                        <div className="flex-1">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Size</span>
                                                            <p className="text-[14px] text-zinc-100 font-semibold">{(currentSong.size / (1024 * 1024)).toFixed(1)} MB</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Back (Info) Button Overlay (Bottom Left) -> exactly like front to act as a toggle off */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowInfo(false); }}
                                                className={`absolute bottom-4 left-4 z-40 p-3 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg bg-black/60 text-primary shadow-[0_0_15px_rgba(var(--theme-color),0.3)] ring-1 ring-primary/30`}
                                                title="Back to Artwork"
                                            >
                                                <IoInformationCircleOutline size={22} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Text */}
                            <div className={`text-center space-y-1 transition-all duration-700 ${showLyrics ? 'max-w-[280px]' : ''}`}>
                                <div className="flex items-center justify-center gap-3">
                                    <h2 className={`font-bold text-white truncate transition-all duration-700 ${showLyrics ? 'text-xl max-w-[250px]' : 'text-3xl max-w-xs'}`}>{displayMeta.title}</h2>
                                </div>
                                <p className={`text-zinc-400 font-medium transition-all duration-700 ${showLyrics ? 'text-sm' : 'text-lg'}`}>{displayMeta.artist}</p>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full space-y-2 group">
                                <div className="w-full h-1.5 bg-white/20 backdrop-blur-sm rounded-full cursor-pointer relative overflow-visible shadow-inner">
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 0}
                                        value={progress || 0}
                                        onChange={handleSeek}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                    />
                                    <div
                                        className="h-full bg-primary rounded-full relative shadow-[0_0_10px_rgba(var(--theme-color),0.5)]"
                                        style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                                    >
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity scale-0 group-hover:scale-100"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs font-medium text-zinc-500 font-mono">
                                    <span>{formatTime(progress)}</span>

                                    {/* Apple Music Lossless Badge */}
                                    {meta.filename && meta.filename.toLowerCase().endsWith('.flac') && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsLosslessModalOpen(true);
                                                }}
                                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-500/15 border border-white/5 shadow-sm opacity-80 hover:opacity-100 hover:bg-zinc-500/25 transition-all cursor-pointer"
                                                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif' }}
                                            >
                                                <svg width="11" height="8" viewBox="0 0 22 11" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-zinc-300">
                                                    <path d="M1 5.5C1 5.5 3 1 5.5 1C8 1 10 5.5 10 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M6.5 5.5C6.5 5.5 8.5 1 11 1C13.5 1 15.5 5.5 15.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M12 5.5C12 5.5 14 1 16.5 1C19 1 21 5.5 21 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M1 5.5C1 5.5 3 10 5.5 10C8 10 10 5.5 10 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M6.5 5.5C6.5 5.5 8.5 10 11 10C13.5 10 15.5 5.5 15.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M12 5.5C12 5.5 14 10 16.5 10C19 10 21 5.5 21 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                <span className="text-[9px] font-semibold text-zinc-200 tracking-normal ml-0.5">
                                                    {(meta.sampleRate > 48000) ? 'Hi-Res Lossless' : 'Lossless'}
                                                </span>
                                            </button>

                                            {/* Lossless Details Modal */}
                                            {isLosslessModalOpen && (
                                                <div
                                                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsLosslessModalOpen(false);
                                                    }}
                                                >
                                                    <div
                                                        className="w-[90%] max-w-[320px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-[18px] overflow-hidden shadow-2xl flex flex-col animate-scale-in origin-center"
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif' }}
                                                    >
                                                        <div className="flex flex-col items-center justify-center pt-8 pb-6 px-6 space-y-4">
                                                            <div className="w-16 h-12 text-white flex items-center justify-center mb-1">
                                                                <svg width="68" height="42" viewBox="0 0 22 11" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                                                                    <path d="M1 5.5C1 5.5 3 1 5.5 1C8 1 10 5.5 10 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M6.5 5.5C6.5 5.5 8.5 1 11 1C13.5 1 15.5 5.5 15.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M12 5.5C12 5.5 14 1 16.5 1C19 1 21 5.5 21 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M1 5.5C1 5.5 3 10 5.5 10C8 10 10 5.5 10 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M6.5 5.5C6.5 5.5 8.5 10 11 10C13.5 10 15.5 5.5 15.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M12 5.5C12 5.5 14 10 16.5 10C19 10 21 5.5 21 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            </div>
                                                            <div className="text-center space-y-1">
                                                                <h3 className="text-[17px] font-bold text-white">
                                                                    {(meta.sampleRate > 48000) ? 'Hi-Res Lossless' : 'Lossless'}
                                                                </h3>
                                                                <p className="text-[13px] text-zinc-400 font-medium">
                                                                    {meta.bitsPerSample || 16}-bit/{((meta.sampleRate || 44100) / 1000).toFixed(1)} kHz {meta.codec || 'FLAC'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 border-t border-white/10">
                                                            <button
                                                                onClick={() => setIsLosslessModalOpen(false)}
                                                                className="h-[44px] flex items-center justify-center text-[17px] font-semibold text-primary hover:bg-white/5 active:bg-white/10 transition-colors"
                                                            >
                                                                OK
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Main Controls */}
                            <div className={`flex items-center justify-between w-full transition-all duration-700 ${showLyrics ? 'max-w-[280px]' : 'max-w-xs'} px-4`}>
                                <button onClick={(e) => { e.stopPropagation(); onShuffleToggle(); }} className={`transition-colors ${isShuffle ? 'text-primary' : 'text-zinc-500 hover:text-white'}`}>
                                    <IoShuffle size={showLyrics ? 20 : 24} />
                                </button>

                                <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-white hover:scale-110 transition-transform">
                                    <IoPlaySkipBack size={showLyrics ? 26 : 32} />
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                                    className={`bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] ${showLyrics ? 'w-16 h-16' : 'w-20 h-20'}`}
                                >
                                    {isPlaying ? <IoPause size={showLyrics ? 26 : 32} /> : <IoPlay size={showLyrics ? 28 : 36} className="pl-1" />}
                                </button>

                                <button onClick={(e) => { e.stopPropagation(); onNext(false); }} className="text-white hover:scale-110 transition-transform">
                                    <IoPlaySkipForward size={showLyrics ? 26 : 32} />
                                </button>

                                <button onClick={(e) => { e.stopPropagation(); onRepeatToggle(); }} className={`transition-colors ${repeatMode > 0 ? 'text-primary' : 'text-zinc-500 hover:text-white'} relative`}>
                                    <IoRepeat size={showLyrics ? 20 : 24} />
                                    {repeatMode === 2 && <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-black px-1 rounded-full font-bold">1</span>}
                                </button>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Lyrics Panel — always rendered, animated via opacity+transform */}
                        <div
                            className={`h-full min-h-0 rounded-2xl overflow-hidden transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-[opacity,transform] ${showLyrics ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}
                        >
                            <Lyrics
                                audioRef={audioRef}
                                artist={displayMeta.artist}
                                title={displayMeta.title}
                                duration={duration}
                                isExpanded={isExpanded}
                                onAvailable={(available) => {
                                    if (available) {
                                        setLyricsStatus('available');
                                    } else {
                                        setLyricsStatus('unavailable');
                                        setShowLyrics(false);
                                    }
                                }}
                            />
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
                        onError={(e) => {
                            console.error("Audio Playback Error", e);
                            const error = e.target.error;
                            if (error && error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                                // Likely 403 or Network Error
                                console.warn("Stream failed, likely rate limit or network.");
                            }
                            setIsPlaying(false);
                        }}
                    />
                )}
            </div>
        </>
    );
};

export default Player;
