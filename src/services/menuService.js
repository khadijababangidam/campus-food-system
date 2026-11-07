/**
 * Menu service — business rules for menu items. Ownership checks live
 * here (not in the controller) so they're testable without an HTTP layer,
 * consistent with the Clean Architecture boundary used in authService.
 */
const menuRepository = require('../repositories/menuRepository');
const vendorRepository = require('../repositories/vendorRepository');
const categoryRepository = require('../repositories/categoryRepository');

class MenuError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'MenuError';
    this.statusCode = statusCode;
  }
}

async function requireOwnVendor(userId) {
  const vendor = await vendorRepository.findByUserId(userId);
  if (!vendor) {
    throw new MenuError('No vendor profile is associated with this account', 403);
  }
  return vendor;
}

async function requireOwnedItem(userId, itemId) {
  const vendor = await requireOwnVendor(userId);
  const item = await menuRepository.findById(itemId);
  if (!item) {
    throw new MenuError('Menu item not found', 404);
  }
  if (item.vendor_id !== vendor.id) {
    throw new MenuError('You do not have permission to modify this menu item', 403);
  }
  return { vendor, item };
}

async function validateCategory(categoryId) {
  if (!categoryId) return null;
  const category = await categoryRepository.findById(categoryId);
  if (!category) {
    throw new MenuError('Invalid category', 400);
  }
  return category;
}

async function browse({ vendorId, categoryId, page, limit }) {
  return menuRepository.list({ vendorId, categoryId, available: true, page, limit });
}

async function getOwnMenu(userId, { categoryId, page, limit }) {
  const vendor = await requireOwnVendor(userId);
  return menuRepository.list({ vendorId: vendor.id, categoryId, available: undefined, page, limit });
}

async function getItem(itemId) {
  const item = await menuRepository.findById(itemId);
  if (!item) throw new MenuError('Menu item not found', 404);
  return item;
}

async function createItem(userId, { categoryId, name, description, price }) {
  const vendor = await requireOwnVendor(userId);
  await validateCategory(categoryId);
  return menuRepository.create({ vendorId: vendor.id, categoryId, name, description, price });
}

async function updateItem(userId, itemId, { categoryId, name, description, price }) {
  await requireOwnedItem(userId, itemId);
  await validateCategory(categoryId);
  return menuRepository.update(itemId, { categoryId, name, description, price });
}

async function setAvailability(userId, itemId, available) {
  await requireOwnedItem(userId, itemId);
  return menuRepository.setAvailability(itemId, available);
}

async function deleteItem(userId, itemId) {
  await requireOwnedItem(userId, itemId);
  const hasHistory = await menuRepository.hasOrderHistory(itemId);
  if (hasHistory) {
    throw new MenuError(
      'This item has order history and cannot be deleted. Mark it unavailable instead.',
      409
    );
  }
  await menuRepository.remove(itemId);
}

module.exports = {
  MenuError,
  browse,
  getOwnMenu,
  getItem,
  createItem,
  updateItem,
  setAvailability,
  deleteItem,
};
