/**
 * Order repository. `create()` is the one write in this whole codebase
 * that must be transactional: an Order row and its OrderItem rows are
 * either both committed or neither is — a half-written order (total
 * without line items, or vice versa) is a data-integrity bug that would
 * be very hard to notice until someone tries to reconcile the books.
 */
const { pool } = require('../config/db');

async function findById(id) {
  const [orderRows] = await pool.query(
    `SELECT o.*, v.business_name AS vendor_name, u.full_name AS customer_name, u.email AS customer_email,
            d.id AS delivery_id, d.status AS delivery_status, d.rider_id, r.full_name AS rider_name,
            d.assigned_at, d.delivered_at,
            rv.rating AS review_rating, rv.comment AS review_comment
     FROM orders o
     JOIN vendors v ON v.id = o.vendor_id
     JOIN users u ON u.id = o.user_id
     LEFT JOIN deliveries d ON d.order_id = o.id
     LEFT JOIN users r ON r.id = d.rider_id
     LEFT JOIN reviews rv ON rv.order_id = o.id
     WHERE o.id = ? LIMIT 1`,
    [id]
  );
  const order = orderRows[0];
  if (!order) return null;

  const [items] = await pool.query(
    `SELECT oi.order_item_id, oi.item_id, oi.quantity, oi.unit_price, m.name AS item_name
     FROM order_items oi
     JOIN menu_items m ON m.id = oi.item_id
     WHERE oi.order_id = ?`,
    [id]
  );

  return { ...order, items };
}

/**
 * Creates an order and its line items in a single transaction. `items`
 * must already be validated and priced by the service layer — this
 * function trusts its caller, it doesn't re-derive prices itself.
 */
async function create({ userId, vendorId, totalAmount, items }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, vendor_id, status, total_amount, created_at)
       VALUES (?, ?, 'pending', ?, NOW())`,
      [userId, vendorId, totalAmount]
    );
    const orderId = orderResult.insertId;

    const values = items.map(i => [orderId, i.itemId, i.quantity, i.unitPrice]);
    await connection.query(
      `INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES ?`,
      [values]
    );

    await connection.commit();
    return orderId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listByUser(userId, { status, page = 1, limit = 20 } = {}) {
  const conditions = ['o.user_id = ?'];
  const params = [userId];
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT o.*, v.business_name AS vendor_name,
            d.status AS delivery_status, r.full_name AS rider_name,
            rv.rating AS review_rating, rv.comment AS review_comment
     FROM orders o
     JOIN vendors v ON v.id = o.vendor_id
     LEFT JOIN deliveries d ON d.order_id = o.id
     LEFT JOIN users r ON r.id = d.rider_id
     LEFT JOIN reviews rv ON rv.order_id = o.id
     ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders o ${whereClause}`,
    params
  );
  return { orders: rows, total, page: Number(page), limit: Number(limit) };
}

async function listByVendor(vendorId, { status, page = 1, limit = 20 } = {}) {
  const conditions = ['o.vendor_id = ?'];
  const params = [vendorId];
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT o.*, u.full_name AS customer_name,
            d.status AS delivery_status, r.full_name AS rider_name,
            rv.rating AS review_rating, rv.comment AS review_comment
     FROM orders o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN deliveries d ON d.order_id = o.id
     LEFT JOIN users r ON r.id = d.rider_id
     LEFT JOIN reviews rv ON rv.order_id = o.id
     ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders o ${whereClause}`,
    params
  );
  return { orders: rows, total, page: Number(page), limit: Number(limit) };
}

async function updateStatus(id, status) {
  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

module.exports = { findById, create, listByUser, listByVendor, updateStatus };
