/**
 * Refund repository. create() relies on refund_requests.order_id being
 * UNIQUE (migration 012) for its actual duplicate-prevention guarantee —
 * see walletRepository.js's header comment for why a SELECT-then-INSERT
 * check alone isn't sufficient under concurrency.
 */
const { pool } = require('../config/db');

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM refund_requests WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function findByOrderId(orderId) {
  const [rows] = await pool.query('SELECT * FROM refund_requests WHERE order_id = ? LIMIT 1', [orderId]);
  return rows[0] || null;
}

/**
 * Creates a refund request, idempotently. Returns { created: boolean,
 * refund }. If a refund request for this order already exists (any
 * status), created is false and the existing row is returned instead.
 */
async function create({ orderId, userId, amount }) {
  const [result] = await pool.query(
    `INSERT INTO refund_requests (order_id, user_id, amount, status, created_at)
     VALUES (?, ?, ?, 'pending', NOW())
     ON DUPLICATE KEY UPDATE id = id`,
    [orderId, userId, amount]
  );

  if (result.affectedRows !== 1) {
    const existing = await findByOrderId(orderId);
    return { created: false, refund: existing };
  }

  const refund = await findById(result.insertId);
  return { created: true, refund };
}

async function listPending({ page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT r.*, o.vendor_id, o.status AS order_status, u.full_name AS customer_name, u.email AS customer_email
     FROM refund_requests r
     JOIN orders o ON o.id = r.order_id
     JOIN users u ON u.id = r.user_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at ASC
     LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM refund_requests WHERE status = 'pending'"
  );
  return { refunds: rows, total, page: Number(page), limit: Number(limit) };
}

/**
 * pending -> processed. Conditional UPDATE + affectedRows check is the
 * idempotency guarantee — processing twice simply fails the second time.
 */
async function markProcessed(id, adminNotes) {
  const [result] = await pool.query(
    "UPDATE refund_requests SET status = 'processed', admin_notes = ? WHERE id = ? AND status = 'pending'",
    [adminNotes || null, id]
  );
  return result.affectedRows === 1;
}

module.exports = { findById, findByOrderId, create, listPending, markProcessed };
