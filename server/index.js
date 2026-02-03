const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Import new services
const CacheService = require('./services/cacheService');
const DriveService = require('./services/driveService');
const MetadataService = require('./services/metadataService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*', // Allow Vercel/Render/Localhost
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range']
}));
app.use(express.json());

// Google Drive Auth Setup
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
let driveClient = null;

async function authenticateDrive() {
    try {
        // 1. Check if the environment variable contains JSON content directly (Render/Vercel)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.trim().startsWith('{')) {
            const credsPath = path.join(__dirname, 'google-credentials.json');
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
        metadataService = new MetadataService(driveService, cacheService, CACHE_DIR);

        console.log('[Services] All services initialized successfully');
    } else {
        console.error('[Services] Failed to initialize - Drive client not authenticated');
    }
}

initializeServices();

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
            const files = await driveService.getFilesInFolder(targetFolderId);

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



        res.json({
            files: filesRes.data.files || [],
            folderId: targetFolderId,
            folderName: folderName
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// API: Recursive File Fetch (for Folder Play)
app.get('/api/files/recursive', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    const folderId = req.query.folderId;
    if (!folderId) return res.status(400).json({ error: 'Folder ID required' });

    try {
        console.log(`Fetch recursive: ${folderId}`);
        const files = await driveService.getFilesRecursive(folderId);
        console.log(`Found ${files.length} files recursively`);

        res.json({ files });
    } catch (error) {
        console.error('Recursive fetch error:', error);
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
            duration: metadata.duration
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


// API: Get Thumbnail (Album Artwork)
app.get('/api/thumbnail/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const cachePath = path.join(CACHE_DIR, `${fileId}`);

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
