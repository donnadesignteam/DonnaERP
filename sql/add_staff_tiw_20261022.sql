-- เพิ่มพนักงานฝึกงานแอดมิน: ติว (กุลนิษฐ์ แก้ววงศ์) — 22 ต.ค. 69
-- ล็อกอิน DN0X2 / รหัสผ่านใน login_pass (ยังไม่มีวันเริ่มงาน เลยใช้รหัสตั้งเองแบบ DN0X1)
-- ตำแหน่ง/ฝ่าย ตั้งเหมือนแอดมินคนอื่น (แอดมิน / ธุรการ)
insert into staff (code, name, nickname, position, division, start_date, active, login_pass,
                   sick_avail, sick_used, sick_left,
                   personal_avail, personal_full, personal_half, personal_left,
                   vacation_avail, vacation_used, vacation_left,
                   wop_full, wop_half, wop_hours, late)
values ('DN0X2', 'กุลนิษฐ์ แก้ววงศ์', 'ติว', 'แอดมิน', 'ธุรการ', null, true, '1410',
        0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0,
        0, 0, 0, 0)
on conflict (code) do update
  set name = excluded.name, nickname = excluded.nickname, position = excluded.position,
      division = excluded.division, active = true, login_pass = excluded.login_pass;

-- ตรวจผล
select code, name, nickname, position, division, active
  from staff where code = 'DN0X2';
