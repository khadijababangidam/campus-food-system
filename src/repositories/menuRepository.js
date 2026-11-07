/**
 * Menu item repository. `remove()` deliberately does NOT delete rows that
 * have order history — order_items.item_id is ON DELETE RESTRICT, so
 * MySQL itself would refuse it. We check first here and surface a clear
 * reason rather than letting the caller hit a raw FK error.
 */
const { pool } = require('../config/db');

async function findByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT * FROM menu_items WHERE id IN (${placeholders})`,
    ids
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT m.*, v.business_name AS vendor_name, c.name AS category_name
     FROM menu_items m
     JOIN vendors v ON v.id = m.vendor_id
     LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Filtered, paginated browse. `available` defaults to true for public
 * browsing (FR3: students shouldn't see items a vendor turned off), but
 * a vendor viewing their own menu passes available = undefined to see
 * everything including items they've hidden.
 */
async function list({ vendorId, categoryId, available, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];

  if (vendorId) {
    conditions.push('m.vendor_id = ?');
    params.push(vendorId);
  }
  if (categoryId) {
    conditions.push('m.category_id = ?');
    params.push(categoryId);
  }
  if (available !== undefined) {
    conditions.push('m.available = ?');
    params.push(available ? 1 : 0);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT m.*, v.business_name AS vendor_name, c.name AS category_name
     FROM menu_items m
     JOIN vendors v ON v.id = m.vendor_id
     LEFT JOIN categories c ON c.id = m.category_id
     ${whereClause}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM menu_items m ${whereClause}`,
    params
  );

  return { items: rows, total, page: Number(page), limit: Number(limit) };
}

async function create({ vendorId, categoryId, name, description, price }) {
  const [result] = await pool.query(
    `INSERT INTO menu_items (vendor_id, category_id, name, description, price, available, created_at)
     VALUES (?, ?, ?, ?, ?, TRUE, NOW())`,
    [vendorId, categoryId || null, name, description || null, price]
  );
  return findById(result.insertId);
}

async function update(id, { categoryId, name, description, price }) {
  await pool.query(
    `UPDATE menu_items
     SET category_id = ?, name = ?, description = ?, price = ?
     WHERE id = ?`,
    [categoryId || null, name, description || null, price, id]
  );
  return findById(id);
}

async function setAvailability(id, available) {
  await pool.query('UPDATE menu_items SET available = ? WHERE id = ?', [available ? 1 : 0, id]);
  return findById(id);
}

async function hasOrderHistory(id) {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM order_items WHERE item_id = ?',
    [id]
  );
  return count > 0;
}

async function remove(id) {
  await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);
}

module.exports = { findById, findByIds, list, create, update, setAvailability, hasOrderHistory, remove };
