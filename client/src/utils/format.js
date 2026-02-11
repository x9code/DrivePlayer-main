/**
 * Format Utility
 * Shared functions for text formatting
 */

const TITLE_SUFFIXES = ['remix', 'mix', 'live', 'edit', 'version', 'ver', 'cover', 'official', 'video', 'audio', 'lyrics', 'remastered', 'instrumental'];

// Helper: Find common terms (likely Artists) to help parsing
// This needs access to the full song list, so we might keep the "CommonTerms" logic in App.jsx 
// BUT the cleaning logic itself can be stateless if we pass context or simplify it.
// For now, let's port the stateless parts and the suffix removal.

/**
 * Clean a filename to look like a title
 * @param {string} fileName - Original filename
 * @param {Set<string>} commonTerms - Optional set of known artist names for heuristics
 * @returns {string} Cleaned title
 */
export const cleanTitle = (fileName, commonTerms = null) => {
    if (!fileName) return "Unknown Title";

    let name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    name = name.replace(/^\d+[\.\-\s]+/, "");    // Remove initial numbering

    // Remove duplicate suffixes like (1), (2), copy 1, etc.
    name = name.replace(/\s*\(\d+\)$/, ''); // matches " (1)", " (2)" at end
    name = name.replace(/\s*copy\s*\d*$/i, ''); // matches " copy", " copy 1"

    const parts = name.split(' - ');

    if (parts.length > 1) {
        const part1 = parts[0].trim();
        const part2 = parts.slice(1).join(' - ').trim();

        const p1Lower = part1.toLowerCase();
        const p2Lower = part2.toLowerCase();

        // Frequency Heuristic (if data provided)
        if (commonTerms) {
            const p1IsCommon = commonTerms.has(p1Lower);
            const p2IsCommon = commonTerms.has(p2Lower);

            if (p1IsCommon && !p2IsCommon) return part2;
            if (p2IsCommon && !p1IsCommon) return part1;
        }

        // Comma Heuristic
        const p1Commas = (part1.match(/,/g) || []).length;
        const p2Commas = (part2.match(/,/g) || []).length;
        if (p1Commas > 0 && p2Commas === 0) return part2;
        if (p2Commas > 0 && p1Commas === 0) return part1;

        // Feat Heuristic
        const featRegex = /\s(feat|ft|featuring)\.?\s/i;
        if (featRegex.test(part1) && !featRegex.test(part2)) return part2;
        if (featRegex.test(part2) && !featRegex.test(part1)) return part1;

        // Suffix Heuristic - REMOVED: We want to keep the part with the suffix (Title), not return the whole string.
        // if (TITLE_SUFFIXES.some(s => p2Lower.includes(s))) return name;

        // Default: If we can't decide, usually Part 2 is the title in "Artist - Title"
        // But without commonTerms, it's risky. 
        // Start with name, but if we have commonTerms, we trust them.
        return name;
    }
    return name;
};
