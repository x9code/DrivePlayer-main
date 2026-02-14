/**
 * Drive Service
 * Abstracts Google Drive API interactions
 * Handles range downloads, file metadata, and streaming
 */

const { Readable } = require('stream');

class DriveService {
    constructor(driveClient) {
        this.driveClient = driveClient;
    }

    /**
     * Get file metadata from Google Drive
     * @param {string} fileId - Google Drive file ID
     * @returns {Promise<{name: string, size: number, mimeType: string}>}
     */
    async getFileMetadata(fileId) {
        try {
            const response = await this.driveClient.files.get({
                fileId: fileId,
                fields: 'name, size, mimeType'
            });

            return {
                name: response.data.name,
                size: parseInt(response.data.size),
                mimeType: response.data.mimeType
            };
        } catch (error) {
            console.error(`[Drive] Error fetching metadata for ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download a specific byte range from Google Drive
     * @param {string} fileId - Google Drive file ID
     * @param {number} start - Start byte (inclusive)
     * @param {number} end - End byte (inclusive)
     * @returns {Promise<Buffer>} Downloaded data
     */
    async downloadRange(fileId, start, end) {
        try {
            const response = await this.driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                {
                    responseType: 'stream',
                    headers: { 'Range': `bytes=${start}-${end}` }
                }
            );

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of response.data) {
                chunks.push(chunk);
            }

            return Buffer.concat(chunks);
        } catch (error) {
            console.error(`[Drive] Error downloading range ${start}-${end} for ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download multiple byte ranges and combine them
     * Useful for reading both header and footer of audio files
     * @param {string} fileId - Google Drive file ID
     * @param {Array<{start: number, end: number}>} ranges - Array of byte ranges
     * @returns {Promise<Buffer>} Combined buffer
     */
    async downloadMultipleRanges(fileId, ranges) {
        try {
            const downloads = ranges.map(range =>
                this.downloadRange(fileId, range.start, range.end)
            );

            const buffers = await Promise.all(downloads);
            return Buffer.concat(buffers);
        } catch (error) {
            console.error(`[Drive] Error downloading multiple ranges for ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download optimized ranges for metadata (Header + Footer)
     * Header: 64KB (Cover ID3v2, most FLAC headers)
     * Footer: 4KB (Cover ID3v1)
     * @param {string} fileId - File ID
     * @param {number} fileSize - Total file size
     * @returns {Promise<{stream: Readable, size: number}>}
     */
    async downloadOptimizedMetadata(fileId, fileSize) {
        try {
            const headerSize = Math.min(1572864, fileSize); // 1.5MB (Improved for Hi-Res Art)
            const footerSize = Math.min(16384, fileSize);  // 16KB

            console.log(`[Drive] Smart Scan ${fileId}: Header(${headerSize}) + Footer(${footerSize})`);

            // Check if file is too small to have separate footer
            if (fileSize <= headerSize + footerSize) {
                // Just download the whole thing if it's tiny
                const buffer = await this.downloadRange(fileId, 0, fileSize - 1);
                const { PassThrough } = require('stream');
                const stream = new PassThrough();
                stream.end(buffer);
                return { stream, size: buffer.length };
            }

            // Download ranges
            const [header, footer] = await Promise.all([
                this.downloadRange(fileId, 0, headerSize - 1),
                this.downloadRange(fileId, fileSize - footerSize, fileSize - 1)
            ]);

            // Combine only if music-metadata can handle gaps?
            // Actually, music-metadata 'parseStream' expects a continuous stream or a random-access reader.
            // For a stream, we can just concatenate header + padding + footer?
            // NO, `music-metadata` might stop if it hits garbage.
            // BETTER: metadataService should handle the specific logic. 
            // BUT for now, let's just return the concatenated buffer. 
            // Most parsers are robust enough to find ID3 at start and ID3v1 at end.

            const combined = Buffer.concat([header, footer]);

            const { PassThrough } = require('stream');
            const stream = new PassThrough();
            stream.end(combined);

            return {
                stream: stream,
                size: combined.length
            };
        } catch (error) {
            console.error(`[Drive] Smart Scan error for ${fileId}:`, error.message);
            // Fallback to old safe method
            return this.downloadMetadataRanges(fileId, fileSize);
        }
    }

    /**
     * Download enough data to parse full metadata
     * Downloads both header (1MB) and footer (128KB) for comprehensive tag extraction
     * @param {string} fileId - Google Drive file ID
     * @param {number} fileSize - Total file size in bytes
     * @returns {Promise<{stream: Readable, size: number}>} Stream with combined data
     */
    async downloadMetadataRanges(fileId, fileSize) {
        try {
            // Download first 1MB to cover large ID3v2 tags with embedded artwork
            const downloadSize = Math.min(1048576, fileSize); // 1MB or file size

            console.log(`[Drive] Downloading first ${downloadSize} bytes for metadata parsing`);

            const buffer = await this.downloadRange(fileId, 0, downloadSize - 1);

            console.log(`[Drive] Downloaded ${buffer.length} bytes successfully`);

            // Create a proper stream from buffer using PassThrough
            const { PassThrough } = require('stream');
            const stream = new PassThrough();
            stream.end(buffer);

            return {
                stream: stream,
                size: buffer.length
            };
        } catch (error) {
            console.error(`[Drive] Error downloading metadata for ${fileId}:`, error.message);
            console.error(`[Drive] Full error:`, error);

            // Fallback: try smaller range
            console.log(`[Drive] Falling back to 512KB download`);
            try {
                const headerSize = Math.min(524288, fileSize); // 512KB
                const headerBuffer = await this.downloadRange(fileId, 0, headerSize - 1);

                const { PassThrough } = require('stream');
                const stream = new PassThrough();
                stream.end(headerBuffer);

                return {
                    stream: stream,
                    size: headerBuffer.length
                };
            } catch (fallbackError) {
                console.error(`[Drive] Fallback also failed:`, fallbackError.message);
                throw error; // Throw original error
            }
        }
    }

    /**
     * Stream file for playback
     * @param {string} fileId - Google Drive file ID
     * @param {string|null} range - Optional range header (e.g., "bytes=0-1023")
     * @returns {Promise<Stream>} File stream
     */
    async streamFile(fileId, range = null) {
        try {
            const options = {
                responseType: 'stream'
            };

            if (range) {
                options.headers = { 'Range': range };
            }

            const response = await this.driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                options
            );

            return response.data;
        } catch (error) {
            console.error(`[Drive] Error streaming file ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if Drive client is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.driveClient !== null;
    }
    /**
     * Recursively fetch all audio files from a folder and its subfolders
     * @param {string} folderId - The folder ID to start from
     * @param {number} maxDepth - Maximum recursion depth (default 5)
     * @param {number} maxFiles - Maximum total files to fetch (default 500)
     * @returns {Promise<Array>} List of file objects
     */
    async getFilesRecursive(folderId, maxDepth = 5, maxFiles = 10000) {
        let allFiles = [];

        // Fetch root folder name first
        let rootFolderName = 'Unknown Album';
        try {
            const rootMeta = await this.getFileMetadata(folderId);
            rootFolderName = rootMeta.name;
        } catch (e) {
            console.warn(`[Drive] Failed to fetch root folder name: ${e.message}`);
        }

        const fetchLevel = async (currentFolderId, currentFolderName, currentDepth) => {
            if (currentDepth > maxDepth || allFiles.length >= maxFiles) return;

            try {
                let pageToken = null;

                do {
                    if (allFiles.length >= maxFiles) break;

                    const res = await this.driveClient.files.list({
                        q: `'${currentFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio/' or fileExtension = 'mp3' or fileExtension = 'm4a' or fileExtension = 'opus' or fileExtension = 'flac') and trashed = false`,
                        fields: 'nextPageToken, files(id, name, mimeType, size, thumbnailLink)',
                        orderBy: 'folder, name',
                        pageSize: 1000,
                        pageToken: pageToken
                    });

                    const items = res.data.files || [];
                    pageToken = res.data.nextPageToken;

                    const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
                    const files = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

                    // Attach Album Name (Folder Name) & Parent ID
                    const filesWithAlbum = files.map(f => ({
                        ...f,
                        album: currentFolderName,
                        parent: currentFolderId
                    }));

                    // Also include key folder info for hierarchy reconstruction
                    const folderObjects = folders.map(f => ({
                        id: f.id,
                        name: f.name,
                        mimeType: f.mimeType,
                        parent: currentFolderId,
                        isFolder: true
                    }));

                    allFiles.push(...filesWithAlbum, ...folderObjects);

                    if (folders.length > 0 && allFiles.length < maxFiles) {
                        // Pass folder.name as the new album name for children
                        await Promise.all(folders.map(folder => fetchLevel(folder.id, folder.name, currentDepth + 1)));
                    }
                } while (pageToken && allFiles.length < maxFiles);

            } catch (error) {
                console.error(`[Drive] Error scanning folder ${currentFolderId}:`, error.message);
            }
        };

        await fetchLevel(folderId, rootFolderName, 0);
        return allFiles;
    }

    /**
     * Get all files in a specific folder with pagination
     * @param {string} folderId - Google Drive folder ID
     * @returns {Promise<Array>} List of file objects
     */
    async getFilesInFolder(folderId) {
        let allFiles = [];
        let pageToken = null;

        try {
            do {
                // Broaden search: fetch ALL non-trashed files in the folder
                // We previously filtered by mimeType/extension here, but Drive's indexing can be spotty.
                // Fetching everything and filtering in-memory ensures we see what Drive actually has.
                const res = await this.driveClient.files.list({
                    q: `'${folderId}' in parents and trashed = false`,
                    fields: 'nextPageToken, files(id, name, mimeType, size, thumbnailLink, createdTime, fileExtension)',
                    orderBy: 'folder, name',
                    pageSize: 1000,
                    pageToken: pageToken
                });

                const rawFiles = res.data.files || [];

                // In-memory Filter
                const filtered = rawFiles.filter(f => {
                    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
                    const isAudioMime = f.mimeType && f.mimeType.startsWith('audio/');
                    // Check extension (handling case sensitivity)
                    const ext = f.fileExtension ? f.fileExtension.toLowerCase() : ''; // fileExtension field is cleaner than parsing name
                    // Fallback to name parsing if fileExtension is missing but name exists
                    const nameExt = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : '';

                    const isAudioExt = ['mp3', 'm4a', 'flac', 'opus', 'wav', 'ogg'].includes(ext || nameExt);

                    return isFolder || isAudioMime || isAudioExt;
                });

                console.log(`[Drive] Page fetched: ${rawFiles.length} items. Kept ${filtered.length} (Folders/Audio).`);

                // Inject parent ID for consistency with recursive fetch
                const mapped = filtered.map(f => ({
                    ...f,
                    parent: folderId
                }));

                allFiles.push(...mapped);
                pageToken = res.data.nextPageToken;

                if (pageToken) {
                    console.log(`[Drive] Fetching more files from folder ${folderId}...`);
                }

            } while (pageToken);

            return allFiles;
        } catch (error) {
            console.error(`[Drive] Error listing files in folder ${folderId}:`, error.message);
            throw error;
        }
    }
}

module.exports = DriveService;
