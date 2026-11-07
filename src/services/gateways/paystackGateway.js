/**
 * Paystack gateway. Every Paystack-specific detail (API shape, kobo
 * conversion, signature algorithm) lives in this one file. paymentService
 * only calls the three functions below — if Flutterwave is added later,
 * it becomes a second file with the same three functions, and
 * paymentService picks between them by `payment.gateway`, never by
 * duplicating gateway-specific logic inline.
 */
const crypto = require('crypto');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function requireSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return key;
}

/**
 * Starts a transaction. Amount must be in kobo (Paystack's smallest unit),
 * so the caller is responsible for converting Naira -> kobo before this.
 */
async function initializeTransaction({ email, amountKobo, reference, callbackUrl }) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Failed to initialize payment with Paystack');
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

/**
 * Re-verifies a transaction directly against Paystack's servers. Called
 * both from the webhook handler and from the frontend-facing verify
 * endpoint — never trust a webhook payload or a client redirect alone,
 * this is the one call whose result is actually authoritative.
 */
async function verifyTransaction(reference) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${requireSecretKey()}` },
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Failed to verify payment with Paystack');
  }

  return {
    status: data.data.status, // 'success' | 'failed' | 'abandoned' | ...
    amountKobo: data.data.amount,
    paidAt: data.data.paid_at,
    reference: data.data.reference,
  };
}

/**
 * Validates the `x-paystack-signature` header against the raw request
 * body. Paystack signs with HMAC-SHA512 using the secret key; this must
 * run against the raw (unparsed) request bytes, not the parsed JSON
 * object, or the signature will never match.
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha512', requireSecretKey())
    .update(rawBody)
    .digest('hex');
  return expected === signatureHeader;
}

module.exports = { initializeTransaction, verifyTransaction, verifyWebhookSignature };
