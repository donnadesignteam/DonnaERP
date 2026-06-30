-- (อนาคต) เก็บภาพตอนแพ็คราง/แพ็คม่านของแต่ละออเดอร์
-- โครงสร้าง: array ของ URL รูป (อัปโหลดเข้า Supabase Storage แล้วเก็บลิงก์)
-- รันเมื่อพร้อมเริ่มเก็บภาพจริง — รันใน Supabase → SQL Editor
--
-- หลังรันแล้ว แจ้งให้เพิ่ม 'packing_photos' เข้า .select() ในหน้า customers
-- และทำปุ่มอัปโหลด (แนวเดียวกับ medical-certs bucket ในหน้า employees)

alter table public.order_entries
  add column if not exists packing_photos jsonb not null default '[]'::jsonb;
