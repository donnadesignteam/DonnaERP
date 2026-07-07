-- เพิ่มคอลัมน์ "สั่งนอก" ในตารางออเดอร์
-- รันใน Supabase Dashboard → SQL Editor

alter table order_entries add column if not exists outsource text;
