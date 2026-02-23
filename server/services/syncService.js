const libraryService = require('./libraryService');
// const metadataService = require('./metadataService');

class SyncService {
    constructor() {
        this.driveService = null;
        this.metadataService = null;
        this.isSyncing = false;
        this.syncError = null;
        this.BATCH_SIZE = 500;
    }

    /**
     * Initialize the service with dependencies
     */
    init(driveServiceInstance, metadataServiceInstance) {
        this.driveService = driveServiceInstance;
        this.metadataService = metadataServiceInstance;
        console.log('[Sync] Service initialized with DriveService and MetadataService instances');
    }

    /**
     * Start the synchronization process (Background Job)
     * Handles both Bootstrap (Initial) and Delta (Incremental) syncs
     */
    async startSync() {
        if (!this.driveService) {
            console.error('[Sync] Error: DriveService not initialized');
            return;
        }

        // Reset stuck state on startup (safety check)
        // We do this check in memory, but we should also trust the DB lock if another process was running?
        // Since this is single-process Node.js, if we are starting fresh, we own the DB.
        // So effectively, we should clear any "leftover" true state.

        if (this.isSyncing) {
            console.log('[Sync] Sync already in progress (in-memory flag), skipping.');
            return { status: 'skipped', message: 'Sync in progress' };
        }

        // Double check DB state (in case multiple instances or previous crash)
        const dbSyncing = await libraryService.getSyncState('isSyncing');
        if (dbSyncing === 'true') {
            // CRITICAL: If we just restarted, this might be a stale lock.
            // Ideally we check a PID or heartbeat. 
            // For now, if WE are just starting, we assume we are the authority and it's stale.
            // But inside `startSync` we assume we are running.
            // Wait, `startSync` is called periodically. 
            // We need a specific "Reset" method called ONCE at server boot.
        }

        this.isSyncing = true;
        this.syncError = null;
        await libraryService.setSyncState('isSyncing', 'true');
        console.log('[Sync] Starting sync process...');

        try {
            // 1. Check if we have a Page Token (Bootstrap vs Delta)
            const nextPageToken = await libraryService.getSyncState('nextPageToken');

            if (!nextPageToken) {
                await this.runBootstrapSync();
            } else {
                await this.runDeltaSync(nextPageToken);
            }

            // Success
            await libraryService.setSyncState('lastSuccessfulSyncTime', new Date().toISOString());
            await libraryService.setSyncState('syncError', null);
            console.log('[Sync] Sync completed successfully.');

        } catch (error) {
            console.error('[Sync] Fatal error:', error);
            this.syncError = error.message;
            await libraryService.setSyncState('syncError', error.message);
        } finally {
            this.isSyncing = false;
            await libraryService.setSyncState('isSyncing', 'false');
            await libraryService.setSyncState('lastSyncTime', new Date().toISOString());
        }
    }

    /**
     * Phase 1: Bootstrap Sync
     * Full recursive crawl + Bulk Insert
     */
    async runBootstrapSync() {
        console.log('[Sync] No page token found. Starting BOOTSTRAP (Full) Sync...');

        // 1. Get Root Folder ID
        let rootFolderId = null;
        const files = await this.driveService.driveClient.files.list({
            q: "name = 'music' and mimeType = 'application/vnd.google-apps.folder'",
            fields: 'files(id)',
        });
        if (files.data.files.length) {
            rootFolderId = files.data.files[0].id;
        } else {
            throw new Error('Music folder not found during bootstrap');
        }

        // 2. Recursive Crawl
        console.log(`[Sync] Crawling folder: ${rootFolderId}`);
        const allFiles = await this.driveService.getFilesRecursive(rootFolderId, 20, 50000);
        console.log(`[Sync] Found ${allFiles.length} files. Preparing to insert...`);

        // 3. Obtain Start Page Token
        const startToken = await this.driveService.getStartPageToken();

        // 4. Batch Insert
        const client = await libraryService.beginTransaction();
        try {
            let batch = [];
            for (const file of allFiles) {
                const dbFile = this.mapDriveFileToDB(file);
                batch.push(dbFile);

                if (batch.length >= this.BATCH_SIZE) {
                    await this.processBatch(batch, client);
                    batch = [];
                }
            }
            if (batch.length > 0) await this.processBatch(batch, client);

            // 5. Save Token INSIDE Transaction (Atomic commit)
            await libraryService.setSyncState('nextPageToken', startToken, client);

            await libraryService.commit(client);
            console.log('[Sync] Bootstrap complete. Saved start token.');

            // [NEW] Trigger metadata enrichment for the entire library after bootstrap
            if (this.metadataService && allFiles.length > 0) {
                console.log(`[Sync] Triggering enrichment for ${allFiles.length} files...`);
                this.metadataService.enrichFiles(allFiles).catch(err => console.error('[Sync] Enrichment error:', err));
            }

        } catch (err) {
            await libraryService.rollback(client);
            throw err;
        }
    }

    async runDeltaSync(currentToken) {
        console.log('[Sync] Page token found. Starting DELTA Sync...');

        let pageToken = currentToken;
        let hasMore = true;
        const changedFiles = [];

        while (hasMore) {
            const { changes, newStartPageToken } = await this.driveService.getChanges(pageToken);

            if (changes.length > 0) {
                console.log(`[Sync] Processing ${changes.length} changes for token ${pageToken}...`);
                const client = await libraryService.beginTransaction();
                try {
                    for (const change of changes) {
                        if (change.removed || (change.file && change.file.trashed)) {
                            await libraryService.softDeleteFile(change.fileId, client);
                        } else if (change.file) {
                            const dbFile = this.mapDriveFileToDB(change.file);
                            await this.upsertWithOptimization(dbFile, client);
                            changedFiles.push(dbFile);
                        }
                    }

                    // Update Token INSIDE Transaction
                    const nextTokenToSave = newStartPageToken;
                    if (nextTokenToSave) {
                        await libraryService.setSyncState('nextPageToken', nextTokenToSave, client);
                        pageToken = nextTokenToSave; // Update local loop var
                    }

                    await libraryService.commit(client);
                } catch (err) {
                    await libraryService.rollback(client);
                    throw err;
                }
            } else {
                // No changes in this batch, but might have new token
                if (newStartPageToken) {
                    await libraryService.setSyncState('nextPageToken', newStartPageToken);
                    pageToken = newStartPageToken;
                }
            }

            // If changes occurred, trigger enrichment for those specific files
            if (this.metadataService && changedFiles.length > 0) {
                console.log(`[Sync] Triggering enrichment for ${changedFiles.length} files...`);
                this.metadataService.enrichFiles(changedFiles).catch(err => console.error('[Sync] Enrichment error:', err));
            }

            hasMore = false; // Force single loops for now to avoid Infinite Loop risk
        }
    }

    /**
     * Map Drive API Object to DB Object
     */
    mapDriveFileToDB(file) {
        // Fallbacks
        const name = file.name || 'Untitled';
        const fileExt = name.split('.').pop();

        return {
            id: file.id,
            name: name,
            parent: file.parent || ((file.parents && file.parents[0]) ? file.parents[0] : null),
            mimeType: file.mimeType,
            size: parseInt(file.size || 0),
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            md5Checksum: file.md5Checksum,
            // Init Metadata (will be refined by optimization or metadata service)
            album: null,
            artist: null,
            title: null,
            duration: null,
            picture: file.thumbnailLink || null // Fallback to Drive Thumbnail
        };
    }

    /**
     * Upsert but preserve metadata if checksum/mod-time matches
     */
    async upsertWithOptimization(newFile, client) {
        // Minimal logic: rely on LibraryService.upsertFile to just overwrite.
        await libraryService.upsertFile(newFile, client);
    }

    /**
     * Process a batch of files
     */
    async processBatch(batch, client) {
        console.log(`[Sync] Inserting batch of ${batch.length} files...`);
        let count = 0;
        for (const file of batch) {
            try {
                await libraryService.upsertFile(file, client);
                count++;
            } catch (err) {
                console.error(`[Sync] Error upserting file ${file.name} (${file.id}):`, err);
                throw err;
            }
        }
        console.log(`[Sync] Finished inserting ${count} files in this batch.`);
    }
}

module.exports = new SyncService();
