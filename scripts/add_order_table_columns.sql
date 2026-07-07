-- คอลัมน์ใหม่ในตารางออเดอร์ (7 ก.ค. 2026)
-- outsource_at  = วันเวลาที่พิมพ์ช่อง "สั่งนอก" (โชว์ใต้ข้อความในตาราง)
-- address       = ที่อยู่ (งานนอก/งานติดตั้ง) และ "ที่อยู่จัดส่งแยก" (งานแพลตฟอร์ม)
-- install_status = สถานะติดตั้ง: ติดตั้งแล้ว / ติดตั้ง50%
-- รันใน Supabase Dashboard → SQL Editor

alter table order_entries add column if not exists outsource_at timestamptz;
alter table order_entries add column if not exists address text;
alter table order_entries add column if not exists install_status text;
