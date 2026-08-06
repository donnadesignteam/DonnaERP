-- ล้างข้อมูลรายการสินค้าเก่า (6 ส.ค. 69) — รันครั้งเดียว รันซ้ำได้ไม่เสียหาย
--   1) จำนวนชั้นที่ติดอยู่ในชื่อชนิด ("รางม่านจีบ 2 ชั้น") → ย้ายลงช่อง floors + ตัดออกจากชื่อ
--   2) ชนิดตะขอที่เก็บรวมกับจำนวนจีบในช่องหัวราง ("3จีบ ตะขอยาว") → แยกลงช่อง hook_type
--      (เฉพาะรายการที่ "ไม่ใช่ราง" — ของราง คำว่า "ตะขอ" คือชื่อหัวราง ห้ามย้าย)
-- ตาราง: order_entries + claims

-- ───────── ดูก่อนว่าจะโดนกี่รายการ (ไม่แก้ข้อมูล) ─────────
select 'order_entries' as tbl, count(*) as รายการที่จะแก้
from order_entries e, jsonb_array_elements(e.items) it
where it->>'type' ~ '[0-9]+\s*ชั้น'
   or ((it->>'type') !~ '^ราง' and (it->>'rail_head') ~ 'ตะขอ' and coalesce(it->>'hook_type','') = '')
union all
select 'claims', count(*)
from claims c, jsonb_array_elements(c.items) it
where it->>'type' ~ '[0-9]+\s*ชั้น'
   or ((it->>'type') !~ '^ราง' and (it->>'rail_head') ~ 'ตะขอ' and coalesce(it->>'hook_type','') = '');

-- ───────── 1) order_entries ─────────
with exploded as (
  select e.id, t.ord,
    t.it
    || case when t.it->>'type' ~ '[0-9]+\s*ชั้น'
            then jsonb_build_object(
                   'type',   btrim(regexp_replace(t.it->>'type', '\s*[0-9]+\s*ชั้น', '', 'g')),
                   'floors', coalesce(nullif(t.it->>'floors','')::int,
                                      (regexp_match(t.it->>'type', '([0-9]+)\s*ชั้น'))[1]::int))
            else '{}'::jsonb end
    || case when (t.it->>'type') !~ '^ราง'
              and (t.it->>'rail_head') ~ 'ตะขอ'
              and coalesce(t.it->>'hook_type','') = ''
            then jsonb_build_object(
                   'rail_head', btrim(regexp_replace(t.it->>'rail_head', 'ตะขอ\s*(สั้น|ยาว|เพดาน)?', '', 'g')),
                   'hook_type', replace((regexp_match(t.it->>'rail_head', 'ตะขอ\s*(?:สั้น|ยาว|เพดาน)?'))[1], ' ', ''))
            else '{}'::jsonb end
    as it
  from order_entries e, jsonb_array_elements(e.items) with ordinality t(it, ord)
  where e.items is not null and jsonb_typeof(e.items) = 'array'
), fixed as (
  select id, jsonb_agg(it order by ord) as items from exploded group by id
)
update order_entries e
set items = f.items
from fixed f
where f.id = e.id and e.items is distinct from f.items;

-- ───────── 2) claims ─────────
with exploded as (
  select c.id, t.ord,
    t.it
    || case when t.it->>'type' ~ '[0-9]+\s*ชั้น'
            then jsonb_build_object(
                   'type',   btrim(regexp_replace(t.it->>'type', '\s*[0-9]+\s*ชั้น', '', 'g')),
                   'floors', coalesce(nullif(t.it->>'floors','')::int,
                                      (regexp_match(t.it->>'type', '([0-9]+)\s*ชั้น'))[1]::int))
            else '{}'::jsonb end
    || case when (t.it->>'type') !~ '^ราง'
              and (t.it->>'rail_head') ~ 'ตะขอ'
              and coalesce(t.it->>'hook_type','') = ''
            then jsonb_build_object(
                   'rail_head', btrim(regexp_replace(t.it->>'rail_head', 'ตะขอ\s*(สั้น|ยาว|เพดาน)?', '', 'g')),
                   'hook_type', replace((regexp_match(t.it->>'rail_head', 'ตะขอ\s*(?:สั้น|ยาว|เพดาน)?'))[1], ' ', ''))
            else '{}'::jsonb end
    as it
  from claims c, jsonb_array_elements(c.items) with ordinality t(it, ord)
  where c.items is not null and jsonb_typeof(c.items) = 'array'
), fixed as (
  select id, jsonb_agg(it order by ord) as items from exploded group by id
)
update claims c
set items = f.items
from fixed f
where f.id = c.id and c.items is distinct from f.items;

-- ───────── ตรวจหลังรัน: ต้องได้ 0 ทั้งสองแถว ─────────
select 'order_entries' as tbl, count(*) as เหลือค้าง
from order_entries e, jsonb_array_elements(e.items) it
where it->>'type' ~ '[0-9]+\s*ชั้น'
   or ((it->>'type') !~ '^ราง' and (it->>'rail_head') ~ 'ตะขอ' and coalesce(it->>'hook_type','') = '')
union all
select 'claims', count(*)
from claims c, jsonb_array_elements(c.items) it
where it->>'type' ~ '[0-9]+\s*ชั้น'
   or ((it->>'type') !~ '^ราง' and (it->>'rail_head') ~ 'ตะขอ' and coalesce(it->>'hook_type','') = '');
