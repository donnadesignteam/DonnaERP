-- นำเข้ารายการจากชีท 7/69 → order_entries (งานนอก 14 + งานติดตั้ง 12 = 26 แถว)
--   + สร้างแถวปฏิทินงานติดตั้ง (installations) ให้ 12 งานติดตั้ง พร้อมเติมโซนจากหมายเหตุ
-- แยกตาม "วันจัดส่ง/ติดตั้ง": จัดส่งตามที่อยู่ = งานนอก, รอนัดหมาย/นัดหมายแล้ว = งานติดตั้ง
-- แมป: Shpoee->Shopee-Chat, Tiktok->Tiktok-Chat, Lineพี่ยุน->Lineส่วนตัวยุน, kairaymond=งานนอก(มารับเอง)
-- ผูก installations.source_order_id = order_entries.id → เปิดหน้าออเดอร์แล้วบันทึกทับได้ ไม่สร้างซ้ำ
-- รันครั้งเดียวใน Supabase SQL Editor · ย้อน: DELETE FROM order_entries WHERE created_at > '<เวลาก่อนรัน>' (installations ผูก FK cascade)
WITH ins_orders AS (
  INSERT INTO order_entries
    (entry_date, customer_name, platform, price, deposit, payment_status, order_assigned,
     is_installation, order_status, status, deadline, installation_date, install_time, notes,
     created_at, updated_at)
  VALUES
  -- ===== งานนอก (จัดส่งตามที่อยู่) =====
  ('2026-07-01','Eli Sompo','Facebook',51600,25000,'ชำระไม่ครบ','แจ้งลงหน้าร้าน, พี่ฟอง',false,'เสร็จสิ้น','อยู่ในกำหนด',NULL,NULL,NULL,'ชำระก่อนส่ง 26,600 บาท ขาด 600',now(),now()),
  ('2026-07-01','tete.f','Shopee-Chat',1725,862.50,'ชำระครบ','แจ้งลงหน้าร้าน',false,'เสร็จสิ้น','อยู่ในกำหนด',NULL,NULL,NULL,'ชำระก่อนส่ง 862.5 บาท',now(),now()),
  ('2026-07-01','PRAPAN','LineOA',665,0,'ชำระครบ','แจ้งลงหน้าร้าน',false,'เสร็จสิ้น','อยู่ในกำหนด',NULL,NULL,NULL,'ค่าแก้ผ้า งานน่าน ส่งให้ลูกค้าพ่อลูกค้าติดตั้งเอง',now(),now()),
  ('2026-07-01','M-A-I','LineOA',4737,2368.50,'ชำระครบ','แจ้งลงหน้าร้าน',false,'เสร็จสิ้น','อยู่ในกำหนด',NULL,NULL,NULL,'ชำระก่อนจัดส่ง 2,368.50 บาท',now(),now()),
  ('2026-07-01','หลี 🧧','LineOA',9816,4908,'ชำระ 50%','แจ้งลงหน้าร้าน, พี่ฟอง',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,'ชำระก่อนจัดส่ง 4908 บาทค่ะ',now(),now()),
  ('2026-07-01','Maipun Design','LineOA',6618.60,3309.30,'ชำระ 50%','แจ้งลงหน้าร้าน, พี่ฟอง',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,'ชำระก่อนส่ง 3309.30 บาท',now(),now()),
  ('2026-07-06','CTNT5961','Tiktok-Chat',13628,6814,'ชำระครบ','แจ้งลงหน้าร้าน',false,'เสร็จสิ้น','อยู่ในกำหนด',NULL,NULL,NULL,'ระ ก่อนจัดส่ง อีก 6,814 บาท',now(),now()),
  ('2026-07-06','แม่แตง','LineOA',2070,0,'ชำระครบ','แจ้งลงหน้าร้าน',false,'เสร็จสิ้น','อยู่ในกำหนด',NULL,NULL,NULL,NULL,now(),now()),
  ('2026-07-08','อ้อ','LineOA',13669,6834.50,'ชำระ 50%','แจ้งลงหน้าร้าน',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,'ชำระก่อนส่ง 6,834.5 บาท',now(),now()),
  ('2026-07-09','สายธาร ที่ ใจเย็นเหมือนน้ำ','Tiktok-Chat',101,0,'ชำระครบ','แจ้งลงหน้าร้าน',false,'เสร็จสิ้น','อยู่ในกำหนด','2026-07-11',NULL,NULL,NULL,now(),now()),
  ('2026-07-09','bathitasrirsan','Shopee-Chat',210,0,'ชำระ 50%','สรุปออเดอร์',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,now(),now()),
  ('2026-07-09','kairaymond700','LineOA',2100,2100,'ยังไม่ชำระ','สรุปออเดอร์',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,'ลูกค้ามารับเองที่ร้าน ค้างชำระ 2,100.00',now(),now()),
  ('2026-07-11','สายธาร ที่ ใจเย็นเหมือนน้ำ','Tiktok-Chat',45,0,'ชำระครบ','สรุปออเดอร์',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,now(),now()),
  ('2026-07-12','Kran Nuttha','Facebook',1063,0,'ชำระครบ','สรุปออเดอร์',false,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,NULL,NULL,now(),now()),
  -- ===== งานติดตั้ง (รอนัดหมาย / นัดหมายแล้ว) =====
  ('2026-07-01','VanilaSky','LineOA',39085,19542.50,'ชำระ 50%','แจ้งลงหน้าร้าน, พี่ฟอง',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ชำระหลังติดตั้ง 19,542.5 บาท',now(),now()),
  ('2026-07-01','Natthanon Opor','Facebook',10221,5110.50,'ชำระ 50%','แจ้งลงหน้าร้าน',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','📍***งานติดตั้ง กทม ชำระหลังติดตั้ง 5,110.50 บาท',now(),now()),
  ('2026-07-01','SH ❣️ NOI','LineOA',3261,1630.50,'ชำระ 50%','แจ้งลงหน้าร้าน',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ยอดเก่าชำระที่เหลืออีก 49,392 บาท ยอดใหม่อีก 1,630.50 รวมชำระหลังติดตั้ง 51,022.5 บาท',now(),now()),
  ('2026-07-03','bhee','LineOA',3092,1546,'ชำระ 50%','แจ้งลงหน้าร้าน',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ชำระหลังติดตั้ง 1546บาท ติดตั้งเชียงใหม่ ยุนไป',now(),now()),
  ('2026-07-07','labubu','LineOA',2000,NULL,'ยังไม่ชำระ','ช่างเชียงใหม่',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00',NULL,now(),now()),
  ('2026-07-07','คุณศักดิ์','Lineส่วนตัวยุน',25000,12500,'ชำระ 50%','แจ้งลงหน้าร้าน',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','***ค้างชำระ 12,500 บาท ‼️',now(),now()),
  ('2026-07-09','Miss','LineOA',3037,1518.50,'ชำระ 50%','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ชำระหลังติดตั้ง 1518.50 บาท',now(),now()),
  ('2026-07-10','คุณแนน','Lineส่วนตัวยุน',20587,10293.50,'ชำระ 50%','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ชำระที่เหลือหลังติดตั้ง 10,293.50 บาท งานติดตั้ง กทม',now(),now()),
  ('2026-07-10','ปัญญาทิพย์ เดคคอร์','LineOA',500,0,'ชำระครบ','ช่างเชียงราย',true,'เสร็จสิ้น','อยู่ในกำหนด',NULL,'2026-07-10','9:00','แก้ไขรางม่านตก แก้ไขเรียบร้อยแล้ว',now(),now()),
  ('2026-07-11','Looknam','LineOA',23797,11898.50,'ชำระครบ','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ชำระหลังติดตั้ง 11,898.50 บาท งานติดตั้ง กทม',now(),now()),
  ('2026-07-11','𝙰𝙾𝚈 ᵒʳᵃʸᵃ','LineOA',12212,6106,'ชำระ 50%','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ชำระหลังติดตั้ง 6,106 บาท งานติดตั้ง กทม',now(),now()),
  ('2026-07-12','phaiphai','LineOA',24000,12000,'ชำระ 50%','สรุปออเดอร์',true,'รอดำเนินการ','อยู่ในกำหนด',NULL,NULL,'9:00','ชำระหลังติดตั้ง12,000บาทค่ะ',now(),now())
  RETURNING id, entry_date, customer_name, platform, price, notes, installation_date,
            is_installation, order_status, payment_status
),
maxserial AS (
  SELECT COALESCE(MAX(serial_no::int) FILTER (WHERE serial_no ~ '^\d+$'), 0) AS m FROM installations
),
cal AS (
  SELECT o.*, row_number() OVER (ORDER BY o.entry_date, o.customer_name) AS rn
  FROM ins_orders o WHERE o.is_installation
)
INSERT INTO installations
  (source_order_id, serial_no, work_type, work_details, payment_status, appointment_status,
   production_status, send_to_technician, installation_status, appointment_datetime,
   platform, customer_id, customer_real_name, price, notes, entered_by, install_zone,
   created_at, updated_at)
SELECT
  c.id,
  lpad((mx.m + c.rn)::text, 4, '0'),
  'งานติดตั้ง',
  '',
  c.payment_status,
  CASE WHEN c.customer_name = 'ปัญญาทิพย์ เดคคอร์' THEN 'นัดหมายแล้ว' ELSE 'รอนัดหมาย' END,
  'กำลังผลิต',
  'หน้าร้าน',
  CASE WHEN c.order_status = 'เสร็จสิ้น' THEN 'ติดตั้งเสร็จ' ELSE 'ติดตั้ง' END,
  CASE WHEN c.installation_date IS NOT NULL
       THEN (c.installation_date::text || 'T09:00:00+07:00')::timestamptz ELSE NULL END,
  c.platform, c.customer_name, c.customer_name, c.price, c.notes, '',
  CASE c.customer_name
    WHEN 'Natthanon Opor'      THEN 'กทม'
    WHEN 'bhee'                THEN 'เชียงใหม่'
    WHEN 'labubu'              THEN 'เชียงใหม่'
    WHEN 'คุณแนน'               THEN 'กทม'
    WHEN 'ปัญญาทิพย์ เดคคอร์'      THEN 'เชียงราย'
    WHEN 'Looknam'             THEN 'กทม'
    WHEN '𝙰𝙾𝚈 ᵒʳᵃʸᵃ'           THEN 'กทม'
    ELSE NULL
  END,
  now(), now()
FROM cal c CROSS JOIN maxserial mx;
