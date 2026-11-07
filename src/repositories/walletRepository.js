/**
 * Wallet repository. vendor_wallets and wallet_transactions are always
 * read/written together (a wallet's balance IS the sum of its
 * transactions, in spirit), so they share one file rather than being
 * split like most other entity pairs in this codebase.
 *
 * The idempotency guarantee for creditWallet() is NOT the pre-check
 * SELECT — it's the UNIQUE constraint on wallet_transactions.reference
 * (migration 012) combined with INSERT ... ON DUPLICATE KEY UPDATE and
 * checking affectedRows. That's the only thing that's actually safe
 * under concurrent calls; see deliveryRepository.claim() for the same
 * philosophy applied to a different table.
 */
const { pool } = require('../config/db');

async function findByVendorId(vendorId) {
  const [rows] = await pool.query('SELECT * FROM vendor_wallets WHERE vendor_id = ? LIMIT 1', [vendorId]);
  return rows[0] || null;
}

async function findTransactionByReference(reference) {
  const [rows] = await pool.query(
    'SELECT * FROM wallet_transactions WHERE reference = ? LIMIT 1',
    [reference]
  );
  return rows[0] || null;
}

async function listTransactions(vendorId, { page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT * FROM wallet_transactions WHERE vendor_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [vendorId, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM wallet_transactions WHERE vendor_id = ?',
    [vendorId]
  );
  return { transactions: rows, total, page: Number(page), limit: Number(limit) };
}

/**
 * Credits a vendor's wallet, idempotently, for a given reference.
 *
 * Order of operations matters here: the wallet_transactions row is
 * inserted FIRST, and its outcome (fresh insert vs. already-existed,
 * read off affectedRows) decides whether the balance update happens at
 * all. This is the reverse of "update balance, then log it" — logging
 * first and gating the balance update on that log succeeding is what
 * makes a double-call safe.
 *
 * Returns { alreadyCredited: boolean, wallet }.
 */
async function creditWallet({ vendorId, amount, reference }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Ensure the wallet row exists before we try to credit it — the
    // vendor's very first delivered order won't have one yet.
    await connection.query(
      `INSERT INTO vendor_wallets (vendor_id, available_balance, total_earned)
       VALUES (?, 0.00, 0.00)
       ON DUPLICATE KEY UPDATE vendor_id = vendor_id`,
      [vendorId]
    );

    // The actual idempotency guarantee: reference is UNIQUE, so a second
    // attempt with the same reference affects 0 rows here, not 1.
    const [txResult] = await connection.query(
      `INSERT INTO wallet_transactions (vendor_id, type, amount, reference, status, created_at)
       VALUES (?, 'credit', ?, ?, 'completed', NOW())
       ON DUPLICATE KEY UPDATE id = id`,
      [vendorId, amount, reference]
    );

    if (txResult.affectedRows !== 1) {
      // Reference already existed — this order was already credited.
      await connection.rollback();
      const wallet = await findByVendorId(vendorId);
      return { alreadyCredited: true, wallet };
    }

    await connection.query(
      `UPDATE vendor_wallets
       SET available_balance = available_balance + ?, total_earned = total_earned + ?
       WHERE vendor_id = ?`,
      [amount, amount, vendorId]
    );

    await connection.commit();
    const wallet = await findByVendorId(vendorId);
    return { alreadyCredited: false, wallet };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Atomically deducts from available_balance, only if sufficient funds
 * exist at the moment the UPDATE runs — the same "conditional UPDATE +
 * check affectedRows" pattern as deliveryRepository.claim(), which is
 * what makes two concurrent withdrawal requests from the same vendor
 * safe: at most one of them can succeed against a given balance.
 * Returns true if the deduction succeeded, false if funds were
 * insufficient (or the wallet doesn't exist) at that moment.
 */
async function deductBalance(connection, vendorId, amount) {
  const [result] = await connection.query(
    `UPDATE vendor_wallets
     SET available_balance = available_balance - ?
     WHERE vendor_id = ? AND available_balance >= ?`,
    [amount, vendorId, amount]
  );
  return result.affectedRows === 1;
}

/**
 * Compensating credit for a rejected withdrawal — same idempotent-insert
 * pattern as creditWallet(), reusable inside a connection that's already
 * in a transaction (see withdrawalRepository.reject()).
 */
async function creditBalanceWithinTransaction(connection, vendorId, amount, reference) {
  const [txResult] = await connection.query(
    `INSERT INTO wallet_transactions (vendor_id, type, amount, reference, status, created_at)
     VALUES (?, 'credit', ?, ?, 'completed', NOW())
     ON DUPLICATE KEY UPDATE id = id`,
    [vendorId, amount, reference]
  );

  if (txResult.affectedRows !== 1) {
    return false; // already refunded once — do not touch the balance again
  }

  await connection.query(
    'UPDATE vendor_wallets SET available_balance = available_balance + ? WHERE vendor_id = ?',
    [amount, vendorId]
  );
  return true;
}

/**
 * Debit entry for a withdrawal request — written inside the same
 * transaction as the withdrawal row and the balance deduction (see
 * withdrawalRepository.create()).
 */
async function debitBalanceWithinTransaction(connection, vendorId, amount, reference) {
  await connection.query(
    `INSERT INTO wallet_transactions (vendor_id, type, amount, reference, status, created_at)
     VALUES (?, 'debit', ?, ?, 'completed', NOW())`,
    [vendorId, amount, reference]
  );
}

module.exports = {
  findByVendorId,
  findTransactionByReference,
  listTransactions,
  creditWallet,
  deductBalance,
  creditBalanceWithinTransaction,
  debitBalanceWithinTransaction,
};
