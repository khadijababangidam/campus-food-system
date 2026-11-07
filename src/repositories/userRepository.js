/**
 * User repository — the ONLY module allowed to write raw SQL for the users table.
 * Services never touch `pool` directly; this keeps the data-access concern
 * isolated so MySQL could be swapped later without touching business logic
 * (Clean Architecture boundary described in Chapter 3, Section 3.2/3.8.1).
 */
const { pool } = require('../config/db');

async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function create({ fullName, email, phone, passwordHash, role }) {
  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [fullName, email, phone, passwordHash, role]
  );
  return findById(result.insertId);
}

async function list({ role, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];
  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, role, is_active, created_at
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereClause}`, params);
  return { users: rows, total, page: Number(page), limit: Number(limit) };
}

async function setActive(id, isActive) {
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, id]);
  return findById(id);
}

module.exports = { findByEmail, findById, create, list, setActive };
