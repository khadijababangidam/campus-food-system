-- Migration 005: orders
-- Centre of the schema (Section 3.8.3): links the customer (user_id) and
-- the vendor. `status` models the lifecycle walked through in the system
-- workflow (Section 3.8.7) and activity diagram (Fig. 3.6): pending ->
-- confirmed -> preparing -> ready -> out_for_delivery -> delivered, with
-- payment_failed and cancelled as exception-path terminal states.

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  vendor_id INT UNSIGNED NOT NULL,
  status ENUM(
    'pending',
    'payment_failed',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'flagged_for_review'
  ) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_orders_user (user_id),
  KEY idx_orders_vendor (vendor_id),
  KEY idx_orders_status (status),
  KEY idx_orders_created_at (created_at),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_vendor
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
