-- คอลัมน์ปิดงานเคลม: ใครปิด + ปิดเมื่อไหร่ (รันใน Supabase SQL Editor)
alter table claims
  add column if not exists closed_by text,
  add column if not exists closed_at timestamptz;
