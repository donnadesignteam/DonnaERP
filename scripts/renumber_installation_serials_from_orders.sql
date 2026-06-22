-- ให้รายการในปฏิทินที่ sync มาจากออเดอร์ (source_order_id) ได้ serial เลขรัน 4 หลัก
-- เหมือนรายการที่ลงในหน้าปฏิทินเอง — ต่อจากเลขสูงสุดที่มีอยู่
-- เฉพาะแถวที่ serial ยังว่าง/ไม่ใช่ตัวเลขล้วน (เช่นเก็บเลขออเดอร์ไว้); ของเดิมที่เป็นเลขรันอยู่แล้วไม่แตะ
-- รันใน Supabase SQL Editor

with maxn as (
  select coalesce(max(serial_no::int), 0) as m
  from public.installations
  where serial_no ~ '^\d+$'
),
torenum as (
  select id, row_number() over (order by created_at) as rn
  from public.installations
  where source_order_id is not null
    and (serial_no is null or serial_no !~ '^\d+$')
)
update public.installations i
set serial_no = lpad((maxn.m + torenum.rn)::text, 4, '0')
from torenum, maxn
where i.id = torenum.id;
