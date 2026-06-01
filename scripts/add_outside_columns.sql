-- เพิ่มคอลัมน์สำหรับ งานนอก / งานติดตั้ง
ALTER TABLE order_entries
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'ยังไม่ชำระ',
  ADD COLUMN IF NOT EXISTS deposit NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS order_assigned TEXT DEFAULT 'รออัพเดท';
