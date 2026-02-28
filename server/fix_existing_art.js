/**
 * One-time fix: Clear iTunes-fetched picture URLs for songs that have embedded album art.
 * 
 * Songs with embedded art have artwork=true in metadata_cache and their art
 * is served from the local disk cache — the iTunes URL in the `picture` column
 * is redundant and can cause the wrong art to display.
 *
 * Usage: node fix_existing_art.js
 */

const pool = require('./database/db');

async function fix() {
    console.log('[Fix] Finding songs with embedded art that also have an iTunes picture URL...');

    // Find all files where metadata_cache has artwork=true AND files.picture contains an iTunes/mzstatic URL
    const { rows } = await pool.query(`
        SELECT f.id, f.picture, mc.metadata
        FROM files f
        JOIN metadata_cache mc ON mc.file_id = f.id
        WHERE f.picture IS NOT NULL
          AND f.picture LIKE '%mzstatic.com%'
          AND mc.metadata::text LIKE '%"artwork":true%'
    `);

    console.log(`[Fix] Found ${rows.length} songs to fix.`);

    if (rows.length === 0) {
        console.log('[Fix] Nothing to do. All clean!');
        process.exit(0);
    }

    let fixed = 0;
    for (const row of rows) {
        await pool.query(`UPDATE files SET picture = NULL WHERE id = $1`, [row.id]);
        fixed++;
    }

    console.log(`[Fix] Done! Cleared iTunes art from ${fixed} songs. They will now use their embedded artwork.`);
    process.exit(0);
}

fix().catch(err => {
    console.error('[Fix] Error:', err);
    process.exit(1);
});
