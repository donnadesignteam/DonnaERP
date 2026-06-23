-- ตาราง log การสแกน QR อัปเดตสถานะงานผลิต (ออปชัน — ไว้ตรวจย้อนหลังว่าใครสแกนอะไรเมื่อไหร่)
-- ระบบสแกนทำงานได้แม้ไม่มีตารางนี้ (โค้ด insert แบบ best-effort) แต่ถ้าอยากเก็บประวัติให้รันใน Supabase → SQL Editor

create table if not exists production_scans (
  id          bigint generated always as identity primary key,
  order_number text not null,
  stage        text,            -- ตัด / เย็บ / รีด / แพ็ค
  status       text,            -- สถานะที่ตั้งให้ เช่น ตัดผ้าแล้ว
  tech_code    text,            -- รหัสพนักงานที่สแกน เช่น DN003
  tech_name    text,
  scanned_at   timestamptz default now()
);

create index if not exists production_scans_order_idx on production_scans (order_number);

-- ให้ anon (เว็บฝั่ง client) insert ได้ — ปรับตาม policy RLS ของโปรเจกต์
alter table production_scans enable row level security;
create policy "anon insert scans" on production_scans for insert to anon with check (true);
create policy "anon read scans"   on production_scans for select to anon using (true);
