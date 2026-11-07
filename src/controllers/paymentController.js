const { validationResult } = require('express-validator');
const paymentService = require('../services/paymentService');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

async function initializeHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const result = await paymentService.initializePayment(req.user.sub, Number(req.body.orderId));
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function verifyHandler(req, res, next) {
  try {
    const payment = await paymentService.verifyPayment(req.user.sub, req.params.reference);
    return res.status(200).json({ success: true, data: payment });
  } catch (err) {
    return next(err);
  }
}

async function orderPaymentsHandler(req, res, next) {
  try {
    const payments = await paymentService.listPaymentsForOrder(
      req.user.sub,
      req.user.role,
      Number(req.params.orderId)
    );
    return res.status(200).json({ success: true, data: payments });
  } catch (err) {
    return next(err);
  }
}

/**
 * Webhook handler. Always returns 200 once the signature check passes and
 * the event has been processed (or safely ignored), so Paystack doesn't
 * keep retrying an event we've already handled. Only a bad signature or
 * an unexpected server error should produce a non-2xx here.
 */
async function webhookHandler(req, res, next) {
  try {
    await paymentService.handleWebhookEvent(req.rawBody, req.headers['x-paystack-signature'], req.body);
    return res.status(200).json({ received: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { initializeHandler, verifyHandler, orderPaymentsHandler, webhookHandler };
