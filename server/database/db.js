const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'library.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('[Database] Connection error:', err.message);
    } else {
        console.log('[Database] Connected to library.db');
    }
});

// Initialize Schema immediately (queued by sqlite3)
initializeSchema();

function initializeSchema() {
    db.serialize(() => {
        // Files Table
        db.run(`
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT,
                parent TEXT,
                mimeType TEXT,
                size INTEGER,
                createdTime TEXT,
                modifiedTime TEXT,
                md5Checksum TEXT,
                album TEXT,
                artist TEXT,
                title TEXT,
                duration INTEGER,
                is_trashed INTEGER DEFAULT 0,
                picture TEXT
            )
        `);

        // Migration: Add picture column if it doesn't exist (for existing DBs)
        db.run(`ALTER TABLE files ADD COLUMN picture TEXT`, (err) => {
            // Ignore error if column already exists
            if (err && !err.message.includes('duplicate column')) {
                // console.log('[Database] Column migration check:', err.message);
            } else if (!err) {
                console.log('[Database] Migrated: Added picture column');
            }
        });

        // Indexes for performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_parent ON files(parent)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_mimeType ON files(mimeType)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_album ON files(album)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_artist ON files(artist)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_title ON files(title)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_trashed ON files(is_trashed)`);

        // Sync State Table
        db.run(`
            CREATE TABLE IF NOT EXISTS sync_state (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        console.log('[Database] Schema initialized/verified');
    });
}

module.exports = db;
