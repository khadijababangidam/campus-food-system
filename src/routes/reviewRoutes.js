const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

const router = Router();

// Public — ratings are meant to inform a browsing decision, no auth needed.
router.get('/vendor-summaries', reviewController.vendorSummariesBatchHandler);
router.get('/vendor/:vendorId/summary', reviewController.vendorSummaryHandler);
router.get('/vendor/:vendorId', reviewController.listVendorReviewsHandler);

// Customer creates a review for their own delivered order.
router.post(
  '/order/:orderId',
  authenticate,
  authorize('student', 'staff'),
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional({ nullable: true }).isLength({ max: 2000 }),
  ],
  reviewController.createReviewHandler
);

module.exports = router;
