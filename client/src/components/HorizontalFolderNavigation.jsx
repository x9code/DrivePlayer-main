import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { IoPlay, IoPencil, IoShuffle, IoTrashOutline } from 'react-icons/io5';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ═══════════════════════════════════════════
// Module-level caches (persist across re-renders & navigation)
// ═══════════════════════════════════════════
const recursiveSongCache = {};   // folderId -> [songIds]
const coverStatusCache = {};     // folderId -> boolean

// ═══════════════════════════════════════════
// IntersectionObserver hook for lazy loading
// ═══════════════════════════════════════════
const useIsVisible = (ref) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!ref.current) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref]);

    return isVisible;
};

// ═══════════════════════════════════════════
// Collage Component (Optimized: 25 tiles max)
// ═══════════════════════════════════════════
const ArtCollage = ({ songIds = [] }) => {
    const tiles = useMemo(() => {
        if (!songIds || songIds.length === 0) return [];
        const unique = [...new Set(songIds)];
        // Show one tile per unique album art (max 25 for 5x5 grid)
        const target = Math.min(25, unique.length);
        const result = [];
        for (let i = 0; i < target; i++) {
            result.push(unique[i % unique.length]);
        }
        // Shuffle to spread repeated covers
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(((i * 2654435761) % result.length));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }, [songIds]);

    if (tiles.length === 0) return null;

    return (
        <div
            className="absolute inset-0 overflow-hidden"
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gridAutoRows: '1fr',
            }}
        >
            {tiles.map((id, i) => (
                <CollageImage key={`${id}-${i}`} songId={id} />
            ))}
        </div>
    );
};

const CollageImage = React.memo(({ songId }) => {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return <div className="w-full h-full bg-zinc-900" />;
    }

    return (
        <img
            src={`${API_BASE}/api/thumbnail/${songId}`}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
});

// ═══════════════════════════════════════════
// Section Card (with lazy loading)
// ═══════════════════════════════════════════
const SectionCard = ({ folder, onFolderClick, onFolderPlay, onCoverUpload, refreshTrigger, hasCustomCover: initialHasCustomCover }) => {
    const cardRef = useRef(null);
    const isVisible = useIsVisible(cardRef);
    const [isHovered, setIsHovered] = useState(false);
    const [collageSongIds, setCollageSongIds] = useState(folder.coverSongIds || []);
    const [hasCustomCover, setHasCustomCover] = useState(initialHasCustomCover);
    const [dataLoaded, setDataLoaded] = useState(false);
    const coverUrl = `${API_BASE}/api/folder/cover/${folder.id}?t=${refreshTrigger || 0}`;

    // Sync with parent prop
    useEffect(() => {
        setHasCustomCover(initialHasCustomCover);
    }, [initialHasCustomCover]);

    // Optimization #1: Only fetch recursive songs when card is VISIBLE
    useEffect(() => {
        if (!isVisible || dataLoaded || hasCustomCover) return;

        const existing = folder.coverSongIds || [];

        if (existing.length >= 10) {
            setCollageSongIds(existing);
            setDataLoaded(true);
            return;
        }

        // Optimization #2: Check module-level cache
        if (recursiveSongCache[folder.id]) {
            setCollageSongIds(recursiveSongCache[folder.id]);
            setDataLoaded(true);
            return;
        }

        const fetchRecursive = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/files/recursive?folderId=${folder.id}`);
                const audioFiles = res.data.files
                    .filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

                // Deduplicate by album: pick one song per unique "artist - album"
                const seen = new Set();
                const songs = [];
                for (const f of audioFiles) {
                    const hasAlbumInfo = f.artist && f.album &&
                        f.artist !== 'Unknown Artist' && f.album !== 'Unknown Album';
                    const key = hasAlbumInfo
                        ? `${f.artist}|||${f.album}`.toLowerCase()
                        : f.id; // treat unknown-metadata songs as unique
                    if (!seen.has(key)) {
                        seen.add(key);
                        songs.push(f.id);
                    }
                }

                const ids = songs.length > 0 ? songs : existing;
                recursiveSongCache[folder.id] = ids;
                setCollageSongIds(ids);
            } catch (e) {
                console.error('Collage fetch error:', e);
                setCollageSongIds(existing);
            }
            setDataLoaded(true);
        };

        fetchRecursive();
    }, [isVisible, dataLoaded, hasCustomCover, folder.id, folder.coverSongIds]);

    const handleRemoveCover = async (e) => {
        e.stopPropagation();
        try {
            await axios.delete(`${API_BASE}/api/folder/cover/${folder.id}`);
            setHasCustomCover(false);
            coverStatusCache[folder.id] = false;
        } catch (err) {
            console.error('Failed to remove cover:', err);
            alert('Failed to remove cover');
        }
    };

    const handleUploadCover = (e) => {
        if (e.target.files[0]) {
            onCoverUpload(folder.id, e.target.files[0]);
            setTimeout(() => {
                setHasCustomCover(true);
                coverStatusCache[folder.id] = true;
            }, 500);
        }
    };

    const showCollage = !hasCustomCover && collageSongIds.length > 0;

    return (
        <div
            ref={cardRef}
            className="relative flex-none snap-start overflow-hidden group cursor-pointer transition-transform duration-700 ease-out rounded-3xl"
            style={{
                width: 'calc(100% - 2rem)',
                height: '100%',
                transform: isHovered ? 'scale(1.01)' : 'scale(1)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onFolderClick(folder.id)}
        >
            {/* Background: Collage or Custom Cover */}
            <div className="absolute inset-0">
                {showCollage && isVisible ? (
                    <ArtCollage songIds={collageSongIds} />
                ) : hasCustomCover ? (
                    <img
                        src={coverUrl}
                        className="w-full h-full object-cover"
                        alt={folder.name}
                    />
                ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                        <IoPlay className="text-white/10 text-9xl" />
                    </div>
                )}
            </div>

            {/* Immersive Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />
            <div className={`absolute inset-0 bg-black/10 transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100'}`} />
            {/* Vignette Edge */}
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{ boxShadow: 'inset 0 0 80px 30px rgba(0,0,0,0.7)' }} />

            {/* Content Area */}
            <div className="absolute inset-0 flex flex-col justify-between p-8 md:p-12 z-10">
                {/* Top: Folder Name & Actions */}
                <div className="flex justify-between items-start w-full">
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">Category</span>
                        <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">
                            {folder.name}
                        </h1>
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* Remove Custom Cover Button */}
                        {hasCustomCover && (
                            <button
                                onClick={handleRemoveCover}
                                className="p-3 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-xl rounded-full text-red-400 hover:text-red-300 border border-red-500/20 transition-all hover:scale-110"
                                title="Remove Custom Cover"
                            >
                                <IoTrashOutline size={20} />
                            </button>
                        )}

                        {/* Upload Custom Cover Button */}
                        <label
                            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white border border-white/10 transition-all hover:scale-110 cursor-pointer"
                            title="Change Section Art"
                        >
                            <IoPencil size={20} />
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleUploadCover}
                            />
                        </label>
                    </div>
                </div>

                {/* Bottom: Actions */}
                <div className="flex items-center gap-5">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onFolderPlay(folder.id);
                        }}
                        className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-bold text-base hover:scale-105 transition-transform shadow-2xl hover:bg-primary"
                    >
                        <IoShuffle size={24} />
                        <span>Shuffle</span>
                    </button>

                    <div className="flex flex-col text-white/40">
                        <span className="text-xs font-bold uppercase tracking-wider">Collection</span>
                        <span className="text-sm font-medium">Click to browse</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
const HorizontalFolderNavigation = ({ folders, onFolderClick, onFolderPlay, onCoverUpload, refreshTrigger }) => {
    if (!folders || folders.length === 0) return null;

    const scrollContainerRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    // Optimization #4: Batch cover status check (one call for all folders)
    const [coverStatuses, setCoverStatuses] = useState({});

    useEffect(() => {
        const folderIds = folders.map(f => f.id);

        // Check cache first — if all folders are cached, skip API call
        const allCached = folderIds.every(id => id in coverStatusCache);
        if (allCached) {
            const cached = {};
            folderIds.forEach(id => { cached[id] = coverStatusCache[id]; });
            setCoverStatuses(cached);
            return;
        }

        // Single batch API call
        const fetchStatuses = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/folder/covers/status?ids=${folderIds.join(',')}`);
                const statuses = res.data;
                // Update module-level cache
                Object.entries(statuses).forEach(([id, has]) => {
                    coverStatusCache[id] = has;
                });
                setCoverStatuses(statuses);
            } catch (e) {
                console.error('Cover status check error:', e);
                // Fallback: assume no custom covers
                const fallback = {};
                folderIds.forEach(id => { fallback[id] = false; });
                setCoverStatuses(fallback);
            }
        };

        fetchStatuses();
    }, [folders, refreshTrigger]);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 50);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    const scroll = (direction) => {
        if (scrollContainerRef.current) {
            const scrollAmount = scrollContainerRef.current.clientWidth;
            scrollContainerRef.current.scrollBy({
                left: direction === 'right' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="relative w-full" style={{ height: 'calc(100vh - 10rem)' }}>
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth items-center gap-4 px-4"
            >
                {folders.map((folder) => (
                    <SectionCard
                        key={folder.id}
                        folder={folder}
                        onFolderClick={onFolderClick}
                        onFolderPlay={onFolderPlay}
                        onCoverUpload={onCoverUpload}
                        refreshTrigger={refreshTrigger}
                        hasCustomCover={!!coverStatuses[folder.id]}
                    />
                ))}
            </div>

            {/* Left Navigation Button */}
            {canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white/10 hover:bg-white/20 backdrop-blur-2xl rounded-full w-12 h-12 flex items-center justify-center text-white transition-all duration-300 hover:scale-110 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/20"
                    title="Previous Folder"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* Right Navigation Button */}
            {canScrollRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white/10 hover:bg-white/20 backdrop-blur-2xl rounded-full w-12 h-12 flex items-center justify-center text-white transition-all duration-300 hover:scale-110 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/20"
                    title="Next Folder"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default HorizontalFolderNavigation;
