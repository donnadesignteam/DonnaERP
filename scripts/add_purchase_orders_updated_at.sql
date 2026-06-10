-- เพิ่มคอลัมน์ updated_at ให้ตาราง purchase_orders (สำหรับคอลัมน์ "แก้ไขล่าสุด" ในเว็บ)
-- รันใน Supabase SQL Editor

alter table public.purchase_orders
  add column if not exists updated_at timestamptz default now();

update public.purchase_orders
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;
