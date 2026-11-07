const { Router } = require('express');
const authRoutes = require('./authRoutes');
const menuRoutes = require('./menuRoutes');
const orderRoutes = require('./orderRoutes');
const paymentRoutes = require('./paymentRoutes');
const deliveryRoutes = require('./deliveryRoutes');
const reviewRoutes = require('./reviewRoutes');
const financialRoutes = require('./financialRoutes');
const adminRoutes = require('./adminRoutes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/reviews', reviewRoutes);
router.use('/financial', financialRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
