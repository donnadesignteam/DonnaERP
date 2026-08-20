-- แก้ชื่อเล่น DN024 จาก "อ๋อง" → "อ่อง" (สะกดตามที่เจ้าตัวใช้)
update staff set nickname = 'อ่อง', updated_at = now() where code = 'DN024';

-- ใบลาเก่าเก็บชื่อเล่นไว้ในแถวด้วย แก้ให้ตรงกันทั้งหมด
update leave_requests set employee_nickname = 'อ่อง' where employee_code = 'DN024';

-- ตรวจผล
select code, nickname, name from staff where code = 'DN024';
select count(*) as ใบลาที่แก้แล้ว from leave_requests where employee_code = 'DN024' and employee_nickname = 'อ่อง';
