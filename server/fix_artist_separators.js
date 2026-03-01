require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    console.log('Starting Artist Separator Migration (Replacing ; with , )');
    try {
        // 1. Update files table
        const { rows: filesToUpdate } = await pool.query(`SELECT id, artist FROM files WHERE artist LIKE '%;%'`);
        console.log(`Found ${filesToUpdate.length} files with ';' in their artist name.`);

        let updatedFilesCount = 0;
        for (const file of filesToUpdate) {
            const newArtist = file.artist.replace(/;\s*/g, ', ');
            await pool.query(`UPDATE files SET artist = $1 WHERE id = $2`, [newArtist, file.id]);
            updatedFilesCount++;
        }
        console.log(`Successfully updated ${updatedFilesCount} files in the database.`);

        // 2. Update metadata_cache table
        const { rows: cachedItems } = await pool.query(`SELECT file_id, metadata FROM metadata_cache`);
        let updatedCacheCount = 0;

        for (const item of cachedItems) {
            let metadata = item.metadata;
            if (typeof metadata === 'string') {
                try {
                    metadata = JSON.parse(metadata);
                } catch (e) {
                    continue;
                }
            }
            if (metadata && metadata.artist && metadata.artist.includes(';')) {
                metadata.artist = metadata.artist.replace(/;\s*/g, ', ');
                await pool.query(
                    `UPDATE metadata_cache SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE file_id = $2`,
                    [JSON.stringify(metadata), item.file_id]
                );
                updatedCacheCount++;
            }
        }
        console.log(`Successfully updated ${updatedCacheCount} items in the metadata_cache.`);

        console.log('Migration completed.');
    } catch (err) {
        console.error('Error during migration:', err);
    } finally {
        await pool.end();
    }
}

main();
