/**
 * Withdrawal repository. State transitions (approve/pay/reject) use the
 * same "conditional UPDATE, check affectedRows" idempotency pattern as
 * deliveryRepository — a transition only succeeds if the row is still in
 * the expected prior state at the moment the UPDATE runs, so two
 * concurrent attempts to reject the same withdrawal can't both refund it.
 */
const { pool } = require('../config/db');
const walletRepository = require('./walletRepository');

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT w.*, v.business_name AS vendor_name, u.full_name AS owner_name
     FROM withdrawal_requests w
     JOIN vendors v ON v.id = w.vendor_id
     JOIN users u ON u.id = v.user_id
     WHERE w.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listByVendor(vendorId, { status, page = 1, limit = 20 } = {}) {
  const conditions = ['vendor_id = ?'];
  const params = [vendorId];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM withdrawal_requests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM withdrawal_requests ${whereClause}`,
    params
  );
  return { withdrawals: rows, total, page: Number(page), limit: Number(limit) };
}

async function listAll({ status, page = 1, limit = 20 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('w.status = ?');
    params.push(status);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows] = await pool.query(
    `SELECT w.*, v.business_name AS vendor_name, u.full_name AS owner_name
     FROM withdrawal_requests w
     JOIN vendors v ON v.id = w.vendor_id
     JOIN users u ON u.id = v.user_id
     ${whereClause}
     ORDER BY w.created_at ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM withdrawal_requests w ${whereClause}`,
    params
  );
  return { withdrawals: rows, total, page: Number(page), limit: Number(limit) };
}

/**
 * Creates a withdrawal request. The balance deduction, the request row,
 * and the debit transaction log all commit together or not at all — and
 * the deduction itself is the atomic conditional UPDATE in
 * walletRepository.deductBalance(), which is what actually prevents two
 * concurrent requests from both spending the same balance.
 */
async function create({ vendorId, amount, bankName, accountNumber, accountName }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const deducted = await walletRepository.deductBalance(connection, vendorId, amount);
    if (!deducted) {
      await connection.rollback();
      return { insufficientFunds: true };
    }

    const [result] = await connection.query(
      `INSERT INTO withdrawal_requests
         (vendor_id, amount, status, bank_name, account_number, account_name, created_at)
       VALUES (?, ?, 'pending', ?, ?, ?, NOW())`,
      [vendorId, amount, bankName, accountNumber, accountName]
    );
    const withdrawalId = result.insertId;

    await walletRepository.debitBalanceWithinTransaction(
      connection, vendorId, amount, `WITHDRAWAL_REQUEST_${withdrawalId}`
    );

    await connection.commit();
    const withdrawal = await findById(withdrawalId);
    return { insufficientFunds: false, withdrawal };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * pending -> approved. No wallet change (funds were already deducted at
 * request time). Returns true only if the row was actually in 'pending'
 * at the moment this ran.
 */
async function approve(id) {
  const [result] = await pool.query(
    "UPDATE withdrawal_requests SET status = 'approved' WHERE id = ? AND status = 'pending'",
    [id]
  );
  return result.affectedRows === 1;
}

/**
 * approved -> paid. No wallet change here either — this only records
 * that the vendor has actually been paid out via whatever offline/manual
 * bank transfer process the admin used; the deduction already happened.
 */
async function markPaid(id) {
  const [result] = await pool.query(
    "UPDATE withdrawal_requests SET status = 'paid' WHERE id = ? AND status = 'approved'",
    [id]
  );
  return result.affectedRows === 1;
}

/**
 * pending -> rejected, with a compensating wallet credit. The status
 * flip and the refund are the same transaction; the status flip's
 * affectedRows check (only succeeds from 'pending') is what prevents a
 * second, concurrent reject call from refunding twice — it simply never
 * gets past the first check.
 */
async function reject(id, adminNotes) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [statusResult] = await connection.query(
      "UPDATE withdrawal_requests SET status = 'rejected', admin_notes = ? WHERE id = ? AND status = 'pending'",
      [adminNotes || null, id]
    );
    if (statusResult.affectedRows !== 1) {
      await connection.rollback();
      return { rejected: false };
    }

    const [[withdrawal]] = await connection.query(
      'SELECT vendor_id, amount FROM withdrawal_requests WHERE id = ?',
      [id]
    );

    const refunded = await walletRepository.creditBalanceWithinTransaction(
      connection, withdrawal.vendor_id, withdrawal.amount, `WITHDRAWAL_REJECT_${id}`
    );
    // refunded should always be true here (the reference is fresh per
    // withdrawal id and the status guard above ensures this only runs
    // once) — but if it's somehow false, the withdrawal is still
    // correctly marked rejected, it just means the compensating credit
    // reference collided, which would itself be a bug worth surfacing
    // rather than silently losing the vendor's funds.
    if (!refunded) {
      await connection.rollback();
      throw new Error(`Compensating credit for withdrawal ${id} did not apply — refusing to leave the withdrawal rejected without it.`);
    }

    await connection.commit();
    return { rejected: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { findById, listByVendor, listAll, create, approve, markPaid, reject };
