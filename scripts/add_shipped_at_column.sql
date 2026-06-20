-- เพิ่มคอลัมน์ shipped_at เก็บวันเวลาที่ติ๊ก "จัดส่งแล้ว"
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม รันใน Supabase SQL Editor ได้เลย
ALTER TABLE order_entries ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
