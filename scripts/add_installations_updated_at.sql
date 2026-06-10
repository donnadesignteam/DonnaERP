-- เพิ่มคอลัมน์ updated_at ให้ตาราง installations (สำหรับคอลัมน์ "แก้ไขล่าสุด" ในเว็บ)
-- รันใน Supabase SQL Editor

alter table public.installations
  add column if not exists updated_at timestamptz default now();

-- เซ็ตค่าเริ่มต้นให้แถวเดิม = วันที่สร้าง (ถ้ายังว่าง)
update public.installations
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;
