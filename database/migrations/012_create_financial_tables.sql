-- Migration 012: financial module (vendor wallets, withdrawals, refunds)
--
-- Two deviations from the schema as originally specified, both required
-- for the idempotency guarantees the financial module explicitly demands
-- ("must not credit twice", "must not refund twice") to actually hold
-- under concurrency rather than just in the common case:
--
--   1. wallet_transactions.reference is now UNIQUE. Without this, the
--      "check if a completed transaction with this reference already
--      exists" idempotency check is a SELECT-then-INSERT race — two
--      concurrent requests can both pass the SELECT before either
--      INSERTs. The application now relies on INSERT ... ON DUPLICATE
--      KEY UPDATE against this constraint as the actual guarantee, with
--      the SELECT retained only as a fast, cheap pre-check.
--
--   2. refund_requests.order_id is now UNIQUE, for the identical reason
--      applied to "duplicate refund protection."
--
-- Everything else matches the schema as given, unmodified.

CREATE TABLE IF NOT EXISTS vendor_wallets (
  vendor_id INT UNSIGNED PRIMARY KEY,
  available_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_earned DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vendor_wallets_vendor
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT UNSIGNED NOT NULL,
  type ENUM('credit', 'debit') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  reference VARCHAR(255) NOT NULL,
  status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'completed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_tx_vendor
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  UNIQUE KEY uq_wallet_tx_reference (reference),
  KEY idx_wallet_tx_vendor (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'paid') NOT NULL DEFAULT 'pending',
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  admin_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_withdrawals_vendor
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  KEY idx_withdrawals_vendor (vendor_id),
  KEY idx_withdrawals_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refund_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'processed', 'rejected') NOT NULL DEFAULT 'pending',
  admin_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_refunds_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE KEY uq_refund_requests_order_id (order_id),
  KEY idx_refunds_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
