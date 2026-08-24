-- แนบรูปตอนพนักงานยื่นอุทธรณ์งานที่ทำผิด (แอปมือถือ หน้า "ข้อมูลของฉัน" → งานที่ทำผิด → ยื่นอุทธรณ์)
-- ไฟล์รูปเก็บบน Cloudflare R2 โฟลเดอร์ claims/appeal/ — ในตารางเก็บแค่ลิงก์
alter table claims add column if not exists fault_appeal_photos jsonb default '[]'::jsonb;

-- ตรวจผล
select count(*) filter (where coalesce(fault_appeal, '') <> '')          as ยื่นอุทธรณ์แล้ว,
       count(*) filter (where jsonb_array_length(coalesce(fault_appeal_photos, '[]'::jsonb)) > 0) as มีรูปแนบ
  from claims;
