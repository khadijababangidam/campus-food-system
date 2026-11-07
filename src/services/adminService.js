/**
 * Admin service. Vendor creation here is the ONLY way a vendor account
 * comes into existence (Section 3.9) — there is deliberately no
 * self-registration path for this role, closing a gap that existed
 * earlier in the build where /auth/register still accepted role=vendor.
 */
const userRepository = require('../repositories/userRepository');
const vendorRepository = require('../repositories/vendorRepository');
const analyticsRepository = require('../repositories/analyticsRepository');
const { hashPassword } = require('../utils/password');

class AdminError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AdminError';
    this.statusCode = statusCode;
  }
}

// ---------- Users ----------

async function listUsers({ role, page, limit }) {
  return userRepository.list({ role, page, limit });
}

async function setUserActive(requestingAdminId, targetUserId, isActive) {
  if (requestingAdminId === targetUserId) {
    throw new AdminError('You cannot suspend your own account', 400);
  }
  const user = await userRepository.findById(targetUserId);
  if (!user) throw new AdminError('User not found', 404);
  return userRepository.setActive(targetUserId, isActive);
}

// ---------- Vendors ----------

async function createVendor({ fullName, email, phone, password, businessName, description }) {
  if (!businessName || !businessName.trim()) {
    throw new AdminError('businessName is required');
  }
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AdminError('An account with this email already exists', 409);
  }

  const passwordHash = await hashPassword(password);
  const vendorId = await vendorRepository.createWithUser({
    fullName, email, phone, passwordHash, businessName, description,
  });
  return vendorRepository.findById(vendorId);
}

async function listVendors({ status, page, limit }) {
  return vendorRepository.listAll({ status, page, limit });
}

async function setVendorStatus(vendorId, status) {
  const vendor = await vendorRepository.findById(vendorId);
  if (!vendor) throw new AdminError('Vendor not found', 404);
  if (!['pending', 'active', 'suspended'].includes(status)) {
    throw new AdminError('Invalid vendor status');
  }
  return vendorRepository.updateStatus(vendorId, status);
}

// ---------- Analytics ----------

async function getAnalyticsSummary() {
  const [totals, ordersByStatus, revenueByVendor, ordersByDay] = await Promise.all([
    analyticsRepository.getTotals(),
    analyticsRepository.getOrdersByStatus(),
    analyticsRepository.getRevenueByVendor(10),
    analyticsRepository.getOrdersByDay(14),
  ]);
  return { ...totals, ordersByStatus, revenueByVendor, ordersByDay };
}

module.exports = {
  AdminError,
  listUsers,
  setUserActive,
  createVendor,
  listVendors,
  setVendorStatus,
  getAnalyticsSummary,
};
