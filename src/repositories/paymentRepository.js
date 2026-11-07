/**
 * Payment repository. Since migration 010, multiple rows can exist per
 * order (one per attempt) — `reference` stays globally unique (enforced
 * at the DB level), but `order_id` no longer is. "At most one successful
 * payment per order" is a business rule enforced in paymentService, not
 * something this layer checks.
 */
const { pool } = require('../config/db');

async function findByReference(reference) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE reference = ? LIMIT 1', [reference]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listByOrderId(orderId) {
  const [rows] = await pool.query(
    'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC',
    [orderId]
  );
  return rows;
}

async function findSuccessfulByOrderId(orderId) {
  const [rows] = await pool.query(
    "SELECT * FROM payments WHERE order_id = ? AND status = 'success' LIMIT 1",
    [orderId]
  );
  return rows[0] || null;
}

async function create({ orderId, gateway, reference, amount }) {
  const [result] = await pool.query(
    `INSERT INTO payments (order_id, gateway, reference, status, amount, created_at)
     VALUES (?, ?, ?, 'pending', ?, NOW())`,
    [orderId, gateway, reference, amount]
  );
  return findById(result.insertId);
}

async function markSuccess(id, paidAt) {
  await pool.query(
    "UPDATE payments SET status = 'success', paid_at = ? WHERE id = ?",
    [paidAt || new Date(), id]
  );
  return findById(id);
}

async function markFailed(id) {
  await pool.query("UPDATE payments SET status = 'failed' WHERE id = ?", [id]);
  return findById(id);
}

module.exports = {
  findByReference,
  findById,
  listByOrderId,
  findSuccessfulByOrderId,
  create,
  markSuccess,
  markFailed,
};
