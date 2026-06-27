-- เพิ่มคอลัมน์เวลาที่ติ๊ก "งานเสร็จ" (รันใน Supabase SQL editor)
alter table order_entries
  add column if not exists done_at timestamptz;
