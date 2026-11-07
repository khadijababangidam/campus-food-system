/**
 * Auth controller — the ONLY layer allowed to touch req/res directly.
 * Keeps HTTP concerns (status codes, body shape) separate from the
 * business rules living in authService.
 */
const { validationResult } = require('express-validator');
const authService = require('../services/authService');

async function registerHandler(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { fullName, email, phone, password, role } = req.body;
    const user = await authService.register({ fullName, email, phone, password, role });
    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
}

async function loginHandler(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { registerHandler, loginHandler };
