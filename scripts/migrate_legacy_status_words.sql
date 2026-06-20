-- แปลงค่าสถานะเก่า "กำลังX" → "Xแล้ว" ที่ยังค้างใน DB
-- (ค่าเก่าไม่มีใน dropdown options ของเว็บ เลยโชว์เป็น "-")
-- รันใน Supabase SQL Editor ได้เลย ปลอดภัย แก้เฉพาะแถวที่ยังเป็นค่าเก่า

-- order_entries (พบค้าง: กำลังรีด, กำลังเย็บ, กำลังแพ็ค)
UPDATE order_entries SET order_status = 'ตัดผ้าแล้ว' WHERE order_status = 'กำลังตัด';
UPDATE order_entries SET order_status = 'เย็บแล้ว'   WHERE order_status = 'กำลังเย็บ';
UPDATE order_entries SET order_status = 'รีดแล้ว'    WHERE order_status = 'กำลังรีด';
UPDATE order_entries SET order_status = 'แพ็คแล้ว'   WHERE order_status = 'กำลังแพ็ค';

-- work_status (พบค้าง: กำลังตัด, กำลังเย็บ, กำลังรีด, กำลังแพ็ค)
UPDATE work_status SET status = 'ตัดผ้าแล้ว' WHERE status = 'กำลังตัด';
UPDATE work_status SET status = 'เย็บแล้ว'   WHERE status = 'กำลังเย็บ';
UPDATE work_status SET status = 'รีดแล้ว'    WHERE status = 'กำลังรีด';
UPDATE work_status SET status = 'แพ็คแล้ว'   WHERE status = 'กำลังแพ็ค';

-- หมายเหตุ: การ UPDATE order_status จะทำให้ trigger order_status_events ยิง event เพิ่ม
-- (entered_at เดียวกันหลายแถว = ไม่ใช่ timing จริง) ตาราง events ยังไม่ได้ใช้วิเคราะห์ตอนนี้ จึงไม่กระทบการใช้งาน
