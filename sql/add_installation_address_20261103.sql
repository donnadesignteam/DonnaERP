-- 3พ.ย.69 ช่อง "ที่อยู่" ในกล่องเพิ่ม/แก้รายการของปฏิทินงานติดตั้ง
-- งานติดตั้งส่งต่อไปช่องที่อยู่ของใบออเดอร์ที่ผูกกันด้วย (order_entries.address)
alter table installations add column if not exists address text;
