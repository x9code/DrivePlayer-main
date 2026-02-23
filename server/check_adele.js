const { pool } = require('./database/db');
pool.query("SELECT name, mimeType FROM files WHERE name = 'Adele' LIMIT 1")
    .then(res => { console.log(res.rows); process.exit(0); })
    .catch(console.error);
