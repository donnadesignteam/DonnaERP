-- เพิ่มช่องข้อมูลหน้างานให้ฟอร์มออเดอร์ติดตั้ง (order_entries)
-- เพื่อ sync ขึ้นการ์ดปฏิทินงานติดตั้งให้ครบ: เวลานัด/จังหวัด/เบอร์/ลิงก์โลเคชั่น
-- รันใน Supabase SQL Editor

alter table public.order_entries
  add column if not exists install_time   text,
  add column if not exists province       text,
  add column if not exists phone          text,
  add column if not exists location_link  text;
