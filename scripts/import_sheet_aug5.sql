-- ============================================================================
-- นำเข้าอัพเดตจากชีท (5 ส.ค. 2569)
--   ชีท 1 = ชีทพนักงาน/การลา  (1EHLyXg_bQOz2jYheq00ii6rjm8dIqQh1aDkVoNUTBls)
--   ชีท 2 = ปฏิทินงานติดตั้ง Movement_log  (1xI3TlT8MD2uYsBCOO5rk6qEvVzw72sWae52Kuif-els)
--   ชีท 3 = ชีทออเดอร์รายวัน แท็บ 7/69 + 8/69  (1ssuuxWhVam-Ek1F8gpdqlrIleF8TB-gBUZErNqZ830I)
--
--   ส่วนที่ 1 = ประวัติการลาที่ยังไม่มีในระบบ (มิ.ย.-ก.ค. 69)
--   ส่วนที่ 2 = ตัวเลขสิทธิลาคงเหลือของพนักงาน ให้ตรงแท็บ "สรุปข้อมูลพนักงาน"
--   ส่วนที่ 3 = งานนอก: ออเดอร์ใหม่จากชีทที่ยังไม่มีในระบบ
--   ส่วนที่ 4 = งานติดตั้ง: สถานะที่ปฏิทินเดินไปแล้ว + งานวัดหน้างานที่ยังไม่มีในระบบ
--
-- ‼️ รันทีเดียวทั้งไฟล์ · ทุกคำสั่งรันซ้ำได้ (มีเช็ค NOT EXISTS / อัปเดตค่าตรงๆ)
-- ============================================================================

-- ===========================================================================
-- ส่วนที่ 1 : ประวัติการลาที่ยังไม่มีในระบบ (62 แถว)
--   เทียบด้วย รหัสพนักงาน + วันลา + ประเภทการลา — รันซ้ำไม่เพิ่มซ้ำ
-- ===========================================================================
INSERT INTO leave_requests
  (employee_code, employee_name, employee_nickname, department, leave_date, leave_end_date,
   leave_time, leave_type, reason, leave_status, supervisor_approval, hr_approval)
SELECT v.* FROM (VALUES
  ('DN007', 'ธัญณิชา วงค์กาอินทร์', 'กุ้ง', 'ปฏิบัติการ', '2026-05-29'::date, '2026-05-29'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN013', 'พุท บุญจี้', 'ลา', 'ปฏิบัติการ', '2026-06-02'::date, '2026-06-02'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN026', 'ศิริรัตน์ กันทาซาว', 'เก๋', 'ธุรการ', '2026-06-06'::date, '2026-06-06'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN029', 'สุลักษณา จันกิติ', 'หนูนา', 'ธุรการ', '2026-06-09'::date, '2026-06-09'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN011', 'สมัชญา ใจ๋มา', 'กี้', 'ปฏิบัติการ', '2026-06-10'::date, '2026-06-10'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-06-10'::date, '2026-06-10'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN022', 'นรมน แซตูกู', 'ยู', 'ปฏิบัติการ', '2026-06-12'::date, '2026-06-12'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN003', 'จันทร์แก้ว สลีสองสม', 'ดาว', 'ปฏิบัติการ', '2026-06-15'::date, '2026-06-15'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN033', 'ธีรพล หม่องส่วย', 'ที', 'ปฏิบัติการ', '2026-06-15'::date, '2026-06-15'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN034', 'ไซพ่อน หล่าย', 'พงศ์', 'ปฏิบัติการ', '2026-06-15'::date, '2026-06-15'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN009', 'ภานุกร สิทธิโสด', 'มาร์ท', 'ปฏิบัติการ', '2026-06-16'::date, '2026-06-16'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN022', 'นรมน แซตูกู', 'ยู', 'ปฏิบัติการ', '2026-06-16'::date, '2026-06-16'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN034', 'ไซพ่อน หล่าย', 'พงศ์', 'ปฏิบัติการ', '2026-06-16'::date, '2026-06-16'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN009', 'ภานุกร สิทธิโสด', 'มาร์ท', 'ปฏิบัติการ', '2026-06-17'::date, '2026-06-17'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-06-17'::date, '2026-06-17'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN033', 'ธีรพล หม่องส่วย', 'ที', 'ปฏิบัติการ', '2026-06-17'::date, '2026-06-17'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN016', 'ยุพา ศรีสว่าง', 'นิล', 'ปฏิบัติการ', '2026-06-19'::date, '2026-06-19'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN009', 'ภานุกร สิทธิโสด', 'มาร์ท', 'ปฏิบัติการ', '2026-06-23'::date, '2026-06-23'::date, '08:00', 'ลาป่วย', 'อาหารเป็นพิษ', 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN009', 'ภานุกร สิทธิโสด', 'มาร์ท', 'ปฏิบัติการ', '2026-06-24'::date, '2026-06-24'::date, '08:00', 'ลาป่วย', 'อาหารเป็นพิษ', 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-06-24'::date, '2026-06-24'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN020', 'มะลิวัลย์ เปี่ยมสกุลไพศาล', 'เมย์', 'ปฏิบัติการ', '2026-06-24'::date, '2026-06-24'::date, '08:00', 'ลาป่วย', 'ลาป่วยครึ่งวัน', 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN029', 'สุลักษณา จันกิติ', 'หนูนา', 'ธุรการ', '2026-06-24'::date, '2026-06-24'::date, '08:00', 'ลาป่วย', 'ลาป่วยครึ่งวัน', 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN004', 'เกษมณี แสนคำ', 'ยุ้ย', 'ปฏิบัติการ', '2026-06-25'::date, '2026-06-25'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN029', 'สุลักษณา จันกิติ', 'หนูนา', 'ธุรการ', '2026-06-25'::date, '2026-06-25'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN006', 'ลู ซา ลิง', 'ตุ๊ดตู่', 'ปฏิบัติการ', '2026-06-26'::date, '2026-06-26'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN007', 'ธัญณิชา วงค์กาอินทร์', 'กุ้ง', 'ปฏิบัติการ', '2026-06-26'::date, '2026-06-26'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN031', 'หม่อง คี ไป', 'หาญ', 'ปฏิบัติการ', '2026-06-29'::date, '2026-06-29'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN021', 'วิศวกร มาชม', 'เกมส์', 'ปฏิบัติการ', '2026-06-30'::date, '2026-06-30'::date, '08:00', 'มาสาย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN031', 'หม่อง คี ไป', 'หาญ', 'ปฏิบัติการ', '2026-06-30'::date, '2026-06-30'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN037', 'ศุภกิจ กาละวงค์', 'บาส', 'ปฏิบัติการ', '2026-06-30'::date, '2026-06-30'::date, '08:00', 'ลากิจครึ่งวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN003', 'จันทร์แก้ว สลีสองสม', 'ดาว', 'ปฏิบัติการ', '2026-07-01'::date, '2026-07-01'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-03'::date, '2026-07-03'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN034', 'ไซพ่อน หล่าย', 'พงศ์', 'ปฏิบัติการ', '2026-07-03'::date, '2026-07-03'::date, '08:00', 'ลากิจครึ่งวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-04'::date, '2026-07-04'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN023', 'Sangsar', 'ศรี', 'ปฏิบัติการ', '2026-07-04'::date, '2026-07-04'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN024', 'Jai Aung Jing', 'อ๋อง', 'ปฏิบัติการ', '2026-07-04'::date, '2026-07-04'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-06'::date, '2026-07-06'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN016', 'ยุพา ศรีสว่าง', 'นิล', 'ปฏิบัติการ', '2026-07-07'::date, '2026-07-07'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-07'::date, '2026-07-07'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN007', 'ธัญณิชา วงค์กาอินทร์', 'กุ้ง', 'ปฏิบัติการ', '2026-07-08'::date, '2026-07-08'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-08'::date, '2026-07-08'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN024', 'Jai Aung Jing', 'อ๋อง', 'ปฏิบัติการ', '2026-07-08'::date, '2026-07-08'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN007', 'ธัญณิชา วงค์กาอินทร์', 'กุ้ง', 'ปฏิบัติการ', '2026-07-09'::date, '2026-07-09'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-09'::date, '2026-07-09'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN024', 'Jai Aung Jing', 'อ๋อง', 'ปฏิบัติการ', '2026-07-09'::date, '2026-07-09'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-10'::date, '2026-07-10'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN037', 'ศุภกิจ กาละวงค์', 'บาส', 'ปฏิบัติการ', '2026-07-10'::date, '2026-07-10'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN018', 'อิทธิพล เชอมือ', 'บอย', 'ปฏิบัติการ', '2026-07-11'::date, '2026-07-11'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN037', 'ศุภกิจ กาละวงค์', 'บาส', 'ปฏิบัติการ', '2026-07-11'::date, '2026-07-11'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN003', 'จันทร์แก้ว สลีสองสม', 'ดาว', 'ปฏิบัติการ', '2026-07-13'::date, '2026-07-13'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN029', 'สุลักษณา จันกิติ', 'หนูนา', 'ธุรการ', '2026-07-17'::date, '2026-07-17'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN029', 'สุลักษณา จันกิติ', 'หนูนา', 'ธุรการ', '2026-07-18'::date, '2026-07-18'::date, '08:00', 'ลากิจเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN037', 'ศุภกิจ กาละวงค์', 'บาส', 'ปฏิบัติการ', '2026-07-18'::date, '2026-07-18'::date, '08:00', 'ลากิจครึ่งวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN009', 'ภานุกร สิทธิโสด', 'มาร์ท', 'ปฏิบัติการ', '2026-07-22'::date, '2026-07-22'::date, '08:00', 'WOPเต็มวัน', 'ไม่เขียนใบลา', 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN020', 'มะลิวัลย์ เปี่ยมสกุลไพศาล', 'เมย์', 'ปฏิบัติการ', '2026-07-23'::date, '2026-07-23'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN033', 'ธีรพล หม่องส่วย', 'ที', 'ปฏิบัติการ', '2026-07-23'::date, '2026-07-23'::date, '08:00', 'ลากิจครึ่งวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN004', 'เกษมณี แสนคำ', 'ยุ้ย', 'ปฏิบัติการ', '2026-07-24'::date, '2026-07-24'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN007', 'ธัญณิชา วงค์กาอินทร์', 'กุ้ง', 'ปฏิบัติการ', '2026-07-24'::date, '2026-07-24'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN008', 'แสงดาว ลีลี', 'แสงดาว', 'ปฏิบัติการ', '2026-07-24'::date, '2026-07-24'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN008', 'แสงดาว ลีลี', 'แสงดาว', 'ปฏิบัติการ', '2026-07-25'::date, '2026-07-25'::date, '08:00', 'ลาพักร้อน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN028', 'สุมาลี กุยวารีย์', 'ไก่', 'ปฏิบัติการ', '2026-07-25'::date, '2026-07-25'::date, '08:00', 'ลาป่วย', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ'),
  ('DN026', 'ศิริรัตน์ กันทาซาว', 'เก๋', 'ธุรการ', '2026-07-27'::date, '2026-07-27'::date, '08:00', 'WOPเต็มวัน', NULL, 'ใบลาเรียบร้อย', 'อนุมัติ', 'อนุมัติ')
) AS v(employee_code, employee_name, employee_nickname, department, leave_date, leave_end_date,
        leave_time, leave_type, reason, leave_status, supervisor_approval, hr_approval)
WHERE NOT EXISTS (
  SELECT 1 FROM leave_requests l
  WHERE l.employee_code = v.employee_code AND l.leave_date = v.leave_date AND l.leave_type = v.leave_type
);

-- ===========================================================================
-- ส่วนที่ 2 : ตัวเลขวันลา/มาสาย ของพนักงาน ให้ตรงกับแท็บ "สรุปข้อมูลพนักงาน"
--   (ชีทคือต้นทาง — ตั้งค่าทับของเดิม ไม่ใช่บวกเพิ่ม)
-- ===========================================================================
UPDATE staff SET sick_avail = 30, sick_used = 4, sick_left = 26, personal_avail = 3, personal_full = 1, personal_half = 0, personal_left = 2, vacation_avail = 6, vacation_used = 1, vacation_left = 5, wop_full = 0, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN003';   -- ดาว
UPDATE staff SET sick_avail = 30, sick_used = 1, sick_left = 29, personal_avail = 3, personal_full = 1, personal_half = 0, personal_left = 2, vacation_avail = 6, vacation_used = 5, vacation_left = 1, wop_full = 2, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN004';   -- ยุ้ย
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 0, personal_half = 0, personal_left = 3, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 0, wop_half = 0, wop_hours = 1, late = 0, updated_at = now() WHERE code = 'DN005';   -- น้าส้ม
UPDATE staff SET sick_avail = 30, sick_used = 1, sick_left = 29, personal_avail = 3, personal_full = 1, personal_half = 0, personal_left = 2, vacation_avail = 6, vacation_used = 3, vacation_left = 3, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN006';   -- ตุ๊ดตู่
UPDATE staff SET sick_avail = 30, sick_used = 9, sick_left = 21, personal_avail = 3, personal_full = 1, personal_half = 0.5, personal_left = 1.5, vacation_avail = 6, vacation_used = 3, vacation_left = 3, wop_full = 2, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN007';   -- กุ้ง
UPDATE staff SET sick_avail = 30, sick_used = 2, sick_left = 28, personal_avail = 3, personal_full = 0, personal_half = 0, personal_left = 3, vacation_avail = 6, vacation_used = 3, vacation_left = 3, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN008';   -- แสงดาว
UPDATE staff SET sick_avail = 30, sick_used = 3, sick_left = 27, personal_avail = 3, personal_full = 0, personal_half = 0, personal_left = 3, vacation_avail = 6, vacation_used = 3, vacation_left = 3, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN009';   -- มาร์ท
UPDATE staff SET sick_avail = 30, sick_used = 4, sick_left = 26, personal_avail = 3, personal_full = 2, personal_half = 0, personal_left = 1, vacation_avail = 6, vacation_used = 6, vacation_left = 0, wop_full = 2, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN011';   -- กี้
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 1, personal_half = 0, personal_left = 2, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 0, wop_half = 0.5, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN013';   -- ลา
UPDATE staff SET sick_avail = 30, sick_used = 1, sick_left = 29, personal_avail = 3, personal_full = 0, personal_half = 0, personal_left = 3, vacation_avail = 6, vacation_used = 3, vacation_left = 3, wop_full = 0, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN016';   -- นิล
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 0, personal_half = 0, personal_left = 3, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 0, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN017';   -- ซาน
UPDATE staff SET sick_avail = 30, sick_used = 2, sick_left = 28, personal_avail = 3, personal_full = 2, personal_half = 0, personal_left = 1, vacation_avail = 6, vacation_used = 4, vacation_left = 2, wop_full = 8, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN018';   -- บอย
UPDATE staff SET sick_avail = 30, sick_used = 2, sick_left = 28, personal_avail = 3, personal_full = 0, personal_half = 0, personal_left = 3, vacation_avail = 6, vacation_used = 3, vacation_left = 3, wop_full = 1, wop_half = 0.5, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN020';   -- เมย์
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 1, personal_half = 0, personal_left = 2, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 0, wop_half = 0, wop_hours = 0, late = 3, updated_at = now() WHERE code = 'DN021';   -- เกมส์
UPDATE staff SET sick_avail = 30, sick_used = 3, sick_left = 27, personal_avail = 3, personal_full = 0, personal_half = 1, personal_left = 2, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN022';   -- ยู
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 3, personal_half = 0, personal_left = 0, vacation_avail = 6, vacation_used = 1, vacation_left = 5, wop_full = 0, wop_half = 0.5, wop_hours = 2, late = 0, updated_at = now() WHERE code = 'DN023';   -- ศรี
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 1, personal_half = 1, personal_left = 1, vacation_avail = 6, vacation_used = 1, vacation_left = 5, wop_full = 0, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN024';   -- อ๋อง
UPDATE staff SET sick_avail = 30, sick_used = 3, sick_left = 27, personal_avail = 3, personal_full = 1, personal_half = 1, personal_left = 1, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 2, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN026';   -- เก๋
UPDATE staff SET sick_avail = 30, sick_used = 1, sick_left = 29, personal_avail = 3, personal_full = 0, personal_half = 0, personal_left = 2.5, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 0, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN027';   -- เจน
UPDATE staff SET sick_avail = 30, sick_used = 1, sick_left = 29, personal_avail = 3, personal_full = 3, personal_half = 0, personal_left = 0, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 0, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN028';   -- ไก่
UPDATE staff SET sick_avail = 30, sick_used = 4, sick_left = 26, personal_avail = 3, personal_full = 3, personal_half = 0, personal_left = 0, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 0, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN029';   -- หนูนา
UPDATE staff SET sick_avail = 29, sick_used = NULL, sick_left = NULL, personal_avail = NULL, personal_full = NULL, personal_half = NULL, personal_left = NULL, vacation_avail = NULL, vacation_used = NULL, vacation_left = NULL, wop_full = NULL, wop_half = NULL, wop_hours = NULL, late = NULL, updated_at = now() WHERE code = 'DN030';   -- ออม
UPDATE staff SET sick_avail = 30, sick_used = 2, sick_left = 28, personal_avail = 3, personal_full = 0, personal_half = 0.5, personal_left = 2.5, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 1, late = 0, updated_at = now() WHERE code = 'DN031';   -- หาญ
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 0, personal_half = 0.5, personal_left = 2.5, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 1, late = 0, updated_at = now() WHERE code = 'DN032';   -- แลง
UPDATE staff SET sick_avail = 30, sick_used = 1, sick_left = 29, personal_avail = 3, personal_full = 1, personal_half = 0.5, personal_left = 1.5, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN033';   -- ที
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 3, personal_full = 1, personal_half = 0.5, personal_left = 1.5, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN034';   -- พงศ์
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 1, personal_full = 0.5, personal_half = 0.5, personal_left = 1.5, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN035';   -- กาย
UPDATE staff SET sick_avail = 30, sick_used = 0, sick_left = 30, personal_avail = 1, personal_full = 0.5, personal_half = 0.5, personal_left = 1.5, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN036';   -- ปูน
UPDATE staff SET sick_avail = 30, sick_used = 2, sick_left = 28, personal_avail = 0, personal_full = 1, personal_half = 1, personal_left = 2, vacation_avail = 6, vacation_used = 0, vacation_left = 6, wop_full = 1, wop_half = 0, wop_hours = 0, late = 0, updated_at = now() WHERE code = 'DN037';   -- บาส

-- ===========================================================================
-- ส่วนที่ 3 : งานนอก — ออเดอร์ในชีทที่ยังไม่มีในระบบ (1 ใบ)
--   Ice 4/8 · 8,913 บาท ชำระ 50% (4,456.50) · ติดตั้ง กทม
--   ปฏิทินมีงานติดตั้ง Ice 20/8 13:00 (Serial ระบบ 0062) อยู่แล้วแต่ยังไม่ผูกออเดอร์ → ผูกให้ด้วย
-- ===========================================================================
WITH ins AS (
  INSERT INTO order_entries
    (entry_date, customer_name, platform, price, deposit, payment_status, order_assigned,
     is_installation, order_status, status, deadline, installation_date, install_time,
     province, phone, notes, created_at, updated_at)
  SELECT '2026-08-04'::date, 'Ice', 'LineOA', 8913, 4456.50, 'ชำระ 50%', 'แจ้งลงหน้าร้าน, พี่ฟอง',
         true, 'รอดำเนินการ', 'อยู่ในกำหนด', '2026-08-20'::date, '2026-08-20'::date, '13:00',
         'กทม', NULL, 'ชำระหลังติดตั้ง 4,456.5 บาท งานติดตั้งกรุงเทพ (ปฏิทินนัด 20/8 13:00)', now(), now()
  WHERE NOT EXISTS (
    SELECT 1 FROM order_entries o WHERE o.customer_name = 'Ice' AND o.entry_date = '2026-08-04'
  )
  RETURNING id
)
UPDATE installations SET source_order_id = ins.id, updated_at = now()
FROM ins WHERE installations.id = '02f6b1e1-0bb3-4ab6-bc32-9f533854a93c'
  AND installations.source_order_id IS NULL;

-- ===========================================================================
-- ส่วนที่ 4 : งานติดตั้ง
--   4.1 สถานะที่ปฏิทินลงว่าเสร็จแล้ว แต่ในระบบยังเป็น "ติดตั้ง" (19 งาน)
-- ===========================================================================
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '40c5d74a-40c7-4a12-b709-aea0a5d92490' AND installation_status <> 'ติดตั้งเสร็จ';   -- 🫶🏻 (คุณ ศรีสุดา) (ปฏิทิน 0043)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = 'f308a5b4-2992-4f3a-b591-28e964bdb5e8' AND installation_status <> 'ติดตั้งเสร็จ';   -- ben (ปฏิทิน 0063)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '6d2dfc0e-0344-4f30-98cf-b85a4f68adeb' AND installation_status <> 'ติดตั้งเสร็จ';   -- NuNee (ปฏิทิน 0070)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = 'ccc8bec9-24d2-4b28-9078-3624c79d8f2f' AND installation_status <> 'ติดตั้งเสร็จ';   -- Maipun Design (ปฏิทิน 0095)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '70ec3a46-1656-40a5-bf73-bd8ad5f909a5' AND installation_status <> 'ติดตั้งเสร็จ';   -- mod (ปฏิทิน 0096)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = 'b4df234e-3bd3-4e85-a45d-dac34b28dc46' AND installation_status <> 'ติดตั้งเสร็จ';   -- J. (ปฏิทิน 0099)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '4c01be75-976f-41e1-84b7-702ea5334992' AND installation_status <> 'ติดตั้งเสร็จ';   -- MTY (ปฏิทิน 0102)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '7006e620-e648-4ee1-9f6e-90e1dce76d5a' AND installation_status <> 'ติดตั้งเสร็จ';   -- Att (คุณอัฐ) (ปฏิทิน 0103)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '85a55ebb-65a6-4ff6-b613-fbd165a51cc8' AND installation_status <> 'ติดตั้งเสร็จ';   -- Ne (ปฏิทิน 0104)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '7f638423-f5e6-41da-8c02-4d333145a2db' AND installation_status <> 'ติดตั้งเสร็จ';   -- labubu (ปฏิทิน 0107)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '5a56dfca-2c43-409b-a489-d8b23f4a06bb' AND installation_status <> 'ติดตั้งเสร็จ';   -- Newwy🌻 (ปฏิทิน 0109)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '0fb08d02-de34-4d48-8901-e338b4391697' AND installation_status <> 'ติดตั้งเสร็จ';   -- wan mai (ปฏิทิน 0110)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '88b6621f-c9f7-4040-a275-eda5a5ef1865' AND installation_status <> 'ติดตั้งเสร็จ';   -- Pattarapohn Tuijai (ปฏิทิน 0111)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '941ff314-f0bf-4fa0-96b8-8cf670ac9b7d' AND installation_status <> 'ติดตั้งเสร็จ';   -- Beau (ปฏิทิน 0117)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = 'f8cbb4f6-1248-4fb9-8958-d6ecb509ef09' AND installation_status <> 'ติดตั้งเสร็จ';   -- Sanya Niruttinanont (ปฏิทิน 0118)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '89f370ef-7175-44da-9282-ca2619f49283' AND installation_status <> 'ติดตั้งเสร็จ';   -- Nally (ปฏิทิน 0120)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '71c140ee-5d8e-4ac1-8681-b318652b89dd' AND installation_status <> 'ติดตั้งเสร็จ';   -- น้องเอิน (ปฏิทิน 0121)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '7570ce7f-b9b9-4c68-8269-850fe9a48292' AND installation_status <> 'ติดตั้งเสร็จ';   -- by_nee (ปฏิทิน 0122)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now() WHERE id = '1a56a752-8d16-451e-b39f-d0c6864f111b' AND installation_status <> 'ติดตั้งเสร็จ';   -- JOEYY (ปฏิทิน 0128)

-- 4.2 ปฏิทินลงว่าติดตั้ง 50% (2 งาน)
UPDATE installations SET installation_status = 'ติดตั้ง50%', updated_at = now() WHERE id = 'd45c61a1-f8d3-4df7-9084-055e2e3f8ab5' AND installation_status = 'ติดตั้ง';   -- VanilaSky (ปฏิทิน 0114)
UPDATE installations SET installation_status = 'ติดตั้ง50%', updated_at = now() WHERE id = '0a30e75b-ed02-4933-9c67-38dfe845098e' AND installation_status = 'ติดตั้ง';   -- phaiphai 🐼 (ปฏิทิน 0126)

-- 4.3 งานในปฏิทินชีทที่ยังไม่มีในระบบ (5 งาน — ผ่านวันนัดไปแล้วทั้งหมด ลงไว้ให้ประวัติครบ)
INSERT INTO installations
  (serial_no, work_type, work_details, payment_status, appointment_status, production_status,
   send_to_technician, installation_status, appointment_datetime, platform, customer_id,
   customer_real_name, price, notes, entered_by, install_zone, province, phone, created_at, updated_at)
SELECT lpad((mx.m + 1)::text, 4, '0'), 'งานติดตั้ง', '', 'ชำระครบ', 'นัดหมายแล้ว', 'ผลิตเสร็จแล้ว',
       'หน้าร้าน', 'ติดตั้งเสร็จ', '2026-06-29T10:00:00+07:00', 'LineOA', 'PHANIDA', 'PHANIDA', 20000,
       'บ้านดอยงาม ต.ดอนศิลา อ.เวียงชัย (ปฏิทิน Serial 0075)', 'หนูนา', 'เชียงราย', 'เชียงราย', '0955586462', now(), now()
FROM (SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations) mx
WHERE NOT EXISTS (
  SELECT 1 FROM installations i WHERE i.customer_id = 'PHANIDA' AND i.appointment_datetime = '2026-06-29T10:00:00+07:00'
);
INSERT INTO installations
  (serial_no, work_type, work_details, payment_status, appointment_status, production_status,
   send_to_technician, installation_status, appointment_datetime, platform, customer_id,
   customer_real_name, price, notes, entered_by, install_zone, province, phone, created_at, updated_at)
SELECT lpad((mx.m + 1)::text, 4, '0'), 'งานวัดหน้างาน', '', 'ชำระครบ', 'นัดหมายแล้ว', 'ผลิตเสร็จแล้ว',
       'หน้าร้าน', 'วัดหน้างานแล้ว', '2026-07-01T10:00:00+07:00', 'Lineพี่สู้', 'คุณบอย', 'คุณบอย', 64310,
       'สิงห์ปาร์ค · ชื่อจริง boy-000i (ปฏิทิน Serial 0108)', 'หนูนา', 'เชียงราย', 'เชียงราย', '0903191738', now(), now()
FROM (SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations) mx
WHERE NOT EXISTS (
  SELECT 1 FROM installations i WHERE i.customer_id = 'คุณบอย' AND i.appointment_datetime = '2026-07-01T10:00:00+07:00'
);
INSERT INTO installations
  (serial_no, work_type, work_details, payment_status, appointment_status, production_status,
   send_to_technician, installation_status, appointment_datetime, platform, customer_id,
   customer_real_name, price, notes, entered_by, install_zone, province, phone, created_at, updated_at)
SELECT lpad((mx.m + 1)::text, 4, '0'), 'งานวัดหน้างาน', '', 'ยังไม่ชำระ', 'นัดหมายแล้ว', 'ผลิตเสร็จแล้ว',
       'หน้าร้าน', 'วัดหน้างานแล้ว', '2026-07-25T13:00:00+07:00', 'LineOA', 'Alizbell🐱🐰', 'Alizbell🐱🐰', 0,
       'เอเรนบางนา (ปฏิทิน Serial 0112)', 'หนูนา', 'กทม', 'กทม', NULL, now(), now()
FROM (SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations) mx
WHERE NOT EXISTS (
  SELECT 1 FROM installations i WHERE i.customer_id = 'Alizbell🐱🐰' AND i.appointment_datetime = '2026-07-25T13:00:00+07:00'
);
INSERT INTO installations
  (serial_no, work_type, work_details, payment_status, appointment_status, production_status,
   send_to_technician, installation_status, appointment_datetime, platform, customer_id,
   customer_real_name, price, notes, entered_by, install_zone, province, phone, created_at, updated_at)
SELECT lpad((mx.m + 1)::text, 4, '0'), 'งานวัดหน้างาน', '', 'ยังไม่ชำระ', 'นัดหมายแล้ว', 'ผลิตเสร็จแล้ว',
       'หน้าร้าน', 'วัดหน้างานแล้ว', '2026-07-03T17:00:00+07:00', 'LineOA', 'Nuun', 'Nuun', 0,
       'บ้านเลขที่ 88/19 มาตามโลเคชั่นได้เลย ประตูสีดำ โทรแจ้งลูกค้าก่อนเข้า (ปฏิทิน Serial 0113)', 'หนูนา', 'เชียงราย', 'เชียงราย', '084-0194253', now(), now()
FROM (SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations) mx
WHERE NOT EXISTS (
  SELECT 1 FROM installations i WHERE i.customer_id = 'Nuun' AND i.appointment_datetime = '2026-07-03T17:00:00+07:00'
);
INSERT INTO installations
  (serial_no, work_type, work_details, payment_status, appointment_status, production_status,
   send_to_technician, installation_status, appointment_datetime, platform, customer_id,
   customer_real_name, price, notes, entered_by, install_zone, province, phone, created_at, updated_at)
SELECT lpad((mx.m + 1)::text, 4, '0'), 'งานวัดหน้างาน', '', 'ยังไม่ชำระ', 'นัดหมายแล้ว', 'ผลิตเสร็จแล้ว',
       'หน้าร้าน', 'วัดหน้างานแล้ว', '2026-07-20T10:00:00+07:00', 'LineOA', 'คุุุณโย', 'คุุุณโย', 0,
       'บ้านเลขที่ 323/98 อภิทาวน์ เชียงราย (ปฏิทิน Serial 0131)', 'หนูนา', 'เชียงราย', 'เชียงราย', NULL, now(), now()
FROM (SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations) mx
WHERE NOT EXISTS (
  SELECT 1 FROM installations i WHERE i.customer_id = 'คุุุณโย' AND i.appointment_datetime = '2026-07-20T10:00:00+07:00'
);

-- ===========================================================================
-- ‼️ 2 รายการที่ไม่ได้แก้ให้ รอ user ตัดสินใจ (ชีทกับระบบไม่ตรงกัน คนละทิศ)
--   1) SH ❣️ NOI (นัด 20/7 · Serial ระบบ 0005): ระบบ = "ติดตั้งเสร็จ" แต่ชีท Serial 0065 = "ติดตั้ง50%"
--      → ถ้าชีทถูก ให้รัน: UPDATE installations SET installation_status='ติดตั้ง50%' WHERE serial_no='0005';
--   2) K'miń (ปฏิทิน 0098 งานติดตั้ง 7/7 = ติดตั้งสำเร็จ): ในระบบมีแต่ใบ "งานวัดหน้างาน" 23/6 (Serial 0001)
--      → งานติดตั้งใบนี้ยังไม่เคยลงระบบเลย ถ้าต้องการให้ลงย้อนหลัง บอกได้
-- ===========================================================================
