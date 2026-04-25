const { Pool } = require('pg');
const dotenv = require('dotenv');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Read DATABASE_URL directly from .env file to bypass dotenv's & parsing bug
// (dotenv misparses query strings containing & without proper quoting)
function readDatabaseUrl() {
    try {
        const envPath = path.join(__dirname, '../.env');
        const raw = fs.readFileSync(envPath, 'utf8');
        const match = raw.match(/^DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
        if (match) return match[1].trim();
    } catch (e) { /* ignore */ }
    return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/driveplayer';
}

// Pre-resolve host via Google DNS to bypass ISP DNS that blocks .neon.tech
// Returns a pool configured with the resolved IP but correct SSL servername
async function createPool() {
    const connStr = readDatabaseUrl();

    try {
        const parsed = new URL(connStr);
        const hostname = parsed.hostname;

        // Resolve via Google DNS
        const resolver = new dns.Resolver();
        resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

        const ip = await new Promise((resolve, reject) => {
            resolver.resolve4(hostname, (err, addrs) => {
                if (err) reject(err);
                else resolve(addrs[0]);
            });
        });

        console.log(`[Database] Resolved ${hostname} → ${ip} via Google DNS`);

        // Use parsed config so we can set host=IP while keeping servername for Neon SNI routing
        return new Pool({
            host: ip,
            port: parsed.port || 5432,
            user: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
            database: parsed.pathname.replace(/^\//, ''),
            ssl: {
                rejectUnauthorized: false,
                servername: hostname, // Neon uses SNI to route — must match original hostname
            },
        });
    } catch (err) {
        console.warn(`[Database] Google DNS resolution failed (${err.message}), using system DNS`);
        // Fallback: use original connection string with system DNS
        return new Pool({
            connectionString: connStr,
            ssl: { rejectUnauthorized: false },
        });
    }
}

// We export a proxy pool object that queues queries until the real pool is ready
let _pool = null;
const poolReady = createPool().then(p => { _pool = p; return p; });

const pool = {
    query: (...args) => poolReady.then(p => p.query(...args)),
    connect: (...args) => poolReady.then(p => p.connect(...args)),
    end: (...args) => poolReady.then(p => p.end(...args)),
};

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
