-- Migration 010: allow multiple payment attempts per order
-- Chapter 3's activity diagram (Fig. 3.6) documents a retry path: a failed
-- payment lets the customer retry, which means a second payment attempt
-- against the same order. The original UNIQUE(order_id) constraint from
-- migration 007 assumed exactly one payment per order and would reject
-- that. This migration relaxes it to a plain index — multiple attempts
-- (multiple rows) are now allowed per order, full attempt history is kept,
-- and "at most one *successful* payment per order" is enforced in
-- paymentService instead of at the database level.

ALTER TABLE payments
  DROP INDEX uq_payments_order_id,
  ADD KEY idx_payments_order_id (order_id);
