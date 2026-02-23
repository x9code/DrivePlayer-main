const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MetadataService = require('./services/metadataService');
const LocalLibraryService = require('./services/libraryService');

const CACHE_FILE = path.join(__dirname, 'data', 'metadata_persistence.json');

async function wipeAndResync() {
    console.log("=== STARTING FULL METADATA WIPE AND RESYNC ===");
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await client.connect();
        console.log("1. Connected to Neon Database.");

        // [WIPE CACHES]
        console.log("\n--- WIPING LOCAL CACHES ---");
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
            console.log(`Deleted local persistence cache: ${CACHE_FILE}`);
        } else {
            console.log(`Local cache file not found: ${CACHE_FILE} (Safe to proceed)`);
        }

        console.log("Truncating 'metadata_cache' table in DB...");
        await client.query('TRUNCATE TABLE metadata_cache RESTART IDENTITY');
        console.log("Database 'metadata_cache' wiped.");

        // [INITIALIZE SERVICES]
        // Since we are running manually, we need to spin up the services we want to use
        // DriveService needs auth, which requires checking if token exists. Wait, that might be complex to boot in a script.
        // It might be easier to trigger an existing endpoint, but we don't have a "Wipe and Resync All" endpoint.

        // Instead, let's just make the script emit an instruction to restart the server
        // so that the server boots up with ZERO cache, and then we hit the /api/metadata endpoint in a loop.

        console.log("\n=== CACHE WIPE COMPLETE ===");
        console.log("Please restart the node server so it boots with a clean slate.");
        console.log("Then, we will trigger a re-fetch of all files.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}

wipeAndResync();
