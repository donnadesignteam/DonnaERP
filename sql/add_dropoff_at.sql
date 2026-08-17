-- เวลาที่กด Drop-off ของใบออเดอร์ (ใช้จับใบที่ดรอปแล้วเกิน 24 ชม. แต่ยังไม่ได้ติ๊กจัดส่ง)
-- เดิมมีแค่ธง is_dropoff แบบ true/false เลยไม่รู้ว่ากดไปตอนไหน
alter table order_entries add column if not exists dropoff_at timestamptz;

-- ใบเก่าที่ติ๊ก Drop-off ไว้แล้ว: เติมเวลาย้อนหลังจาก updated_at เพื่อให้ปุ่มเตือนใช้ได้ทันที
-- (งานติดตั้งใช้ is_dropoff เป็นธง "ติดตั้งแล้ว" คนละความหมาย → ข้ามไป)
update order_entries
   set dropoff_at = coalesce(updated_at, created_at)
 where is_dropoff = true
   and dropoff_at is null
   and coalesce(is_installation, false) = false;

-- ตรวจผล
select count(*) filter (where dropoff_at is not null) as มีเวลาดรอป,
       count(*) filter (where is_dropoff and dropoff_at is null) as ยังไม่มีเวลา
  from order_entries;
