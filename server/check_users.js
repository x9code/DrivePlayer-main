const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'library.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Checking users table...");
    db.all("SELECT id, email, created_at, avatar_path, username FROM users", (err, rows) => {
        if (err) {
            console.error("Error querying users:", err);
        } else {
            console.log(`Found ${rows.length} users:`);
            rows.forEach(row => {
                console.log(JSON.stringify(row));
            });
        }
    });
});

db.close();
