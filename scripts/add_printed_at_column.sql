-- เพิ่มคอลัมน์ printed_at เก็บวันเวลาที่ปริ้นใบออเดอร์ล่าสุด (โชว์สีเหลืองข้างปุ่มปริ้นในเมนู ···)
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม รันใน Supabase SQL Editor ได้เลย
ALTER TABLE order_entries ADD COLUMN IF NOT EXISTS printed_at timestamptz;
