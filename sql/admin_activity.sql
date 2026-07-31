-- ════════════════════════════════════════════════════════════════════
-- DonnaERP — บันทึกว่า "ใครทำ" ในประวัติการแก้ไข + เจ้าของโบนัสของออเดอร์ (2026-07-31)
-- รันใน Supabase → SQL Editor → กด Run  (รันซ้ำได้ ไม่พัง)
--
-- ที่มา: activity_logs เดิมเก็บว่า "แก้อะไร" แต่ไม่เก็บว่า "ใครแก้"
--        (ตอนนั้นทุกคนล็อกอินด้วยรหัสรวมของร้าน) ตอนนี้มีล็อกอินรายคนแล้ว
--        เว็บจะแปะรหัสพนักงานลงในแถวที่บันทึก แล้ว trigger คัดลอกเข้า activity_logs ให้
-- ════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- 1) order_entries — ใครลงออเดอร์ / ใครแตะล่าสุด / เจ้าของโบนัส
-- ───────────────────────────────────────────────
alter table order_entries add column if not exists created_by_code  text;         -- คนลงออเดอร์ (ตั้งครั้งเดียว ไม่เปลี่ยน)
alter table order_entries add column if not exists created_by_name  text;
alter table order_entries add column if not exists actor_code       text;         -- คนที่บันทึกแถวนี้ล่าสุด (ทุกการกระทำ) — ใช้ป้อน activity_logs
alter table order_entries add column if not exists actor_name       text;
alter table order_entries add column if not exists admin_code       text;         -- รหัสของเจ้าของโบนัส (คู่กับ admin_name เดิม)
alter table order_entries add column if not exists last_content_at  timestamptz;  -- เวลาที่มีคนแก้ "เนื้อออเดอร์" ล่าสุด

-- ───────────────────────────────────────────────
-- 2) claims / installations — แปะคนทำเหมือนกัน (ประวัติจะได้มีชื่อ)
-- ───────────────────────────────────────────────
alter table claims        add column if not exists actor_code text;
alter table claims        add column if not exists actor_name text;
alter table installations add column if not exists actor_code text;
alter table installations add column if not exists actor_name text;

-- ───────────────────────────────────────────────
-- 3) activity_logs — เก็บคนทำ
-- ───────────────────────────────────────────────
alter table activity_logs add column if not exists actor_code text;
alter table activity_logs add column if not exists actor_name text;

create index if not exists idx_activity_actor on activity_logs(actor_code, created_at desc);
create index if not exists idx_activity_row   on activity_logs(table_name, row_id, created_at desc);

-- ───────────────────────────────────────────────
-- 4) trigger กลางตัวเดิม + คัดลอกคนทำจากแถวที่บันทึก
--    (ตารางไหนไม่มีคอลัมน์ actor_* ก็ได้ค่า null เหมือนเดิม — rec->>'actor_code' คืน null เอง)
--    ‼️ actor_code/actor_name/last_content_at ไม่ถือเป็น "การเปลี่ยนแปลง"
--       เปลี่ยนแค่ 3 ช่องนี้ = ไม่บันทึกประวัติ (กันแถวขยะ)
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
  acode text;
  aname text;
  cmap  jsonb := '{"order_entries":"ออเดอร์","claims":"เคลม","installations":"งานติดตั้ง","purchase_orders":"สั่งซื้อ","stock":"สต็อก","leave_requests":"ใบลา","production_scans":"สแกนผลิต","suppliers":"ผู้จัดจำหน่าย"}'::jsonb;
begin
  cat := coalesce(cmap ->> tg_table_name, tg_table_name);

  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;

  acode := rec->>'actor_code';
  aname := rec->>'actor_name';

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
       and key not in ('updated_at','created_at','actor_code','actor_name','last_content_at');
    -- เปลี่ยนแค่ updated_at / ช่องคนทำ (ไม่มีอะไรจริง) → ไม่ต้องบันทึก
    if diff is null then
      return new;
    end if;
    insert into activity_logs(table_name, category, action, row_id, label, changes, actor_code, actor_name)
    values (tg_table_name, cat, 'update', rec->>'id', lbl, diff, acode, aname);
    return new;

  elsif tg_op = 'INSERT' then
    insert into activity_logs(table_name, category, action, row_id, label, changes, actor_code, actor_name)
    values (tg_table_name, cat, 'insert', rec->>'id', lbl, null, acode, aname);
    return new;

  else  -- DELETE
    insert into activity_logs(table_name, category, action, row_id, label, changes, actor_code, actor_name)
    values (tg_table_name, cat, 'delete', rec->>'id', lbl, null, acode, aname);
    return old;
  end if;
end;
$$;

-- ───────────────────────────────────────────────
-- 5) เติมรหัสแอดมินให้ออเดอร์เก่าที่มีชื่อแอดมินอยู่แล้ว (จับคู่ชื่อเล่นกับตาราง staff)
--    ออเดอร์เก่าไม่มีทางรู้ว่าใครเป็นคนลง → created_by_* ปล่อยว่าง โชว์เป็น "—"
-- ───────────────────────────────────────────────
update order_entries o
set admin_code = s.code
from staff s
where o.admin_code is null
  and o.admin_name is not null
  and o.admin_name <> ''
  and s.nickname = o.admin_name;

-- ตรวจผล
select
  count(*) filter (where admin_name is not null and admin_name <> '') as "มีชื่อแอดมิน",
  count(*) filter (where admin_code is not null)                     as "เติมรหัสแล้ว"
from order_entries;
