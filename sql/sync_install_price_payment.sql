-- กวาดยอดเงิน/สถานะชำระในตาราง installations ให้ตรงกับใบออเดอร์ที่ผูกไว้
-- เหตุ: order_entries เป็นเจ้าของข้อมูลจริง แต่ installations เก็บสำเนาไว้ด้วย
--       เดิมตอนแก้ยอด/ชำระในหมวดออเดอร์ สำเนาฝั่งปฏิทินไม่ถูกอัปเดตตาม
--       → หน้า "ยอดติดตั้ง" กับแอปมือถือเลยโชว์คนละค่ากับตารางรายการ (เพี้ยน 47 จาก 72 แถว)
-- แก้ที่โค้ดแล้ว (syncInstallation + mirrorInstallMoney ใน components/OrderWorkspace.tsx
--  และ saveOrder ใน app/(admin)/installations/page.tsx) ไฟล์นี้ไว้กวาดของเก่าครั้งเดียว

-- 1) ดูก่อนว่าจะแก้แถวไหนบ้าง (รันดูเฉยๆ ไม่เปลี่ยนข้อมูล)
select i.serial_no,
       i.customer_real_name,
       i.payment_status as ปฏิทิน_ชำระ,  o.payment_status as ออเดอร์_ชำระ,
       i.price          as ปฏิทิน_ยอด,   o.price          as ออเดอร์_ยอด
from installations i
join order_entries o on o.id = i.source_order_id
where coalesce(i.payment_status, '') is distinct from coalesce(o.payment_status, '')
   or coalesce(i.price, 0) is distinct from coalesce(o.price, 0)
order by i.serial_no;

-- 2) กวาดให้ตรงกัน
update installations i
set payment_status = coalesce(o.payment_status, i.payment_status),
    price          = coalesce(o.price, 0)
from order_entries o
where o.id = i.source_order_id
  and (coalesce(i.payment_status, '') is distinct from coalesce(o.payment_status, '')
    or coalesce(i.price, 0) is distinct from coalesce(o.price, 0));

-- 3) ตรวจซ้ำ — ต้องได้ 0 แถว
select count(*) as ยังไม่ตรงกัน
from installations i
join order_entries o on o.id = i.source_order_id
where coalesce(i.payment_status, '') is distinct from coalesce(o.payment_status, '')
   or coalesce(i.price, 0) is distinct from coalesce(o.price, 0);
