const { Router } = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const financialController = require('../controllers/financialController');

const router = Router();

// --- Vendor: wallet (read-only) ---
router.get('/wallet', authenticate, authorize('vendor'), financialController.getWalletHandler);

router.get(
  '/wallet/transactions',
  authenticate,
  authorize('vendor'),
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  financialController.listWalletTransactionsHandler
);

// --- Vendor: withdrawals ---
router.post(
  '/withdrawals',
  authenticate,
  authorize('vendor'),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('bankName').trim().notEmpty().withMessage('Bank name is required'),
    body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
    body('accountName').trim().notEmpty().withMessage('Account name is required'),
  ],
  financialController.requestWithdrawalHandler
);

router.get(
  '/withdrawals',
  authenticate,
  authorize('vendor'),
  [query('status').optional().isIn(['pending', 'approved', 'rejected', 'paid'])],
  financialController.myWithdrawalsHandler
);

// --- Admin: withdrawals ---
router.get(
  '/admin/withdrawals',
  authenticate,
  authorize('admin'),
  [query('status').optional().isIn(['pending', 'approved', 'rejected', 'paid'])],
  financialController.adminListWithdrawalsHandler
);

router.patch(
  '/admin/withdrawals/:id/status',
  authenticate,
  authorize('admin'),
  [
    body('status').isIn(['approved', 'paid', 'rejected']).withMessage('Invalid status'),
    body('adminNotes').optional({ nullable: true }).isLength({ max: 2000 }),
  ],
  financialController.adminUpdateWithdrawalStatusHandler
);

// --- Admin: refunds ---
router.get(
  '/admin/refunds/pending',
  authenticate,
  authorize('admin'),
  financialController.adminListPendingRefundsHandler
);

router.patch(
  '/admin/refunds/:id/process',
  authenticate,
  authorize('admin'),
  [body('adminNotes').optional({ nullable: true }).isLength({ max: 2000 })],
  financialController.adminProcessRefundHandler
);

module.exports = router;
