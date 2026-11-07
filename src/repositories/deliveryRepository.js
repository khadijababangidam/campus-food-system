/**
 * Delivery repository. `claim()` is the one write here that has to be
 * concurrency-safe: two riders could tap "Accept" on the same delivery
 * within milliseconds of each other. The UPDATE below only succeeds if
 * the row is still unclaimed at the moment it runs — MySQL's row locking
 * makes this atomic, so the second rider's request simply affects zero
 * rows instead of racing the first one.
 */
const { pool } = require('../config/db');

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT d.*, o.vendor_id, o.user_id AS customer_id, o.total_amount, o.status AS order_status,
            v.business_name AS vendor_name, u.full_name AS customer_name
     FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     JOIN vendors v ON v.id = o.vendor_id
     JOIN users u ON u.id = o.user_id
     WHERE d.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findByOrderId(orderId) {
  const [rows] = await pool.query('SELECT * FROM deliveries WHERE order_id = ? LIMIT 1', [orderId]);
  return rows[0] || null;
}

/**
 * Creates the delivery record once a vendor marks an order ready. Called
 * from orderService.markReady — an order can only ever have one delivery
 * row (deliveries.order_id is unique), created exactly once, here.
 */
async function createForOrder(orderId) {
  const [result] = await pool.query(
    `INSERT INTO deliveries (order_id, status) VALUES (?, 'awaiting_rider')`,
    [orderId]
  );
  return findById(result.insertId);
}

async function listAvailable() {
  const [rows] = await pool.query(
    `SELECT d.*, o.vendor_id, o.total_amount, v.business_name AS vendor_name
     FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     JOIN vendors v ON v.id = o.vendor_id
     WHERE d.status = 'awaiting_rider'
     ORDER BY d.id ASC`
  );
  return rows;
}

async function listByRider(riderId, { status } = {}) {
  const conditions = ['d.rider_id = ?'];
  const params = [riderId];
  if (status) {
    conditions.push('d.status = ?');
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT d.*, o.vendor_id, o.total_amount, v.business_name AS vendor_name, u.full_name AS customer_name
     FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     JOIN vendors v ON v.id = o.vendor_id
     JOIN users u ON u.id = o.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.assigned_at DESC`,
    params
  );
  return rows;
}

/**
 * Atomically claims an unassigned delivery. Returns true if this call was
 * the one that won the race, false if someone else claimed it first (or
 * it no longer exists / isn't claimable).
 */
async function claim(deliveryId, riderId) {
  const [result] = await pool.query(
    `UPDATE deliveries
     SET rider_id = ?, status = 'assigned', assigned_at = NOW()
     WHERE id = ? AND status = 'awaiting_rider' AND rider_id IS NULL`,
    [riderId, deliveryId]
  );
  return result.affectedRows === 1;
}

async function markPickedUp(deliveryId, riderId) {
  const [result] = await pool.query(
    `UPDATE deliveries SET status = 'picked_up' WHERE id = ? AND rider_id = ? AND status = 'assigned'`,
    [deliveryId, riderId]
  );
  return result.affectedRows === 1;
}

async function markDelivered(deliveryId, riderId) {
  const [result] = await pool.query(
    `UPDATE deliveries SET status = 'delivered', delivered_at = NOW()
     WHERE id = ? AND rider_id = ? AND status = 'picked_up'`,
    [deliveryId, riderId]
  );
  return result.affectedRows === 1;
}

module.exports = {
  findById,
  findByOrderId,
  createForOrder,
  listAvailable,
  listByRider,
  claim,
  markPickedUp,
  markDelivered,
};
