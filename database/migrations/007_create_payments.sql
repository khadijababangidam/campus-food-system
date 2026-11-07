-- Migration 007: payments
-- One row per payment attempt (originally constrained to exactly one
-- payment per order; see migration 010, which relaxes this to support the
-- retry path in Chapter 3's activity diagram — multiple attempts per
-- order are allowed, "at most one successful payment per order" is
-- enforced in paymentService). `reference` is the gateway transaction
-- reference used for webhook-based verification (Section 3.3.3, Document
-- Review) — never trust a client-reported success alone; the payment
-- service re-verifies this reference against Paystack directly before
-- marking status = success.

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  gateway ENUM('paystack', 'flutterwave') NOT NULL,
  reference VARCHAR(100) NOT NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  amount DECIMAL(10,2) NOT NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payments_order_id (order_id),
  UNIQUE KEY uq_payments_reference (reference),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_payments_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
