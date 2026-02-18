const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Import new services
// Import new services
const CacheService = require('./services/cacheService');
const DriveService = require('./services/driveService');
const MetadataService = require('./services/metadataService');
const LocalLibraryService = require('./services/libraryService'); // Rename to avoid conflict if any
const SyncService = require('./services/syncService');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Secret for JWT (In production, use .env)
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*', // Allow Vercel/Render/Localhost
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // [NEW] Serve Static Files

// Google Drive Auth Setup
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
let driveClient = null;

async function authenticateDrive() {
    try {
        // 1. Check if the environment variable contains JSON content directly (Render/Vercel)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.trim().startsWith('{')) {
            const credsPath = path.join(os.tmpdir(), 'google-credentials.json');
            fs.writeFileSync(credsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS);
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
            console.log('Detected JSON credentials, wrote to file:', credsPath);
        }

        // 2. Now use the file path (either original path or our newly created temp file)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
            const auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                scopes: SCOPES,
            });
            driveClient = google.drive({ version: 'v3', auth });
            console.log('Authenticated with Service Account');
        } else {
            console.log('No credentials found. Please set GOOGLE_APPLICATION_CREDENTIALS in .env');
        }
    } catch (error) {
        console.error('Auth Error:', error);
    }
}

// Initialize services
let driveService = null;
let cacheService = null;
let metadataService = null;

const os = require('os');
const CACHE_DIR = path.join(os.tmpdir(), 'driveplayer-cache');

async function initializeServices() {
    await authenticateDrive();

    if (driveClient) {
        // Initialize services
        driveService = new DriveService(driveClient);
        cacheService = new CacheService(CACHE_DIR);
        await cacheService.init();
        // Inject LocalLibraryService for DB updates
        metadataService = new MetadataService(driveService, cacheService, CACHE_DIR, LocalLibraryService);

        // Initialize SyncService with DriveService instance
        SyncService.init(driveService);

        console.log('[Services] All services initialized successfully');

        // Trigger Background Sync (Bootstrap or Delta)
        SyncService.startSync().catch(err => console.error('[Sync] Startup sync failed:', err));
    } else {
        console.error('[Services] Failed to initialize - Drive client not authenticated');
    }
}

initializeServices();

// --- DATABASE & AUTH SETUP ---

// Ensure Users Table Exists
const db = LocalLibraryService.db; // Access the existing SQLite instance
if (db) {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating users table:", err);
            else {
                console.log("Users table ready");
                // [NEW] Attempt to add avatar_path column if it doesn't exist
                db.run("ALTER TABLE users ADD COLUMN avatar_path TEXT", (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                        console.error("Column add error (might exist):", err.message);
                    } else {
                        console.log("Avatar column ready");
                    }

                });
                // [NEW] Add Username Column
                db.run("ALTER TABLE users ADD COLUMN username TEXT", (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                        console.error("Column add error (might exist):", err.message);
                    } else {
                        console.log("Username column ready");
                    }
                });
            }
        });
    });
}

// Middleware: Authenticate Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---

// Register
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");
        stmt.run(email, hashedPassword, function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: "Email already exists" });
                }
                return res.status(500).json({ error: err.message });
            }

            // Auto-login after register
            const user = { id: this.lastID, email };
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' }); // Long session
            res.status(201).json({ token, user });
        });
        stmt.finalize();
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(400).json({ error: "User not found" });

        try {
            if (await bcrypt.compare(password, user.password)) {
                const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
                res.json({ token, user: { id: user.id, email: user.email } });
            } else {
                res.status(401).json({ error: "Invalid credentials" });
            }
        } catch (e) {
            res.status(500).json({ error: "Server error" });
        }
    });
});

// Get Current User (Verify Token)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

// --- USER DATA ROUTES (Protected) ---

// Favorites
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const favorites = await LocalLibraryService.getFavorites(req.user.id);
        res.json(favorites);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/favorites/:fileId', authenticateToken, async (req, res) => {
    try {
        await LocalLibraryService.addFavorite(req.user.id, req.params.fileId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/favorites/:fileId', authenticateToken, async (req, res) => {
    try {
        await LocalLibraryService.removeFavorite(req.user.id, req.params.fileId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Playlists
app.get('/api/playlists', authenticateToken, async (req, res) => {
    try {
        const playlists = await LocalLibraryService.getPlaylists(req.user.id);
        res.json(playlists);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/playlists', authenticateToken, async (req, res) => {
    try {
        const { id, name } = req.body;
        await LocalLibraryService.createPlaylist(req.user.id, id, name);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/playlists/:id', authenticateToken, async (req, res) => {
    try {
        await LocalLibraryService.deletePlaylist(req.user.id, req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/playlists/:id/songs', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.body;
        await LocalLibraryService.addToPlaylist(req.user.id, req.params.id, fileId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


app.get('/', (req, res) => {
    res.send('DrivePlayer Server Running');
});

// API: Browsing Files (Folders and Songs)
app.get('/api/files', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    let targetFolderId = req.query.folderId;

    try {
        if (!targetFolderId) {
            const folderRes = await driveClient.files.list({
                q: "name = 'music' and mimeType = 'application/vnd.google-apps.folder'",
                fields: 'files(id, name)',
            });
            if (!folderRes.data.files.length) return res.status(404).json({ error: 'Music folder not found' });
            targetFolderId = folderRes.data.files[0].id;
        }

        // Get Folder Name
        const folderMeta = await driveClient.files.get({
            fileId: targetFolderId,
            fields: 'name'
        });
        const folderName = folderMeta.data.name;

        console.log(`Browsing folder: ${folderName} (${targetFolderId})`);

        if (driveService) {
            console.log(`[API] Fetching files using driveService (paginated)`);
            let files = await driveService.getFilesInFolder(targetFolderId);

            // Enrich with metadata (covers, titles, etc.)
            if (metadataService) {
                files = metadataService.enrichList(files);
            }

            res.json({
                files: files,
                folderId: targetFolderId,
                folderName: folderName
            });
            return;
        }

        // Fallback if service not ready (shouldn't happen if initialized correctly)
        const filesRes = await driveClient.files.list({
            q: `'${targetFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio/' or fileExtension = 'mp3' or fileExtension = 'm4a' or fileExtension = 'opus' or fileExtension = 'flac')`,
            fields: 'files(id, name, mimeType, size, thumbnailLink, createdTime)',
            orderBy: 'folder, name'
        });



        // Enrich with Metadata
        let files = filesRes.data.files || [];
        if (metadataService) {
            files = metadataService.enrichList(files);
        }

        res.json({
            files: files,
            folderId: targetFolderId,
            folderName: folderName
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// API: Recursive File Fetch (Now Instant from DB)
app.get('/api/files/recursive', async (req, res) => {
    try {
        const folderId = req.query.folderId;
        let files;

        if (folderId) {
            console.log(`[API] Fetching recursive files for folder: ${folderId}`);
            files = await LocalLibraryService.getFilesRecursive(folderId);
        } else {
            console.log('[API] Fetching all files from Local DB');
            files = await LocalLibraryService.getAllFiles();
        }

        console.log(`[API] Returning ${files.length} files from DB`);
        res.json({ files: files });

        // Trigger background sync if empty AND doing full fetch
        if (!folderId && files.length === 0) {
            console.log('[API] Library empty, triggering bootstrap sync...');
            SyncService.startSync().catch(err => console.error(err));
        } else if (files.length > 0 && metadataService) {
            // [NEW] Trigger metadata enrichment in background
            // This ensures that if we have files but no metadata (id3 tags), we fetch them now.
            // We don't await this so the UI loads instantly.
            console.log('[API] Triggering background metadata enrichment for list...');
            metadataService.enrichFiles(files).catch(err => console.error('[API] Enrichment error:', err));
        }
    } catch (error) {
        console.error('[API] Error fetching files:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Trigger Sync
app.post('/api/sync/trigger', (req, res) => {
    SyncService.startSync(); // Run in background
    res.status(202).json({ message: 'Sync started' });
});

// API: Sync Status
app.get('/api/sync/status', async (req, res) => {
    try {
        const status = {
            isSyncing: SyncService.isSyncing,
            lastSyncTime: await LocalLibraryService.getSyncState('lastSyncTime'),
            lastSuccessfulSyncTime: await LocalLibraryService.getSyncState('lastSuccessfulSyncTime'),
            syncError: await LocalLibraryService.getSyncState('syncError'),
            // Add stats
            stats: await LocalLibraryService.getStats()
        };
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Search Files
app.get('/api/search', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    const query = req.query.q;
    if (!query) return res.json([]);

    try {
        console.log(`Searching for: ${query}`);
        const filesRes = await driveClient.files.list({
            q: `name contains '${query}' and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio/' or fileExtension = 'mp3' or fileExtension = 'm4a' or fileExtension = 'opus' or fileExtension = 'flac') and trashed = false`,
            fields: 'files(id, name, mimeType, size, thumbnailLink, createdTime)',
            pageSize: 50
        });



        res.json(filesRes.data.files || []);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Backward compatibility (existing)
app.get('/api/songs', async (req, res) => {
    res.redirect('/api/files');
});



// API: Get Metadata (Title, Artist, Album)
app.get('/api/metadata/:fileId', async (req, res) => {
    if (!metadataService) {
        return res.status(500).json({ error: 'Metadata service not initialized' });
    }

    try {
        // Add timeout to prevent metadata fetch from blocking playback
        const timeoutMs = 10000; // 10 seconds
        const metadataPromise = metadataService.getOrParseMetadata(req.params.fileId);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Metadata timeout')), timeoutMs)
        );

        const metadata = await Promise.race([metadataPromise, timeoutPromise]);
        res.json({
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            duration: metadata.duration,
            filename: metadata.filename,
            // Tech Details
            sampleRate: metadata.sampleRate,
            bitsPerSample: metadata.bitsPerSample,
            codec: metadata.codec
        });
    } catch (error) {
        console.error('[API] Metadata fetch error:', error.message);
        // Return minimal metadata so playback isn't blocked
        res.json({
            title: 'Loading...',
            artist: 'Loading...',
            album: 'Unknown',
            duration: 0
        });
    }
});

// API: Get Metadata Scan Status
app.get('/api/metadata/status/progress', (req, res) => {
    if (!metadataService) {
        return res.json({ active: false });
    }
    const status = { ...metadataService.scanStatus };
    if (metadataService.cachedCount !== undefined) {
        status.cached = metadataService.cachedCount;
    }
    res.json(status);
});

// API: Force Rescan (Root)
app.post('/api/metadata/rescan', async (req, res) => {
    if (!driveClient || !driveService || !metadataService) {
        return res.status(500).json({ error: 'Services not initialized' });
    }

    try {
        console.log('[Metadata] Force Rescan triggered by user');

        // Find root "music" folder if not cached
        // (Similar logic to /api/files but we need the ID)
        let rootFolderId = null;
        const folderRes = await driveClient.files.list({
            q: "name = 'music' and mimeType = 'application/vnd.google-apps.folder'",
            fields: 'files(id)',
        });

        if (folderRes.data.files.length) {
            rootFolderId = folderRes.data.files[0].id;
        } else {
            return res.status(404).json({ error: 'Music folder not found' });
        }

        // Fetch all files recursively
        const files = await driveService.getFilesRecursive(rootFolderId);

        // CRITICAL FIX: Update SQLite DB Structure (Parent/Child links)
        // The metadata service only updates JSON cache, but we need DB for recursive queries.
        console.log('[Metadata] Rescan: Syncing file structure to DB...');
        await LocalLibraryService.beginTransaction();
        try {
            for (const file of files) {
                // Use SyncService mapper to handle parent logic consistently
                const dbFile = SyncService.mapDriveFileToDB(file);
                await LocalLibraryService.upsertFile(dbFile);
            }
            await LocalLibraryService.commit();
            console.log('[Metadata] DB Structure updated successfully.');
        } catch (dbErr) {
            await LocalLibraryService.rollback();
            console.error('[Metadata] Failed to update DB structure:', dbErr);
            // Continue to enrichment even if DB update fails (though it shouldn't)
        }

        // Trigger enrichment with FORCE=false to only scan new/unscanned files
        metadataService.enrichFiles(files, false).catch(err =>
            console.error('[Background] Rescan enrichment error:', err.message)
        );

        res.json({ success: true, message: 'Structure synced & Scanning new files...', count: files.length });

    } catch (error) {
        console.error('[Metadata] Rescan error:', error.message);
        res.status(500).json({ error: 'Rescan failed' });
    }
});

// --- Custom Folder Covers ---
const multer = require('multer');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'custom_covers');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Use folderId as filename (we get it from body)
        // Note: req.body might not be populated before file if not ordered correctly,
        // but multer handles this if fields come before files or if we rename later.
        // Easier approach: Save as temp, rename in handler.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit
});

// API: Upload Cover
app.post('/api/folder/cover', upload.single('image'), (req, res) => {
    const folderId = req.body.folderId;
    if (!folderId || !req.file) {
        return res.status(400).json({ error: 'Missing folderId or image' });
    }

    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, 'custom_covers', `${folderId}.png`);

    try {
        // Delete old cover if exists
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }

        // Rename/Move uploaded file to target
        fs.renameSync(tempPath, targetPath);

        res.json({ success: true, message: 'Cover updated' });
    } catch (err) {
        console.error("Cover upload error:", err);
        res.status(500).json({ error: 'Failed to save cover' });
    }
});

// API: Get Custom Cover
app.get('/api/folder/cover/:folderId', (req, res) => {
    const folderId = req.params.folderId;
    const coverPath = path.join(__dirname, 'custom_covers', `${folderId}.png`);

    if (fs.existsSync(coverPath)) {
        res.sendFile(coverPath);
    } else {
        res.status(404).send('No custom cover');
    }
});
// ----------------------------

// --- Avatar Upload ---
const avatarStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads', 'avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.user.id}-${uniqueSuffix}${ext}`);
    }
});

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 300 * 1024 } // 300KB Limit
});

// API: Upload Avatar
app.post('/api/user/avatar', authenticateToken, uploadAvatar.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // Update DB
    const stmt = db.prepare("UPDATE users SET avatar_path = ? WHERE id = ?");
    stmt.run(avatarPath, req.user.id, function (err) {
        if (err) return res.status(500).json({ error: "Database update failed" });
        res.json({ success: true, avatarPath });
    });
    stmt.finalize();
});

// API: Update User Profile (Username)
app.put('/api/user/profile', authenticateToken, (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ error: "Invalid username" });
    }

    const trimmedUsername = username.trim();

    // Check uniqueness (optional, but good practice)
    db.get("SELECT id FROM users WHERE username = ? AND id != ?", [trimmedUsername, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (row) return res.status(409).json({ error: "Username already taken" });

        const stmt = db.prepare("UPDATE users SET username = ? WHERE id = ?");
        stmt.run(trimmedUsername, req.user.id, function (err) {
            if (err) return res.status(500).json({ error: "Update failed" });
            res.json({ success: true, username: trimmedUsername });
        });
        stmt.finalize();
    });
});
// ----------------------------

// API: Get Metadata (Specific File)
app.get('/api/metadata/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    if (!metadataService) return res.status(500).json({ error: 'Metadata service not initialized' });

    try {
        const metadata = await metadataService.getOrParseMetadata(fileId);
        res.json(metadata);
    } catch (error) {
        console.error(`[API] Metadata fetch error for ${fileId}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});
// ----------------------------


// API: Get Thumbnail (Album Artwork)
app.get('/api/thumbnail/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const cachePath = path.join(CACHE_DIR, `${fileId}`);

    // 0. Check Local DB for specialized artwork (iTunes / Drive Link) - Fastest
    try {
        const file = await LocalLibraryService.getFile(fileId);
        if (file && file.picture && file.picture.startsWith('http')) {
            return res.redirect(file.picture);
        }
    } catch (e) {
        console.warn(`[API] DB lookup failed for thumbnail ${fileId}`, e.message);
    }

    // 1. Check Disk Cache
    if (fs.existsSync(cachePath)) {
        return res.sendFile(cachePath);
    }

    // 2. Parse metadata if not cached (will extract and save artwork)
    if (!metadataService) {
        return res.status(500).send('Metadata service not available');
    }

    try {
        let metadata = await metadataService.getOrParseMetadata(fileId);

        // Re-check disk cache
        if (fs.existsSync(cachePath)) {
            return res.sendFile(cachePath);
        }

        // If missing but metadata claims it exists, force regenerate
        if (metadata.artwork) {
            console.log(`[API] Artwork missing for ${fileId}, forcing regeneration...`);
            await metadataService.getOrParseMetadata(fileId, true); // force=true

            if (fs.existsSync(cachePath)) {
                return res.sendFile(cachePath);
            }
        }

        return res.status(404).send('No artwork found');
    } catch (error) {
        console.error('[API] Thumbnail extraction error:', error.message);
        res.status(500).send('Error extracting artwork');
    }
});

// API: Stream Song
app.get('/api/stream/:fileId', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    const fileId = req.params.fileId;
    const range = req.headers.range;

    console.log(`[Stream] Request: ${fileId} | Range: ${range}`);

    try {
        let fileSize, mimeType;

        // Get file metadata from Drive
        // Use driveService if available, otherwise direct API call
        if (driveService) {
            console.log(`[Stream] Using driveService to fetch metadata`);
            const fileInfo = await driveService.getFileMetadata(fileId);
            fileSize = fileInfo.size;
            mimeType = fileInfo.mimeType;
        } else {
            console.log(`[Stream] Fetching metadata directly from Drive API`);
            const fileMetadata = await driveClient.files.get({
                fileId: fileId,
                fields: 'size, mimeType'
            });
            fileSize = parseInt(fileMetadata.data.size);
            mimeType = fileMetadata.data.mimeType;
        }

        console.log(`[Stream] File metadata: Size=${fileSize}, Type=${mimeType}`);

        // MIME Type Normalization for Streaming
        if (mimeType === 'audio/x-m4a') mimeType = 'audio/mp4';
        if (mimeType === 'audio/x-flac') mimeType = 'audio/flac';
        if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') mimeType = 'audio/wav';

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            console.log(`[Stream] Streaming bytes ${start}-${end}/${fileSize} (${chunksize} bytes)`);

            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mimeType,
            };
            res.writeHead(206, head);

            const driveStream = await driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream', headers: { 'Range': `bytes=${start}-${end}` } }
            );

            driveStream.data
                .on('end', () => console.log(`[Stream] End: ${fileId}`))
                .on('error', (err) => {
                    console.error(`[Stream] Error: ${fileId}`, err);
                    // Ensure we don't crash the server on stream error
                    if (!res.headersSent) res.status(500).end();
                })
                .pipe(res);
        } else {
            console.log(`[Stream] Full file: ${fileSize}`);
            const head = {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
            };
            res.writeHead(200, head);

            const driveStream = await driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            driveStream.data
                .on('end', () => console.log(`[Stream] End: ${fileId}`))
                .on('error', (err) => {
                    console.error(`[Stream] Error: ${fileId}`, err);
                    if (!res.headersSent) res.status(500).end();
                })
                .pipe(res);
        }
    } catch (error) {
        console.error('[Stream] Fatal Error:', error.message);
        if (!res.headersSent) res.status(500).send('Error streaming file');
    }
});

// --- Download Endpoints ---

// API: Download Single File
app.get('/api/download/:fileId', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    const fileId = req.params.fileId;

    try {
        // Get file metadata for name and size
        const fileMeta = await driveService.getFileMetadata(fileId);
        const fileName = fileMeta.name || `${fileId}.mp3`;
        const fileSize = parseInt(fileMeta.size, 10);

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        if (fileSize) res.setHeader('Content-Length', fileSize);

        const stream = await driveService.streamFile(fileId);
        stream
            .on('error', (err) => {
                console.error(`[Download] Stream error for ${fileId}:`, err.message);
                if (!res.headersSent) res.status(500).end();
            })
            .pipe(res);
    } catch (error) {
        console.error('[Download] Error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    }
});

// API: Download Folder as ZIP
app.get('/api/download/folder/:folderId', async (req, res) => {
    if (!driveClient || !driveService) return res.status(500).json({ error: 'Drive not authenticated' });

    const folderId = req.params.folderId;

    try {
        // Get folder name
        let folderName = 'DrivePlayer-Download';
        try {
            const folderMeta = await driveService.getFileMetadata(folderId);
            folderName = folderMeta.name || folderName;
        } catch (e) { /* fallback name */ }

        // Get all files in folder (non-recursive, just immediate children)
        const files = await driveService.getFilesInFolder(folderId);
        const songs = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        if (songs.length === 0) {
            return res.status(404).json({ error: 'No files found in this folder' });
        }

        console.log(`[Download] Creating ZIP for folder "${folderName}" with ${songs.length} files`);

        // Set response headers for ZIP download
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(folderName)}.zip"`);
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 0 } }); // No compression (music is already compressed)

        archive.on('error', (err) => {
            console.error('[Download] Archive error:', err.message);
            if (!res.headersSent) res.status(500).end();
        });

        archive.pipe(res);

        // Stream each file into the archive
        for (const song of songs) {
            try {
                const stream = await driveService.streamFile(song.id);
                archive.append(stream, { name: song.name });
            } catch (fileErr) {
                console.error(`[Download] Failed to add ${song.name}: ${fileErr.message}`);
                // Skip failed files, continue with others
            }
        }

        await archive.finalize();
        console.log(`[Download] ZIP finalized for "${folderName}"`);
    } catch (error) {
        console.error('[Download] Folder ZIP error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    }
});

// API: Download Album as ZIP
app.get('/api/download/album', async (req, res) => {
    if (!driveClient || !metadataService) return res.status(500).json({ error: 'Services not initialized' });

    const albumName = req.query.name;
    if (!albumName) return res.status(400).json({ error: 'Album name required' });

    try {
        // Find all songs in this album from persistent cache
        const songs = Object.entries(metadataService.persistentCache)
            .filter(([id, meta]) => meta.album === albumName)
            .map(([id, meta]) => ({
                id,
                name: meta.filename || `${meta.title || 'track'}.mp3`
            }));

        if (songs.length === 0) {
            return res.status(404).json({ error: 'No songs found for this album in cache. Please scan library.' });
        }

        console.log(`[Download] Creating ZIP for album "${albumName}" with ${songs.length} files`);

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(albumName)}.zip"`);
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 0 } });
        archive.on('error', (err) => {
            console.error('[Download] Album Archive error:', err.message);
            if (!res.headersSent) res.status(500).end();
        });

        archive.pipe(res);

        for (const song of songs) {
            try {
                const stream = await driveService.streamFile(song.id);
                archive.append(stream, { name: song.name });
            } catch (fileErr) {
                console.error(`[Download] Failed to add ${song.name}: ${fileErr.message}`);
            }
        }

        await archive.finalize();
        console.log(`[Download] Album ZIP finalized for "${albumName}"`);
    } catch (error) {
        console.error('[Download] Album ZIP error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    }
});

// --- Telegram OTP System ---
const TelegramBot = require('node-telegram-bot-api');
let bot = null;

// Initialize Bot if credentials exist
if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    // Polling false because we only send messages, we don't need to read them
    console.log('Telegram Bot Initialized');
} else {
    console.log('Telegram Bot Token Missing - OTPs will fail or fallback to console');
}

let currentOtp = null;
let otpExpires = 0;

app.post('/api/auth/otp/send', async (req, res) => {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    currentOtp = otp;
    otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

    const message = `🔐 *DrivePlayer Verification*\n\nYour code is: \`${otp}\`\n\nValid for 5 minutes.`;

    try {
        if (bot && process.env.TELEGRAM_CHAT_ID) {
            await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
            console.log(`[Telegram] OTP Sent to ${process.env.TELEGRAM_CHAT_ID}`);
            res.json({ success: true, message: 'OTP Sent to Telegram' });
        } else {
            // Fallback for debugging if env missing
            console.log('\n=============================');
            console.log(`[MOCK SMS] To: Telegram User`);
            console.log(`[MOCK SMS] Message: Your Code is: ${otp}`);
            console.log('=============================\n');
            res.json({ success: true, message: 'OTP Generated (Check Console)' });
        }
    } catch (error) {
        console.error('Telegram Error:', error.message);
        res.status(500).json({ error: 'Failed to send Telegram message' });
    }
});

app.post('/api/auth/otp/verify', (req, res) => {
    const { otp } = req.body;



    if (!otp) return res.status(400).json({ error: 'OTP required' });

    if (!currentOtp || Date.now() > otpExpires) {
        return res.json({ valid: false, message: 'OTP Expired' });
    }

    // Ensure strict string comparison
    if (String(otp).trim() === String(currentOtp).trim()) {
        // Clear OTP after successful use to prevent replay (optional, but good practice)
        currentOtp = null;
        res.json({ valid: true });
    } else {
        res.json({ valid: false, message: 'Invalid OTP' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
