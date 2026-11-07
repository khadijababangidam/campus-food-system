/**
 * Delivery service. Talks to orderRepository directly (not orderService)
 * for the order-status side effects each action triggers — orderService
 * already depends on deliveryRepository (to create a delivery when an
 * order is marked ready), so this keeps the dependency graph
 * one-directional instead of circular.
 */
const deliveryRepository = require('../repositories/deliveryRepository');
const orderRepository = require('../repositories/orderRepository');
const financialService = require('./financialService');

class DeliveryError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DeliveryError';
    this.statusCode = statusCode;
  }
}

async function listAvailable() {
  return deliveryRepository.listAvailable();
}

async function listMine(riderId, { status } = {}) {
  return deliveryRepository.listByRider(riderId, { status });
}

/**
 * Self-claim from the shared pool. The atomicity guarantee lives in
 * deliveryRepository.claim() (a conditional UPDATE) — this function just
 * translates "someone else got there first" into a clear 409 rather than
 * a confusing generic failure.
 */
async function acceptDelivery(riderId, deliveryId) {
  const delivery = await deliveryRepository.findById(deliveryId);
  if (!delivery) throw new DeliveryError('Delivery not found', 404);

  const claimed = await deliveryRepository.claim(deliveryId, riderId);
  if (!claimed) {
    throw new DeliveryError('This delivery has already been accepted by another rider', 409);
  }
  return deliveryRepository.findById(deliveryId);
}

async function markPickedUp(riderId, deliveryId) {
  const delivery = await deliveryRepository.findById(deliveryId);
  if (!delivery) throw new DeliveryError('Delivery not found', 404);
  if (delivery.rider_id !== riderId) {
    throw new DeliveryError('This delivery is not assigned to you', 403);
  }

  const updated = await deliveryRepository.markPickedUp(deliveryId, riderId);
  if (!updated) {
    throw new DeliveryError(`Delivery cannot be marked picked up (current status: ${delivery.status})`, 409);
  }
  await orderRepository.updateStatus(delivery.order_id, 'out_for_delivery');
  return deliveryRepository.findById(deliveryId);
}

async function markDelivered(riderId, deliveryId) {
  const delivery = await deliveryRepository.findById(deliveryId);
  if (!delivery) throw new DeliveryError('Delivery not found', 404);
  if (delivery.rider_id !== riderId) {
    throw new DeliveryError('This delivery is not assigned to you', 403);
  }

  const updated = await deliveryRepository.markDelivered(deliveryId, riderId);
  if (!updated) {
    throw new DeliveryError(`Delivery cannot be marked delivered (current status: ${delivery.status})`, 409);
  }
  await orderRepository.updateStatus(delivery.order_id, 'delivered');

  // Credit the vendor's wallet now that the order is genuinely delivered.
  // Idempotent (see walletRepository.creditWallet) — safe even if this
  // ends up called more than once for the same order. Deliberately NOT
  // wrapped in try/catch: every other service in this codebase lets
  // errors propagate to the central error handler rather than swallowing
  // them, and a failed credit here is safely retriable later (same
  // idempotency guarantee) precisely because nothing was silently lost.
  // The trade-off is that a wallet-credit failure will currently surface
  // to the rider as a 500 on their "mark delivered" action, even though
  // the delivery itself DID succeed — worth revisiting if that UX isn't
  // acceptable (e.g. by logging and not re-throwing here instead).
  await financialService.creditVendorWallet(delivery.order_id);

  return deliveryRepository.findById(deliveryId);
}

module.exports = { DeliveryError, listAvailable, listMine, acceptDelivery, markPickedUp, markDelivered };
