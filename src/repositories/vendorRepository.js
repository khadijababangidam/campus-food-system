/**
 * Vendor repository. Menu operations need to translate "the logged-in
 * user" (from the JWT) into "their vendor row" (which menu_items actually
 * references), so this lookup sits ahead of every write in menuService.
 */
const { pool } = require('../config/db');

async function findByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM vendors WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM vendors WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Creates the user row (role='vendor') and the vendor profile row in one
 * transaction — a vendor can't meaningfully exist as only one half of
 * that pair. This is the ONLY way a vendor account gets created (FR9,
 * Section 3.9): there's no public self-registration path for this role.
 */
async function createWithUser({ fullName, email, phone, passwordHash, businessName, description }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, 'vendor', NOW())`,
      [fullName, email, phone, passwordHash]
    );
    const userId = userResult.insertId;

    const [vendorResult] = await connection.query(
      `INSERT INTO vendors (user_id, business_name, description, status, created_at)
       VALUES (?, ?, ?, 'active', NOW())`,
      [userId, businessName, description || null]
    );

    await connection.commit();
    return vendorResult.insertId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listAll({ status, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('v.status = ?');
    params.push(status);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT v.*, u.full_name AS owner_name, u.email AS owner_email, u.is_active AS owner_is_active
     FROM vendors v
     JOIN users u ON u.id = v.user_id
     ${whereClause}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM vendors v ${whereClause}`,
    params
  );
  return { vendors: rows, total, page: Number(page), limit: Number(limit) };
}

async function updateStatus(id, status) {
  await pool.query('UPDATE vendors SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

module.exports = { findByUserId, findById, createWithUser, listAll, updateStatus };
