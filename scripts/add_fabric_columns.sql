ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS fabric_width numeric,
  ADD COLUMN IF NOT EXISTS fabric_type text,
  ADD COLUMN IF NOT EXISTS shop_name text;
