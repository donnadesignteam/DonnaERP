-- ยื่นอุทธรณ์งานเคลมที่ถูกลงชื่อว่า "ผิดโดย" (พนักงานกดยื่นเองจากแอปมือถือ หน้า "ข้อมูลของฉัน" → งานที่ทำผิด)
-- ผู้จัดการเห็นข้อความอุทธรณ์ในหน้า หมวดพนักงาน → งานเคลม แล้วกดเปลี่ยนผลตรวจสอบได้ตามเดิม
alter table claims add column if not exists fault_appeal text;          -- ข้อความชี้แจงของพนักงาน (NULL = ยังไม่ยื่น)
alter table claims add column if not exists fault_appeal_at timestamptz; -- ยื่นเมื่อไหร่
alter table claims add column if not exists fault_appeal_by text;        -- ใครยื่น (ชื่อเล่น/ชื่อพนักงาน)

-- ตรวจผล
select count(*) filter (where coalesce(fault_by, '') <> '')      as เคสที่มีคนผิด,
       count(*) filter (where coalesce(fault_appeal, '') <> '')  as ยื่นอุทธรณ์แล้ว
  from claims;
