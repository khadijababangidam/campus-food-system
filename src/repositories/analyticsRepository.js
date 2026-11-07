/**
 * Analytics repository. Every query here answers a specific gap named in
 * Chapter 3's fact-finding (Section 3.3.4): "administrators currently
 * have no operational data at all — order volume, vendor performance, or
 * revenue trends — to plan around." Revenue is always derived from
 * successful PAYMENTS, never from orders.total_amount directly — an
 * order that was never paid for isn't revenue, regardless of what it
 * would have been worth.
 */
const { pool } = require('../config/db');

async function getTotals() {
  const [[orderTotals]] = await pool.query('SELECT COUNT(*) AS total_orders FROM orders');
  const [[revenueTotals]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM payments WHERE status = 'success'"
  );
  return {
    totalOrders: orderTotals.total_orders,
    totalRevenue: Number(revenueTotals.total_revenue),
  };
}

async function getOrdersByStatus() {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
  return rows;
}

async function getRevenueByVendor(limit = 10) {
  const [rows] = await pool.query(
    `SELECT v.id AS vendor_id, v.business_name,
            COUNT(DISTINCT o.id) AS order_count,
            COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0) AS revenue
     FROM vendors v
     LEFT JOIN orders o ON o.vendor_id = v.id
     LEFT JOIN payments p ON p.order_id = o.id
     GROUP BY v.id, v.business_name
     ORDER BY revenue DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows.map(r => ({ ...r, revenue: Number(r.revenue) }));
}

async function getOrdersByDay(days = 14) {
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM orders
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [Number(days)]
  );
  return rows;
}

module.exports = { getTotals, getOrdersByStatus, getRevenueByVendor, getOrdersByDay };
