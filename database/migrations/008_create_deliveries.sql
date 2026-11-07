-- Migration 008: deliveries
-- Optional (0..1) relationship to orders (Section 3.8.3) — a delivery
-- record is only created once a vendor marks an order ready and a rider
-- is assigned (system workflow, Section 3.8.7), not at order creation.
-- rider_id is nullable up to that point.

CREATE TABLE IF NOT EXISTS deliveries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  rider_id INT UNSIGNED NULL,
  status ENUM(
    'awaiting_rider',
    'assigned',
    'picked_up',
    'delivered'
  ) NOT NULL DEFAULT 'awaiting_rider',
  assigned_at DATETIME NULL,
  delivered_at DATETIME NULL,

  UNIQUE KEY uq_deliveries_order_id (order_id),
  KEY idx_deliveries_rider (rider_id),
  KEY idx_deliveries_status (status),
  CONSTRAINT fk_deliveries_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_deliveries_rider
    FOREIGN KEY (rider_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
