-- Baseline categories. Vendors assign menu items to these; an admin route
-- can add more later without a schema change (categories is just data).
INSERT INTO categories (name) VALUES
  ('Rice Dishes'),
  ('Swallow & Soups'),
  ('Snacks & Pastries'),
  ('Beverages'),
  ('Grills & Suya'),
  ('Breakfast')
ON DUPLICATE KEY UPDATE name = VALUES(name);
