const { Client } = require('pg');
require('dotenv').config();
const { parseArtistFromFilename } = require('./utils/sanitizer');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function fixDB() {
    try {
        await client.connect();
        console.log("Connected to DB");

        const res = await client.query(`SELECT id, name FROM files WHERE artist = 'Unknown Artist' OR artist IS NULL`);
        const rows = res.rows;

        console.log(`Found ${rows.length} files to check.`);

        const updates = [];

        for (const row of rows) {
            const newArtist = parseArtistFromFilename(row.name);
            if (newArtist && newArtist !== 'Unknown Artist') {
                updates.push({ id: row.id, artist: newArtist });
            }
        }

        console.log(`Prepared ${updates.length} updates. Sending via transactions...`);

        const BATCH_SIZE = 100;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE);

            await client.query('BEGIN');
            try {
                const promises = batch.map(item => {
                    return Promise.all([
                        client.query('UPDATE files SET artist = $1 WHERE id = $2', [item.artist, item.id]),
                        client.query(`UPDATE metadata_cache SET metadata = jsonb_set(metadata::jsonb, '{artist}', $1::jsonb) WHERE file_id = $2`, [JSON.stringify(item.artist), item.id])
                    ]);
                });

                await Promise.all(promises);
                await client.query('COMMIT');
                console.log(`Updated batch ${i} to ${i + batch.length} / ${updates.length}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("Batch error:", err);
                throw err;
            }
        }

        console.log(`Successfully updated ${updates.length} files with new artists!`);
    } catch (e) {
        console.error("Error during DB update:", e);
    } finally {
        await client.end();
    }
}

fixDB();
