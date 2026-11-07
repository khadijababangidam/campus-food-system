/**
 * Review repository. Reviews are immutable once created (FR8 covers
 * create + read, not edit) — there is deliberately no update() here.
 * `order_id` stays UNIQUE at the database level (migration 009), so even
 * a bug in the service-layer duplicate check can't create two reviews
 * for the same order.
 */
const { pool } = require('../config/db');

async function findByOrderId(orderId) {
  const [rows] = await pool.query('SELECT * FROM reviews WHERE order_id = ? LIMIT 1', [orderId]);
  return rows[0] || null;
}

async function create({ orderId, rating, comment }) {
  const [result] = await pool.query(
    `INSERT INTO reviews (order_id, rating, comment, created_at) VALUES (?, ?, ?, NOW())`,
    [orderId, rating, comment || null]
  );
  return findByOrderId(orderId);
  // (result.insertId isn't needed — order_id is unique, so findByOrderId is equivalent)
}

/**
 * Rating summary for one vendor, used when a single vendor's detail is
 * being shown. See getVendorSummaries() for the batch version used on
 * the browse page, which avoids one query per vendor card.
 */
async function getVendorSummary(vendorId) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(AVG(r.rating), 0) AS average_rating, COUNT(r.id) AS review_count
     FROM reviews r
     JOIN orders o ON o.id = r.order_id
     WHERE o.vendor_id = ?`,
    [vendorId]
  );
  return { averageRating: Number(row.average_rating), reviewCount: row.review_count };
}

/**
 * Batch version: one query for every vendor the browse page currently
 * has cards for, instead of N round trips. Returns a plain object keyed
 * by vendor_id so the frontend can do O(1) lookups while rendering.
 */
async function getVendorSummaries(vendorIds) {
  if (!vendorIds || vendorIds.length === 0) return {};
  const placeholders = vendorIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT o.vendor_id, AVG(r.rating) AS average_rating, COUNT(r.id) AS review_count
     FROM reviews r
     JOIN orders o ON o.id = r.order_id
     WHERE o.vendor_id IN (${placeholders})
     GROUP BY o.vendor_id`,
    vendorIds
  );
  const summaries = {};
  rows.forEach(r => {
    summaries[r.vendor_id] = { averageRating: Number(r.average_rating), reviewCount: r.review_count };
  });
  return summaries;
}

async function listByVendor(vendorId, { page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT r.*, u.full_name AS customer_name
     FROM reviews r
     JOIN orders o ON o.id = r.order_id
     JOIN users u ON u.id = o.user_id
     WHERE o.vendor_id = ?
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [vendorId, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.vendor_id = ?`,
    [vendorId]
  );
  return { reviews: rows, total, page: Number(page), limit: Number(limit) };
}

module.exports = { findByOrderId, create, getVendorSummary, getVendorSummaries, listByVendor };
