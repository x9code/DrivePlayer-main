import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Lyrics = ({ audioRef, artist, title, isExpanded }) => {
    const [lyrics, setLyrics] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);
    const linesRef = useRef([]);
    const [translateY, setTranslateY] = useState(0);

    // Fetch Lyrics
    useEffect(() => {
        if (!artist || !title || !isExpanded) return;

        const fetchLyrics = async () => {
            setLoading(true);
            setError(null);
            setLyrics([]);
            setActiveIndex(-1);

            try {
                // Use LRCLIB API
                const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
                const response = await axios.get(url);

                if (response.data && response.data.syncedLyrics) {
                    const parsed = parseLrc(response.data.syncedLyrics);
                    setLyrics(parsed);
                } else {
                    setError("No synced lyrics available");
                }
            } catch (err) {
                console.warn("Lyrics fetch failed:", err);
                setError("No synced lyrics available");
            } finally {
                setLoading(false);
            }
        };

        // Debounce to avoid spamming API on rapid skips
        const timeout = setTimeout(fetchLyrics, 500);
        return () => clearTimeout(timeout);
    }, [artist, title, isExpanded]);

    // Parse LRC format [mm:ss.xx] text
    const parseLrc = (lrc) => {
        const lines = lrc.split('\n');
        const result = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        for (const line of lines) {
            const match = timeRegex.exec(line);
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const milliseconds = parseInt(match[3], 10);
                const time = minutes * 60 + seconds + milliseconds / 100;
                const text = line.replace(timeRegex, '').trim();

                if (text) {
                    result.push({ time, text });
                }
            }
        }
        return result;
    };



    // Better Sync Logic: Only update state when changed to avoid re-renders
    // We need to keep the loop running.

    // Ref for active index to avoid dependency loop
    const activeIndexRef = useRef(activeIndex);
    useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

    useEffect(() => {
        if (!lyrics.length || !audioRef.current || !isExpanded) return;
        let animationFrameId;

        const loop = () => {
            const currentTime = audioRef.current.currentTime;
            let newIndex = -1;
            // Optimization: Search from current index forward/backward? 
            // Simple loop is fine for < 100 lines
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
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [lyrics, isExpanded]);


    // Calculate Scroll Position
    useEffect(() => {
        if (activeIndex !== -1 && containerRef.current && linesRef.current[activeIndex]) {
            const containerHeight = containerRef.current.clientHeight;
            const activeLine = linesRef.current[activeIndex];
            const activeLineHeight = activeLine.clientHeight;
            const activeLineTop = activeLine.offsetTop;

            // Center the active line
            const newTranslateY = (containerHeight / 2) - (activeLineTop + activeLineHeight / 2);
            setTranslateY(newTranslateY);
        }
    }, [activeIndex, lyrics, isExpanded]);

    if (error) {
        return (
            <div className="w-full text-center py-8 text-zinc-500 text-sm italic h-full flex items-center justify-center">
                {error}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-full text-center py-8 text-zinc-500 text-sm animate-pulse h-full flex items-center justify-center">
                Syncing lyrics...
            </div>
        );
    }

    if (!lyrics.length) return null;

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative mask-image-gradient"
            style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
            }}
        >
            <div
                className="w-full absolute top-0 left-0 transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] px-4 text-center space-y-8 will-change-transform"
                style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
            >
                {lyrics.map((line, index) => {
                    const isActive = index === activeIndex;
                    const isNear = index === activeIndex - 1 || index === activeIndex + 1;
                    const isFar = index === activeIndex - 2 || index === activeIndex + 2;

                    return (
                        <p
                            key={index}
                            ref={el => linesRef.current[index] = el}
                            className={`transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer origin-center
                                text-3xl font-bold
                                ${isActive
                                    ? 'text-white scale-100 blur-none opacity-100 drop-shadow-md'
                                    : isNear
                                        ? 'text-zinc-300 scale-[0.8] blur-[1px] opacity-70'
                                        : isFar
                                            ? 'text-zinc-500 scale-[0.6] blur-[2px] opacity-40'
                                            : 'text-zinc-700 scale-[0.4] blur-[4px] opacity-20'
                                }
                            `}
                            onClick={() => {
                                if (audioRef.current) {
                                    audioRef.current.currentTime = line.time;
                                    audioRef.current.play();
                                }
                            }}

                        >
                            {line.text}
                        </p>
                    );
                })}
            </div>
        </div>
    );
};

export default Lyrics;
