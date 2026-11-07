const { validationResult } = require('express-validator');
const reviewService = require('../services/reviewService');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

async function createReviewHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const { rating, comment } = req.body;
    const review = await reviewService.createReview(req.user.sub, Number(req.params.orderId), { rating, comment });
    return res.status(201).json({ success: true, data: review });
  } catch (err) {
    return next(err);
  }
}

async function vendorSummaryHandler(req, res, next) {
  try {
    const summary = await reviewService.getVendorSummary(Number(req.params.vendorId));
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    return next(err);
  }
}

async function vendorSummariesBatchHandler(req, res, next) {
  try {
    const ids = String(req.query.vendorIds || '')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isInteger(n) && n > 0);
    const summaries = await reviewService.getVendorSummaries(ids);
    return res.status(200).json({ success: true, data: summaries });
  } catch (err) {
    return next(err);
  }
}

async function listVendorReviewsHandler(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await reviewService.listVendorReviews(Number(req.params.vendorId), {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createReviewHandler,
  vendorSummaryHandler,
  vendorSummariesBatchHandler,
  listVendorReviewsHandler,
};
