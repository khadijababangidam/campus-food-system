/**
 * Financial service. Two integration points are called from OUTSIDE this
 * module, from existing order/delivery logic — see the minimal diffs to
 * deliveryService.js and orderService.js that wire them in:
 *   - creditVendorWallet(orderId)   <- called when an order becomes 'delivered'
 *   - createRefundRequest(orderId, userId) <- called when an order becomes 'cancelled'
 *
 * IMPORTANT, discovered during integration (see conversation before this
 * file was written): orderService.cancelOrder() only ever fires from
 * 'pending' or 'payment_failed' — there is currently no path that
 * cancels an order after payment succeeds. createRefundRequest() is
 * written defensively to handle that correctly: it checks for a
 * successful payment first and is a safe no-op if there isn't one,
 * rather than creating a refund request for money that was never
 * collected. Under the CURRENT order lifecycle this means it will
 * almost always no-op when called from cancelOrder — that's correct
 * behaviour given today's state machine, not a bug. If a future change
 * allows cancelling a confirmed/preparing/ready order, this function
 * becomes meaningfully reachable without needing to change.
 */
const walletRepository = require('../repositories/walletRepository');
const withdrawalRepository = require('../repositories/withdrawalRepository');
const refundRepository = require('../repositories/refundRepository');
const vendorRepository = require('../repositories/vendorRepository');
const orderRepository = require('../repositories/orderRepository');
const paymentRepository = require('../repositories/paymentRepository');

class FinancialError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'FinancialError';
    this.statusCode = statusCode;
  }
}

const VALID_WITHDRAWAL_TRANSITIONS = ['approved', 'paid', 'rejected'];

async function requireVendor(userId) {
  const vendor = await vendorRepository.findByUserId(userId);
  if (!vendor) {
    throw new FinancialError('No vendor profile is associated with this account', 403);
  }
  return vendor;
}

// ---------- Wallet ----------

/**
 * Credits a vendor's wallet for a delivered order. Idempotent by
 * construction (see walletRepository.creditWallet) — safe to call more
 * than once for the same order.
 */
async function creditVendorWallet(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    throw new FinancialError(`Cannot credit wallet: order ${orderId} not found`, 404);
  }

  const reference = `ORDER_DELIVERY_${orderId}`;
  const result = await walletRepository.creditWallet({
    vendorId: order.vendor_id,
    amount: order.total_amount,
    reference,
  });
  return result;
}

/**
 * Returns the caller's own wallet. Never creates a row here — GET
 * requests shouldn't have side effects — so a vendor with no completed
 * orders yet gets a synthesized zero-balance object rather than a 404.
 */
async function getWallet(userId) {
  const vendor = await requireVendor(userId);
  const wallet = await walletRepository.findByVendorId(vendor.id);
  return wallet || { vendor_id: vendor.id, available_balance: '0.00', total_earned: '0.00', updated_at: null };
}

async function listWalletTransactions(userId, { page, limit }) {
  const vendor = await requireVendor(userId);
  return walletRepository.listTransactions(vendor.id, { page, limit });
}

// ---------- Withdrawals (vendor-facing) ----------

async function requestWithdrawal(userId, { amount, bankName, accountNumber, accountName }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new FinancialError('Withdrawal amount must be a positive number');
  }
  if (!bankName || !bankName.trim() || !accountNumber || !accountNumber.trim() || !accountName || !accountName.trim()) {
    throw new FinancialError('Bank name, account number, and account name are all required');
  }

  const vendor = await requireVendor(userId);
  const roundedAmount = Math.round(numericAmount * 100) / 100;

  const result = await withdrawalRepository.create({
    vendorId: vendor.id,
    amount: roundedAmount,
    bankName: bankName.trim(),
    accountNumber: accountNumber.trim(),
    accountName: accountName.trim(),
  });

  if (result.insufficientFunds) {
    throw new FinancialError('Insufficient available balance for this withdrawal', 409);
  }
  return result.withdrawal;
}

async function listMyWithdrawals(userId, { status, page, limit }) {
  const vendor = await requireVendor(userId);
  return withdrawalRepository.listByVendor(vendor.id, { status, page, limit });
}

// ---------- Withdrawals (admin-facing) ----------

async function listWithdrawalsForAdmin({ status, page, limit }) {
  return withdrawalRepository.listAll({ status, page, limit });
}

/**
 * Admin transition: pending -> approved -> paid, or pending -> rejected
 * (with a compensating wallet credit). Each transition is validated
 * against the withdrawal's actual current state by the repository's
 * conditional UPDATE, not assumed here — this function just picks which
 * repository call to make and turns a failed transition into a clear
 * error naming the current status.
 */
async function updateWithdrawalStatus(withdrawalId, newStatus, adminNotes) {
  if (!VALID_WITHDRAWAL_TRANSITIONS.includes(newStatus)) {
    throw new FinancialError(`Invalid withdrawal status: ${newStatus}`);
  }

  const withdrawal = await withdrawalRepository.findById(withdrawalId);
  if (!withdrawal) {
    throw new FinancialError('Withdrawal request not found', 404);
  }

  if (newStatus === 'approved') {
    const ok = await withdrawalRepository.approve(withdrawalId);
    if (!ok) {
      throw new FinancialError(
        `Withdrawal must be pending to approve (current status: ${withdrawal.status})`, 409
      );
    }
  } else if (newStatus === 'paid') {
    const ok = await withdrawalRepository.markPaid(withdrawalId);
    if (!ok) {
      throw new FinancialError(
        `Withdrawal must be approved before it can be marked paid (current status: ${withdrawal.status})`, 409
      );
    }
  } else if (newStatus === 'rejected') {
    const result = await withdrawalRepository.reject(withdrawalId, adminNotes);
    if (!result.rejected) {
      throw new FinancialError(
        `Withdrawal must be pending to reject (current status: ${withdrawal.status})`, 409
      );
    }
  }

  return withdrawalRepository.findById(withdrawalId);
}

// ---------- Refunds ----------

/**
 * Creates a refund request for a cancelled order — but only if the order
 * was actually paid for. See the header comment on this file for why
 * that check matters given the current order lifecycle. Returns null
 * (not an error) when there's nothing to refund, since being called for
 * an unpaid cancelled order is expected, normal behaviour, not a failure.
 */
async function createRefundRequest(orderId, userId) {
  const successfulPayment = await paymentRepository.findSuccessfulByOrderId(orderId);
  if (!successfulPayment) {
    return null; // nothing was ever collected for this order — nothing to refund
  }

  const result = await refundRepository.create({
    orderId,
    userId,
    amount: successfulPayment.amount,
  });
  return result.refund;
}

async function listPendingRefunds({ page, limit }) {
  return refundRepository.listPending({ page, limit });
}

async function processRefund(refundId, adminNotes) {
  const refund = await refundRepository.findById(refundId);
  if (!refund) {
    throw new FinancialError('Refund request not found', 404);
  }

  const ok = await refundRepository.markProcessed(refundId, adminNotes);
  if (!ok) {
    throw new FinancialError(
      `Refund cannot be processed (current status: ${refund.status})`, 409
    );
  }
  return refundRepository.findById(refundId);
}

module.exports = {
  FinancialError,
  creditVendorWallet,
  getWallet,
  listWalletTransactions,
  requestWithdrawal,
  listMyWithdrawals,
  listWithdrawalsForAdmin,
  updateWithdrawalStatus,
  createRefundRequest,
  listPendingRefunds,
  processRefund,
};
