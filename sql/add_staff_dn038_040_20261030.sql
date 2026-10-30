-- 30ต.ค.69 เพิ่มพนักงาน DN038 เมฆ / DN040 ก้อน (แพคสินค้า) + ติว ได้รหัสจริง DN039 แทนรหัสฝึกงาน DN0X2
-- รหัสผ่านล็อกอิน = วันและเดือนที่เริ่มงาน (login_pass ว่าง = ระบบคิดจาก start_date เอง)
insert into staff (code, name, nickname, position, division, start_date, active, login_pass,
                   sick_avail, sick_used, sick_left,
                   personal_avail, personal_full, personal_half, personal_left,
                   vacation_avail, vacation_used, vacation_left,
                   wop_full, wop_half, wop_hours, late)
values
  ('DN038', 'ชยานันต์ ใจตรง',   'เมฆ',  'แพคสินค้า', 'ปฏิบัติการ', '2026-08-17', true, null, 0,0,0, 0,0,0,0, 0,0,0, 0,0,0,0),
  ('DN039', 'กุลนิตย์ แก้ววงค์', 'ติว',  'แอดมิน',    'ธุรการ',     '2026-10-14', true, null, 0,0,0, 0,0,0,0, 0,0,0, 0,0,0,0),
  ('DN040', 'ก้อนหาญ นวล',     'ก้อน', 'แพคสินค้า', 'ปฏิบัติการ', '2026-10-29', true, null, 0,0,0, 0,0,0,0, 0,0,0, 0,0,0,0)
on conflict (code) do update
  set name = excluded.name, nickname = excluded.nickname, position = excluded.position,
      division = excluded.division, start_date = excluded.start_date, active = true;

-- ย้ายประวัติของรหัสฝึกงาน DN0X2 → DN039
update order_entries set created_by_code = 'DN039' where created_by_code = 'DN0X2';
update order_entries set admin_code      = 'DN039' where admin_code      = 'DN0X2';
update order_entries set actor_code      = 'DN039' where actor_code      = 'DN0X2';
update claims        set actor_code      = 'DN039' where actor_code      = 'DN0X2';
update installations set actor_code      = 'DN039' where actor_code      = 'DN0X2';
update activity_logs set actor_code      = 'DN039' where actor_code      = 'DN0X2';
update leave_requests set employee_code  = 'DN039' where employee_code   = 'DN0X2';
update staff set active = false where code = 'DN0X2';

select code, name, nickname, position, division, start_date, active from staff where code in ('DN038','DN039','DN040','DN0X2') order by code;
