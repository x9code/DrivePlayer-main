const sqlite3 = require('../server/node_modules/sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../server/database/library.db');
const db = new sqlite3.Database(dbPath);

const targetFolderId = '1W-VXvAMhefwfGPaL1v_5sOnixFDYlDau';

console.log(`Checking DB at ${dbPath}`);
console.log(`Target Folder: ${targetFolderId}`);

db.serialize(() => {
    // 1. Check if folder exists
    db.get("SELECT * FROM files WHERE id = ?", [targetFolderId], (err, row) => {
        if (err) console.error("Error fetching folder:", err);
        console.log("Folder Entry:", row ? "FOUND" : "NOT FOUND");
        if (row) console.log(JSON.stringify(row, null, 2));
    });

    // 2. Check direct children
    db.all("SELECT id, name, parent, mimeType FROM files WHERE parent = ?", [targetFolderId], (err, rows) => {
        if (err) console.error("Error fetching children:", err);
        console.log(`Direct Children Count: ${rows ? rows.length : 0}`);
        if (rows && rows.length > 0) {
            console.log("First 5 children:", rows.slice(0, 5));
        }
    });

    // 3. Test Recursive Query
    const recursiveSql = `
        WITH RECURSIVE descendants(id) AS (
            SELECT id FROM files WHERE parent = ? AND mimeType = 'application/vnd.google-apps.folder' AND is_trashed = 0
            UNION ALL
            SELECT f.id FROM files f
            JOIN descendants d ON f.parent = d.id
            WHERE f.mimeType = 'application/vnd.google-apps.folder' AND f.is_trashed = 0
        )
        SELECT * FROM files 
        WHERE (parent = ? OR parent IN descendants) 
        AND is_trashed = 0
    `;

    // 4. Check files by Album Name (to see if they exist and what parent they have)
    const albumName = "Born To Die – Paradise Edition (Special Version) Explicit ";
    console.log(`Checking files with Album: "${albumName}"`);

    db.all("SELECT id, name, parent, album FROM files WHERE album = ?", [albumName], (err, rows) => {
        if (err) console.error("Error fetching album files:", err);
        console.log(`Files with this Album: ${rows ? rows.length : 0}`);
        if (rows && rows.length > 0) {
            console.log("First 5 files:", rows.slice(0, 5));
        }
    });
});

db.close();
