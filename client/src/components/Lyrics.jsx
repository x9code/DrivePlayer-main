import React, { useState, useEffect, useRef } from 'react';

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
// am-lyrics via direct DOM web component (CDN loaded)
// ────────────────────────────────────────────────────────────
const AmLyricsRenderer = ({ audioRef, artist, title, duration, isExpanded }) => {
    const containerRef = useRef(null);
    const amElementRef = useRef(null);
    const [scriptLoaded, setScriptLoaded] = useState(amLyricsLoaded);
    const [scriptError, setScriptError] = useState(false);

    // Load the am-lyrics script
    useEffect(() => {
        loadAmLyricsScript()
            .then(() => setScriptLoaded(true))
            .catch(() => {
                console.warn('[Lyrics] Failed to load am-lyrics CDN');
                setScriptError(true);
            });
    }, []);

    // Create and manage the <am-lyrics> element directly
    useEffect(() => {
        if (!scriptLoaded || !containerRef.current || !artist || !title) return;

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

                /* Unsung syllables: dimmer */
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

        return () => {
            observer.disconnect();
            if (amElementRef.current) {
                amElementRef.current.remove();
                amElementRef.current = null;
            }
        };
    }, [scriptLoaded, artist, title, duration]);

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
// MAIN: am-lyrics only
// ────────────────────────────────────────────────────────────
const Lyrics = ({ audioRef, artist, title, duration, isExpanded }) => {
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

    return (
        <AmLyricsRenderer
            audioRef={audioRef}
            artist={artist}
            title={title}
            duration={duration}
            isExpanded={isExpanded}
        />
    );
};

export default Lyrics;
