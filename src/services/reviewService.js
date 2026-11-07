/**
 * Review service. A review can only be created for an order that is
 * 'delivered' — that's the terminal state in this build (no separate
 * customer-confirmation step; see the delivery module's README notes) —
 * and only by the customer who placed it, once.
 */
const reviewRepository = require('../repositories/reviewRepository');
const orderRepository = require('../repositories/orderRepository');

class ReviewError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ReviewError';
    this.statusCode = statusCode;
  }
}

async function createReview(userId, orderId, { rating, comment }) {
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new ReviewError('Rating must be an integer between 1 and 5');
  }

  const order = await orderRepository.findById(orderId);
  if (!order) throw new ReviewError('Order not found', 404);
  if (order.user_id !== userId) {
    throw new ReviewError('You do not have permission to review this order', 403);
  }
  if (order.status !== 'delivered') {
    throw new ReviewError(`Only delivered orders can be reviewed (current status: ${order.status})`, 409);
  }

  const existing = await reviewRepository.findByOrderId(orderId);
  if (existing) {
    throw new ReviewError('This order has already been reviewed', 409);
  }

  return reviewRepository.create({ orderId, rating: ratingNum, comment });
}

async function getVendorSummary(vendorId) {
  return reviewRepository.getVendorSummary(vendorId);
}

async function getVendorSummaries(vendorIds) {
  return reviewRepository.getVendorSummaries(vendorIds);
}

async function listVendorReviews(vendorId, { page, limit }) {
  return reviewRepository.listByVendor(vendorId, { page, limit });
}

module.exports = { ReviewError, createReview, getVendorSummary, getVendorSummaries, listVendorReviews };
