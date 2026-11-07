-- Migration 002: vendors
-- Vendor-specific profile data, kept separate from `users` per 3NF (Section
-- 3.8.4): a vendor's business details would otherwise create a transitive
-- dependency and update anomalies if duplicated onto every order row.
-- Vendor accounts are created/verified by an admin, not self-registered
-- (Section 3.9, System Assumptions), so there is no public "register as
-- vendor" endpoint — this table is populated via an admin-only route.

CREATE TABLE IF NOT EXISTS vendors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  business_name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status ENUM('pending', 'active', 'suspended') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_vendors_user_id (user_id),
  CONSTRAINT fk_vendors_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
