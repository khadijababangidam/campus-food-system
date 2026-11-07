const { validationResult } = require('express-validator');
const menuService = require('../services/menuService');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

async function browseHandler(req, res, next) {
  try {
    const { vendorId, categoryId, page, limit } = req.query;
    const result = await menuService.browse({
      vendorId: vendorId ? Number(vendorId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function ownMenuHandler(req, res, next) {
  try {
    const { categoryId, page, limit } = req.query;
    const result = await menuService.getOwnMenu(req.user.sub, {
      categoryId: categoryId ? Number(categoryId) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function getItemHandler(req, res, next) {
  try {
    const item = await menuService.getItem(Number(req.params.id));
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

async function createItemHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const { categoryId, name, description, price } = req.body;
    const item = await menuService.createItem(req.user.sub, { categoryId, name, description, price });
    return res.status(201).json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

async function updateItemHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const { categoryId, name, description, price } = req.body;
    const item = await menuService.updateItem(req.user.sub, Number(req.params.id), {
      categoryId, name, description, price,
    });
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

async function setAvailabilityHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const item = await menuService.setAvailability(req.user.sub, Number(req.params.id), req.body.available);
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    return next(err);
  }
}

async function deleteItemHandler(req, res, next) {
  try {
    await menuService.deleteItem(req.user.sub, Number(req.params.id));
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  browseHandler,
  ownMenuHandler,
  getItemHandler,
  createItemHandler,
  updateItemHandler,
  setAvailabilityHandler,
  deleteItemHandler,
};
