-- ════════════════════════════════════════════════════════════════════
-- DonnaERP — SQL ค้างทั้งหมด รวมรันทีเดียว (2026-06-24)
-- รันใน Supabase → SQL Editor → กด Run
-- ปลอดภัย: ทุกบล็อกมี guard (IF NOT EXISTS / WHERE ค่าเก่า) รันซ้ำได้ไม่พัง
-- ════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────
-- 1) ช่วงวันลา — เพิ่มคอลัมน์ leave_end_date  [จำเป็น! ปฏิทินร้านบันทึกช่วงลาไม่ได้ถ้าไม่มี]
-- ───────────────────────────────────────────────
alter table leave_requests
  add column if not exists leave_end_date date;

update leave_requests
  set leave_end_date = leave_date
  where leave_end_date is null;


-- ───────────────────────────────────────────────
-- 2) จัดส่งแล้ว — เพิ่มคอลัมน์ shipped_at  [ไม่งั้นติ๊ก "จัดส่งแล้ว" ไม่เซฟ]
-- ───────────────────────────────────────────────
alter table order_entries
  add column if not exists shipped_at timestamptz;


-- ───────────────────────────────────────────────
-- 3) แปลงค่าสถานะเก่า "กำลังX" → "Xแล้ว"  [แก้ dropdown ขึ้น "-"]
-- ───────────────────────────────────────────────
update order_entries set order_status = 'ตัดผ้าแล้ว' where order_status = 'กำลังตัด';
update order_entries set order_status = 'เย็บแล้ว'   where order_status = 'กำลังเย็บ';
update order_entries set order_status = 'รีดแล้ว'    where order_status = 'กำลังรีด';
update order_entries set order_status = 'แพ็คแล้ว'   where order_status = 'กำลังแพ็ค';

update work_status set status = 'ตัดผ้าแล้ว' where status = 'กำลังตัด';
update work_status set status = 'เย็บแล้ว'   where status = 'กำลังเย็บ';
update work_status set status = 'รีดแล้ว'    where status = 'กำลังรีด';
update work_status set status = 'แพ็คแล้ว'   where status = 'กำลังแพ็ค';


-- ───────────────────────────────────────────────
-- 4) Log การสแกน QR — ตาราง production_scans  [ออปชัน — ระบบสแกนทำงานได้แม้ไม่มี]
-- ───────────────────────────────────────────────
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

alter table production_scans enable row level security;

-- policy (drop ก่อน create กันชนถ้าเคยรันแล้ว)
drop policy if exists "anon insert scans" on production_scans;
drop policy if exists "anon read scans"   on production_scans;
create policy "anon insert scans" on production_scans for insert to anon with check (true);
create policy "anon read scans"   on production_scans for select to anon using (true);


-- ════════════════════════════════════════════════════════════════════
-- เสร็จ — ทั้ง 4 งานค้างถูกรันครบ
-- ════════════════════════════════════════════════════════════════════
