/**
 * MySQL connection pool.
 * A pool is used instead of a single connection so concurrent requests
 * (e.g. several students checking out at once) don't block on one connection.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: false,
});

/**
 * Simple helper to verify the DB is reachable at startup.
 * Fails loudly rather than letting the server start against a dead DB.
 */
async function verifyConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { pool, verifyConnection };
