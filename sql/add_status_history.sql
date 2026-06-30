-- เพิ่มคอลัมน์เก็บประวัติสถานะของแต่ละออเดอร์
-- โครงสร้าง: array ของ { status, at (เวลา ISO), by (ใครทำ — null ไว้ก่อน รอใช้ตัวสแกนเดือนหน้า) }
-- รันใน Supabase → SQL Editor

alter table public.order_entries
  add column if not exists status_history jsonb not null default '[]'::jsonb;
