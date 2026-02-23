const pool = require('./database/db');

async function checkFolders() {
    try {
        const sql = `SELECT id, name, mimetype, artist, title, album FROM files WHERE name IN ('Adele', 'Alan Walker', 'Anne-Marie', 'Arctic Monkeys')`;
        const res = await pool.query(sql);
        console.log("Found rows:", JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error("Query failed:", err.message);
        // Try with quoted identifier if it fails
        try {
            const sql2 = `SELECT id, name, "mimeType", artist, title, album FROM files WHERE name IN ('Adele', 'Alan Walker', 'Anne-Marie', 'Arctic Monkeys')`;
            const res2 = await pool.query(sql2);
            console.log("Found rows (quoted):", JSON.stringify(res2.rows, null, 2));
        } catch (err2) {
            console.error("Second attempt failed:", err2.message);
        }
    } finally {
        process.exit(0);
    }
}

checkFolders();
