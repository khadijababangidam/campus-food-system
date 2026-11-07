/**
 * Runs each .sql file in database/seeds, in filename order.
 * Unlike migrate.js, this is NOT tracked/idempotent-guarded beyond what
 * each seed file itself does (e.g. ON DUPLICATE KEY UPDATE) — seeds are
 * meant to be safe to re-run, not run-once.
 *
 * Usage: npm run seed
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SEEDS_DIR = path.join(__dirname, 'seeds');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const files = fs.readdirSync(SEEDS_DIR).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
      console.log(`seed   ${file}`);
      await connection.query(sql);
    }
    console.log(`Seeded ${files.length} file(s).`);
  } finally {
    await connection.end();
  }
}

run().catch(err => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
