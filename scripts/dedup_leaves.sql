-- ลบประวัติลาที่ซ้ำ (จากการรัน staff_migration_full.sql ซ้ำรอบ)
-- เก็บไว้ 1 แถวต่อ (employee_code + leave_date + leave_type) — ใช้ ctid หาแถวซ้ำ
-- รันใน Supabase SQL Editor (ปลอดภัย รันซ้ำได้ ไม่ลบเกิน)

delete from leave_requests a
using leave_requests b
where a.ctid > b.ctid
  and a.employee_code = b.employee_code
  and a.leave_date    = b.leave_date
  and a.leave_type    = b.leave_type;

-- เช็กจำนวนที่เหลือ
select count(*) as leave_rows from leave_requests;
