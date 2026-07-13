-- เพิ่มคอลัมน์ install_zone เก็บโซนติดตั้ง (เชียงราย/เชียงใหม่/กทม) ในตาราง installations
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม รันใน Supabase SQL Editor ได้เลย
ALTER TABLE installations ADD COLUMN IF NOT EXISTS install_zone text;
