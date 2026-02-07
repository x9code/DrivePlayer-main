import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Lyrics = ({ audioRef, artist, title, isExpanded }) => {
    const [lyrics, setLyrics] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);

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

    // Sync Loop
    useEffect(() => {
        if (!lyrics.length || !audioRef.current || !isExpanded) return;

        let animationFrameId;

        const syncLyrics = () => {
            const currentTime = audioRef.current.currentTime;

            // Find the active line (lines are sorted by time)
            let newIndex = -1;
            for (let i = 0; i < lyrics.length; i++) {
                if (currentTime >= lyrics[i].time) {
                    newIndex = i;
                } else {
                    break;
                }
            }

            if (newIndex !== activeIndex) {
                setActiveIndex(newIndex);
                scrollToActive(newIndex);
            }

            animationFrameId = requestAnimationFrame(syncLyrics);
        };

        animationFrameId = requestAnimationFrame(syncLyrics);
        return () => cancelAnimationFrame(animationFrameId);
    }, [lyrics, isExpanded, activeIndex]); // Removed activeIndex from dep to avoid re-bind, handled inside logic? No, need state ref or effect re-run. 
    // Actually, re-running effect on activeIndex change is okay as long as requestAnimationFrame is stable.

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
                scrollToActive(newIndex);
            }
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [lyrics, isExpanded]);


    const scrollToActive = (index) => {
        if (!containerRef.current) return;
        const activeEl = containerRef.current.children[index];
        if (activeEl) {
            activeEl.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    };

    if (error) {
        return (
            <div className="w-full text-center py-8 text-zinc-500 text-sm italic">
                {error}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-full text-center py-8 text-zinc-500 text-sm animate-pulse">
                Syncing lyrics...
            </div>
        );
    }

    if (!lyrics.length) return null;

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-y-auto no-scrollbar py-12 px-4 text-center space-y-6 mask-image-gradient"
            // Use mask-image for fade out top/bottom
            style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)'
            }}
        >
            {lyrics.map((line, index) => {
                const isActive = index === activeIndex;
                const isNear = index === activeIndex - 1 || index === activeIndex + 1;

                return (
                    <p
                        key={index}
                        className={`transition-all duration-500 ease-out cursor-pointer
                            ${isActive
                                ? 'text-white font-bold scale-110 blur-none opacity-100'
                                : isNear
                                    ? 'text-zinc-300 scale-100 blur-[1px] opacity-60'
                                    : 'text-zinc-500 scale-95 blur-[2px] opacity-30 hover:opacity-50'
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
    );
};

export default Lyrics;
