const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/driveplayer',
    ssl: { rejectUnauthorized: false } // Required for Neon and other cloud DBs
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('[Database] Connection error (ensure DATABASE_URL is set):', err.message);
    } else {
        console.log('[Database] Connected to PostgreSQL');
    }
});

// Initialize Schema immediately
initializeSchema();

async function initializeSchema() {
    try {
        // Files Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT,
                parent TEXT,
                mimeType TEXT,
                size BIGINT,
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

        // Migration: Add picture column if it doesn't exist
        await pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS picture TEXT`);

        // Indexes for performance
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_parent ON files(parent)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_mimeType ON files(mimeType)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_album ON files(album)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_artist ON files(artist)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_title ON files(title)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_trashed ON files(is_trashed)`);

        // Sync State Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_state (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // Metadata Cache Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS metadata_cache (
                file_id TEXT PRIMARY KEY,
                metadata JSONB,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Folder Covers Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS folder_covers (
                folder_id TEXT PRIMARY KEY,
                cover_file_id TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('[Database] Schema initialized/verified');
    } catch (err) {
        console.error('[Database] Schema initialization error:', err);
    }
}

module.exports = pool;
