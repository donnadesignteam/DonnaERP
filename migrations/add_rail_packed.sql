-- เพิ่มคอลัมน์สถานะแพ็คราง ในตารางออเดอร์ (รันใน Supabase SQL editor)
alter table order_entries
  add column if not exists rail_packed boolean not null default false,
  add column if not exists rail_packed_at timestamptz;
