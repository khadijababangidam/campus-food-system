/**
 * Bootstraps the first admin account. Necessary because, as of the admin
 * module, neither vendor nor admin accounts can self-register (Section
 * 3.9) — something has to create the very first admin some other way.
 * This script is idempotent: if any admin already exists, it does
 * nothing, so it's safe to run more than once (e.g. by accident, or as
 * part of a repeatable setup script).
 *
 * Usage: npm run seed:admin
 * Configure via .env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_PHONE
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [existing] = await connection.query("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.length > 0) {
      console.log(`Admin already exists (${existing[0].email}) — nothing to do.`);
      return;
    }

    const fullName = process.env.ADMIN_FULL_NAME || 'System Administrator';
    const email = process.env.ADMIN_EMAIL || 'admin@gsu-food.local';
    const phone = process.env.ADMIN_PHONE || '0000000000';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await connection.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, 'admin', NOW())`,
      [fullName, email, phone, passwordHash]
    );

    console.log(`Admin account created: ${email}`);
    console.log('Log in and change this password immediately if you used the default.');
  } finally {
    await connection.end();
  }
}

run().catch(err => {
  console.error('Admin bootstrap failed:', err.message);
  process.exit(1);
});
