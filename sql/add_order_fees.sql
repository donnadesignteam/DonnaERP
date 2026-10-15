-- ค่าส่ง (งานนอก) / ค่าติดตั้ง (งานติดตั้ง) ของใบออเดอร์
-- ‼️ เป็นแค่ตัวบอกว่า "ยอดทั้งหมด" (price) มีค่าส่ง/ค่าติดตั้งอยู่เท่าไหร่ — ยอดทั้งหมดยังเป็นยอดรวมที่ลูกค้าจ่ายเหมือนเดิม ไม่ได้บวกเพิ่ม
alter table order_entries add column if not exists ship_fee numeric;
alter table order_entries add column if not exists install_fee numeric;
