const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const router = Router();

router.post(
  '/initialize',
  authenticate,
  authorize('student', 'staff'),
  [body('orderId').isInt({ min: 1 }).withMessage('orderId is required')],
  paymentController.initializeHandler
);

router.get(
  '/verify/:reference',
  authenticate,
  authorize('student', 'staff'),
  paymentController.verifyHandler
);

router.get(
  '/order/:orderId',
  authenticate,
  authorize('student', 'staff', 'vendor'),
  paymentController.orderPaymentsHandler
);

// Paystack calls this directly — no JWT, authenticity comes from the
// signed webhook payload instead (verified against the raw body in
// paymentService). NOT mounted under /api/v1/payments' normal auth
// pattern; see app.js for how the raw body is preserved for this route.
router.post('/webhook/paystack', paymentController.webhookHandler);

module.exports = router;
