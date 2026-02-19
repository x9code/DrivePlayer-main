const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE users (email TEXT)");
    const email = "User@Example.com";
    db.run("INSERT INTO users (email) VALUES (?)", [email]);

    console.log(`Inserted: ${email}`);

    const tests = ["User@Example.com", "user@example.com", "USER@EXAMPLE.COM"];

    tests.forEach(testEmail => {
        db.get("SELECT * FROM users WHERE email = ?", [testEmail], (err, row) => {
            if (err) console.error(err);
            console.log(`Querying for '${testEmail}': matched = ${row ? 'YES' : 'NO'}`);
        });
    });
});
