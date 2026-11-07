/**
 * Category repository. Categories are a fixed, admin-managed reference
 * list (Section 3.8.4: kept in their own table to avoid free-text
 * duplication on menu_items) — vendors select from this list, they don't
 * create entries in it. See database/seeds/001_categories.sql.
 */
const { pool } = require('../config/db');

async function listAll() {
  const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

module.exports = { listAll, findById };
