-- สต็อกผ้า: 1 แถวต่อรหัสผ้า · ร้านที่ซื้อได้หลายเจ้าเก็บใน suppliers (เดิมแยกแถวละร้าน เช่น AB21 จิงจิง / CT store)
-- รวมแถวรหัสซ้ำ: เก็บแถวที่อยู่บนสุด (sort_order น้อยสุด) · ม้วน/เมตร บวกรวมกัน · สถานะคิดใหม่จากจำนวนม้วน
-- ประวัติตัดสต็อก (stock_cuts) ย้ายไปชี้แถวที่เก็บไว้ · สำรองตารางเดิมไว้ที่ stock_backup_20260922
-- รันซ้ำได้ (รอบสองไม่มีรหัสซ้ำแล้ว ก็ไม่รวมอะไรเพิ่ม)
begin;

create table if not exists stock_backup_20260922 as select * from stock;

alter table stock add column if not exists suppliers jsonb;

-- แถวที่ยังไม่มี suppliers → ใช้ร้านเดิมของแถวเป็นร้านแรก
update stock set suppliers = case
    when coalesce(btrim(shop_code), '') = '' and coalesce(btrim(shop_name), '') = '' then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object('shop_code', coalesce(btrim(shop_code), ''), 'shop_name', coalesce(btrim(shop_name), '')))
  end
where suppliers is null;

-- จับกลุ่มรหัสซ้ำ (ไม่สนตัวพิมพ์/ช่องว่าง) → แถวที่เก็บ = sort_order น้อยสุด
create temp table stock_dup on commit drop as
select id, upper(btrim(fabric_code)) as code,
       first_value(id) over (partition by upper(btrim(fabric_code)) order by sort_order nulls last, updated_at) as keep_id,
       count(*) over (partition by upper(btrim(fabric_code))) as n
from stock
where coalesce(btrim(fabric_code), '') <> '';
delete from stock_dup where n < 2;

-- รวมค่าลงแถวที่เก็บ
update stock s set
  suppliers = agg.suppliers,
  roll_count = agg.roll_count,
  unused_rolls = agg.unused_rolls,
  in_use_rolls = agg.in_use_rolls,
  remaining_meters = agg.remaining_meters,
  status = case when agg.roll_count = 0 then 'ของหมด' when agg.roll_count <= 3 then 'ควรสั่ง' when agg.roll_count <= 6 then 'ของเหลือน้อย' else 'ปกติ' end,
  ordered_at = agg.ordered_at,
  notes = agg.notes,
  updated_at = now()
from (
  select d.keep_id,
    (select coalesce(jsonb_agg(distinct e), '[]'::jsonb)
       from stock x join stock_dup dx on dx.id = x.id, jsonb_array_elements(x.suppliers) e
      where dx.keep_id = d.keep_id) as suppliers,
    sum(coalesce(t.roll_count, 0)) as roll_count,
    sum(coalesce(t.unused_rolls, 0)) as unused_rolls,
    sum(coalesce(t.in_use_rolls, 0)) as in_use_rolls,
    case when bool_and(t.remaining_meters is null) then null else sum(coalesce(t.remaining_meters, 0)) end as remaining_meters,
    max(t.ordered_at) as ordered_at,
    nullif(string_agg(distinct nullif(btrim(t.notes), ''), ' · '), '') as notes
  from stock_dup d join stock t on t.id = d.id
  group by d.keep_id
) agg
where s.id = agg.keep_id;

-- ร้านแรกของแถวที่เก็บ = shop_code/shop_name (หน้าอื่นที่ยังอ่านช่องเดิมจะได้ไม่ว่าง)
update stock s set
  shop_code = coalesce(s.suppliers->0->>'shop_code', s.shop_code),
  shop_name = coalesce(s.suppliers->0->>'shop_name', s.shop_name)
where s.id in (select distinct keep_id from stock_dup);

-- ประวัติตัดสต็อก: ย้ายไปแถวที่เก็บ (ออเดอร์เดียวกันเคยตัดทั้ง 2 แถว = บวกรวม)
insert into stock_cuts (scan_no, stock_id, meters, deducted, created_at)
select c.scan_no, d.keep_id::text, c.meters, c.deducted, c.created_at
from stock_cuts c join stock_dup d on c.stock_id = d.id::text
where d.id <> d.keep_id
on conflict (scan_no, stock_id) do update
  set meters = stock_cuts.meters + excluded.meters, deducted = stock_cuts.deducted + excluded.deducted;
delete from stock_cuts c using stock_dup d where c.stock_id = d.id::text and d.id <> d.keep_id;

-- ลบแถวซ้ำที่รวมแล้ว
delete from stock s using stock_dup d where s.id = d.id and d.id <> d.keep_id;

commit;

notify pgrst, 'reload schema';

-- ตรวจผล: ต้องไม่เหลือรหัสซ้ำ
select upper(btrim(fabric_code)) as code, count(*) from stock group by 1 having count(*) > 1;
