-- เพิ่มคอลัมน์วันสิ้นสุดการลา (ช่วงวันลา) ในตาราง leave_requests
-- รันใน Supabase → SQL Editor

alter table leave_requests
  add column if not exists leave_end_date date;

-- เติมค่าให้แถวเดิม: ถ้ายังไม่มีวันสิ้นสุด ให้ใช้วันเริ่มลา (ลาวันเดียว)
update leave_requests
  set leave_end_date = leave_date
  where leave_end_date is null;
