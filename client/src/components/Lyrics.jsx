import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ────────────────────────────────────────────────────────────
// Load am-lyrics web component from CDN (once)
// ────────────────────────────────────────────────────────────
let amLyricsLoaded = false;
let amLyricsLoadPromise = null;

function loadAmLyricsScript() {
    if (amLyricsLoaded) return Promise.resolve();
    if (amLyricsLoadPromise) return amLyricsLoadPromise;

    amLyricsLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics/dist/src/am-lyrics.min.js';
        script.onload = () => { amLyricsLoaded = true; resolve(); };
        script.onerror = () => reject(new Error('Failed to load am-lyrics'));
        document.head.appendChild(script);
    });

    return amLyricsLoadPromise;
}


// ────────────────────────────────────────────────────────────
// FALLBACK: Original LRC-based lyrics renderer
// ────────────────────────────────────────────────────────────
const LrcFallback = ({ audioRef, artist, title, duration, isExpanded }) => {
    const [lyrics, setLyrics] = useState([]);
    const [plainLyrics, setPlainLyrics] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [lineProgress, setLineProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);
    const linesRef = useRef([]);
    const [translateY, setTranslateY] = useState(0);

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
                            setPlainLyrics(response.data.syncedLyrics || response.data.plainLyrics);
                            return;
                        } else if (response.data.plainLyrics) {
                            setPlainLyrics(response.data.plainLyrics);
                            return;
                        }
                    }
                } catch (e) { /* Primary fetch failed, try search */ }

                let searchRes = await axios.get(`${API_BASE}/api/lyrics/search`, {
                    params: { q: artist + ' ' + title }
                });

                if (searchRes.data && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
                    handleMatch(searchRes.data);
                    return;
                }

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

    const activeIndexRef = useRef(activeIndex);
    useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

    useEffect(() => {
        if (!lyrics?.length || !audioRef.current || !isExpanded) return;
        let animationFrameId;

        const loop = () => {
            if (!audioRef.current) return;
            const currentTime = audioRef.current.currentTime;
            let newIndex = -1;
            for (let i = 0; i < lyrics.length; i++) {
                if (currentTime >= lyrics[i].time) newIndex = i;
                else break;
            }

            if (newIndex !== activeIndexRef.current) setActiveIndex(newIndex);

            if (newIndex >= 0) {
                const lineStart = lyrics[newIndex].time;
                const lineEnd = newIndex < lyrics.length - 1 ? lyrics[newIndex + 1].time : (duration || lineStart + 5);
                const lineDuration = lineEnd - lineStart;
                if (lineDuration > 0) {
                    const elapsed = currentTime - lineStart;
                    setLineProgress(Math.min(1, Math.max(0, elapsed / lineDuration)));
                } else {
                    setLineProgress(1);
                }
            } else {
                setLineProgress(0);
            }

            animationFrameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [lyrics, isExpanded, duration]);

    useEffect(() => {
        if (activeIndex !== -1 && containerRef.current && linesRef.current[activeIndex]) {
            const containerHeight = containerRef.current.clientHeight;
            const activeLine = linesRef.current[activeIndex];
            if (activeLine) {
                const activeLineHeight = activeLine.clientHeight;
                const activeLineTop = activeLine.offsetTop;
                setTranslateY((containerHeight / 2) - (activeLineTop + activeLineHeight / 2));
            }
        }
    }, [activeIndex, isExpanded]);

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

    if ((!lyrics || !lyrics.length) && plainLyrics) {
        return (
            <div className="w-full h-full overflow-y-auto px-6 py-8 text-center mask-image-gradient custom-scrollbar">
                <p className="whitespace-pre-wrap text-lg leading-loose text-zinc-400">
                    {plainLyrics}
                </p>
                <div className="mt-8 text-xs text-zinc-600 uppercase tracking-widest font-bold">
                    Synced lyrics unavailable
                </div>
            </div>
        );
    }

    if (!lyrics?.length) return null;

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
                className="w-full absolute top-0 left-0 transition-transform duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] px-4 text-center space-y-8 will-change-transform"
                style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
            >
                {lyrics.map((line, index) => {
                    const isActive = index === activeIndex;
                    const isPast = index < activeIndex;
                    const isNear = index === activeIndex - 1 || index === activeIndex + 1;

                    let wordElements = null;
                    if (isActive) {
                        const words = line.text.split(/(\s+)/);
                        let charCount = 0;
                        const totalChars = line.text.length;

                        wordElements = words.map((word, wIndex) => {
                            const startChar = charCount;
                            const endChar = charCount + word.length;
                            charCount += word.length;
                            const currentPos = lineProgress * totalChars;

                            const commonStyle = {
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                color: 'transparent',
                                WebkitTextFillColor: 'transparent',
                                display: 'inline-block',
                            };

                            let wordStyle;
                            if (currentPos >= endChar) {
                                wordStyle = { ...commonStyle, backgroundImage: 'linear-gradient(to right, white, white)', opacity: 1 };
                            } else if (currentPos <= startChar) {
                                wordStyle = { ...commonStyle, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.3), rgba(255,255,255,0.3))', opacity: 1 };
                            } else {
                                const fill = Math.min(100, Math.max(0, ((currentPos - startChar) / word.length) * 100));
                                wordStyle = { ...commonStyle, backgroundImage: `linear-gradient(to right, #ffffff ${fill}%, rgba(255,255,255,0.3) ${fill}%)`, opacity: 1 };
                            }

                            return <span key={wIndex} style={wordStyle}>{word === ' ' ? '\u00A0' : word}</span>;
                        });
                    }

                    return (
                        <p
                            key={index}
                            ref={el => linesRef.current[index] = el}
                            className={`cursor-pointer origin-center inline-block w-auto max-w-full
                                text-2xl md:text-3xl font-bold tracking-tight
                                ${isActive
                                    ? 'scale-100'
                                    : isPast
                                        ? isNear
                                            ? 'text-white/60 scale-[0.85] blur-[0.5px] opacity-80'
                                            : 'text-zinc-600 scale-[0.6] blur-[2px] opacity-40'
                                        : isNear
                                            ? 'text-zinc-300 scale-[0.85] blur-[0.5px] opacity-80'
                                            : 'text-zinc-600 scale-[0.6] blur-[2px] opacity-40'
                                }
                            `}
                            style={{
                                transition: 'transform 0.7s cubic-bezier(0.2,0.8,0.2,1), filter 0.7s cubic-bezier(0.2,0.8,0.2,1), opacity 0.7s cubic-bezier(0.2,0.8,0.2,1)',
                                ...(isActive ? { opacity: 1 } : {})
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


// ────────────────────────────────────────────────────────────
// PRIMARY: am-lyrics via direct DOM web component (CDN loaded)
// ────────────────────────────────────────────────────────────
const AmLyricsRenderer = ({ audioRef, artist, title, duration, isExpanded, showLyrics, onFallback }) => {
    const containerRef = useRef(null);
    const amElementRef = useRef(null);
    const [scriptLoaded, setScriptLoaded] = useState(amLyricsLoaded);
    const [scriptError, setScriptError] = useState(false);

    // Load the am-lyrics script
    useEffect(() => {
        loadAmLyricsScript()
            .then(() => setScriptLoaded(true))
            .catch(() => {
                console.warn('[Lyrics] Failed to load am-lyrics CDN, falling back to LRC');
                setScriptError(true);
                onFallback();
            });
    }, []);

    // Create and manage the <am-lyrics> element directly
    useEffect(() => {
        if (!scriptLoaded || !containerRef.current || !artist || !title || !showLyrics) return;

        // Remove previous element
        if (amElementRef.current) {
            amElementRef.current.remove();
            amElementRef.current = null;
        }

        const el = document.createElement('am-lyrics');
        el.setAttribute('song-title', title);
        el.setAttribute('song-artist', artist);
        el.setAttribute('query', `${title} ${artist}`);
        if (duration) el.setAttribute('song-duration', String(Math.round(duration * 1000)));
        el.setAttribute('current-time', '0');
        el.setAttribute('highlight-color', '#ffffff');
        el.setAttribute('hover-background-color', 'rgba(255,255,255,0.06)');
        el.setAttribute('font-family', "'Inter', system-ui, -apple-system, sans-serif");
        el.setAttribute('autoscroll', '');
        el.setAttribute('interpolate', '');
        el.setAttribute('hide-source-footer', '');

        el.style.width = '100%';
        el.style.height = '100%';
        el.style.display = 'block';
        el.style.fontSize = '1.5rem';
        el.style.fontWeight = '700';
        el.style.setProperty('--am-lyrics-highlight-color', '#ffffff');
        el.style.setProperty('--hover-background-color', 'rgba(255,255,255,0.06)');
        el.style.setProperty('--highlight-color', '#ffffff');

        // Inject custom styles into shadow DOM once it's ready
        const injectStyles = () => {
            if (!el.shadowRoot) return;
            const existingStyle = el.shadowRoot.querySelector('#dp-custom-style');
            if (existingStyle) return;

            const style = document.createElement('style');
            style.id = 'dp-custom-style';
            style.textContent = `
                :host {
                    /* Bright white for highlighted/sung text */
                    --lyplus-lyrics-palette: #ffffff !important;
                    --lyplus-text-primary: #ffffff !important;
                    /* Much dimmer for unsung text — high contrast */
                    --lyplus-text-secondary: rgba(255, 255, 255, 0.18) !important;
                    /* Larger base font */
                    --lyplus-font-size-base: 30px !important;
                    --lyplus-blur-amount: 0.05em !important;
                    --lyplus-blur-amount-near: 0.02em !important;
                }

                /* Inactive lines: very dim */
                .lyrics-line {
                    opacity: 0.6 !important;
                }

                /* Active line: full brightness */
                .lyrics-line.active {
                    opacity: 1 !important;
                    color: #ffffff !important;
                }

                /* Sung syllables: bright white */
                .lyrics-syllable.finished {
                    background-color: #ffffff !important;
                }

                /* Unsunq syllables: dimmer */
                .lyrics-line .lyrics-syllable {
                    background-color: rgba(255, 255, 255, 0.18) !important;
                }

                /* Active line syllables: proper transition */
                .lyrics-line.active .lyrics-syllable {
                    background-color: rgba(255, 255, 255, 0.18) !important;
                }

                .lyrics-line.active .lyrics-syllable.finished {
                    background-color: #ffffff !important;
                }

                .lyrics-line.active .lyrics-syllable.finished:has(.char) {
                    background-color: transparent !important;
                }

                /* Char-level highlight */
                .lyrics-syllable.finished span.char {
                    background-color: #ffffff !important;
                }

                .lyrics-syllable span.char {
                    background-color: rgba(255, 255, 255, 0.18) !important;
                }

                /* Gap dots */
                .lyrics-gap .lyrics-syllable {
                    background-color: rgba(255, 255, 255, 0.18) !important;
                    background-clip: unset !important;
                }
                .lyrics-gap.active .lyrics-syllable.highlight,
                .lyrics-gap.active .lyrics-syllable.finished {
                    background-color: #ffffff !important;
                }

                /* Hide header/footer controls for cleaner look */
                .lyrics-header, .lyrics-footer {
                    display: none !important;
                }
            `;
            el.shadowRoot.prepend(style);
        };

        // Try immediately, then retry with observer
        injectStyles();
        const observer = new MutationObserver(() => injectStyles());
        if (el.shadowRoot) {
            observer.observe(el.shadowRoot, { childList: true, subtree: true });
        } else {
            // Wait for shadow root
            const checkInterval = setInterval(() => {
                if (el.shadowRoot) {
                    clearInterval(checkInterval);
                    injectStyles();
                    observer.observe(el.shadowRoot, { childList: true, subtree: true });
                }
            }, 200);
            setTimeout(() => clearInterval(checkInterval), 10000);
        }

        // Handle line clicks
        el.addEventListener('line-click', (event) => {
            const audio = audioRef?.current;
            if (audio && event.detail?.timestamp != null) {
                audio.currentTime = event.detail.timestamp / 1000;
                audio.play();
            }
        });

        containerRef.current.appendChild(el);
        amElementRef.current = el;

        // Check after 8 seconds if lyrics actually rendered
        const fallbackTimer = setTimeout(() => {
            if (el.shadowRoot) {
                const inner = el.shadowRoot.innerHTML || '';
                // If shadow DOM is basically empty or only has a container with no lyric content
                if (inner.length < 100 || (!inner.includes('lyric') && !inner.includes('word') && !inner.includes('line'))) {
                    console.log('[Lyrics] am-lyrics has no content after 8s, switching to LRC');
                    onFallback();
                }
            } else {
                console.log('[Lyrics] am-lyrics has no shadowRoot, switching to LRC');
                onFallback();
            }
        }, 8000);

        return () => {
            clearTimeout(fallbackTimer);
            observer.disconnect();
            if (amElementRef.current) {
                amElementRef.current.remove();
                amElementRef.current = null;
            }
        };
    }, [scriptLoaded, artist, title, duration, showLyrics]);

    // Sync currentTime from audioRef via requestAnimationFrame
    useEffect(() => {
        const audio = audioRef?.current;
        const el = amElementRef.current;
        if (!audio || !el || !isExpanded) return;

        let animationFrameId;

        const updateTime = () => {
            if (audio && amElementRef.current) {
                amElementRef.current.currentTime = audio.currentTime * 1000;
            }
            animationFrameId = requestAnimationFrame(updateTime);
        };

        const handlePlay = () => { animationFrameId = requestAnimationFrame(updateTime); };
        const handlePause = () => { cancelAnimationFrame(animationFrameId); };
        const handleSeeked = () => {
            if (amElementRef.current) amElementRef.current.currentTime = audio.currentTime * 1000;
        };

        if (!audio.paused) animationFrameId = requestAnimationFrame(updateTime);

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('seeked', handleSeeked);

        return () => {
            cancelAnimationFrame(animationFrameId);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('seeked', handleSeeked);
        };
    }, [audioRef, isExpanded, scriptLoaded, artist, title]);



    if (scriptError) return null;

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden relative"
            style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
            }}
        />
    );
};


// ────────────────────────────────────────────────────────────
// MAIN: am-lyrics primary with LRC fallback
// ────────────────────────────────────────────────────────────
const Lyrics = ({ audioRef, artist, title, duration, isExpanded, showLyrics }) => {
    const [useFallback, setUseFallback] = useState(false);

    // Reset on song change
    useEffect(() => {
        setUseFallback(false);
    }, [artist, title]);

    if (!artist || !title) {
        return (
            <div className="w-full text-center py-8 text-zinc-500/50 text-xl font-medium h-full flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-50">
                        <path d="M9 17H15M9 13H15M9 9H10M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <span>No Lyrics Found</span>
            </div>
        );
    }

    if (useFallback) {
        return <LrcFallback audioRef={audioRef} artist={artist} title={title} duration={duration} isExpanded={isExpanded} />;
    }

    return (
        <AmLyricsRenderer
            audioRef={audioRef}
            artist={artist}
            title={title}
            duration={duration}
            isExpanded={isExpanded}
            showLyrics={showLyrics}
            onFallback={() => setUseFallback(true)}
        />
    );
};

export default Lyrics;
