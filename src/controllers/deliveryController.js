const deliveryService = require('../services/deliveryService');

async function listAvailableHandler(req, res, next) {
  try {
    const deliveries = await deliveryService.listAvailable();
    return res.status(200).json({ success: true, data: deliveries });
  } catch (err) {
    return next(err);
  }
}

async function listMineHandler(req, res, next) {
  try {
    const deliveries = await deliveryService.listMine(req.user.sub, { status: req.query.status });
    return res.status(200).json({ success: true, data: deliveries });
  } catch (err) {
    return next(err);
  }
}

async function acceptHandler(req, res, next) {
  try {
    const delivery = await deliveryService.acceptDelivery(req.user.sub, Number(req.params.id));
    return res.status(200).json({ success: true, data: delivery });
  } catch (err) {
    return next(err);
  }
}

async function pickupHandler(req, res, next) {
  try {
    const delivery = await deliveryService.markPickedUp(req.user.sub, Number(req.params.id));
    return res.status(200).json({ success: true, data: delivery });
  } catch (err) {
    return next(err);
  }
}

async function deliverHandler(req, res, next) {
  try {
    const delivery = await deliveryService.markDelivered(req.user.sub, Number(req.params.id));
    return res.status(200).json({ success: true, data: delivery });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listAvailableHandler, listMineHandler, acceptHandler, pickupHandler, deliverHandler };
