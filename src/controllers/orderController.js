const { validationResult } = require('express-validator');
const orderService = require('../services/orderService');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

async function createOrderHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const { vendorId, items } = req.body;
    const order = await orderService.createOrder(req.user.sub, { vendorId: Number(vendorId), items });
    return res.status(201).json({ success: true, data: order });
  } catch (err) {
    return next(err);
  }
}

async function myOrdersHandler(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await orderService.listMyOrders(req.user.sub, {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function vendorOrdersHandler(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await orderService.listVendorOrders(req.user.sub, {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function getOrderHandler(req, res, next) {
  try {
    const order = await orderService.getOrderForUser(req.user.sub, req.user.role, Number(req.params.id));
    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    return next(err);
  }
}

async function cancelOrderHandler(req, res, next) {
  try {
    const order = await orderService.cancelOrder(req.user.sub, Number(req.params.id));
    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    return next(err);
  }
}

async function startPreparingHandler(req, res, next) {
  try {
    const order = await orderService.startPreparing(req.user.sub, Number(req.params.id));
    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    return next(err);
  }
}

async function markReadyHandler(req, res, next) {
  try {
    const order = await orderService.markReady(req.user.sub, Number(req.params.id));
    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createOrderHandler,
  myOrdersHandler,
  vendorOrdersHandler,
  getOrderHandler,
  cancelOrderHandler,
  startPreparingHandler,
  markReadyHandler,
};
