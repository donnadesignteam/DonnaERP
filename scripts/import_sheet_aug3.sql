-- ============================================================================
-- นำเข้าอัพเดตจากชีท (3 ส.ค. 2569)
--   แหล่งข้อมูล 1 = ชีทออเดอร์รายวัน แท็บ 769  (1ssuuxWhVam-Ek1F8gpdqlrIleF8TB-gBUZErNqZ830I)
--   แหล่งข้อมูล 2 = ชีทปฏิทินงานติดตั้ง Movement_log Serial 0125-0142 (1xI3TlT8MD2uYsBCOO5rk6qEvVzw72sWae52Kuif-els)
-- รอบก่อน (27 ก.ค.) นำเข้าถึง 27/7 · รอบนี้ = แถวใหม่ 28/7-1/8 + งานเพิ่มของลูกค้าเดิม + สถานะ/วันนัดที่เดินไป
--
-- ส่วนที่ 1 = ออเดอร์ใหม่ 10 แถว (งานติดตั้ง 6 → สร้างแถวปฏิทิน installations ผูก source_order_id อัตโนมัติ)
-- ส่วนที่ 2 = อัปเดตออเดอร์เดิม: จัดส่งแล้ว 4 · ติดตั้งเสร็จ 2 · เติมวันนัดจากปฏิทิน 4
-- ส่วนที่ 3 = นัดวัดหน้างานใหม่ที่ไม่ผูกออเดอร์ (View Wealth 10/8)
--
-- ‼️ รันทีเดียวทั้งไฟล์ · ย้อนกลับส่วนที่ 1: DELETE FROM order_entries WHERE created_at > '<เวลาก่อนรัน>';
-- ============================================================================

-- ===========================================================================
-- ส่วนที่ 1 : ออเดอร์ใหม่ 10 แถว (จากชีทแท็บ 769 วันที่ 27/7 - 1/8)
-- ===========================================================================
WITH ins_orders AS (
  INSERT INTO order_entries
    (entry_date, customer_name, platform, price, deposit, payment_status, order_assigned,
     is_installation, order_status, status, deadline, installation_date, install_time,
     province, address, phone, notes, created_at, updated_at)
  VALUES
  -- ───────── งานนอก (จัดส่งตามที่อยู่) 4 แถว ─────────
  ('2026-07-29','Cafe-Lipe','LineOA',13269,6634.50,'ชำระ 50%','สรุปออเดอร์',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,NULL,NULL,'ชำระก่อนจัดส่ง 6,634.50 บาท · รอเลือกสีใหม่ M20 หมด (ชีทลงซ้ำอีกรอบ 1/8 = ใบเดียวกัน)',now(),now()),
  ('2026-07-29','Cherry กะแดะปรี๊ด','Facebook',1423,NULL,'ชำระครบ','แจ้งลงหน้าร้าน',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,now(),now()),
  ('2026-07-30','นุ่นนนนนน','Tiktok',1227,613.50,'ชำระ 50%','สรุปออเดอร์',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,NULL,NULL,'ชำระก่อนจัดส่ง 613.50 บาท',now(),now()),
  ('2026-08-01','Pandaaa🐼','LineOA',4159,NULL,'ชำระครบ','สรุปออเดอร์',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,NULL,NULL,NULL,now(),now()),

  -- ───────── งานติดตั้ง 6 แถว ─────────
  ('2026-07-27','Yothaka','LineOA',88000,NULL,'ชำระครบ','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,NULL,'0922836430','รอนัดหมาย (ปฏิทิน Serial 0127 ลงเวลา 17:00 แต่ยังไม่มีวันนัด)',now(),now()),
  -- VanilaSky: งานเพิ่มจากใบเดิม 1/7 (ใบนั้นติดตั้ง 16/7 ไปแล้ว) — ใบใหม่นัดติด 3/8
  ('2026-07-27','VanilaSky','LineOA',1650,825,'ชำระ 50%','แจ้งลงหน้าร้าน',true,'รอดำเนินการ','อยู่ในกำหนด','2026-08-03','2026-08-03','10:00','เชียงราย',NULL,'0992726424','ชำระหลังติดตั้ง 825 บาท ติดตั้ง 3 สิงหา (งานเพิ่มจากใบ 1/7)',now(),now()),
  -- จอยคราม: งานเพิ่มจากใบเดิม 17/7 — ปฏิทิน Serial 0129 นัด 5/8 10:00
  ('2026-07-27','😄😍๛๏~จอยคราม~๏๛😍😆','LineOA',16276,NULL,'ยังไม่ชำระ','แจ้งลงหน้าร้าน, ช่างบัวบาน',true,'รอดำเนินการ','อยู่ในกำหนด','2026-08-05','2026-08-05','10:00','เชียงราย','บ้านหนองยาว ท่าสาย','0613816075','งานเพิ่มจากใบ 17/7 — ชำระหลังติดตั้ง 28,981.65 ยอดเดิม + 16,276 (ปฏิทิน Serial 0129)',now(),now()),
  ('2026-07-29','เจ้าเนยอ้วง','LineOA',9243,4621.50,'ชำระ 50%','แจ้งลงหน้าร้าน',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'09:00','กทม',NULL,NULL,'ชำระหลังติดตั้ง 4,621.5 บาท งานติดตั้ง กทม',now(),now()),
  ('2026-07-30','namenoii','LineOA',12863,6431.50,'ชำระ 50%','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'09:00','กทม',NULL,NULL,'ชำระหลังติดตั้ง 6,431.50 บาท ติดตั้ง กทม',now(),now()),
  ('2026-07-30','ChanakanCha','LineOA',36859,18429.50,'ชำระ 50%','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'09:00','เชียงราย',NULL,'0954528016','ชำระหลังติดตั้ง 18,429.50 บาท (วัดหน้างานแล้ว 18/7 Serial 0125 หน้า ม.แม่ฟ้าหลวง)',now(),now())
  RETURNING id, customer_name, platform, price, notes, deadline, install_time,
            province, address, phone, is_installation, payment_status
),
maxserial AS (
  SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations
),
cal AS (
  SELECT o.*, row_number() OVER (ORDER BY o.deadline NULLS LAST, o.customer_name) AS rn
  FROM ins_orders o WHERE o.is_installation
)
INSERT INTO installations
  (source_order_id, serial_no, work_type, work_details, payment_status, appointment_status,
   production_status, send_to_technician, installation_status, appointment_datetime,
   platform, customer_id, customer_real_name, price, notes, entered_by, install_zone,
   province, phone, created_at, updated_at)
SELECT
  c.id,
  lpad((mx.m + c.rn)::text, 4, '0'),
  'งานติดตั้ง',
  '',
  COALESCE(c.payment_status, 'รอมัดจำ'),
  CASE WHEN c.deadline IS NOT NULL THEN 'นัดหมายแล้ว' ELSE 'รอนัดหมาย' END,
  'กำลังผลิต',
  'หน้าร้าน',
  'ติดตั้ง',
  CASE WHEN c.deadline IS NOT NULL
       THEN (c.deadline::text || 'T'
             || lpad(split_part(COALESCE(c.install_time, '09:00'), ':', 1), 2, '0') || ':'
             || COALESCE(NULLIF(split_part(COALESCE(c.install_time, '09:00'), ':', 2), ''), '00')
             || ':00+07:00')::timestamptz
       ELSE NULL END,
  c.platform, c.customer_name, c.customer_name, COALESCE(c.price, 0), c.notes, '',
  CASE WHEN c.province IN ('กทม','เชียงใหม่','เชียงราย') THEN c.province END,
  c.province,
  c.phone,
  now(), now()
FROM cal c CROSS JOIN maxserial mx;

-- ===========================================================================
-- ส่วนที่ 2 : อัปเดตออเดอร์เดิมที่ชีทเดินสถานะไปแล้ว
-- ===========================================================================

-- 2.1 งานนอกที่ชีทลง "ดำเนินการเสร็จสิ้น" → จัดส่งแล้ว (4 ใบ)
UPDATE order_entries SET order_status = 'จัดส่งแล้ว', updated_at = now()
WHERE is_installation = false
  AND order_status <> 'จัดส่งแล้ว'
  AND (entry_date, customer_name) IN (
    ('2026-07-13','kung6954'),
    ('2026-07-17','🎀Luktarn🎀'),
    ('2026-07-19','Yui Seeboo'),
    ('2026-07-22','Nuiforhair_new')
  );

-- 2.2 งานติดตั้งที่ชีทลงว่าเสร็จแล้ว → ติดตั้งแล้ว (1st 27/7 · SH ❣️ NOI ที่ค้าง ติดตั้ง50%)
UPDATE order_entries SET install_status = 'ติดตั้งแล้ว', is_dropoff = true, updated_at = now()
WHERE id IN ('51081ebc-d42d-49fb-a614-5a0f292bee04',   -- 1st (14/7)
             '20383ad2-beb2-474c-86ea-172481d1f698');  -- SH ❣️ NOI (1/7)
UPDATE installations SET installation_status = 'ติดตั้งเสร็จ', updated_at = now()
WHERE id IN ('8a529d75-6dee-4fdb-a3d7-81219b9732a6',   -- INST 0035 ของ 1st
             'a812b1da-f031-44c5-9808-4c39d73e6ceb');  -- INST 0005 ของ SH ❣️ NOI

-- 2.3 เติมวันนัดจากปฏิทิน (Movement_log Serial 0136/0141/0142/0138)
-- 𝔾 (27/7): นัดวัดหน้างาน 10/8 14:00 (Serial 0136)
UPDATE order_entries SET deadline = '2026-08-10', installation_date = '2026-08-10', install_time = '14:00',
       notes = COALESCE(notes,'') || ' · นัดวัดหน้างาน 10/8 14:00 (Serial 0136)', updated_at = now()
WHERE id = 'c7b12c91-b56a-4469-a248-b97912889a80';
UPDATE installations SET appointment_datetime = '2026-08-10T14:00:00+07:00', appointment_status = 'นัดหมายแล้ว',
       work_type = 'งานวัดหน้างาน', installation_status = 'วัดหน้างาน', updated_at = now()
WHERE id = 'c88f724f-86a3-4af7-bb7b-83b7ac78352c';

-- 𝙰𝙾𝚈 ᵒʳᵃʸᵃ (11/7): นัดติดตั้ง 3/8 13:00 (Serial 0141)
UPDATE order_entries SET deadline = '2026-08-03', installation_date = '2026-08-03', install_time = '13:00',
       address = COALESCE(address, 'ลุมพินีวิลล์ จรัญ-ไฟฉาย ห้อง 2112 ตึก C แขวงบ้านช่างหล่อ เขตบางกอกน้อย กทม 10700'),
       phone = COALESCE(phone, '0933650018'), updated_at = now()
WHERE id = 'b00d87e4-a6a8-4090-b24a-b621e187c1b0';
UPDATE installations SET appointment_datetime = '2026-08-03T13:00:00+07:00', appointment_status = 'นัดหมายแล้ว', updated_at = now()
WHERE source_order_id = 'b00d87e4-a6a8-4090-b24a-b621e187c1b0';
-- ถ้า AOY ยังไม่มีแถวในปฏิทิน ให้สร้างใหม่
INSERT INTO installations
  (source_order_id, serial_no, work_type, work_details, payment_status, appointment_status,
   production_status, send_to_technician, installation_status, appointment_datetime,
   platform, customer_id, customer_real_name, price, notes, entered_by, install_zone, province, phone, created_at, updated_at)
SELECT o.id, lpad((mx.m + 1)::text, 4, '0'), 'งานติดตั้ง', '', o.payment_status, 'นัดหมายแล้ว',
       'กำลังผลิต', 'หน้าร้าน', 'ติดตั้ง', '2026-08-03T13:00:00+07:00',
       o.platform, o.customer_name, o.customer_name, COALESCE(o.price, 0), 'ปฏิทิน Serial 0141', '', 'กทม', 'กทม', o.phone, now(), now()
FROM order_entries o,
     (SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations) mx
WHERE o.id = 'b00d87e4-a6a8-4090-b24a-b621e187c1b0'
  AND NOT EXISTS (SELECT 1 FROM installations i WHERE i.source_order_id = o.id);

-- W (siwaa clinic) (16/7): นัดติดตั้ง 11/8 10:00 (Serial 0142)
UPDATE order_entries SET deadline = '2026-08-11', installation_date = '2026-08-11', install_time = '10:00',
       address = COALESCE(address, 'รังสิต คลองสอง'), phone = COALESCE(phone, '0931282588'), updated_at = now()
WHERE id = '16859998-90d2-43a6-8b22-f07087f35c06';
UPDATE installations SET appointment_datetime = '2026-08-11T10:00:00+07:00', appointment_status = 'นัดหมายแล้ว',
       phone = COALESCE(phone, '0931282588'), updated_at = now()
WHERE id = 'dbf9b4eb-98aa-4015-bdfc-e228376f4ae1';

-- บริษัท เดอะเวิลด์ เฟรท จำกัด (25/7): ปฏิทินลงติดตั้งไปแล้ว 31/7 09:00 (Serial 0138) — เติมวันให้ตรงประวัติ
UPDATE order_entries SET deadline = '2026-07-31', installation_date = '2026-07-31', install_time = '09:00',
       address = COALESCE(address, '548/91 ซอยสาธุประดิษฐ์ 58 แยก 18 แขวงบางโพงพาง เขตยานนาวา กรุงเทพฯ 10120'), updated_at = now()
WHERE id = '62c032b4-70f1-42b5-b2ba-f95ee523aa2f';
UPDATE installations SET appointment_datetime = '2026-07-31T09:00:00+07:00', appointment_status = 'นัดหมายแล้ว', updated_at = now()
WHERE id = 'bec209cd-bf9e-4e15-be1e-f24bae2269b2';

-- ===========================================================================
-- ส่วนที่ 3 : นัดวัดหน้างานใหม่ ไม่ผูกออเดอร์ — View Wealth 10/8 11:00 (Serial 0137)
-- ===========================================================================
INSERT INTO installations
  (serial_no, work_type, work_details, payment_status, appointment_status,
   production_status, send_to_technician, installation_status, appointment_datetime,
   platform, customer_id, customer_real_name, price, notes, entered_by, install_zone, province, phone, created_at, updated_at)
SELECT lpad((mx.m + 1)::text, 4, '0'), 'งานวัดหน้างาน', '', 'ยังไม่ชำระ', 'นัดหมายแล้ว',
       'กำลังผลิต', 'หน้าร้าน', 'วัดหน้างาน', '2026-08-10T11:00:00+07:00',
       'LineOA', 'View Wealth', 'View Wealth', 0,
       'บ้านเลขที่ 18/48 มบ.กลางเมือง ซอยประเสริฐมนูกิจ 25 ถนนประเสริฐมนูกิจ แขวงจรเข้บัว เขตลาดพร้าว กทม (ปฏิทิน Serial 0137)',
       '', 'กทม', 'กทม', '0942822898', now(), now()
FROM (SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations) mx
WHERE NOT EXISTS (
  SELECT 1 FROM installations i
  WHERE i.customer_id = 'View Wealth' AND i.appointment_datetime = '2026-08-10T11:00:00+07:00'
);
