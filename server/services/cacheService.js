/**
 * Cache Service
 * Manages persistent metadata cache using JSON file storage
 * Thread-safe with atomic writes
 */

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

class CacheService {
    constructor(cacheDir) {
        this.cacheDir = cacheDir;
        this.cacheFilePath = path.join(cacheDir, 'metadata.json');
        this.cache = new Map(); // In-memory cache for fast access
        this.saveQueue = null; // Debounced save operation
        this.saveDelay = 2000; // Wait 2 seconds before saving to disk
    }

    /**
     * Initialize cache service
     * Loads existing cache from disk
     */
    async init() {
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
            await fsPromises.mkdir(this.cacheDir, { recursive: true });
        }

        // Load existing cache
        await this.load();
        console.log(`[Cache] Loaded ${this.cache.size} entries from disk`);
    }

    /**
     * Load cache from disk
     */
    async load() {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const data = await fsPromises.readFile(this.cacheFilePath, 'utf-8');
                const parsed = JSON.parse(data);

                // Convert object to Map
                this.cache = new Map(Object.entries(parsed));

                console.log(`[Cache] Successfully loaded ${this.cache.size} entries`);
            } else {
                console.log('[Cache] No existing cache file found, starting fresh');
                this.cache = new Map();
            }
        } catch (error) {
            console.error('[Cache] Error loading cache:', error.message);
            console.log('[Cache] Starting with empty cache');
            this.cache = new Map();
        }
    }

    /**
     * Save cache to disk (debounced)
     * Uses atomic write to prevent corruption
     */
    async save() {
        // Clear existing save timeout
        if (this.saveQueue) {
            clearTimeout(this.saveQueue);
        }

        // Schedule save operation
        this.saveQueue = setTimeout(async () => {
            try {
                // Convert Map to object
                const cacheObject = Object.fromEntries(this.cache);

                // Write to temp file first (atomic operation)
                const tempPath = this.cacheFilePath + '.tmp';
                await fsPromises.writeFile(
                    tempPath,
                    JSON.stringify(cacheObject, null, 2),
                    'utf-8'
                );

                // Atomic rename
                await fsPromises.rename(tempPath, this.cacheFilePath);

                console.log(`[Cache] Saved ${this.cache.size} entries to disk`);
            } catch (error) {
                console.error('[Cache] Error saving cache:', error.message);
            }
        }, this.saveDelay);
    }

    /**
     * Get metadata from cache
     * @param {string} fileId - Google Drive file ID
     * @returns {object|null} Cached metadata or null
     */
    get(fileId) {
        return this.cache.get(fileId) || null;
    }

    /**
     * Check if file metadata is cached
     * @param {string} fileId - Google Drive file ID
     * @returns {boolean}
     */
    has(fileId) {
        return this.cache.has(fileId);
    }

    /**
     * Store metadata in cache
     * @param {string} fileId - Google Drive file ID
     * @param {object} metadata - Parsed metadata object
     */
    async set(fileId, metadata) {
        // Add timestamp
        const cacheEntry = {
            ...metadata,
            parsedAt: Date.now()
        };

        this.cache.set(fileId, cacheEntry);

        // Trigger debounced save
        await this.save();
    }

    /**
     * Remove entry from cache
     * @param {string} fileId - Google Drive file ID
     */
    async delete(fileId) {
        this.cache.delete(fileId);
        await this.save();
    }

    /**
     * Clear entire cache
     */
    async clear() {
        this.cache.clear();
        await this.save();
        console.log('[Cache] Cleared all entries');
    }

    /**
     * Force immediate save (for shutdown)
     */
    async forceSave() {
        if (this.saveQueue) {
            clearTimeout(this.saveQueue);
        }

        try {
            const cacheObject = Object.fromEntries(this.cache);
            await fsPromises.writeFile(
                this.cacheFilePath,
                JSON.stringify(cacheObject, null, 2),
                'utf-8'
            );
            console.log('[Cache] Force saved to disk');
        } catch (error) {
            console.error('[Cache] Error during force save:', error.message);
        }
    }

    /**
     * Get all cache keys
     * @returns {Array<string>} Array of all cache keys
     */
    getAllKeys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            totalEntries: this.cache.size,
            cacheFilePath: this.cacheFilePath,
            memoryUsage: JSON.stringify(Object.fromEntries(this.cache)).length
        };
    }
}

module.exports = CacheService;
