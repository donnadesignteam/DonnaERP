-- ปรับชื่อสถานะ/ลักษณะงานในตาราง installations ให้ตรงกับเว็บเวอร์ชันล่าสุด
-- (ตัดคำว่า "รอ" ออก: รอการติดตั้ง→ติดตั้ง, รอวัดพื้นที่/รอวัดหน้างาน→วัดหน้างาน, ติดตั้งสำเร็จ→ติดตั้งเสร็จ, งานรอแก้→รอแก้)
-- รันใน Supabase SQL Editor

-- work_type
update public.installations set work_type = 'งานวัดหน้างาน' where work_type = 'งานวัดพื้นที่';

-- installation_status
update public.installations set installation_status = 'วัดหน้างาน'  where installation_status in ('รอวัดพื้นที่','รอวัดหน้างาน');
update public.installations set installation_status = 'ติดตั้ง'      where installation_status = 'รอการติดตั้ง';
update public.installations set installation_status = 'ติดตั้งเสร็จ' where installation_status in ('ติดตั้งสำเร็จ','งานช่างนอกติดตั้งสำเร็จ');
update public.installations set installation_status = 'รอแก้'        where installation_status = 'งานรอแก้';
