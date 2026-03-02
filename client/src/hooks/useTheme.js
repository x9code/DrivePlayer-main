import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useTheme() {
    const [defaultColor, setDefaultColor] = useState(() => {
        return localStorage.getItem('driveplayer_default_color') || '#e085e0'; // Default Pink-Lavender hex
    });

    const hexToRgbStr = (hex) => {
        if (!hex) return '224, 133, 224';
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(x => x + x).join('');
        const r = parseInt(h.substring(0, 2), 16) || 224;
        const g = parseInt(h.substring(2, 4), 16) || 133;
        const b = parseInt(h.substring(4, 6), 16) || 224;
        return `${r}, ${g}, ${b}`;
    };

    const [themeColor, setThemeColor] = useState(hexToRgbStr(defaultColor));
    const [gradientEnabled, setGradientEnabled] = useState(() => {
        return localStorage.getItem('driveplayer_gradient') === 'true';
    });
    const [useAlbumColor, setUseAlbumColor] = useState(() => {
        const stored = localStorage.getItem('driveplayer_use_album_color');
        return stored !== null ? stored === 'true' : true; // Default to true
    });

    useEffect(() => {
        localStorage.setItem('driveplayer_gradient', gradientEnabled);
    }, [gradientEnabled]);

    useEffect(() => {
        localStorage.setItem('driveplayer_use_album_color', useAlbumColor);
    }, [useAlbumColor]);

    useEffect(() => {
        localStorage.setItem('driveplayer_default_color', defaultColor);
        // If we want the app color to immediately reflect the change while NO song is playing or when overriding
        document.documentElement.style.setProperty('--theme-color', hexToRgbStr(defaultColor));
        setThemeColor(hexToRgbStr(defaultColor));
    }, [defaultColor]);

    useEffect(() => {
        document.documentElement.style.setProperty('--theme-color', themeColor);
    }, [themeColor]);

    const forceBrightColor = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        if (l < 0.5) l = 0.55;

        let r1, g1, b1;
        if (s === 0) {
            r1 = g1 = b1 = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r1 = hue2rgb(p, q, h + 1 / 3);
            g1 = hue2rgb(p, q, h);
            b1 = hue2rgb(p, q, h - 1 / 3);
        }

        return [Math.round(r1 * 255), Math.round(g1 * 255), Math.round(b1 * 255)];
    };

    const extractColor = (songId) => {
        if (!songId || !useAlbumColor) {
            setThemeColor(hexToRgbStr(defaultColor));
            return;
        }

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = `${API_BASE}/api/thumbnail/${songId}`;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 10;
                canvas.height = 10;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 10, 10);

                const imageData = ctx.getImageData(0, 0, 10, 10).data;
                let maxScore = -1;
                let bestR = 29, bestG = 185, bestB = 84;

                for (let i = 0; i < imageData.length; i += 4) {
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];

                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const l = (max + min) / 2 / 255;
                    const delta = max - min;
                    const s = (max === min) ? 0 : delta / (1 - Math.abs(2 * l - 1));

                    if (l < 0.15 || l > 0.9) continue;
                    const score = s * 10;

                    if (score > maxScore) {
                        maxScore = score;
                        bestR = r;
                        bestG = g;
                        bestB = b;
                    }
                }

                const [finalR, finalG, finalB] = forceBrightColor(bestR, bestG, bestB);
                setThemeColor(`${finalR}, ${finalG}, ${finalB}`);
            } catch (e) {
                console.warn("Color extraction failed", e);
                setThemeColor(hexToRgbStr(defaultColor));
            }
        };

        img.onerror = () => setThemeColor(hexToRgbStr(defaultColor));
    };

    return { themeColor, gradientEnabled, setGradientEnabled, extractColor, defaultColor, setDefaultColor, useAlbumColor, setUseAlbumColor };
}
