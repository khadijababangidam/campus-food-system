const { validationResult } = require('express-validator');
const financialService = require('../services/financialService');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

// ---------- Vendor: wallet ----------

async function getWalletHandler(req, res, next) {
  try {
    const wallet = await financialService.getWallet(req.user.sub);
    return res.status(200).json({ success: true, data: wallet });
  } catch (err) {
    return next(err);
  }
}

async function listWalletTransactionsHandler(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await financialService.listWalletTransactions(req.user.sub, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

// ---------- Vendor: withdrawals ----------

async function requestWithdrawalHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const { amount, bankName, accountNumber, accountName } = req.body;
    const withdrawal = await financialService.requestWithdrawal(req.user.sub, {
      amount, bankName, accountNumber, accountName,
    });
    return res.status(201).json({ success: true, data: withdrawal });
  } catch (err) {
    return next(err);
  }
}

async function myWithdrawalsHandler(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await financialService.listMyWithdrawals(req.user.sub, {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

// ---------- Admin: withdrawals ----------

async function adminListWithdrawalsHandler(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await financialService.listWithdrawalsForAdmin({
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function adminUpdateWithdrawalStatusHandler(req, res, next) {
  if (!handleValidation(req, res)) return;
  try {
    const { status, adminNotes } = req.body;
    const withdrawal = await financialService.updateWithdrawalStatus(
      Number(req.params.id), status, adminNotes
    );
    return res.status(200).json({ success: true, data: withdrawal });
  } catch (err) {
    return next(err);
  }
}

// ---------- Admin: refunds ----------

async function adminListPendingRefundsHandler(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await financialService.listPendingRefunds({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function adminProcessRefundHandler(req, res, next) {
  try {
    const { adminNotes } = req.body;
    const refund = await financialService.processRefund(Number(req.params.id), adminNotes);
    return res.status(200).json({ success: true, data: refund });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getWalletHandler,
  listWalletTransactionsHandler,
  requestWithdrawalHandler,
  myWithdrawalsHandler,
  adminListWithdrawalsHandler,
  adminUpdateWithdrawalStatusHandler,
  adminListPendingRefundsHandler,
  adminProcessRefundHandler,
};
