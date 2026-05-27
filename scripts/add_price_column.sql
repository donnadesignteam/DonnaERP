-- เพิ่ม price column ใน order_entries
ALTER TABLE order_entries
  ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT NULL;
