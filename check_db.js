const db = require('./server/database/db');

async function check() {
    try {
        const covers = await db.query('SELECT * FROM folder_covers LIMIT 10');
        console.log('Folder Covers in DB:', covers.rows);
        
        const files = await db.query('SELECT parent, COUNT(*) FROM files GROUP BY parent LIMIT 10');
        console.log('Files grouping by parent:', files.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
