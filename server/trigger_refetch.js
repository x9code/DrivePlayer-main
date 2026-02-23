const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function triggerRefetch() {
    try {
        await client.connect();

        // Only get files that are definitely audio
        const res = await client.query(`
            SELECT id FROM files 
            WHERE mimeType LIKE 'audio/%' 
            OR mimeType IN ('video/mp4', 'application/ogg')
        `);

        const files = res.rows;
        console.log(`Found ${files.length} audio files to re-fetch.`);

        let count = 0;
        const total = files.length;

        // Process sequentially to be nice to Google Drive API limits
        for (const file of files) {
            count++;

            try {
                // Hitting the local API which will trigger metadataService.getOrParseMetadata
                // The cache was wiped, so this forces a real download from Drive.
                const response = await fetch(`http://localhost:5000/api/metadata/${file.id}`);

                if (!response.ok) {
                    console.error(`[${count}/${total}] Failed for ${file.id}: ${response.statusText}`);
                } else {
                    const data = await response.json();
                    console.log(`[${count}/${total}] Updated: ${data.artist} - ${data.title}`);
                }
            } catch (fetchErr) {
                console.error(`[${count}/${total}] network error for ${file.id}: ${fetchErr.message}`);
            }

            // Artificial delay to prevent Drive API rate limits (HTTP 403/429)
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log("=== FULL METADATA RESYNC COMPLETE ===");

    } catch (e) {
        console.error("Database connection error:", e);
    } finally {
        await client.end();
    }
}

triggerRefetch();
