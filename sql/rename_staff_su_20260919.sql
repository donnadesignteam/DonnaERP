-- เปลี่ยนชื่อเล่นพนักงาน DN002 จาก "สู้" เป็น "พี่สู้คนเท่" + แก้ชื่อในข้อมูลเก่าให้ตรงกัน
-- (หน้าพนักงาน/งานเคลมของตัวเอง ค้นจากชื่อเล่น → ถ้าไม่แก้ของเก่า ประวัติเดิมจะไม่ขึ้นในหน้าของเขา)
-- ‼️ ช่องทางขาย "Lineส่วนตัวสู้" ไม่แตะ (เป็นชื่อช่องทาง ไม่ใช่ชื่อพนักงาน)
update staff            set nickname  = 'พี่สู้คนเท่'          where code = 'DN002' and nickname = 'สู้';
update order_entries    set admin_name = 'พี่สู้คนเท่'         where admin_name = 'สู้';
update claims           set admin_name = 'พี่สู้คนเท่'         where admin_name = 'สู้';
update claims           set fault_by   = 'พี่สู้คนเท่'         where fault_by = 'สู้';
update production_scans set tech_name  = 'พี่สู้คนเท่ (DN002)' where tech_code = 'DN002' and tech_name = 'สู้ (DN002)';

-- ตรวจ: ต้องไม่เหลือ "สู้" เดี่ยวๆ
select 'staff' t, count(*) from staff where nickname = 'สู้'
union all select 'order_entries', count(*) from order_entries where admin_name = 'สู้'
union all select 'claims', count(*) from claims where admin_name = 'สู้' or fault_by = 'สู้'
union all select 'production_scans', count(*) from production_scans where tech_name = 'สู้ (DN002)';
