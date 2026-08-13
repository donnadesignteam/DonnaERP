-- ตารางเก็บ "ใครใช้เว็บเวอร์ชันอะไรอยู่" — ไว้ดูในหน้าตั้งค่าว่าเครื่องไหนยังค้างของเก่า
-- เว็บของแต่ละเครื่องจะเขียนแถวของตัวเองทุกครั้งที่เปิดหน้า/เช็กเวอร์ชัน (1 เครื่อง = 1 แถว)
-- รันใน Supabase → SQL Editor

create table if not exists public.client_versions (
  client_id   text primary key,             -- รหัสสุ่มของเบราว์เซอร์เครื่องนั้น (เก็บใน localStorage)
  staff_code  text,                         -- รหัสพนักงานที่ล็อกอินอยู่ (ว่าง = ล็อกอินด้วยรหัสรวมของร้าน)
  staff_name  text,
  version     text not null,                -- เวอร์ชันโค้ดที่หน้านั้นโหลดมา
  user_agent  text,
  updated_at  timestamptz not null default now()
);

create index if not exists client_versions_updated_idx on public.client_versions (updated_at desc);

alter table public.client_versions enable row level security;

-- เว็บใช้ anon key เขียน/อ่านเองเหมือนตารางอื่นในระบบนี้
drop policy if exists client_versions_all on public.client_versions;
create policy client_versions_all on public.client_versions
  for all using (true) with check (true);

-- ตรวจหลังรัน
select * from public.client_versions order by updated_at desc;
