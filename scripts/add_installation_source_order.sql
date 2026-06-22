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
