const { Router } = require('express');
const { query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const deliveryController = require('../controllers/deliveryController');

const router = Router();

// Every route here is rider-only.
router.use(authenticate, authorize('rider'));

router.get('/available', deliveryController.listAvailableHandler);

router.get(
  '/mine',
  [query('status').optional().isString()],
  deliveryController.listMineHandler
);

router.patch('/:id/accept', deliveryController.acceptHandler);
router.patch('/:id/pickup', deliveryController.pickupHandler);
router.patch('/:id/deliver', deliveryController.deliverHandler);

module.exports = router;
