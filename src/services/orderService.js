/**
 * Order service. The one rule that matters most here: never trust a price
 * or total sent by the client. Every unit_price in a created order is
 * re-read from menu_items at the moment of checkout, and the total is
 * computed server-side from that — a tampered client request can change
 * quantities, but it can never change what it pays per item.
 */
const orderRepository = require('../repositories/orderRepository');
const menuRepository = require('../repositories/menuRepository');
const vendorRepository = require('../repositories/vendorRepository');
const deliveryRepository = require('../repositories/deliveryRepository');
const financialService = require('./financialService');

class OrderError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'OrderError';
    this.statusCode = statusCode;
  }
}

async function createOrder(userId, { vendorId, items }) {
  if (!vendorId) throw new OrderError('vendorId is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderError('At least one item is required to place an order');
  }

  const vendor = await vendorRepository.findById(vendorId);
  if (!vendor) throw new OrderError('Vendor not found', 404);
  if (vendor.status !== 'active') {
    throw new OrderError('This vendor is not currently accepting orders', 409);
  }

  // De-duplicate item ids in case the client sent the same item twice
  // as separate lines rather than combining quantities.
  const requestedQuantities = new Map();
  for (const line of items) {
    const itemId = Number(line.itemId);
    const quantity = Number(line.quantity);
    if (!itemId || !quantity || quantity < 1) {
      throw new OrderError('Each item requires a valid itemId and a quantity of at least 1');
    }
    requestedQuantities.set(itemId, (requestedQuantities.get(itemId) || 0) + quantity);
  }

  const itemIds = [...requestedQuantities.keys()];
  const menuItems = await menuRepository.findByIds(itemIds);

  if (menuItems.length !== itemIds.length) {
    throw new OrderError('One or more items in your cart no longer exist', 409);
  }

  const orderItems = [];
  let totalAmount = 0;

  for (const menuItem of menuItems) {
    if (menuItem.vendor_id !== vendorId) {
      throw new OrderError(
        'All items in an order must be from the same vendor — your cart has items from more than one vendor',
        409
      );
    }
    if (!menuItem.available) {
      throw new OrderError(`"${menuItem.name}" is no longer available`, 409);
    }

    const quantity = requestedQuantities.get(menuItem.id);
    const unitPrice = Number(menuItem.price); // server-authoritative price, never from the client
    totalAmount += unitPrice * quantity;

    orderItems.push({ itemId: menuItem.id, quantity, unitPrice });
  }

  const orderId = await orderRepository.create({
    userId,
    vendorId,
    totalAmount: Math.round(totalAmount * 100) / 100,
    items: orderItems,
  });

  return orderRepository.findById(orderId);
}

async function requireOwnedOrder(userId, orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderError('Order not found', 404);
  const vendor = await vendorRepository.findByUserId(userId);
  if (!vendor || vendor.id !== order.vendor_id) {
    throw new OrderError('You do not have permission to update this order', 403);
  }
  return order;
}

/**
 * FR5: vendor moves an order from confirmed -> preparing. Each lifecycle
 * step is its own function enforcing exactly one valid transition, rather
 * than a single "set status to whatever the client sends" endpoint — a
 * vendor request can never jump an order straight to 'delivered', say.
 */
async function startPreparing(userId, orderId) {
  const order = await requireOwnedOrder(userId, orderId);
  if (order.status !== 'confirmed') {
    throw new OrderError(`Order must be confirmed before preparation can start (current status: ${order.status})`, 409);
  }
  return orderRepository.updateStatus(orderId, 'preparing');
}

/**
 * FR5: vendor marks an order ready. This is also the moment a delivery
 * record is created (status = 'awaiting_rider') — an order can't be
 * picked up by a rider before this point, matching the workflow narrative
 * in Chapter 3, Section 3.8.7.
 */
async function markReady(userId, orderId) {
  const order = await requireOwnedOrder(userId, orderId);
  if (order.status !== 'preparing') {
    throw new OrderError(`Order must be in preparation before it can be marked ready (current status: ${order.status})`, 409);
  }
  const updated = await orderRepository.updateStatus(orderId, 'ready');
  await deliveryRepository.createForOrder(orderId);
  return updated;
}

async function getOrderForUser(userId, userRole, orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderError('Order not found', 404);

  const isCustomer = order.user_id === userId;
  let isOwningVendor = false;
  if (userRole === 'vendor') {
    const vendor = await vendorRepository.findByUserId(userId);
    isOwningVendor = !!vendor && vendor.id === order.vendor_id;
  }

  if (!isCustomer && !isOwningVendor) {
    throw new OrderError('You do not have permission to view this order', 403);
  }
  return order;
}

async function listMyOrders(userId, { status, page, limit }) {
  return orderRepository.listByUser(userId, { status, page, limit });
}

async function listVendorOrders(userId, { status, page, limit }) {
  const vendor = await vendorRepository.findByUserId(userId);
  if (!vendor) throw new OrderError('No vendor profile is associated with this account', 403);
  return orderRepository.listByVendor(vendor.id, { status, page, limit });
}

async function cancelOrder(userId, orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderError('Order not found', 404);
  if (order.user_id !== userId) {
    throw new OrderError('You do not have permission to cancel this order', 403);
  }
  if (!['pending', 'payment_failed'].includes(order.status)) {
    throw new OrderError(
      `This order can no longer be cancelled (current status: ${order.status})`,
      409
    );
  }
  const cancelled = await orderRepository.updateStatus(orderId, 'cancelled');

  // Create a refund request IF money was actually collected for this
  // order. Under the current state machine (cancellation only allowed
  // from 'pending'/'payment_failed', see the guard above) that's almost
  // always false — see financialService.js's header comment for the
  // full explanation. Kept here rather than skipped so this becomes
  // correctly functional automatically if cancellation is ever extended
  // to confirmed/preparing/ready orders, without needing to revisit this
  // call site.
  await financialService.createRefundRequest(orderId, userId);

  return cancelled;
}

module.exports = {
  OrderError,
  createOrder,
  getOrderForUser,
  listMyOrders,
  listVendorOrders,
  cancelOrder,
  startPreparing,
  markReady,
};
