import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { cleanTitle } from '../utils/format';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useMetadata(song) {
    const [meta, setMeta] = useState({ title: null, artist: null, album: null });

    useEffect(() => {
        if (!song) {
            setMeta({ title: null, artist: null, album: null });
            return;
        }

        // Fetch full metadata for extra fields (album, etc.)
        axios.get(`${API_BASE}/api/metadata/${song.id}`)
            .then(res => setMeta(res.data))
            .catch(err => {
                console.error("Metadata fetch error:", err);
                setMeta({ title: null, artist: null, album: null });
            });
    }, [song?.id]);

    const displayMeta = useMemo(() => {
        if (!song) return { title: '', artist: '' };

        const cleaned = cleanTitle(song.name);

        // Priority: 1. song.title (from App/List), 2. meta.title (fetched), 3. cleaned filename
        const title = song.title || meta.title || cleaned;
        const artist = song.artist || meta.artist || 'Unknown Artist';
        const album = song.album || meta.album || 'Unknown Album';

        return { title, artist, album };
    }, [song, meta]);

    return { meta, displayMeta };
}
