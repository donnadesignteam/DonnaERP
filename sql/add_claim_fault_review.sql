-- ผลตรวจสอบงานเคลมรายเคส (หน้า หมวดพนักงาน → งานเคลม)
-- ว่าง/NULL = ยังรอตรวจสอบ · ค่าที่ใช้: 'ตรวจสอบแล้วไม่พบความผิด' | 'ตรวจสอบแล้วผิดจริง'
alter table claims add column if not exists fault_review text;
alter table claims add column if not exists fault_review_at timestamptz;

-- ตรวจผล
select coalesce(fault_review, 'รอตรวจสอบ') as ผลตรวจสอบ, count(*)
  from claims
 where coalesce(fault_by, '') <> ''
 group by 1;
