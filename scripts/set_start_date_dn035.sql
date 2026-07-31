-- เติมวันเริ่มงานของ DN035 กาย (แอดมิน) = 23 มีนาคม 2026
-- ไม่มีวันเริ่มงาน = ล็อกอินด้วยรหัสพนักงานไม่ได้ (รหัสผ่าน = วันและเดือนที่เริ่มงาน)
-- รันซ้ำได้ ไม่กระทบใครนอกจาก DN035

update staff
set start_date = date '2026-03-23'
where code = 'DN035';

-- ตรวจผล: ควรได้ 1 แถว start_date = 2026-03-23
select code, name, nickname, position, start_date
from staff
where code in ('DN035', 'DN036')
order by code;
