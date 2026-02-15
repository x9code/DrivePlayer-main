const db = require('../database/db');

class LibraryService {
    constructor() { }

    /**
     * Get all active files (not trashed)
     * Optimized for speed - just select needed fields for UI
     */
    getAllFiles() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM files WHERE is_trashed = 0`;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Get files recursively for a specific folder
     */
    getFilesRecursive(folderId) {
        return new Promise((resolve, reject) => {
            // Recursive CTE to find all descendant folders
            const sql = `
                WITH RECURSIVE descendants(id) AS (
                    SELECT id FROM files WHERE parent = ? AND mimeType = 'application/vnd.google-apps.folder' AND is_trashed = 0
                    UNION ALL
                    SELECT f.id FROM files f
                    JOIN descendants d ON f.parent = d.id
                    WHERE f.mimeType = 'application/vnd.google-apps.folder' AND f.is_trashed = 0
                )
                SELECT * FROM files 
                WHERE (parent = ? OR parent IN descendants) 
                AND is_trashed = 0
            `;

            // Note: We need to select files whose parent is either the target folder OR one of its descendants.
            // The CTE above only collects folder IDs to keep it efficient, then we select files belonging to them.

            db.all(sql, [folderId, folderId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Get a single file by ID
     */
    getFile(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM files WHERE id = ?`;
            db.get(sql, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Search files by name, artist, album
     */
    search(query) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM files 
                WHERE is_trashed = 0 
                AND (name LIKE ? OR artist LIKE ? OR album LIKE ? OR title LIKE ?)
                LIMIT 50
            `;
            const search = `%${query}%`;
            db.all(sql, [search, search, search, search], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Upsert a file (Insert or Update)
     * Uses SQLite's ON CONFLICT replacement
     */
    upsertFile(file, tx = db) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO files (id, name, parent, mimeType, size, createdTime, modifiedTime, md5Checksum, album, artist, title, duration, is_trashed, picture)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    parent=excluded.parent,
                    mimeType=excluded.mimeType,
                    size=excluded.size,
                    modifiedTime=excluded.modifiedTime,
                    md5Checksum=excluded.md5Checksum,
                    album=excluded.album,
                    artist=excluded.artist,
                    title=excluded.title,
                    duration=excluded.duration,
                    picture=coalesce(excluded.picture, files.picture),
                    is_trashed=0
            `;

            tx.run(sql, [
                file.id,
                file.name,
                file.parent,
                file.mimeType,
                file.size,
                file.createdTime,
                file.modifiedTime,
                file.md5Checksum,
                file.album,
                file.artist,
                file.title,
                file.duration,
                file.picture // New field
            ], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    /**
     * Update a single field for a file
     */
    updateField(id, field, value, tx = db) {
        return new Promise((resolve, reject) => {
            // WHilist strictly validating 'field' to prevent SQL injection is good practice, 
            // for now we trust internal calls.
            const sql = `UPDATE files SET ${field} = ? WHERE id = ?`;
            tx.run(sql, [value, id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    /**
     * Soft delete a file
     */
    softDeleteFile(id, tx = db) {
        return new Promise((resolve, reject) => {
            tx.run(`UPDATE files SET is_trashed = 1 WHERE id = ?`, [id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    /**
     * Get Sync State key
     */
    getSyncState(key) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT value FROM sync_state WHERE key = ?`, [key], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });
    }

    /**
     * Set Sync State key
     */
    setSyncState(key, value, tx = db) {
        return new Promise((resolve, reject) => {
            tx.run(`INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)`, [key, value], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Transaction Helpers
     */
    beginTransaction() {
        return new Promise((resolve, reject) => {
            db.run("BEGIN TRANSACTION", (err) => err ? reject(err) : resolve());
        });
    }

    commit() {
        return new Promise((resolve, reject) => {
            db.run("COMMIT", (err) => err ? reject(err) : resolve());
        });
    }

    rollback() {
        return new Promise((resolve, reject) => {
            db.run("ROLLBACK", (err) => err ? reject(err) : resolve());
        });
    }

    /**
     * Get Library Stats
     */
    getStats() {
        return new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count, SUM(size) as size FROM files WHERE is_trashed = 0`, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

module.exports = new LibraryService();
