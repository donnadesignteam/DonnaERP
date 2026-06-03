ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS unused_rolls integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_use_rolls integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ปกติ';
