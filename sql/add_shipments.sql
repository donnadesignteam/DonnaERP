-- เพิ่มคอลัมน์เก็บเลขพัสดุ + สถานะขนส่งของแต่ละออเดอร์
-- โครงสร้าง: array ของ { no (เลขพัสดุ), carrier (เจ้าขนส่ง), status (สถานะล่าสุด),
--                        events (timeline [{time, desc}]), checked_at (เช็คล่าสุดเมื่อไหร่) }
-- รันใน Supabase → SQL Editor

alter table public.order_entries
  add column if not exists shipments jsonb;
