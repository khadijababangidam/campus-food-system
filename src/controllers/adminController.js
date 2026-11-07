const { validationResult } = require('express-validator');
const adminService = require('../services/adminService');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

async function listUsersHandler(req, res, next) {
  try {
    const { role, page, limit } = req.query;
    const result = await adminService.listUsers({
      role,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function setUserActiveHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const user = await adminService.setUserActive(
      req.user.sub,
      Number(req.params.id),
      req.body.isActive
    );
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
}

async function createVendorHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const { fullName, email, phone, password, businessName, description } = req.body;
    const vendor = await adminService.createVendor({
      fullName, email, phone, password, businessName, description,
    });
    return res.status(201).json({ success: true, data: vendor });
  } catch (err) {
    return next(err);
  }
}

async function listVendorsHandler(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await adminService.listVendors({
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function setVendorStatusHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const vendor = await adminService.setVendorStatus(Number(req.params.id), req.body.status);
    return res.status(200).json({ success: true, data: vendor });
  } catch (err) {
    return next(err);
  }
}

async function analyticsSummaryHandler(req, res, next) {
  try {
    const summary = await adminService.getAnalyticsSummary();
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listUsersHandler,
  setUserActiveHandler,
  createVendorHandler,
  listVendorsHandler,
  setVendorStatusHandler,
  analyticsSummaryHandler,
};
