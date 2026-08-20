-- ใบลาที่พนักงานแจ้งเองจากแอปมือถือ (หน้า "ข้อมูลของฉัน" → วันลาคงเหลือ → + แจ้งลา)
-- ยื่นแล้วยัง "ไม่หักสิทธิวันลา" — หักตอนหัวหน้า/HR กดอนุมัติที่ปฏิทินพนักงาน
-- แถวเก่าทั้งหมด = true (ลงจากคอม หักสิทธิไปแล้วตั้งแต่ตอนบันทึก)
alter table leave_requests add column if not exists quota_applied boolean not null default true;

-- ตรวจผล
select count(*) filter (where quota_applied)       as หักสิทธิแล้ว,
       count(*) filter (where not quota_applied)   as รออนุมัติยังไม่หัก
  from leave_requests;
