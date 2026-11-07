-- Migration 003: categories
-- Menu categories live in their own table rather than as free text on
-- MenuItem, per the 3NF discussion in Section 3.8.4 (avoids duplicated,
-- inconsistently-spelled category strings across items and vendors).

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,

  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
