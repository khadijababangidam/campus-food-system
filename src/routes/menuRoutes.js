const { Router } = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const menuController = require('../controllers/menuController');
const categoryController = require('../controllers/categoryController');

const router = Router();

const itemValidators = [
  body('name').trim().notEmpty().withMessage('Item name is required').isLength({ max: 120 }),
  body('description').optional({ nullable: true }).isLength({ max: 2000 }),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid category'),
];

// --- Categories: fixed, seeded reference list (public read only) ---
router.get('/categories', categoryController.listAllHandler);

// --- Public browse (students/staff, or anyone) ---
router.get(
  '/',
  [
    query('vendorId').optional().isInt({ min: 1 }),
    query('categoryId').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  menuController.browseHandler
);

// --- Vendor's own menu management (must come before /:id to avoid collision) ---
router.get('/mine', authenticate, authorize('vendor'), menuController.ownMenuHandler);

router.get('/:id', menuController.getItemHandler);

router.post('/', authenticate, authorize('vendor'), itemValidators, menuController.createItemHandler);

router.put('/:id', authenticate, authorize('vendor'), itemValidators, menuController.updateItemHandler);

router.patch(
  '/:id/availability',
  authenticate,
  authorize('vendor'),
  [body('available').isBoolean().withMessage('available must be true or false')],
  menuController.setAvailabilityHandler
);

router.delete('/:id', authenticate, authorize('vendor'), menuController.deleteItemHandler);

module.exports = router;
