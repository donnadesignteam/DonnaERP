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
