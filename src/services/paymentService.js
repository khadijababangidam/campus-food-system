/**
 * Payment service. Two entry points can both learn that a payment
 * succeeded — Paystack's webhook, and the frontend calling /verify after
 * the browser redirects back — so both funnel through applyVerifiedStatus,
 * which is idempotent: calling it twice with the same result is always
 * safe. The webhook is the authoritative path in production; the verify
 * endpoint exists only so the UI isn't left waiting on webhook latency.
 */
const crypto = require('crypto');
const paymentRepository = require('../repositories/paymentRepository');
const orderRepository = require('../repositories/orderRepository');
const orderService = require('./orderService');
const paystackGateway = require('./gateways/paystackGateway');

class PaymentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'PaymentError';
    this.statusCode = statusCode;
  }
}

function generateReference(orderId) {
  return `GSU-${orderId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Creates a new payment attempt for an order and returns the URL the
 * browser should redirect to. Allowed from 'pending' (first attempt) or
 * 'payment_failed' (retry) — anything else means either the order was
 * already paid, or it's in a state where paying no longer makes sense
 * (cancelled, already being prepared, etc.).
 */
async function initializePayment(userId, orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new PaymentError('Order not found', 404);
  if (order.user_id !== userId) {
    throw new PaymentError('You do not have permission to pay for this order', 403);
  }
  if (!['pending', 'payment_failed'].includes(order.status)) {
    throw new PaymentError(`This order cannot be paid for (current status: ${order.status})`, 409);
  }

  // Defense in depth: even if status somehow drifted, never let a second
  // successful payment happen against an order that already has one.
  const existingSuccess = await paymentRepository.findSuccessfulByOrderId(orderId);
  if (existingSuccess) {
    throw new PaymentError('This order has already been paid for', 409);
  }

  const reference = generateReference(orderId);
  const amountKobo = Math.round(Number(order.total_amount) * 100);
  
  // Use environment variable with a safe production fallback to prevent undefined redirects
  const baseUrl = process.env.APP_BASE_URL || 'https://campus-food-system-production-5b3d.up.railway.app';
  const callbackUrl = `${baseUrl}/shared/payment-callback.html`;

  const gatewayResult = await paystackGateway.initializeTransaction({
    email: order.customer_email,
    amountKobo,
    reference,
    callbackUrl,
  });

  await paymentRepository.create({
    orderId,
    gateway: 'paystack',
    reference: gatewayResult.reference,
    amount: order.total_amount,
  });

  return { authorizationUrl: gatewayResult.authorizationUrl, reference: gatewayResult.reference };
}

/**
 * Applies a gateway-verified status to a payment + its order. Idempotent:
 * if the payment is already resolved (success or failed), this is a no-op
 * — safe to call from both the webhook and a client-triggered verify,
 * however many times either fires.
 */
async function applyVerifiedStatus(payment, verifiedStatus, paidAt) {
  if (payment.status !== 'pending') {
    return payment; // already resolved by an earlier webhook/verify call
  }

  if (verifiedStatus === 'success') {
    const updated = await paymentRepository.markSuccess(payment.id, paidAt);
    await orderRepository.updateStatus(payment.order_id, 'confirmed');
    return updated;
  }

  // Any non-success Paystack status (failed, abandoned, reversed, ...)
  // is treated as a failed attempt — the order goes to payment_failed so
  // the student sees a clear retry/cancel choice rather than silence.
  const updated = await paymentRepository.markFailed(payment.id);
  await orderRepository.updateStatus(payment.order_id, 'payment_failed');
  return updated;
}

/**
 * Webhook handler. Signature verification happens against the raw body
 * before anything else runs. The webhook payload itself is never trusted
 * for the actual status — it's only used to know *which* reference to
 * re-verify directly against Paystack's API.
 */
async function handleWebhookEvent(rawBody, signatureHeader, parsedBody) {
  const isValid = paystackGateway.verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    throw new PaymentError('Invalid webhook signature', 401);
  }

  const reference = parsedBody?.data?.reference;
  if (!reference) return; // nothing to act on

  const payment = await paymentRepository.findByReference(reference);
  if (!payment) return; // unknown reference — ignore rather than error, Paystack retries on non-2xx

  const verified = await paystackGateway.verifyTransaction(reference);
  await applyVerifiedStatus(payment, verified.status, verified.paidAt);
}

/**
 * Called by the frontend after Paystack redirects the browser back.
 * Re-verifies directly with Paystack rather than trusting the redirect
 * itself (a redirect can be forged; a signed webhook or a direct
 * server-to-server verify call cannot).
 */
async function verifyPayment(userId, reference) {
  const payment = await paymentRepository.findByReference(reference);
  if (!payment) throw new PaymentError('Payment not found', 404);

  const order = await orderRepository.findById(payment.order_id);
  if (!order || order.user_id !== userId) {
    throw new PaymentError('You do not have permission to view this payment', 403);
  }

  if (payment.status !== 'pending') {
    return payment; // already resolved, no need to hit Paystack again
  }

  const verified = await paystackGateway.verifyTransaction(reference);
  return applyVerifiedStatus(payment, verified.status, verified.paidAt);
}

async function listPaymentsForOrder(userId, userRole, orderId) {
  // Reuses order ownership rules (customer or owning vendor) rather than
  // re-implementing them here.
  await orderService.getOrderForUser(userId, userRole, orderId);
  return paymentRepository.listByOrderId(orderId);
}

module.exports = {
  PaymentError,
  initializePayment,
  handleWebhookEvent,
  verifyPayment,
  listPaymentsForOrder,
};
