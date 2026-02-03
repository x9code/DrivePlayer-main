/**
 * Sanitizer Utility
 * Provides functions to clean, normalize, and extract metadata from strings
 */

/**
 * Sanitize a metadata string
 * - Removes null bytes
 * - Trims whitespace
 * - Normalizes Unicode to NFC form
 * @param {string|null|undefined} str - Input string
 * @returns {string|null} Sanitized string or null
 */
function sanitizeString(str) {
    if (!str || typeof str !== 'string') return null;

    return str
        .replace(/\0/g, '') // Remove null characters
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove other control characters
        .trim()
        .normalize('NFC'); // Normalize Unicode (Canonical Decomposition + Canonical Composition)
}

/**
 * Parse filename to extract title
 * Handles common patterns:
 * - "Artist - Title.mp3" → "Title"
 * - "01 Track Name.mp3" → "Track Name"
 * - "track_name.mp3" → "Track Name"
 * @param {string} filename - Original filename with extension
 * @returns {string|null} Extracted title or null
 */
function parseFilename(filename) {
    if (!filename) return null;

    // Remove file extension
    let name = filename.replace(/\.(mp3|m4a|flac|opus|wav|ogg|aac)$/i, '');

    // Remove leading track numbers (01, 02, etc.)
    name = name.replace(/^\d{1,3}[\s._-]+/, '');

    // If pattern "Artist - Title", extract Title
    if (name.includes(' - ')) {
        const parts = name.split(' - ');
        name = parts[parts.length - 1]; // Take last part as title
    }

    // Replace common separators with spaces
    name = name.replace(/[_-]+/g, ' ');

    // Clean up multiple spaces
    name = name.replace(/\s+/g, ' ').trim();

    return name || null;
}

/**
 * Parse filename to extract artist
 * Handles "Artist - Title" pattern
 * @param {string} filename - Original filename
 * @returns {string|null} Extracted artist or null
 */
function parseArtistFromFilename(filename) {
    if (!filename) return null;

    // Remove extension
    let name = filename.replace(/\.(mp3|m4a|flac|opus|wav|ogg|aac)$/i, '');

    // Remove track numbers
    name = name.replace(/^\d{1,3}[\s._-]+/, '');

    // Check for "Artist - Title" pattern
    if (name.includes(' - ')) {
        const parts = name.split(' - ');
        if (parts.length >= 2) {
            return parts[0].trim();
        }
    }

    return null;
}

/**
 * Validate and sanitize duration
 * @param {number|string} duration - Duration in seconds
 * @returns {number} Valid duration or 0
 */
function sanitizeDuration(duration) {
    const parsed = parseInt(duration);
    return (isNaN(parsed) || parsed < 0) ? 0 : parsed;
}

/**
 * Normalize MIME type to standard format
 * @param {string} mimeType - Original MIME type
 * @returns {string} Normalized MIME type
 */
function normalizeMimeType(mimeType) {
    if (!mimeType) return 'audio/mpeg'; // Default fallback

    // Normalize variants
    const mimeMap = {
        'audio/x-m4a': 'audio/mp4',
        'audio/x-flac': 'audio/flac',
        'audio/x-wav': 'audio/wav',
        'audio/x-opus': 'audio/opus',
    };

    return mimeMap[mimeType] || mimeType;
}

module.exports = {
    sanitizeString,
    parseFilename,
    parseArtistFromFilename,
    sanitizeDuration,
    normalizeMimeType
};
