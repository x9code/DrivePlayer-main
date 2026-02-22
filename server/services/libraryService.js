const pool = require('../database/db');

class LibraryService {
    constructor() {
        this.pool = pool; // Expose DB for external use
        this.initUserTables();
    }

    async initUserTables() {
        try {
            // Favorites
            await pool.query(`CREATE TABLE IF NOT EXISTS user_favorites (
                user_id INTEGER,
                file_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, file_id)
            )`);
            // Note: foreign keys to 'users' table omitted here because 'users' table is created in index.js. 
            // We can add the foreign keys later if strictly needed, but ensuring they don't break if users table isn't created yet.
            // In index.js we will also need to update users table schema.

            // Play Counts
            await pool.query(`CREATE TABLE IF NOT EXISTS user_play_counts (
                user_id INTEGER,
                file_id TEXT,
                count INTEGER DEFAULT 1,
                last_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, file_id)
            )`);

            // Playlists (Created Before Playlist Songs)
            await pool.query(`CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Playlist Songs (Must have Playlists table existing for FK constraint)
            await pool.query(`CREATE TABLE IF NOT EXISTS playlist_songs (
                playlist_id TEXT,
                file_id TEXT,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (playlist_id, file_id),
                CONSTRAINT fk_playlist FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            )`);

            // Password Resets
            await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
                email TEXT NOT NULL,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log("[Database] User tables ready");
        } catch (err) {
            console.error("[Database] Error creating user tables:", err);
        }
    }

    // --- USER SPECIFIC METHODS ---

    async getFavorites(userId) {
        const sql = `
            SELECT f.* FROM files f
            JOIN user_favorites uf ON f.id = uf.file_id
            WHERE uf.user_id = $1 AND f.is_trashed = 0
        `;
        const { rows } = await pool.query(sql, [userId]);
        return rows;
    }

    async addFavorite(userId, fileId) {
        const sql = `INSERT INTO user_favorites (user_id, file_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
        const { rowCount } = await pool.query(sql, [userId, fileId]);
        return rowCount;
    }

    async removeFavorite(userId, fileId) {
        const sql = `DELETE FROM user_favorites WHERE user_id = $1 AND file_id = $2`;
        const { rowCount } = await pool.query(sql, [userId, fileId]);
        return rowCount;
    }

    async getPlaylists(userId) {
        const sql = `SELECT * FROM playlists WHERE user_id = $1 ORDER BY created_at DESC`;
        const { rows: playlists } = await pool.query(sql, [userId]);

        // Enrich with songs
        for (const p of playlists) {
            const songSql = `
                SELECT f.* 
                FROM files f
                JOIN playlist_songs ps ON f.id = ps.file_id
                WHERE ps.playlist_id = $1
            `;
            const { rows: songs } = await pool.query(songSql, [p.id]);
            p.songs = songs;
        }

        return playlists;
    }

    async createPlaylist(userId, playlistId, name) {
        const sql = `INSERT INTO playlists (id, user_id, name) VALUES ($1, $2, $3)`;
        const { rowCount } = await pool.query(sql, [playlistId, userId, name]);
        return rowCount;
    }

    async deletePlaylist(userId, playlistId) {
        const sql = `DELETE FROM playlists WHERE id = $1 AND user_id = $2`;
        const { rowCount } = await pool.query(sql, [playlistId, userId]);
        return rowCount;
    }

    async addToPlaylist(userId, playlistId, fileId) {
        // Verify ownership first
        const { rows } = await pool.query("SELECT id FROM playlists WHERE id = $1 AND user_id = $2", [playlistId, userId]);
        if (rows.length === 0) throw new Error("Playlist not found or access denied");

        const sql = `INSERT INTO playlist_songs (playlist_id, file_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
        const { rowCount } = await pool.query(sql, [playlistId, fileId]);
        return rowCount;
    }

    /**
     * Get all active files (not trashed)
     */
    async getAllFiles() {
        const sql = `SELECT * FROM files WHERE is_trashed = 0`;
        const { rows } = await pool.query(sql);
        return rows;
    }

    /**
     * Get files recursively for a specific folder
     */
    async getFilesRecursive(folderId) {
        const sql = `
            WITH RECURSIVE descendants(id) AS (
                SELECT id FROM files WHERE parent = $1 AND mimeType = 'application/vnd.google-apps.folder' AND is_trashed = 0
                UNION ALL
                SELECT f.id FROM files f
                JOIN descendants d ON f.parent = d.id
                WHERE f.mimeType = 'application/vnd.google-apps.folder' AND f.is_trashed = 0
            )
            SELECT * FROM files 
            WHERE (parent = $2 OR parent IN (SELECT id FROM descendants)) 
            AND is_trashed = 0
        `;
        const { rows } = await pool.query(sql, [folderId, folderId]);
        return rows;
    }

    /**
     * Get a single file by ID
     */
    async getFile(id) {
        const sql = `SELECT * FROM files WHERE id = $1`;
        const { rows } = await pool.query(sql, [id]);
        return rows[0] || null;
    }

    /**
     * Search files by name, artist, album
     */
    async search(query) {
        const sql = `
            SELECT * FROM files 
            WHERE is_trashed = 0 
            AND (name ILIKE $1 OR artist ILIKE $1 OR album ILIKE $1 OR title ILIKE $1)
            LIMIT 50
        `;
        const searchStr = `%${query}%`;
        const { rows } = await pool.query(sql, [searchStr]);
        return rows;
    }

    /**
     * Upsert a file (Insert or Update)
     */
    async upsertFile(file, tx = pool) {
        const sql = `
            INSERT INTO files(id, name, parent, mimeType, size, createdTime, modifiedTime, md5Checksum, album, artist, title, duration, is_trashed, picture)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13)
            ON CONFLICT(id) DO UPDATE SET
                name = EXCLUDED.name,
                parent = EXCLUDED.parent,
                mimeType = EXCLUDED.mimeType,
                size = COALESCE(EXCLUDED.size, files.size),
                modifiedTime = EXCLUDED.modifiedTime,
                md5Checksum = EXCLUDED.md5Checksum,
                album = COALESCE(EXCLUDED.album, files.album),
                artist = COALESCE(EXCLUDED.artist, files.artist),
                title = COALESCE(EXCLUDED.title, files.title),
                duration = COALESCE(EXCLUDED.duration, files.duration),
                picture = COALESCE(EXCLUDED.picture, files.picture),
                is_trashed = 0
        `;
        const { rowCount } = await tx.query(sql, [
            file.id,
            file.name,
            file.parent,
            file.mimeType,
            file.size || 0,
            file.createdTime,
            file.modifiedTime,
            file.md5Checksum,
            file.album || null,
            file.artist || null,
            file.title || null,
            file.duration || null,
            file.picture || null
        ]);
        return rowCount;
    }

    /**
     * Update a single field for a file
     */
    async updateField(id, field, value, tx = pool) {
        // Be careful with dynamic columns. Validated safely inside JS internally.
        const sql = `UPDATE files SET ${field} = $1 WHERE id = $2`;
        const { rowCount } = await tx.query(sql, [value, id]);
        return rowCount;
    }

    /**
     * Update metadata fields (title, artist, album, duration)
     */
    async updateMetadata(id, meta, tx = pool) {
        const sql = `UPDATE files SET title = $1, artist = $2, album = $3, duration = $4 WHERE id = $5`;
        const { rowCount } = await tx.query(sql, [meta.title, meta.artist, meta.album, meta.duration, id]);
        return rowCount;
    }

    /**
     * Soft delete a file
     */
    async softDeleteFile(id, tx = pool) {
        const { rowCount } = await tx.query(`UPDATE files SET is_trashed = 1 WHERE id = $1`, [id]);
        return rowCount;
    }

    /**
     * Get Sync State key
     */
    async getSyncState(key) {
        const { rows } = await pool.query(`SELECT value FROM sync_state WHERE key = $1`, [key]);
        return rows.length ? rows[0].value : null;
    }

    /**
     * Set Sync State key
     */
    async setSyncState(key, value, tx = pool) {
        const sql = `
            INSERT INTO sync_state (key, value) VALUES ($1, $2)
            ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
        `;
        await tx.query(sql, [key, value]);
    }

    /**
     * Transaction Helpers
     */
    async beginTransaction() {
        const client = await pool.connect();
        await client.query("BEGIN");
        return client;
    }

    async commit(client) {
        try {
            await client.query("COMMIT");
        } finally {
            client.release();
        }
    }

    async rollback(client) {
        try {
            await client.query("ROLLBACK");
        } finally {
            client.release();
        }
    }

    /**
     * Get Library Stats
     */
    async getStats() {
        const { rows } = await pool.query(`SELECT COUNT(*) as count, SUM(size) as size FROM files WHERE is_trashed = 0`);
        return rows[0];
    }

    // --- DB-BACKED JSON CACHE --- //

    async getMetadataCache() {
        // Will be accessed on startup
        const { rows } = await pool.query(`SELECT file_id, metadata FROM metadata_cache`);
        const cache = {};
        rows.forEach(row => {
            cache[row.file_id] = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        });
        return cache;
    }

    async setMetadataCache(fileId, metadata) {
        const sql = `
            INSERT INTO metadata_cache(file_id, metadata) VALUES($1, $2)
            ON CONFLICT(file_id) DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP
            `;
        await pool.query(sql, [fileId, JSON.stringify(metadata)]);
    }

    async getFolderCovers() {
        const { rows } = await pool.query(`SELECT folder_id, cover_file_id FROM folder_covers`);
        const covers = {};
        rows.forEach(row => {
            covers[row.folder_id] = row.cover_file_id;
        });
        return covers;
    }

    async setFolderCoversBatch(coversObj) {
        const client = await this.beginTransaction();
        try {
            for (const [folderId, coverFileId] of Object.entries(coversObj)) {
                const sql = `
                    INSERT INTO folder_covers(folder_id, cover_file_id) VALUES($1, $2)
                    ON CONFLICT(folder_id) DO UPDATE SET cover_file_id = EXCLUDED.cover_file_id, updated_at = CURRENT_TIMESTAMP
            `;
                await client.query(sql, [folderId, coverFileId]);
            }
            await this.commit(client);
        } catch (e) {
            await this.rollback(client);
            throw e;
        }
    }
}

module.exports = new LibraryService();
