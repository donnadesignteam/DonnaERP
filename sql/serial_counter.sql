-- ════════════════════════════════════════════════════════════════════
-- DonnaERP — ตัวนับเลขที่ใบ (serial) ไม่ย้อนกลับ (2026-10-01)
-- รันใน Supabase → SQL Editor → กด Run  (รันซ้ำได้ ไม่พัง)
--
-- ที่มา: เดิมเลขถัดไป = เลขสูงสุดที่ "ยังมีอยู่" + 1 → ลบใบล่าสุดทิ้งแล้วเพิ่มใหม่ ได้เลขเดิมซ้ำ
--        ตอนนี้จำเลขสูงสุดที่ "เคยออกไปแล้ว" ไว้ต่อหมวด ลบใบไปแล้วเลขก็ไม่ถูกใช้ซ้ำ
-- หมวด: outside (DR งานนอก) · install (IN งานติดตั้ง) · claim (DM งานเคลม) · return (BP พัสดุตีกลับ)
-- ════════════════════════════════════════════════════════════════════

create table if not exists serial_counters (
  kind    text primary key,
  last_no integer not null default 0
);
alter table serial_counters enable row level security;   -- อ่าน/เขียนผ่านฟังก์ชันข้างล่างเท่านั้น

-- ขอเลขถัดไป 1 เลข (กันชนกันเมื่อแอดมินหลายคนกดบันทึกพร้อมกัน — update แถวเดียวแบบล็อก)
-- p_floor = เลขสูงสุดที่เว็บเห็นในตารางตอนนี้ → ถ้าตัวนับยังต่ำกว่า (เช่นเพิ่งรันครั้งแรก) จะขยับขึ้นมาก่อน
create or replace function take_serial(p_kind text, p_floor integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  insert into serial_counters(kind, last_no) values (p_kind, 0) on conflict (kind) do nothing;
  update serial_counters
     set last_no = greatest(last_no, coalesce(p_floor, 0)) + 1
   where kind = p_kind
  returning last_no into v;
  return v;
end;
$$;

grant execute on function take_serial(text, integer) to anon, authenticated;

-- ตั้งต้นตัวนับจากเลขสูงสุดที่มีอยู่ตอนนี้
-- (เลขของใบที่ลบไปก่อนรันไฟล์นี้ระบบไม่ได้จดไว้ — ถ้ารู้ว่าเคยไปถึงเลขไหน แก้ตัวเลขในตาราง serial_counters เองได้)
insert into serial_counters(kind, last_no)
select 'outside', coalesce(max(nullif(regexp_replace(serial_no, '\D', '', 'g'), '')::int), 0) from order_entries where serial_no like 'DR%'
on conflict (kind) do update set last_no = greatest(serial_counters.last_no, excluded.last_no);

insert into serial_counters(kind, last_no)
select 'install', coalesce(max(nullif(regexp_replace(serial_no, '\D', '', 'g'), '')::int), 0) from installations
on conflict (kind) do update set last_no = greatest(serial_counters.last_no, excluded.last_no);

insert into serial_counters(kind, last_no)
select 'claim', coalesce(max(nullif(regexp_replace(serial_no, '\D', '', 'g'), '')::int), 0) from claims
on conflict (kind) do update set last_no = greatest(serial_counters.last_no, excluded.last_no);

insert into serial_counters(kind, last_no)
select 'return', coalesce(max(nullif(regexp_replace(serial_no, '\D', '', 'g'), '')::int), 0) from return_parcels
on conflict (kind) do update set last_no = greatest(serial_counters.last_no, excluded.last_no);

select * from serial_counters order by kind;
