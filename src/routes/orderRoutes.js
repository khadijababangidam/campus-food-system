const { Router } = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = Router();

const createOrderValidators = [
  body('vendorId').isInt({ min: 1 }).withMessage('vendorId is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.itemId').isInt({ min: 1 }).withMessage('Each item requires a valid itemId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item requires a quantity of at least 1'),
];

// Order creation and history — students/staff only.
router.post(
  '/',
  authenticate,
  authorize('student', 'staff'),
  createOrderValidators,
  orderController.createOrderHandler
);

router.get(
  '/mine',
  authenticate,
  authorize('student', 'staff'),
  [query('status').optional().isString(), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  orderController.myOrdersHandler
);

router.patch(
  '/:id/cancel',
  authenticate,
  authorize('student', 'staff'),
  orderController.cancelOrderHandler
);

// Vendor's incoming orders and lifecycle actions (FR5).
router.get(
  '/vendor',
  authenticate,
  authorize('vendor'),
  [query('status').optional().isString(), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  orderController.vendorOrdersHandler
);

router.patch(
  '/:id/prepare',
  authenticate,
  authorize('vendor'),
  orderController.startPreparingHandler
);

router.patch(
  '/:id/ready',
  authenticate,
  authorize('vendor'),
  orderController.markReadyHandler
);

// Order detail — service layer enforces "customer who placed it, or the
// owning vendor" ownership, so this stays open to both roles here.
router.get(
  '/:id',
  authenticate,
  authorize('student', 'staff', 'vendor'),
  orderController.getOrderHandler
);

module.exports = router;
