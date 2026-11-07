const { Router } = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = Router();

// Every route in this file is admin-only.
router.use(authenticate, authorize('admin'));

// --- Users ---
router.get(
  '/users',
  [query('role').optional().isIn(['student', 'staff', 'vendor', 'rider', 'admin'])],
  adminController.listUsersHandler
);

router.patch(
  '/users/:id/active',
  [body('isActive').isBoolean().withMessage('isActive must be true or false')],
  adminController.setUserActiveHandler
);

// --- Vendors ---
// The only way a vendor account is created — there is no public
// self-registration path for this role (Section 3.9).
router.post(
  '/vendors',
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('businessName').trim().notEmpty().withMessage('Business name is required'),
    body('description').optional({ nullable: true }).isLength({ max: 2000 }),
  ],
  adminController.createVendorHandler
);

router.get(
  '/vendors',
  [query('status').optional().isIn(['pending', 'active', 'suspended'])],
  adminController.listVendorsHandler
);

router.patch(
  '/vendors/:id/status',
  [body('status').isIn(['pending', 'active', 'suspended']).withMessage('Invalid status')],
  adminController.setVendorStatusHandler
);

// --- Analytics ---
router.get('/analytics/summary', adminController.analyticsSummaryHandler);

module.exports = router;
