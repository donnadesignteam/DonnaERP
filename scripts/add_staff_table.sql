-- ════════════════════════════════════════════════════════════════════
-- DonnaERP — ตารางพนักงาน staff (ย้ายจาก Google Sheet มาเก็บใน DB, 2026-06-25)
-- หลังรัน: รัน node scripts/migrate_staff_from_sheet.mjs เพื่อ snapshot ข้อมูลจากชีทครั้งเดียว
-- รันผ่าน:  node scripts/run_sql.mjs scripts/add_staff_table.sql   (รันซ้ำได้)
-- ════════════════════════════════════════════════════════════════════

create table if not exists staff (
  code            text primary key,        -- รหัสพนักงาน DNxxx
  name            text,
  nickname        text,
  position        text,
  division        text,                     -- เนื้องาน ธุรการ/ปฏิบัติการ
  active          boolean not null default true,  -- false = ลาออก (ไม่แสดงในรายชื่อ)
  start_date      date,
  sick_avail      numeric, sick_used numeric, sick_left numeric,
  personal_avail  numeric, personal_full numeric, personal_half numeric, personal_left numeric,
  vacation_avail  numeric, vacation_used numeric, vacation_left numeric,
  wop_full        numeric, wop_half numeric, wop_hours numeric,
  late            numeric,
  warning         text,
  note            text,
  updated_at      timestamptz not null default now()
);

alter table staff enable row level security;
drop policy if exists "staff_all" on staff;
create policy "staff_all" on staff for all to anon using (true) with check (true);

-- ════════════════════════════════════════════════════════════════════
