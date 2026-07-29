-- ============================================================================
-- DonnaERP - SQL โครงสร้างทั้งหมด รวมไฟล์เดียว  (อัปเดต 2026-07-29 รอบ 2 — เพิ่ม RPC สแกนงานเคลม)
--
-- วิธีใช้: Supabase -> SQL Editor -> วางทั้งไฟล์ -> Run
-- รันซ้ำได้ทุกเมื่อ ไม่พัง ไม่ทำข้อมูลซ้ำ (ทุกคำสั่งมี IF NOT EXISTS / OR REPLACE / DROP ก่อน CREATE)
-- ไฟล์นี้มีแต่ "โครงสร้าง" (ตาราง/คอลัมน์/ฟังก์ชัน/policy) ไม่มีสคริปต์นำเข้าข้อมูล
--    สคริปต์นำเข้าข้อมูลรันแล้วห้ามรันซ้ำ (ข้อมูลจะเข้าซ้ำ) ดูรายชื่อท้ายไฟล์
--
-- ส่วนที่ 9 ท้ายไฟล์ = ตารางตรวจสอบ รันแล้วต้องขึ้น OK ทุกแถว
-- ============================================================================

-- ==========================================================================
-- 1) ตารางหลัก (สร้างถ้ายังไม่มี)
-- ==========================================================================

-- ----- ที่มา: scripts/create_claims_table.sql -----
-- ตารางงานเคลม (แยกจาก order_entries) — เก็บเคสเคลม/ส่งผิด/ของหาย/แก้ไขขนาด
-- รันใน Supabase SQL editor (เลือก "Run" ได้เลย มี policy ให้ anon ใช้งานครบ)

create table if not exists public.claims (
  id                     uuid primary key default gen_random_uuid(),
  claim_date             date,                         -- วันที่แจ้งเคลม
  channel                text,                         -- ช่องทาง: Shopee/Lazada/Tiktok/Facebook/LineOA/หน้าร้าน
  customer_username      text,                         -- username/ชื่อลูกค้าในแพลตฟอร์ม
  original_order_number  text,                         -- เลขออเดอร์เดิมที่เคลม
  claim_type            text,                          -- ประเภทเคลม (ของขาด/ส่งผิด/เสียหายขนส่ง/ชำรุด/ลูกค้าแจ้งผิด/เปลี่ยนสินค้า/ส่งคืนไม่แจ้ง)
  fault                  text,                         -- ผู้รับผิดชอบ: ร้าน/ลูกค้า/ขนส่ง
  cause                  text,                         -- รายละเอียดสาเหตุ
  resolution             text,                         -- วิธีจัดการ
  items                  jsonb,                        -- รายการที่เคลม (โครงสร้างเดียวกับออเดอร์)
  ship_name              text,                         -- ชื่อผู้รับ (ส่งใหม่)
  ship_address           text,                         -- ที่อยู่จัดส่ง
  ship_phone             text,                         -- เบอร์โทร
  return_tracking        text,                         -- เลขพัสดุที่ลูกค้าส่งคืน
  outbound_tracking      text,                         -- เลขพัสดุที่ร้านส่งใหม่
  courier                text,                         -- ขนส่งที่ใช้ส่งออก
  refund_amount          numeric,                      -- ยอดเงิน (คืน/เก็บ)
  money_direction        text,                         -- 'คืนลูกค้า' | 'เก็บลูกค้า'
  payment_target         text,                         -- พร้อมเพย์/เลขบัญชี
  money_status           text,                         -- 'รอ' | 'โอนแล้ว' | 'ชำระแล้ว'
  status                 text not null default 'รอของคืน', -- สถานะ workflow
  is_urgent              boolean not null default false,   -- เร่งด่วน 🔥
  notes                  text,
  raw_text               text,                         -- ข้อความไลน์ดิบที่ paste มา (อ้างอิงย้อนหลัง)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_claims_status on public.claims(status);
create index if not exists idx_claims_date   on public.claims(claim_date desc);

-- RLS: เปิดไว้ + policy อนุญาต anon/authenticated ใช้งานครบ (เหมือนตารางอื่นที่เว็บเรียกผ่าน anon key)
alter table public.claims enable row level security;
drop policy if exists claims_all on public.claims;
create policy claims_all on public.claims for all to anon, authenticated using (true) with check (true);

-- ----- ที่มา: scripts/add_staff_table.sql -----
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

-- ----- ที่มา: scripts/add_order_status_events.sql -----
-- บันทึกประวัติการเปลี่ยนสถานะออเดอร์ (สำหรับวิเคราะห์เวลาที่ใช้ในแต่ละแผนก)
-- 1 แถว = 1 ครั้งที่ออเดอร์เข้าสถานะใหม่
-- เก็บอัตโนมัติด้วย trigger — ครอบทุกจุดที่แอปอัปเดต order_status

create table if not exists order_status_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references order_entries(id) on delete cascade,
  order_number text,
  status       text not null,
  entered_at   timestamptz not null default now()
);

create index if not exists idx_status_events_order  on order_status_events(order_id);
create index if not exists idx_status_events_status on order_status_events(status, entered_at);

-- ฟังก์ชัน log: insert เมื่อสร้างออเดอร์ใหม่ หรือเมื่อ order_status เปลี่ยนค่า
create or replace function log_order_status_event()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if new.order_status is not null then
      insert into order_status_events(order_id, order_number, status, entered_at)
      values (new.id, new.order_number, new.order_status, coalesce(new.created_at, now()));
    end if;
  elsif (tg_op = 'UPDATE') then
    if new.order_status is distinct from old.order_status and new.order_status is not null then
      insert into order_status_events(order_id, order_number, status, entered_at)
      values (new.id, new.order_number, new.order_status, now());
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_log_order_status on order_entries;
create trigger trg_log_order_status
  after insert or update of order_status on order_entries
  for each row execute function log_order_status_event();

-- (ทางเลือก) seed สถานะปัจจุบันของออเดอร์ที่มีอยู่แล้ว เป็นจุดเริ่มต้น
-- ใช้ updated_at เป็นเวลาโดยประมาณที่เข้าสถานะปัจจุบัน (ไม่แม่นย้อนหลัง แต่ได้ baseline)
-- เอา comment ออกถ้าต้องการ seed:
-- insert into order_status_events(order_id, order_number, status, entered_at)
-- select id, order_number, order_status, coalesce(updated_at, created_at, now())
-- from order_entries
-- where order_status is not null;

-- ----- ที่มา: scripts/add_activity_logs.sql -----
-- ════════════════════════════════════════════════════════════════════
-- DonnaERP — Activity Log ทั้งร้าน (2026-06-25)
-- เก็บประวัติ เพิ่ม/แก้ไข/ลบ ของทุกหมวด ไม่ว่าจะมาจากเว็บแอดมิน, สแกน QR
-- หรือ DonnaBot (Railway) — เพราะดักที่ชั้น DB ด้วย trigger ไม่ใช่ที่โค้ดเว็บ
-- รันใน Supabase → SQL Editor → กด Run  (รันซ้ำได้ ไม่พัง)
-- ════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- 0) ถ้ามีตาราง activity_logs เก่า (schema ไม่ตรง — ไม่มีคอลัมน์ category) ให้ดรอปทิ้ง
--    (ตารางเก่าจากฟีเจอร์ที่เคยลบไป ว่างเปล่าอยู่แล้ว ปลอดภัย)
-- ───────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'activity_logs')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'activity_logs'
                and column_name = 'category') then
    drop table activity_logs cascade;
  end if;
end $$;

-- ───────────────────────────────────────────────
-- 1) ตารางเก็บประวัติ
-- ───────────────────────────────────────────────
create table if not exists activity_logs (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,           -- ชื่อตารางจริง เช่น order_entries
  category    text not null,           -- หมวดภาษาไทย เช่น ออเดอร์
  action      text not null check (action in ('insert','update','delete')),
  row_id      text,                    -- id ของแถวที่ถูกแก้
  label       text,                    -- ป้ายอ่านง่าย เช่น เลขออเดอร์/ชื่อลูกค้า
  changes     jsonb,                   -- เฉพาะ update: { field: {from, to} }
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_created  on activity_logs(created_at desc);
create index if not exists idx_activity_category on activity_logs(category, created_at desc);

alter table activity_logs enable row level security;
-- อ่านได้ผ่าน anon (หน้าเว็บอยู่หลัง login อยู่แล้ว) — เขียนได้เฉพาะผ่าน trigger
drop policy if exists "anon read activity" on activity_logs;
create policy "anon read activity" on activity_logs for select to anon using (true);

-- ───────────────────────────────────────────────
-- 2) ฟังก์ชัน log กลาง — ใช้ร่วมทุกตาราง (generic ด้วย to_jsonb)
--    SECURITY DEFINER เพื่อให้ trigger เขียน activity_logs ได้แม้ผู้เรียกเป็น anon
-- ───────────────────────────────────────────────
create or replace function log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec   jsonb;
  oldj  jsonb;
  newj  jsonb;
  cat   text;
  lbl   text;
  diff  jsonb;
  cmap  jsonb := '{"order_entries":"ออเดอร์","claims":"เคลม","installations":"งานติดตั้ง","purchase_orders":"สั่งซื้อ","stock":"สต็อก","leave_requests":"ใบลา","production_scans":"สแกนผลิต","suppliers":"ผู้จัดจำหน่าย"}'::jsonb;
begin
  cat := coalesce(cmap ->> tg_table_name, tg_table_name);

  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;

  -- ป้ายอ่านง่าย: ไล่หาคอลัมน์ที่น่าจะสื่อความหมายที่สุด
  lbl := coalesce(
    rec->>'order_number', rec->>'original_order_number',
    rec->>'customer_name', rec->>'customer_username',
    rec->>'color_name', rec->>'fabric_name', rec->>'fabric_code',
    rec->>'supplier', rec->>'serial', rec->>'tech_name', rec->>'name'
  );

  if tg_op = 'UPDATE' then
    oldj := to_jsonb(old);
    newj := to_jsonb(new);
    select jsonb_object_agg(key, jsonb_build_object('from', oldj->key, 'to', newj->key))
      into diff
      from jsonb_object_keys(newj) as k(key)
     where (newj->key) is distinct from (oldj->key)
       and key not in ('updated_at','created_at');
    -- เปลี่ยนแค่ updated_at (ไม่มีอะไรจริง) → ไม่ต้องบันทึก
    if diff is null then
      return new;
    end if;
    insert into activity_logs(table_name, category, action, row_id, label, changes)
    values (tg_table_name, cat, 'update', rec->>'id', lbl, diff);
    return new;

  elsif tg_op = 'INSERT' then
    insert into activity_logs(table_name, category, action, row_id, label, changes)
    values (tg_table_name, cat, 'insert', rec->>'id', lbl, null);
    return new;

  else  -- DELETE
    insert into activity_logs(table_name, category, action, row_id, label, changes)
    values (tg_table_name, cat, 'delete', rec->>'id', lbl, null);
    return old;
  end if;
end;
$$;

-- ───────────────────────────────────────────────
-- 3) แปะ trigger ทุกตารางหลัก (drop ก่อน create กันชนถ้าเคยรันแล้ว)
-- ───────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'order_entries', 'claims', 'installations', 'purchase_orders',
    'stock', 'leave_requests', 'production_scans', 'suppliers'
  ];
begin
  foreach t in array tables loop
    -- ข้ามตารางที่ยังไม่มีในฐานข้อมูล (กันพังถ้าตารางไหนยังไม่ถูกสร้าง)
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists trg_activity on public.%I;', t);
      execute format(
        'create trigger trg_activity after insert or update or delete on public.%I
           for each row execute function log_activity();', t);
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- เสร็จ — ต่อจากนี้ทุกการเพิ่ม/แก้/ลบ จะถูกบันทึกใน activity_logs อัตโนมัติ
-- ดูได้ที่ หน้า "ตั้งค่า" → ประวัติการแก้ไข
-- ════════════════════════════════════════════════════════════════════

-- ==========================================================================
-- 2) คอลัมน์ตารางออเดอร์ (order_entries)
-- ==========================================================================

-- ----- ที่มา: scripts/add_price_column.sql -----
-- เพิ่ม price column ใน order_entries
ALTER TABLE order_entries
  ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT NULL;

-- ----- ที่มา: scripts/add_dropoff_column.sql -----
ALTER TABLE order_entries
  ADD COLUMN IF NOT EXISTS is_dropoff BOOLEAN NOT NULL DEFAULT FALSE;

-- ----- ที่มา: scripts/add_outside_columns.sql -----
-- เพิ่มคอลัมน์สำหรับ งานนอก / งานติดตั้ง
ALTER TABLE order_entries
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'ยังไม่ชำระ',
  ADD COLUMN IF NOT EXISTS deposit NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS order_assigned TEXT DEFAULT 'รออัพเดท';

-- ----- ที่มา: scripts/add_printed_at_column.sql -----
-- เพิ่มคอลัมน์ printed_at เก็บวันเวลาที่ปริ้นใบออเดอร์ล่าสุด (โชว์สีเหลืองข้างปุ่มปริ้นในเมนู ···)
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม รันใน Supabase SQL Editor ได้เลย
ALTER TABLE order_entries ADD COLUMN IF NOT EXISTS printed_at timestamptz;

-- ----- ที่มา: scripts/add_shipped_at_column.sql -----
-- เพิ่มคอลัมน์ shipped_at เก็บวันเวลาที่ติ๊ก "จัดส่งแล้ว"
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม รันใน Supabase SQL Editor ได้เลย
ALTER TABLE order_entries ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

-- ----- ที่มา: migrations/add_done_at.sql -----
-- เพิ่มคอลัมน์เวลาที่ติ๊ก "งานเสร็จ" (รันใน Supabase SQL editor)
alter table order_entries
  add column if not exists done_at timestamptz;

-- ----- ที่มา: migrations/add_rail_packed.sql -----
-- เพิ่มคอลัมน์สถานะแพ็คราง ในตารางออเดอร์ (รันใน Supabase SQL editor)
alter table order_entries
  add column if not exists rail_packed boolean not null default false,
  add column if not exists rail_packed_at timestamptz;

-- ----- ที่มา: sql/add_status_history.sql -----
-- เพิ่มคอลัมน์เก็บประวัติสถานะของแต่ละออเดอร์
-- โครงสร้าง: array ของ { status, at (เวลา ISO), by (ใครทำ — null ไว้ก่อน รอใช้ตัวสแกนเดือนหน้า) }
-- รันใน Supabase → SQL Editor

alter table public.order_entries
  add column if not exists status_history jsonb not null default '[]'::jsonb;

-- ----- ที่มา: sql/add_packing_photos.sql -----
-- (อนาคต) เก็บภาพตอนแพ็คราง/แพ็คม่านของแต่ละออเดอร์
-- โครงสร้าง: array ของ URL รูป (อัปโหลดเข้า Supabase Storage แล้วเก็บลิงก์)
-- รันเมื่อพร้อมเริ่มเก็บภาพจริง — รันใน Supabase → SQL Editor
--
-- หลังรันแล้ว แจ้งให้เพิ่ม 'packing_photos' เข้า .select() ในหน้า customers
-- และทำปุ่มอัปโหลด (แนวเดียวกับ medical-certs bucket ในหน้า employees)

alter table public.order_entries
  add column if not exists packing_photos jsonb not null default '[]'::jsonb;

-- ----- ที่มา: sql/add_shipments.sql -----
-- เพิ่มคอลัมน์เก็บเลขพัสดุ + สถานะขนส่งของแต่ละออเดอร์
-- โครงสร้าง: array ของ { no (เลขพัสดุ), carrier (เจ้าขนส่ง), status (สถานะล่าสุด),
--                        events (timeline [{time, desc}]), checked_at (เช็คล่าสุดเมื่อไหร่) }
-- รันใน Supabase → SQL Editor

alter table public.order_entries
  add column if not exists shipments jsonb;

-- ----- ที่มา: scripts/add_outsource_column.sql -----
-- เพิ่มคอลัมน์ "สั่งนอก" ในตารางออเดอร์
-- รันใน Supabase Dashboard → SQL Editor

alter table order_entries add column if not exists outsource text;

-- ----- ที่มา: scripts/add_order_table_columns.sql -----
-- คอลัมน์ใหม่ในตารางออเดอร์ (7 ก.ค. 2026)
-- outsource_at  = วันเวลาที่พิมพ์ช่อง "สั่งนอก" (โชว์ใต้ข้อความในตาราง)
-- address       = ที่อยู่ (งานนอก/งานติดตั้ง) และ "ที่อยู่จัดส่งแยก" (งานแพลตฟอร์ม)
-- install_status = สถานะติดตั้ง: ติดตั้งแล้ว / ติดตั้ง50%
-- รันใน Supabase Dashboard → SQL Editor

alter table order_entries add column if not exists outsource_at timestamptz;
alter table order_entries add column if not exists address text;
alter table order_entries add column if not exists install_status text;

-- ----- ที่มา: scripts/add_order_install_onsite_columns.sql -----
-- เพิ่มช่องข้อมูลหน้างานให้ฟอร์มออเดอร์ติดตั้ง (order_entries)
-- เพื่อ sync ขึ้นการ์ดปฏิทินงานติดตั้งให้ครบ: เวลานัด/จังหวัด/เบอร์/ลิงก์โลเคชั่น
-- รันใน Supabase SQL Editor

alter table public.order_entries
  add column if not exists install_time   text,
  add column if not exists province       text,
  add column if not exists phone          text,
  add column if not exists location_link  text;

-- ==========================================================================
-- 3) คอลัมน์งานเคลม (claims)
-- ==========================================================================

-- ----- ที่มา: sql/add_claims_admin.sql -----
-- งานเคลม: คอลัมน์ "แอดมินที่รับผิดชอบ" — โชว์ใน dashboard พนักงานรายคนด้วย
-- รันใน Supabase SQL Editor ครั้งเดียว

alter table claims add column if not exists admin_name text;

-- ----- ที่มา: sql/add_claims_closed.sql -----
-- คอลัมน์ปิดงานเคลม: ใครปิด + ปิดเมื่อไหร่ (รันใน Supabase SQL Editor)
alter table claims
  add column if not exists closed_by text,
  add column if not exists closed_at timestamptz;

-- ----- ที่มา: scripts/add_claims_shipping_cost_columns.sql -----
-- งานเคลม: เพิ่มคอลัมน์ปริ้น/จัดส่ง/ค่าใช้จ่าย ให้ทำงานได้เหมือนหมวดออเดอร์
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม — รันใน Supabase SQL Editor ได้เลย

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS printed_at        timestamptz,   -- วันเวลาที่ปริ้นใบเคลมล่าสุด (โชว์สีเหลืองข้างปุ่มปริ้นในเมนู ···)
  ADD COLUMN IF NOT EXISTS shipped_at        timestamptz,   -- วันเวลาที่ติ๊กจัดส่งแล้ว
  ADD COLUMN IF NOT EXISTS shipments         jsonb,         -- เลขพัสดุที่ส่งออก [{ no, carrier }] — โครงเดียวกับ order_entries.shipments
  ADD COLUMN IF NOT EXISTS ship_back_cost    numeric,       -- ค่าส่งกลับ
  ADD COLUMN IF NOT EXISTS ship_return_cost  numeric,       -- ค่าส่งคืน
  ADD COLUMN IF NOT EXISTS estimated_price   numeric;       -- ราคาประเมิน

-- ==========================================================================
-- 4) คอลัมน์งานติดตั้ง (installations) — รวมคอลัมน์รูปหน้างานตัวล่าสุด
-- ==========================================================================

-- ----- ที่มา: scripts/add_install_zone_column.sql -----
-- เพิ่มคอลัมน์ install_zone เก็บโซนติดตั้ง (เชียงราย/เชียงใหม่/กทม) ในตาราง installations
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม รันใน Supabase SQL Editor ได้เลย
ALTER TABLE installations ADD COLUMN IF NOT EXISTS install_zone text;

-- ----- ที่มา: scripts/add_installations_updated_at.sql -----
-- เพิ่มคอลัมน์ updated_at ให้ตาราง installations (สำหรับคอลัมน์ "แก้ไขล่าสุด" ในเว็บ)
-- รันใน Supabase SQL Editor

alter table public.installations
  add column if not exists updated_at timestamptz default now();

-- เซ็ตค่าเริ่มต้นให้แถวเดิม = วันที่สร้าง (ถ้ายังว่าง)
update public.installations
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- ----- ที่มา: scripts/add_installation_source_order.sql -----
-- ผูกออเดอร์ติดตั้ง (order_entries.is_installation) เข้ากับปฏิทินงานติดตั้ง (installations)
-- เพิ่มคอลัมน์ source_order_id ให้ installations: ออเดอร์ 1 แถว = ปฏิทิน 1 แถว
-- ON DELETE CASCADE → ลบออเดอร์แล้วแถวในปฏิทินหายตาม
-- รันใน Supabase SQL Editor

alter table public.installations
  add column if not exists source_order_id uuid unique
    references public.order_entries(id) on delete cascade;

-- ดัชนีช่วย upsert/lookup ตอน sync
create index if not exists installations_source_order_id_idx
  on public.installations (source_order_id);

-- Backfill: ดึงออเดอร์ติดตั้งที่มีอยู่เดิมขึ้นปฏิทินด้วย (ข้ามตัวที่ sync แล้ว)
-- ตัวที่ยังไม่มี installation_date จะ appointment_datetime = null → โชว์เฉพาะในรายการ ยังไม่ขึ้นปฏิทิน
insert into public.installations
  (source_order_id, serial_no, appointment_datetime, work_type, platform,
   customer_id, customer_real_name, province, phone, work_details, location_link,
   price, notes, payment_status, appointment_status, production_status,
   send_to_technician, installation_status, entered_by, updated_at)
select oe.id, coalesce(oe.order_number, ''),
       -- "กำหนดติดตั้ง" ในฟอร์มเก็บที่ deadline เป็นหลัก (installation_date มักว่าง)
       case when coalesce(oe.installation_date, oe.deadline) is not null
            then (coalesce(oe.installation_date, oe.deadline)::text || 'T09:00:00+07:00')::timestamptz end,
       'งานติดตั้ง', coalesce(oe.platform, ''),
       coalesce(oe.customer_name, ''), coalesce(oe.customer_name, ''),
       '', '', '', '',
       coalesce(oe.price, 0), coalesce(oe.notes, ''),
       coalesce(oe.payment_status, 'รอมัดจำ'), 'นัดหมายแล้ว', 'กำลังผลิต',
       'หน้าร้าน', 'ติดตั้ง', coalesce(oe.admin_name, ''), now()
from public.order_entries oe
where oe.is_installation = true
  and not exists (select 1 from public.installations i where i.source_order_id = oe.id);

-- ซ่อมแถวที่ sync ไปก่อนหน้านี้แต่วันนัดยังว่าง (เพราะเคยอ่านจาก installation_date) → เติมจาก deadline
update public.installations i
set appointment_datetime = (coalesce(oe.installation_date, oe.deadline)::text || 'T09:00:00+07:00')::timestamptz
from public.order_entries oe
where i.source_order_id = oe.id
  and i.appointment_datetime is null
  and coalesce(oe.installation_date, oe.deadline) is not null;

-- ----- ที่มา: migrations/add_installation_photos.sql -----
-- รูปหน้างานของรายการติดตั้ง (โมดัล "+ เพิ่มรายการติดตั้ง" / "แก้ไขรายการ" หน้า /installations)
-- เก็บเป็น array ของ { "url": "...", "caption": "..." } — ไฟล์จริงอยู่บน Cloudflare R2 โฟลเดอร์ installations/
-- ‼️ ต้องรันก่อนใช้งานปุ่ม "+ เพิ่มรูป" (ยังไม่รัน = เพิ่ม/แก้รายการได้ตามปกติ แต่พอกดบันทึกรายการที่มีรูปจะขึ้น error)
alter table installations
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- ==========================================================================
-- 5) คอลัมน์สต็อกผ้า (stock)
-- ==========================================================================

-- ----- ที่มา: scripts/add_fabric_columns.sql -----
ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS fabric_width numeric,
  ADD COLUMN IF NOT EXISTS fabric_type text,
  ADD COLUMN IF NOT EXISTS shop_name text;

-- ----- ที่มา: scripts/add_notes_column.sql -----
ALTER TABLE stock ADD COLUMN IF NOT EXISTS notes text;

-- ----- ที่มา: scripts/add_ordered_at_column.sql -----
ALTER TABLE stock ADD COLUMN IF NOT EXISTS ordered_at timestamptz;

-- ----- ที่มา: scripts/add_sort_order_column.sql -----
ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- ----- ที่มา: scripts/add_stock_count_columns.sql -----
ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS unused_rolls integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_use_rolls integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ปกติ';

-- ----- ที่มา: scripts/add_remaining_meters_column.sql -----
ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS remaining_meters numeric;

-- ==========================================================================
-- 6) ใบลา + สั่งซื้อ
-- ==========================================================================

-- ----- ที่มา: scripts/add_medical_cert.sql -----
-- ════════════════════════════════════════════════════════════════════
-- DonnaERP — ใบรับรองแพทย์สำหรับการลาป่วย (2026-06-25)
-- เพิ่มคอลัมน์เก็บลิงก์รูป + bucket เก็บไฟล์ใน Supabase Storage
-- รันผ่าน:  node scripts/run_sql.mjs scripts/add_medical_cert.sql
-- (รันซ้ำได้ ไม่พัง)
-- ════════════════════════════════════════════════════════════════════

-- 1) คอลัมน์เก็บลิงก์รูปใบรับรองแพทย์ (null = ยังไม่แนบ)
alter table leave_requests
  add column if not exists medical_cert_url text;

-- 2) bucket เก็บรูป (public read — เว็บอยู่หลัง login อยู่แล้ว)
insert into storage.buckets (id, name, public)
values ('medical-certs', 'medical-certs', true)
on conflict (id) do update set public = true;

-- 3) policy ให้ anon อัปโหลด/อ่าน/แก้ ไฟล์ใน bucket นี้ (เขียนผ่านเว็บที่ login แล้ว)
drop policy if exists "medcert anon read"   on storage.objects;
drop policy if exists "medcert anon insert" on storage.objects;
drop policy if exists "medcert anon update" on storage.objects;
create policy "medcert anon read"   on storage.objects for select to anon using (bucket_id = 'medical-certs');
create policy "medcert anon insert" on storage.objects for insert to anon with check (bucket_id = 'medical-certs');
create policy "medcert anon update" on storage.objects for update to anon using (bucket_id = 'medical-certs');

-- ════════════════════════════════════════════════════════════════════
-- เสร็จ — ฟอร์มลาป่วยแนบใบรับรองแพทย์ได้ (ไม่บังคับ แนบทีหลังได้)
-- ════════════════════════════════════════════════════════════════════

-- ----- ที่มา: scripts/add_purchase_orders_updated_at.sql -----
-- เพิ่มคอลัมน์ updated_at ให้ตาราง purchase_orders (สำหรับคอลัมน์ "แก้ไขล่าสุด" ในเว็บ)
-- รันใน Supabase SQL Editor

alter table public.purchase_orders
  add column if not exists updated_at timestamptz default now();

update public.purchase_orders
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- ----- ที่มา: sql/add_po_source_order.sql -----
-- สั่งนอกในหมวดออเดอร์ → sync ไปหมวดสั่งซื้ออัตโนมัติ
-- เพิ่มคอลัมน์ผูกรายการสั่งซื้อกับออเดอร์ต้นทาง (กันสร้างซ้ำเวลาแก้ข้อความสั่งนอก)
-- รันใน Supabase SQL Editor ครั้งเดียว

alter table purchase_orders
  add column if not exists source_order_id uuid references order_entries(id) on delete set null;

create index if not exists idx_po_source_order on purchase_orders(source_order_id);

-- ==========================================================================
-- 7) ที่เก็บรูป (Storage bucket + policy)
-- ==========================================================================

-- ----- ที่มา: scripts/add_packing_photos.sql -----
-- รูปถ่ายจากช่าง (ราง/แพ็คแล้ว/ม่านรีด) — เก็บเป็น array ของ URL
ALTER TABLE order_entries
  ADD COLUMN IF NOT EXISTS packing_photos JSONB;

-- bucket เก็บรูป (public อ่านได้ผ่าน URL ตรง)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('packing-photos', 'packing-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- อนุญาตให้หน้า scan (anon key) อัพโหลด + ทุกคนอ่านได้
DROP POLICY IF EXISTS "packing photos read" ON storage.objects;
CREATE POLICY "packing photos read" ON storage.objects
  FOR SELECT USING (bucket_id = 'packing-photos');

DROP POLICY IF EXISTS "packing photos upload" ON storage.objects;
CREATE POLICY "packing photos upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'packing-photos');

-- ==========================================================================
-- 8) ฟังก์ชันสแกน QR (RPC) — เวอร์ชันล่าสุดที่รองรับ 'ลงชื่อช่วยทำ'
-- ==========================================================================

-- ----- ที่มา: sql/scan_helpers.sql -----
-- ช่วยกันทำออเดอร์เดียวกัน (หลายคนใน 1 ขั้น) — ตัด/เย็บ/รีด/แพ็ค บางออเดอร์แบ่งกันทำ 2-3 คน
-- เดิม: คนแรกสแกนได้ คนที่สองสแกนแล้วขึ้น "ไม่อัปเดต (กันข้ามขั้น)" แล้วจบ → ชื่อคนที่ 2 ไม่ถูกบันทึกที่ไหนเลย
-- ใหม่: คนที่สองสแกนซ้ำ → เว็บถามว่า "ออเดอร์นี้สแกนไปแล้วโดย X ต้องการลงชื่อเพิ่มไหม"
--       กดยืนยัน → เรียก scan_join บันทึกว่าช่วยทำขั้นนี้ (ไม่เปลี่ยนสถานะออเดอร์ ไม่เดินขั้น)
--
-- ‼️ รันไฟล์นี้ใน Supabase → SQL Editor "ก่อน" deploy โค้ดหน้า /scan ใหม่ (ก๊อปจากไฟล์ ไม่ใช่จากแชท)
-- ไฟล์นี้ทำ 4 อย่าง: เพิ่มคอลัมน์ is_helper → สร้าง scan_join → แก้ scan_advance → แก้ scan_undo

-- ===== 1) คอลัมน์แยกว่าแถวสแกนนั้นเป็น "คนช่วย" หรือ "คนที่เดินสถานะ" =====
alter table production_scans add column if not exists is_helper boolean not null default false;

-- ===== 2) RPC ลงชื่อช่วยทำ =====
create or replace function public.scan_join(
  p_order_id     uuid,
  p_stage_key    text,   -- cut | sew | iron | pack | rail_pack | shipped
  p_tech_code    text,
  p_tech_name    text,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label   text;
  v_status  text;
  o         record;
  v_now     timestamptz := now();
  v_iso     text;
  v_scan_no text;
  v_hist    jsonb;
  v_people  jsonb;
begin
  -- stage map — ต้องตรงกับ scan_advance / lib/staff.ts (แก้ที่ไหนแก้ให้ครบทุกที่)
  select m.l, m.s into v_label, v_status from (values
    ('cut','ตัด','ตัดผ้าแล้ว'),
    ('sew','เย็บ','เย็บแล้ว'),
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
    ('rail_pack','แพ็คราง','แพ็คราง'),
    ('shipped','จัดส่งแล้ว','จัดส่งแล้ว')
  ) as m(k, l, s) where m.k = p_stage_key;
  if v_status is null then
    return jsonb_build_object('ok', false, 'result', 'bad_stage');
  end if;

  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  -- คนเดิมกดซ้ำ (สแกนซ้ำเครื่องเดียวกัน) → ไม่ต้องบันทึกเพิ่ม กันนับผลงานซ้ำในหน้าวิเคราะห์ข้อมูล
  if exists (
    select 1 from production_scans
     where order_number = v_scan_no and stage = v_label and tech_code = p_tech_code
  ) then
    return jsonb_build_object('ok', false, 'result', 'dup_self', 'stage', v_label);
  end if;

  -- ‼️ ไม่แตะ order_status / work_status — คนช่วยไม่ได้เดินสถานะ แค่บันทึกว่าร่วมทำขั้นนี้
  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at, is_helper)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now, true);

  -- ต่อประวัติสถานะ: เขียนเป็นรายการ "ช่วยทำ" (helper = true) เพื่อให้โฟลเดอร์ลูกค้า/ประวัติเห็นว่ามีใครช่วย
  v_hist := coalesce(o.status_history, '[]'::jsonb);
  if jsonb_typeof(v_hist) <> 'array' then v_hist := '[]'::jsonb; end if;
  update order_entries
     set status_history = v_hist || jsonb_build_object(
           'status', v_status, 'at', v_iso, 'by', p_tech_name, 'helper', true),
         updated_at = v_now
   where id = o.id;

  -- รายชื่อทุกคนที่ทำขั้นนี้ (คนเดินสถานะ + คนช่วย) เรียงตามเวลาสแกน
  select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
    from production_scans t where t.order_number = v_scan_no and t.stage = v_label;

  return jsonb_build_object('ok', true, 'result', 'joined',
    'stage', v_label, 'status', v_status, 'at', v_iso, 'people', v_people);
end;
$$;

grant execute on function public.scan_join(uuid, text, text, text, text) to anon, authenticated;

-- ===== 3) scan_advance: ตอนตอบ 'already' ให้บอกด้วยว่าขั้นนี้ใครสแกนไปแล้วบ้าง =====
-- (เหมือนเดิมทุกอย่าง เปลี่ยนเฉพาะก้อน return ของ 'already')
create or replace function public.scan_advance(
  p_order_id     uuid,
  p_stage_key    text,
  p_tech_code    text,
  p_tech_name    text,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
  v_label  text;
  v_status text;
  o        record;
  v_now    timestamptz := now();
  v_iso    text;
  v_scan_no text;
  v_hist   jsonb;
  v_people jsonb;
begin
  select m.l, m.s into v_label, v_status from (values
    ('cut','ตัด','ตัดผ้าแล้ว'),
    ('sew','เย็บ','เย็บแล้ว'),
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
    ('rail_pack','แพ็คราง','แพ็คราง'),
    ('shipped','จัดส่งแล้ว','จัดส่งแล้ว')
  ) as m(k, l, s) where m.k = p_stage_key;
  if v_status is null then
    return jsonb_build_object('ok', false, 'result', 'bad_stage');
  end if;

  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  if p_stage_key = 'rail_pack' then
    update order_entries set rail_packed = true, rail_packed_at = v_now, updated_at = v_now where id = o.id;
    insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
      values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);
    return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
  end if;

  if p_stage_key = 'shipped' then
    update order_entries
      set order_status = v_status, shipped_at = v_now, is_urgent = true, updated_at = v_now
      where id = o.id;
  else
    -- ด่านกันข้ามขั้น: เดินหน้าได้อย่างเดียว
    if coalesce(array_position(flow, o.order_status), 0) >= array_position(flow, v_status) then
      -- บอกกลับไปด้วยว่าขั้นของคนที่สแกนนี้ มีใครสแกนไปแล้วบ้าง → หน้าเว็บถามต่อว่าจะลงชื่อช่วยไหม
      select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
        from production_scans t where t.order_number = v_scan_no and t.stage = v_label;
      return jsonb_build_object('ok', false, 'result', 'already',
        'current_status', coalesce(nullif(o.order_status, ''), 'รอดำเนินการ'),
        'stage', v_label,
        'people', v_people,
        'mine', exists (
          select 1 from production_scans t
           where t.order_number = v_scan_no and t.stage = v_label and t.tech_code = p_tech_code));
    end if;
    update order_entries set order_status = v_status, updated_at = v_now where id = o.id;
  end if;

  update work_status set status = v_status, status_updated_at = v_now
    where lower(order_number) = lower(coalesce(nullif(o.order_number, ''), '~ไม่มี~'))
       or lower(order_number) = lower(coalesce(nullif(o.customer_name, ''), '~ไม่มี~'));

  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);

  v_hist := coalesce(o.status_history, '[]'::jsonb);
  if jsonb_typeof(v_hist) <> 'array' then v_hist := '[]'::jsonb; end if;
  if (v_hist -> -1 ->> 'status') is distinct from v_status then
    update order_entries
      set status_history = v_hist || jsonb_build_object('status', v_status, 'at', v_iso, 'by', p_tech_name)
      where id = o.id;
  end if;

  return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
end;
$$;

grant execute on function public.scan_advance(uuid, text, text, text, text) to anon, authenticated;

-- ===== 4) scan_undo: ถ้าแถวล่าสุดเป็น "คนช่วย" ให้ลบแค่แถวนั้น ห้ามถอยสถานะ =====
-- (ไม่งั้นคนช่วยกดยกเลิก แล้วสถานะออเดอร์ถอยหลังทั้งที่ขั้นนั้นทำเสร็จจริง)
create or replace function public.scan_undo(
  p_order_id     uuid,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
  o          record;
  v_now      timestamptz := now();
  v_scan_no  text;
  v_stage    text;
  v_helper   boolean;
  v_ctid     tid;
  v_idx      int;
  v_prev     text;
  v_hist     jsonb;
begin
  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  select stage, is_helper, ctid into v_stage, v_helper, v_ctid
    from production_scans where order_number = v_scan_no
    order by scanned_at desc limit 1;
  if v_stage is null then
    return jsonb_build_object('ok', false, 'result', 'no_scan');
  end if;

  if v_helper then
    -- ยกเลิกการ "ลงชื่อช่วย" — ลบแถว log + ตัดรายการ helper ท้ายสุดออกจากประวัติ สถานะออเดอร์คงเดิม
    v_hist := coalesce(o.status_history, '[]'::jsonb);
    if jsonb_typeof(v_hist) = 'array' and jsonb_array_length(v_hist) > 0
       and (v_hist -> -1 ->> 'helper') = 'true' then
      update order_entries set status_history = v_hist - (jsonb_array_length(v_hist) - 1) where id = o.id;
    end if;
    delete from production_scans where ctid = v_ctid;
    return jsonb_build_object('ok', true, 'result', 'undone', 'status', o.order_status, 'helper', true);
  end if;

  if v_stage = 'แพ็คราง' then
    update order_entries set rail_packed = false, rail_packed_at = null, updated_at = v_now where id = o.id;
    v_prev := o.order_status;
  else
    v_idx := array_position(flow, o.order_status);
    if v_idx is null or v_idx <= 1 then
      v_prev := 'รอดำเนินการ';
    else
      v_prev := flow[v_idx - 1];
    end if;

    if o.order_status = 'จัดส่งแล้ว' then
      update order_entries set order_status = v_prev, shipped_at = null, updated_at = v_now where id = o.id;
    else
      update order_entries set order_status = v_prev, updated_at = v_now where id = o.id;
    end if;

    update work_status set status = v_prev, status_updated_at = v_now
      where lower(order_number) = lower(coalesce(nullif(o.order_number, ''), '~ไม่มี~'))
         or lower(order_number) = lower(coalesce(nullif(o.customer_name, ''), '~ไม่มี~'));

    v_hist := coalesce(o.status_history, '[]'::jsonb);
    if jsonb_typeof(v_hist) = 'array' and jsonb_array_length(v_hist) > 0 then
      update order_entries set status_history = v_hist - (jsonb_array_length(v_hist) - 1) where id = o.id;
    end if;
  end if;

  delete from production_scans where ctid = v_ctid;

  return jsonb_build_object('ok', true, 'result', 'undone', 'status', v_prev);
end;
$$;

grant execute on function public.scan_undo(uuid, text) to anon, authenticated;

-- ----- ที่มา: sql/claim_scan.sql -----
-- ════════════════════════════════════════════════════════════════════════════
-- สแกน QR ใบเคลม → เดินสถานะงานเคลม (2026-07-29)
-- คู่กับ sql/scan_helpers.sql ของหมวดออเดอร์ แต่ทำงานกับตาราง claims แทน order_entries
--
-- ‼️ รันไฟล์นี้ใน Supabase → SQL Editor "ก่อน" ใช้ QR บนใบเคลม (รันซ้ำได้ ไม่พัง)
--
-- สายงานเคลม: รอของคืน → ตัดผ้าแล้ว → เย็บแล้ว → รีดแล้ว → แพ็คแล้ว → ส่งแล้ว
--   (ชุดเดียวกับ WORKFLOW ใน components/ClaimsWorkspace.tsx — แก้ที่ไหนต้องแก้ให้ตรงกัน)
--
-- การบันทึกผลงาน: ลง production_scans เหมือนออเดอร์ปกติ แต่ order_number = 'claim:<uuid>'
--   → นับผลงานช่าง/หน้าวิเคราะห์ได้เหมือนกัน และไม่ชนกับเลขออเดอร์จริง
-- ════════════════════════════════════════════════════════════════════════════

-- ===== 1) เดินสถานะงานเคลม =====
create or replace function public.claim_scan_advance(
  p_claim_id  uuid,
  p_stage_key text,   -- cut | sew | iron | pack | shipped
  p_tech_code text,
  p_tech_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอของคืน','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','ส่งแล้ว'];
  v_label   text;
  v_status  text;
  c         record;
  v_now     timestamptz := now();
  v_iso     text;
  v_scan_no text;
  v_people  jsonb;
begin
  select m.l, m.s into v_label, v_status from (values
    ('cut','ตัด','ตัดผ้าแล้ว'),
    ('sew','เย็บ','เย็บแล้ว'),
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
    ('shipped','จัดส่งแล้ว','ส่งแล้ว')
  ) as m(k, l, s) where m.k = p_stage_key;
  if v_status is null then
    -- แผนกที่ไม่มีในสายงานเคลม (เช่น แพ็คราง) — บอกกลับไปให้หน้าเว็บแจ้งช่าง
    return jsonb_build_object('ok', false, 'result', 'bad_stage');
  end if;

  select * into c from claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := 'claim:' || c.id::text;

  -- ด่านกันข้ามขั้น: เดินหน้าได้อย่างเดียว (ยกเว้น 'ส่งแล้ว' ที่กดปิดท้ายได้เสมอ)
  if p_stage_key <> 'shipped'
     and coalesce(array_position(flow, c.status), 0) >= array_position(flow, v_status) then
    select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
      from production_scans t where t.order_number = v_scan_no and t.stage = v_label;
    return jsonb_build_object('ok', false, 'result', 'already',
      'current_status', coalesce(nullif(c.status, ''), 'รอของคืน'),
      'stage', v_label,
      'people', v_people,
      'mine', exists (
        select 1 from production_scans t
         where t.order_number = v_scan_no and t.stage = v_label and t.tech_code = p_tech_code));
  end if;

  if p_stage_key = 'shipped' then
    update claims set status = v_status, shipped_at = v_now, updated_at = v_now where id = c.id;
  else
    update claims set status = v_status, updated_at = v_now where id = c.id;
  end if;

  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);

  return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
end;
$$;

grant execute on function public.claim_scan_advance(uuid, text, text, text) to anon, authenticated;


-- ===== 2) ลงชื่อช่วยทำขั้นนี้ (ไม่เดินสถานะ) =====
create or replace function public.claim_scan_join(
  p_claim_id  uuid,
  p_stage_key text,
  p_tech_code text,
  p_tech_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label   text;
  v_status  text;
  c         record;
  v_now     timestamptz := now();
  v_iso     text;
  v_scan_no text;
  v_people  jsonb;
begin
  select m.l, m.s into v_label, v_status from (values
    ('cut','ตัด','ตัดผ้าแล้ว'),
    ('sew','เย็บ','เย็บแล้ว'),
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
    ('shipped','จัดส่งแล้ว','ส่งแล้ว')
  ) as m(k, l, s) where m.k = p_stage_key;
  if v_status is null then
    return jsonb_build_object('ok', false, 'result', 'bad_stage');
  end if;

  select * into c from claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := 'claim:' || c.id::text;

  -- คนเดิมสแกนซ้ำ → ไม่บันทึกซ้ำ กันนับผลงานเกินจริง
  if exists (
    select 1 from production_scans
     where order_number = v_scan_no and stage = v_label and tech_code = p_tech_code
  ) then
    return jsonb_build_object('ok', false, 'result', 'dup_self', 'stage', v_label);
  end if;

  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at, is_helper)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now, true);

  select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
    from production_scans t where t.order_number = v_scan_no and t.stage = v_label;

  return jsonb_build_object('ok', true, 'result', 'joined',
    'stage', v_label, 'status', v_status, 'at', v_iso, 'people', v_people);
end;
$$;

grant execute on function public.claim_scan_join(uuid, text, text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- เสร็จ — ปริ้นใบเคลมจะมี QR ให้ทีมผลิตสแกนเดินสถานะได้เหมือนใบออเดอร์
-- ════════════════════════════════════════════════════════════════════════════

-- ----- ที่มา: scripts/add_packing_photos_delete_policy.sql (เติม DROP ให้รันซ้ำได้) -----
drop policy if exists "packing-photos delete" on storage.objects;
create policy "packing-photos delete"
  on storage.objects for delete
  using (bucket_id = 'packing-photos');

-- ----- ที่มา: migrations/enable_realtime_orders.sql (ครอบ guard ให้รันซ้ำได้) -----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_entries'
  ) then
    alter publication supabase_realtime add table order_entries;
  end if;
end $$;


-- ============================================================================
-- 9) ตรวจสอบ - รันแล้วดูตารางผลลัพธ์ ต้องเป็น OK ทุกแถว (MISSING = ยังขาด)
-- ============================================================================
with need(kind, obj, detail) as (
  values
    ('column','order_entries','printed_at'), ('column','order_entries','shipped_at'),
    ('column','order_entries','done_at'),    ('column','order_entries','rail_packed'),
    ('column','order_entries','status_history'), ('column','order_entries','packing_photos'),
    ('column','order_entries','shipments'),  ('column','order_entries','outsource'),
    ('column','order_entries','outsource_at'), ('column','order_entries','address'),
    ('column','order_entries','install_status'), ('column','order_entries','install_time'),
    ('column','order_entries','province'),   ('column','order_entries','phone'),
    ('column','order_entries','location_link'), ('column','order_entries','payment_status'),
    ('column','order_entries','deposit'),    ('column','order_entries','order_assigned'),
    ('column','order_entries','is_dropoff'), ('column','order_entries','price'),
    ('column','installations','install_zone'), ('column','installations','updated_at'),
    ('column','installations','source_order_id'), ('column','installations','photos'),
    ('column','claims','admin_name'), ('column','claims','closed_by'), ('column','claims','closed_at'),
    ('column','claims','printed_at'), ('column','claims','shipped_at'), ('column','claims','shipments'),
    ('column','claims','ship_back_cost'), ('column','claims','ship_return_cost'), ('column','claims','estimated_price'),
    ('column','leave_requests','leave_end_date'), ('column','leave_requests','medical_cert_url'),
    ('column','staff','start_date'), ('column','purchase_orders','updated_at'),
    ('column','purchase_orders','source_order_id'), ('column','production_scans','is_helper'),
    ('column','stock','fabric_width'), ('column','stock','fabric_type'), ('column','stock','remaining_meters'),
    ('table','claims',''), ('table','staff',''), ('table','activity_logs',''), ('table','order_status_events',''),
    ('function','scan_advance',''), ('function','scan_join',''), ('function','scan_undo',''),
    ('function','claim_scan_advance',''), ('function','claim_scan_join',''),
    ('function','log_activity',''), ('function','log_order_status_event',''),
    ('bucket','packing-photos',''), ('bucket','medical-certs','')
)
select
  case when ok then 'OK' else 'MISSING' end as status,
  kind, obj, detail
from (
  select kind, obj, detail,
    case kind
      when 'column'   then exists (select 1 from information_schema.columns
                                    where table_schema='public' and table_name=obj and column_name=detail)
      when 'table'    then exists (select 1 from information_schema.tables
                                    where table_schema='public' and table_name=obj)
      when 'function' then exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                    where n.nspname='public' and p.proname=obj)
      when 'bucket'   then exists (select 1 from storage.buckets where id=obj)
      else false
    end as ok
  from need
) t
order by ok, kind, obj, detail;


-- ============================================================================
-- สคริปต์ "ข้อมูล" ที่รันไปแล้ว - ห้ามรันซ้ำ (ข้อมูลจะเข้าซ้ำ/ทับ)
--   scripts/import_sheet_769.sql               นำเข้าออเดอร์ชีท ก.ค. รอบแรก (รันแล้ว 14 ก.ค.)
--   scripts/import_sheet_july_pending.sql      นำเข้างานค้างชีท ก.ค. 42 แถว (รันแล้ว 27 ก.ค. 23:09 น.)
--   scripts/staff_migration_full.sql           ย้ายพนักงานจากชีท (รันแล้ว)
--   scripts/backfill_staff_start_date.sql      เติมวันเริ่มงานที่ตกหล่น (รันแล้ว 23 ก.ค.)
--   scripts/migrate_items_jsonb.sql            แปลงรายการสินค้าเป็น jsonb (รันแล้ว)
--   scripts/migrate_legacy_status_words.sql    แปลงคำสถานะเก่า "กำลังX" -> "Xแล้ว" (รันแล้ว)
--   scripts/dedup_leaves.sql                   ลบใบลาซ้ำ (รันแล้ว)
--   scripts/renumber_installation_serials_from_orders.sql, rename_wat_phuenthi_to_wat_naangan.sql,
--   sql/cleanup_scan_url_rows.sql              งานซ่อมข้อมูลครั้งเดียว (รันแล้ว)
-- ============================================================================
