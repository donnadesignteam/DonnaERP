-- เลขที่ใบ (serial) แยกตามหมวด — งานแพลตฟอร์มไม่มีเลข (ใบเยอะ ใช้เลขคำสั่งซื้อของแพลตฟอร์มอยู่แล้ว)
--   งานนอก      DR0001  → order_entries.serial_no
--   งานติดตั้ง   IN0001  → ใช้ installations.serial_no ที่มีอยู่เดิม (เก็บเป็นตัวเลข 4 หลัก เติม IN ตอนแสดงผล) — ไฟล์นี้ไม่แตะ
--   งานเคลม     DM0001  → claims.serial_no
--   พัสดุตีกลับ  BP0001  → return_parcels.serial_no
-- เกิน 9999 ให้ต่อเป็น 5 หลักเอง (DR10000) ไม่ตัดหลัก เลขไม่ซ้ำ
-- รันไฟล์นี้ครั้งเดียว — รันซ้ำได้ ไม่ทับเลขที่ออกไปแล้ว (ไล่เลขเฉพาะใบที่ serial_no ยังว่าง)

alter table order_entries  add column if not exists serial_no text;
alter table claims         add column if not exists serial_no text;
alter table return_parcels add column if not exists serial_no text;

-- ── งานนอก DR ── (ไม่เอางานติดตั้ง / ไม่เอาใบเคลมที่ผลิตซ้ำ platform 'เคลม:%' / ไม่เอางานแพลตฟอร์ม)
with target as (
  select id,
         row_number() over (order by coalesce(entry_date::text, left(created_at::text, 10)), created_at, id)
         + coalesce((select max((regexp_replace(serial_no, '\D', '', 'g'))::int) from order_entries where serial_no like 'DR%'), 0) as n
  from order_entries
  where serial_no is null
    and coalesce(is_installation, false) = false
    and platform not like 'เคลม:%'
    and platform in ('Facebook','LineOA','Tiktok-Chat','Shopee-Chat','หน้าร้าน',
                     'Lineส่วนตัวยุน','Lineส่วนตัวเฟิร์น','Lineส่วนตัวสู้','Lineส่วนตัวน็อต')
)
update order_entries o set serial_no = 'DR' || lpad(t.n::text, 4, '0')
from target t where o.id = t.id;

-- ── งานเคลม DM ──
with target as (
  select id,
         row_number() over (order by coalesce(claim_date::text, left(created_at::text, 10)), created_at, id)
         + coalesce((select max((regexp_replace(serial_no, '\D', '', 'g'))::int) from claims where serial_no is not null), 0) as n
  from claims where serial_no is null
)
update claims c set serial_no = 'DM' || lpad(t.n::text, 4, '0')
from target t where c.id = t.id;

-- ── พัสดุตีกลับ BP ──
with target as (
  select id,
         row_number() over (order by created_at, id)
         + coalesce((select max((regexp_replace(serial_no, '\D', '', 'g'))::int) from return_parcels where serial_no is not null), 0) as n
  from return_parcels where serial_no is null
)
update return_parcels r set serial_no = 'BP' || lpad(t.n::text, 4, '0')
from target t where r.id = t.id;

-- กันเลขซ้ำ (ใบที่ยังไม่มีเลข = null ซ้ำกันได้)
create unique index if not exists order_entries_serial_no_uniq  on order_entries  (serial_no) where serial_no is not null;
create unique index if not exists claims_serial_no_uniq         on claims         (serial_no) where serial_no is not null;
create unique index if not exists return_parcels_serial_no_uniq on return_parcels (serial_no) where serial_no is not null;

-- ตรวจผล
select 'DR' as prefix, count(*) from order_entries where serial_no like 'DR%'
union all select 'DM', count(*) from claims where serial_no is not null
union all select 'BP', count(*) from return_parcels where serial_no is not null;
