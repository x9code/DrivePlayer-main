import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const Lyrics = ({ audioRef, artist, title, duration, isExpanded, isIdle }) => {
    const [lyrics, setLyrics] = useState([]);
    const [plainLyrics, setPlainLyrics] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [lineProgress, setLineProgress] = useState(0); // 0-1 progress through active line
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);
    const linesRef = useRef([]);
    const [translateY, setTranslateY] = useState(0);

    // Fetch Lyrics (via backend proxy to avoid CORS)
    useEffect(() => {
        if (!artist || !title) return;

        const fetchLyrics = async () => {
            setLoading(true);
            setError(null);
            setLyrics([]);
            setPlainLyrics(null);
            setActiveIndex(-1);
            setLineProgress(0);

            try {
                // 1. Try Primary Fetch (GET via proxy)
                const params = { artist_name: artist, track_name: title };
                if (duration) params.duration = Math.round(duration);

                try {
                    const response = await axios.get(`${API_BASE}/api/lyrics/get`, { params });
                    if (response.data) {
                        if (response.data.syncedLyrics) {
                            const parsed = parseLrc(response.data.syncedLyrics);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                setLyrics(parsed);
                                return;
                            }
                            // syncedLyrics had no timestamps — show as plain text
                            setPlainLyrics(response.data.syncedLyrics || response.data.plainLyrics);
                            return;
                        } else if (response.data.plainLyrics) {
                            setPlainLyrics(response.data.plainLyrics);
                            return;
                        }
                    }
                } catch (e) {
                    // Primary fetch failed, try search...
                }

                // 2. Fallback: Search API (Full Artist)
                let searchRes = await axios.get(`${API_BASE}/api/lyrics/search`, {
                    params: { q: artist + ' ' + title }
                });

                if (searchRes.data && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
                    handleMatch(searchRes.data);
                    return;
                }

                // 3. Fallback: Search API (Clean Artist - remove "ft.", ";", "&", ",")
                const cleanArtist = artist.split(/;| & | ft\. | feat\. |, /i)[0].trim();

                if (cleanArtist && cleanArtist !== artist) {
                    searchRes = await axios.get(`${API_BASE}/api/lyrics/search`, {
                        params: { q: cleanArtist + ' ' + title }
                    });

                    if (searchRes.data && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
                        handleMatch(searchRes.data);
                        return;
                    }
                }

                setError("No lyrics found");

            } catch (err) {
                console.warn("Lyrics fetch failed:", err);
                setError("No lyrics found");
            } finally {
                setLoading(false);
            }
        };

        const handleMatch = (results) => {
            const match = results.find(item => item.syncedLyrics) || results[0];

            if (match && match.syncedLyrics) {
                const parsed = parseLrc(match.syncedLyrics);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setLyrics(parsed);
                } else {
                    // syncedLyrics without timestamps — show as plain
                    setPlainLyrics(match.syncedLyrics);
                }
            } else if (match && match.plainLyrics) {
                setPlainLyrics(match.plainLyrics);
            } else {
                setError("No lyrics found");
            }
        };

        const timeout = setTimeout(fetchLyrics, 500);
        return () => clearTimeout(timeout);
    }, [artist, title, duration]);

    // Parse LRC format [mm:ss.xx] text
    const parseLrc = (lrc) => {
        if (typeof lrc !== 'string') return [];
        const lines = lrc.split('\n');
        const result = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        for (const line of lines) {
            const match = timeRegex.exec(line);
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const milliseconds = parseInt(match[3], 10);
                const time = minutes * 60 + seconds + milliseconds / (match[3].length === 3 ? 1000 : 100);
                const text = line.replace(timeRegex, '').trim();

                if (text) {
                    result.push({ time, text });
                }
            }
        }
        return result;
    };

    // Ref for active index to avoid dependency loop
    const activeIndexRef = useRef(activeIndex);
    useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

    // Main sync loop — tracks active line AND per-line progress
    useEffect(() => {
        if (!lyrics?.length || !audioRef.current || !isExpanded) return;
        let animationFrameId;

        const loop = () => {
            if (!audioRef.current) return;
            const currentTime = audioRef.current.currentTime;
            let newIndex = -1;
            for (let i = 0; i < lyrics.length; i++) {
                if (currentTime >= lyrics[i].time) {
                    newIndex = i;
                } else {
                    break;
                }
            }

            if (newIndex !== activeIndexRef.current) {
                setActiveIndex(newIndex);
            }

            // Calculate per-line progress (0-1)
            if (newIndex >= 0) {
                const lineStart = lyrics[newIndex].time;
                const lineEnd = newIndex < lyrics.length - 1
                    ? lyrics[newIndex + 1].time
                    : (duration || lineStart + 5); // Fallback: 5s for last line

                const lineDuration = lineEnd - lineStart;
                if (lineDuration > 0) {
                    const elapsed = currentTime - lineStart;
                    const progress = Math.min(1, Math.max(0, elapsed / lineDuration));
                    setLineProgress(progress);
                } else {
                    setLineProgress(1);
                }
            } else {
                setLineProgress(0);
            }

            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [lyrics, isExpanded, duration]);


    // Calculate Scroll Position
    useEffect(() => {
        if (activeIndex !== -1 && containerRef.current && linesRef.current[activeIndex]) {
            const containerHeight = containerRef.current.clientHeight;
            const activeLine = linesRef.current[activeIndex];
            if (activeLine) {
                const activeLineHeight = activeLine.clientHeight;
                const activeLineTop = activeLine.offsetTop;

                const newTranslateY = (containerHeight / 2) - (activeLineTop + activeLineHeight / 2);
                setTranslateY(newTranslateY);
            }
        }
    }, [activeIndex, isExpanded, isIdle]);

    if (error) {
        return (
            <div className="w-full text-center py-8 text-zinc-500/50 text-xl font-medium h-full flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-50">
                        <path d="M9 17H15M9 13H15M9 9H10M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <span>{error === "No lyrics found" ? "No Lyrics Found" : "Instrumental Mode"}</span>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-full text-center py-8 text-zinc-500 text-sm animate-pulse h-full flex items-center justify-center">
                Searching lyrics...
            </div>
        );
    }

    // Plain Lyrics View (Scrollable)
    if ((!lyrics || !lyrics.length) && plainLyrics) {
        return (
            <div className="w-full h-full overflow-y-auto px-6 py-8 text-center mask-image-gradient custom-scrollbar">
                <p className={`whitespace-pre-wrap ${isIdle ? 'text-3xl leading-relaxed text-zinc-300' : 'text-lg leading-loose text-zinc-400'}`}>
                    {plainLyrics}
                </p>
                <div className="mt-8 text-xs text-zinc-600 uppercase tracking-widest font-bold">
                    Synced lyrics unavailable
                </div>
            </div>
        );
    }

    if (!lyrics?.length) return null;

    // Calculate fill percentage for the active line (for Apple Music effect)
    const fillPercent = lineProgress * 100;

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative mask-image-gradient"
            style={{
                maskImage: isIdle
                    ? 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)'
                    : 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                WebkitMaskImage: isIdle
                    ? 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)'
                    : 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
            }}
        >
            <div
                className="w-full absolute top-0 left-0 transition-transform duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] px-4 text-center space-y-8 will-change-transform"
                style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
            >
                {lyrics.map((line, index) => {
                    const isActive = index === activeIndex;
                    const isPast = index < activeIndex;
                    const isNear = index === activeIndex - 1 || index === activeIndex + 1;

                    // Word-Level Rendering Logic
                    let wordElements = null;
                    if (isActive) {
                        const words = line.text.split(/(\s+)/); // Keep spaces as tokens
                        let charCount = 0;
                        const totalChars = line.text.length;

                        wordElements = words.map((word, wIndex) => {
                            const startChar = charCount;
                            const endChar = charCount + word.length;
                            charCount += word.length;

                            // Calculate progress for this specific word
                            // lineProgress (0-1) maps to character position
                            const currentPos = lineProgress * totalChars;

                            let wordStyle = {};

                            // Unified Rendering Strategy: Always use background-clip to prevent layout thrashing
                            const commonStyle = {
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                color: 'transparent',
                                WebkitTextFillColor: 'transparent',
                                display: 'inline-block',
                            };

                            if (currentPos >= endChar) {
                                // Word fully sung -> Full White
                                wordStyle = {
                                    ...commonStyle,
                                    backgroundImage: 'linear-gradient(to right, white, white)',
                                    opacity: 1
                                };
                            } else if (currentPos <= startChar) {
                                // Word not yet sung -> Dim White
                                wordStyle = {
                                    ...commonStyle,
                                    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.3), rgba(255,255,255,0.3))',
                                    opacity: 1
                                };
                            } else {
                                // Currently singing -> Dynamic Gradient
                                const wordProgress = (currentPos - startChar) / word.length;
                                const fill = Math.min(100, Math.max(0, wordProgress * 100));
                                wordStyle = {
                                    ...commonStyle,
                                    backgroundImage: `linear-gradient(to right, #ffffff ${fill}%, rgba(255,255,255,0.3) ${fill}%)`,
                                    opacity: 1
                                };
                            }

                            return (
                                <span key={wIndex} style={wordStyle}>
                                    {word === ' ' ? '\u00A0' : word}
                                </span>
                            );
                        });
                    }

                    return (
                        <p
                            key={index}
                            ref={el => linesRef.current[index] = el}
                            className={`cursor-pointer origin-center inline-block w-auto max-w-full
                                ${isIdle ? 'text-4xl md:text-6xl font-extrabold tracking-tight leading-tight' : 'text-2xl md:text-3xl font-bold tracking-tight'}
                                ${isActive
                                    ? `scale-100 ${isIdle ? 'tracking-normal scale-105' : ''}`
                                    : isPast
                                        ? isIdle
                                            ? 'text-zinc-500 scale-[0.9] blur-[2px] opacity-20'
                                            : isNear
                                                ? 'text-white/60 scale-[0.85] blur-[0.5px] opacity-80'
                                                : 'text-zinc-600 scale-[0.6] blur-[2px] opacity-40'
                                        : isIdle
                                            ? 'text-zinc-500 scale-[0.9] blur-[2px] opacity-20'
                                            : isNear
                                                ? 'text-zinc-300 scale-[0.85] blur-[0.5px] opacity-80'
                                                : 'text-zinc-600 scale-[0.6] blur-[2px] opacity-40'
                                }
                            `}
                            style={{
                                transition: 'transform 0.7s cubic-bezier(0.2,0.8,0.2,1), filter 0.7s cubic-bezier(0.2,0.8,0.2,1), opacity 0.7s cubic-bezier(0.2,0.8,0.2,1)',
                                ...(isActive ? {
                                    opacity: 1,
                                } : {})
                            }}
                            onClick={() => {
                                if (audioRef.current) {
                                    audioRef.current.currentTime = line.time;
                                    audioRef.current.play();
                                }
                            }}
                        >
                            {isActive ? wordElements : line.text}
                        </p>
                    );
                })}
            </div>
        </div>
    );
};

export default Lyrics;
