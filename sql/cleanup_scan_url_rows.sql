-- ล้างแถวสแกนผลิตที่เลขออเดอร์เป็น URL (เกิดจากสแกน QR ผิดตัว/ทดสอบระบบ ก่อนแก้บั๊ก 10 ก.ค. 2569)
-- รวมถึงคู่สแกน ตัดผ้าแล้ว→แพ็คแล้ว ห่างกัน 2 นาทีที่ทำให้หน้าวิเคราะห์ข้อมูลโชว์ "เวลาผลิตรวม 2 นาที"
-- รันใน Supabase SQL Editor — เช็คก่อนด้วย select แล้วค่อย delete

-- 1) ดูแถวที่จะโดนลบก่อน
select id, order_number, stage, status, tech_name, scanned_at
from production_scans
where order_number like 'http%';

-- 2) ถ้าถูกต้องแล้วค่อยรันบรรทัดนี้
delete from production_scans where order_number like 'http%';
