-- รหัสผ่านล็อกอินแบบตั้งเอง (กรณีพิเศษ เช่น เด็กฝึกงานที่ยังไม่มีวันเริ่มงาน)
-- ปกติรหัสผ่านพนักงาน = วันและเดือนที่เริ่มงาน (ระบบคิดเอง) — ใครที่กรอก login_pass ไว้
-- จะใช้ค่านี้แทน และล็อกอินได้แม้ไม่มีวันเริ่มงานในระบบ
alter table staff add column if not exists login_pass text;

-- เด็กฝึกงาน: ล็อกอิน DN0X1 / รหัสผ่าน 111  (เปลี่ยนชื่อ-ชื่อเล่นตรงนี้ได้เลย)
insert into staff (code, name, nickname, position, division, start_date, active, login_pass,
                   sick_avail, sick_used, sick_left,
                   personal_avail, personal_full, personal_half, personal_left,
                   vacation_avail, vacation_used, vacation_left,
                   wop_full, wop_half, wop_hours, late)
values ('DN0X1', null, 'ฝึกงาน', 'นักศึกษาฝึกงาน', null, null, true, '111',
        0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0,
        0, 0, 0, 0)
on conflict (code) do update
  set active = true, login_pass = excluded.login_pass;

-- ตรวจผล
select code, nickname, position, start_date, active, login_pass
  from staff where code = 'DN0X1';
