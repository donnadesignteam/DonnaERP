-- ============================================================================
-- นำเข้างานเคลมจากชีท movement_log -> ตาราง claims   (สร้าง 2026-07-29)
-- ชีท: 1o_tuQmUvd__cV3-S3X5Z3iIA3FFPgL66PEv8E1mufDQ  แท็บ movement_log
-- ครอบคลุม Serial 0001-0118 (มีข้อมูลจริง 116 เคส) วันที่ 2/5/2026 - 23/7/2026
--
-- วิธีใช้: Supabase -> SQL Editor -> วางทั้งไฟล์ -> Run
-- รันซ้ำได้: ทุกคำสั่งเช็ค "ชีทเคลม #NNNN" ในช่องหมายเหตุก่อน ถ้ามีแล้วจะข้าม
--
-- การแปลงข้อมูล (สรุป):
--   วันที่แจ้งเคลม -> claim_date        จาก(เคลม:X) -> channel        ID -> customer_username
--   ปัญหา -> รายละเอียดสาเหตุ (cause)   รายละเอียดงาน -> ข้อความดิบ (raw_text)
--   วิธีการแก้ไขปัญหา -> แตกเป็น "รายการที่เคลม" (items) + เก็บข้อความเต็มไว้ในหมายเหตุ
--   ประเภทเคลม (claim_type) = เว้นว่าง ตามที่ตกลงกันไว้ ให้ทีมมาเลือกเอง
--   งานเสร็จ TRUE -> สถานะ 'ส่งแล้ว'  (ช่อง "ปิดงาน" เว้นว่างไว้ เพราะชีทไม่มีวันปิดงานจริง — ทีมติ๊กปิดเองในเว็บได้ ระบบจะลงวันให้)
--   งานเสร็จ FALSE -> สถานะ 'รอของคืน'
--   ผิดโดย (ชื่อคน) -> ผู้รับผิดชอบ = 'ร้าน' (ชื่อคนเก็บไว้ในหมายเหตุ), 'ระบบขนส่ง' -> 'ขนส่ง'
--   ค่าขนส่งที่ให้ลูกค้าส่งมา -> ค่าส่งกลับ · ค่าขนส่งที่เราส่งให้ -> ค่าส่งคืน · ราคา(ประเมิน) -> ราคาประเมิน
--   เก็บเงินเพิ่ม -> ยอดเงิน+ทิศทาง 'เก็บลูกค้า' · ข้อความที่ระบุคืนเงิน -> 'คืนลูกค้า'
-- ============================================================================

-- #0001 2/5/2026 | katim_tik
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-02', 'Shopee', 'katim_tik', NULL, NULL, NULL, 'ลูกค้าส่งม่านมาแก้ค่ะ',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "S01", "color_name": "ครีมมินิมอล", "color_desc": "ตาไก่สีสัก", "width": "2.50", "height": "2.05", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "แก้ความสูงจาก 2.20"}, {"type": "ผ้าโปร่งตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวนวล", "color_desc": "ตาไก่สีสัก", "width": "2.50", "height": "2.05", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'รอที่อยู่
40/17 ม9 มบ.แอสโทเรีย พหลโยธิน ลำลูกกา ต.ลาดสวาย
อ.ลำลูกกา จ.ปทุมธานี 12150', '086-3768099', 'Flash Express', 490, 'เก็บลูกค้า', 'ธนาคารกสิกรไทย',
       'ชำระแล้ว', 'ส่งแล้ว', 'ชีทเคลม #0001 · ประเภทงานในชีท: งานแก้ลูกค้าเพิ่มเงินเอง · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · สถานะการชำระในชีท: ชำระสำเร็จ · ผู้รับชำระ: หนูนา', '2/5/69
shopee : katim_tik
 ลูกค้าส่งม่านมาแก้ค่ะ

ออเดอร์เดิม
ผ้าม่านตาไก่ สีสัก
S01 สีครีมมินิมอล · 
ก2.50*ส2.20 = 2 ผืน

(สั่งตัด)  ม่านตาไก่  สีสัก
โปร่งลายฝนขาวนวล 
2.50*2.20 = 2ผืน
___________________________
แก้เป็น 
ผ้าม่านตาไก่ สีสัก
S01 สีครีมมินิมอล · 
ก2.50*ส2.05 = 2 ผืน

(สั่งตัด)  ม่านตาไก่  สีสัก
โปร่งลายฝนขาวนวล 
2.50*2.05 = 2ผืน

ค่าแก้ 490 บาทบวกค่าส่งอีก 60 บาท
รวมทั้งหมด 550 บาท ชำระเรียบร้อยค่ะ 

รอที่อยู่', 'หนูนา', NULL, NULL,
       NULL, 60, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0001%');
-- #0002 2/5/2026 | after_midnight
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-02', 'Shopee', 'after_midnight', NULL, NULL, 'ร้าน', 'งานแก้จัดส่ง **แอดมินหนูนาสรุปไม่ครบ***',
       '[{"type": "รางม่านตาไก่", "floors": 1, "rail_head": "หัวกระดูม", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "1.50", "height": "", "quantity": 3, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่จัดส่ง
สุรีพร สุขดี 
209 ม.9 ต.นาแต้ อ.เมือง จ.อำนาจเจริญ 37000
0659746151', '0659746151', 'Flash Express', NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0002 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: หนูนา · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 50 บาท · สถานะการชำระในชีท: ไม่มีจ่ายคืนลูกค้า · วิธีแก้: รางม่านตาไก่ 1 ชั้น หัวกระดูม สีขาว ขนาด 1.50 = 3 ชุด', 'ได้รับม่านตาไก่ไม่ครบ ได้รับแค่ 1 ชุด ขาดไป 3 ชุด
รางม่านตาไก่ 1 ชั้น
หัวกระดูม สีขาว ขนาด 1.50 = 3 ชุด', 'กาย', NULL, NULL,
       NULL, 25, 6, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0002%');
-- #0003 3/5/2026 | noodee99
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-03', 'Shopee', 'noodee99', NULL, NULL, 'ร้าน', 'กค้าสั่งม่านขนาด 4.00 ม. ค่ะ แต่มีการโอนเพิ่มเป็นขนาด 4.80 

 ยังไม่ได้ลงออเดอร์เพิ่ม รบกวนโอนเงินส่วนต่างคืนลูกค้าตามเลขบัญชีนี้ค่ะ',
       NULL, NULL, NULL, NULL, 524, 'คืนลูกค้า', NULL,
       'โอนแล้ว', 'ส่งแล้ว', 'ชีทเคลม #0003 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · สถานะการชำระในชีท: ชำระสำเร็จ · วิธีแก้: โอนเงินคืนลูกค้า 524', NULL, 'แพท', NULL, NULL,
       NULL, NULL, 524, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0003%');
-- #0004 1/6/2026 | mamoomint
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'mamoomint', '260419923WYG1W', NULL, 'ร้าน', 'ได้รับตัวมีตำหนิ ผ้าเป็นรู 
ได้แจ้งทางลูกค้าส่งผ้ากลับมาแล้วครับ 
รอเลขพัสดุจากลูกค้าครับ',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "KB-1", "color_name": "Mocha gray", "color_desc": "ตาไก่โอ๊ค", "width": "2.50", "height": "2.10", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ผ้าเป็นรู"}]'::jsonb, 'เลขบัญชี 0678612324 กสิกรไทย
สุประวีณ์ ประเสริฐสกุลไชย
แจ้งลูกค้าไว้หากของมาถึงจะทำการโอนค่าส่งคืนให้ครับ', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0004 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ศรี · ค่าเคลมสินค้า: 1200 บาท · สถานะการชำระในชีท: ไม่มีจ่ายคืนลูกค้า · วิธีแก้: **สอบถามพี่ยุ้ย คิดว่าเกิดจากรอยการใช้เข็มหมุดในการปักผ้า เพราะ ผ้ามีรอยที่เสมอกัน ทุกรอย', '19 เม.ย. 2026
shopee: mamoomint
260419923WYG1W

ผ้าม่านตาไก่ ตาไก่โอ๊ค
KB-1 Mocha gray 
ก2.50*ส2.10 = 2 ผืน 2,544 บาท', 'กาย', NULL, NULL,
       77, 18, 2544, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0004%');
-- #0005 4/5/2026 | lungountree
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-04', 'Shopee', 'lungountree', NULL, NULL, 'ร้าน', '(fire)(fire)ตกหล่น เคลมส่งด่วน(fire)(fire)
4 พ.ค. 2026
shopee: lungountree

ลูกค้าสั่ง ผ้าม่านตาไก่ ตาไก่สีขาว
M20 เบจ 
ก3.50*ส2.61 = 2 ผืน
แต่ได้รับแค่ 1 ผืน และได้รับเป็นตาไก่สัก

ที่อยู่
คุณ มิกิ 
เลขที่ 101/49 มบ.เดอะแพลนท์ ชัยพฤกษ์-วงแหวน 
หมู่ 11 ถ.คลองเจ๊ก ต.บางบัวทอง อ.บางบัวทอง 
จ.นนทบุรี 11110
เบอร์โทรศัพท์ 0911894931',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M20", "color_name": "เบจ", "color_desc": "ตาไก่สีขาว", "width": "3.50", "height": "2.61", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ี่อยู่
คุณ มิกิ 
เลขที่ 101/49 มบ.เดอะแพลนท์ ชัยพฤกษ์-วงแหวน 
หมู่ 11 ถ.คลองเจ๊ก ต.บางบัวทอง อ.บางบัวทอง 
จ.นนทบุรี 11110
เบอร์โทรศัพท์ 0911894931', '0911894931', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0005 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กายสรุปผืนผิด ผู้ช่วยช่างตาไก่ผิด · ส่งแก้: หน้าร้าน · สถานะการชำระในชีท: ไม่มีจ่ายคืนลูกค้า · วิธีแก้: สั่งตัดใหม่  ผ้าม่านตาไก่ ตาไก่สีขาว
M20 เบจ 
ก3.50*ส2.61 = 1 ผืน', '30 เม.ย. 2026
shopee: lungountree
2604306H26S6U8

รางม่านตาไก่ 1 ชั้น 
หัวกลมเรียบ สีสัก
ขนาก 3.50 = 1 ชุด 

ผ้าม่านตาไก่ ตาไก่สีขาว
M20 เบจ 
ก3.50*ส2.61 = 2 ผืน

*แก้ค่ะ*  @All', 'กาย', NULL, NULL,
       NULL, NULL, 1432, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0005%');
-- #0006 4/5/2026 | user463120555
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-04', 'Tiktok', 'user463120555', NULL, NULL, NULL, '6 พ.ค. 2026
Tiktok เคลม : user463120555
583848228839458760

ผ้าม่านตาไก่  ตาไก่สุ่มสีขาว
โปร่ง Mid Modern 
ก2.00*ส2.00 = 1 ผืน',
       '[{"type": "ผ้าโปร่งตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "Mid Modern", "color_desc": "ตาไก่สุ่มสีขาว", "width": "2.00", "height": "2.00", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ชลธิชา เผ่าพันธุ์
หมู่ที่ 1 ตำบลบางคลาน
อำเภอโพทะเลจังหวัดพิจิตร
66130', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0006 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · สถานะการชำระในชีท: ไม่มีจ่ายคืนลูกค้า · วิธีแก้: ผ้าม่านตาไก่  ตาไก่สุ่มสีขาว
โปร่ง Mid Modern 
ก2.00*ส2.00 = 1 ผืน', '4 พ.ค. 2026
Tiktok : user463120555
583848228839458760

ผ้าม่านตาไก่  ตาไก่สุ่มสีขาว
โปร่ง Mid Modern 
ก2.00*ส2.00 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, 25, 678, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0006%');
-- #0007 4/5/2026 | meili.994
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-04', 'Tiktok', 'meili.994', '583843297812580307', NULL, 'ร้าน', '(fire)(fire)ตกหล่น (fire)(fire)
03/05/2026
tiktok : meili.994
583843297812580307

รางม่านตาไก่ ราง2ชั้น 
สีสัก
ขนาด 3.20 = 1 ชุด

ผ้าม่านตาไก่ ตาไก่สุ่มสีขาว 
ผ้าโปร่งลายฝนขาวนวล
ก3.50*ส2.80 = 2 ผืน

ผ้าม่านตาไก่ ตาไก่สุ่มสีขาว 
SHB97 Linen Beige 
ก2.50*ส2.80 = 4 ผืน
ก3.50*ส2.80 = 2 ผืน
รอที่อยู่จัดส่ง 
***แอดมินสรุปออร์เดอร์ตกหล่นไปครับ',
       '[{"type": "รางม่านตาไก่", "floors": 2, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "สัก", "color_desc": "", "width": "3.20", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}, {"type": "ผ้าโปร่งตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวนวล", "color_desc": "ตาไก่สุ่มสีขาว", "width": "3.50", "height": "2.80", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "ตาไก่สุ่มสีขาว", "width": "2.50", "height": "2.80", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "ตาไก่สุ่มสีขาว", "width": "3.50", "height": "2.80", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ทีอยู่จัดส่ง 
คุณ meili.994
สิริกร อภิชัยอภินัน
บ้านเลขที่ 5 ห้วยอื่น หมู่10 ต.เทอดไทย 
อ.แม่ฟ้าหลวง จ.เชียงราย 57240
เบอร์โทรศัพท์ 0641642930', '0641642930', 'SPX Express', NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0007 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: หนูนา · ส่งแก้: หน้าร้าน · สถานะการชำระในชีท: ไม่มีจ่ายคืนลูกค้า · วิธีแก้: ผลิตเพิ่ม (fire)(fire)ตกหล่น (fire)(fire)
03/05/2026
tiktok : meili.994
583843297812580307

รางม่านตาไก่ ราง2ชั้น 
สีสัก
ขนาด 3.20 = 1 ชุด

ผ้าม่านตาไก่ ตาไก่สุ่มสีขาว 
ผ้าโปร่งลายฝนขาวนวล
ก3.50*ส2.80 = 2 ผืน

ผ้าม่านตาไก่ ตาไก่สุ่มสีขาว 
SHB97 Linen Beige 
ก2.50*ส2.80 = 4 ผืน
ก3.50*ส2.80 = 2 ผืน
รอที่อยู่จัดส่ง 
***แอดมินสรุปออร์เดอร์ตกหล่นไปครับ', '03/05/2026
tiktok : meili.994
583843297812580307

รางม่านตาไก่ สีสักลายไม้
ราง1ชั้น, 2.80 = 2 ชุด', 'หนูนา', NULL, NULL,
       NULL, 18, 675, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0007%');
-- #0008 1/6/0206 | pat_srpp
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'pat_srpp', '250926H85K2UYQ', NULL, NULL, 'เจ้านี้ส่งม่านมาแก้เป็นม่านตาไก่ค่ะ

ออเดอร์เดิม
26 ก.ย. 2025, 
shopee: pat_srpp
250926H85K2UYQ

ผ้าม่านลอนตะขอยาว
SHB97 Linen Beige
ก3.80*สูง3.15 =2ผืน',
       '[{"type": "ผ้าม่านลอนตะขอยาว", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "", "width": "3.80", "height": "3.15", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ลูกค้าส่งมาแก้เป็นม่านตาไก่ จ่ายเงินเพิ่มเอง"}]'::jsonb, 'ยังไม่มีที่อยู่ลูกค้า', NULL, NULL, 690, 'เก็บลูกค้า', NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0008 · ประเภทงานในชีท: งานแก้ลูกค้าเพิ่มเงินเอง · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ลูกค้าส่งผ้ากลับมาแก้ ลูกค้าจ่านเงินเพิ่มเอง', '26 ก.ย. 2025, 
shopee: pat_srpp
250926H85K2UYQ

ผ้าม่านลอนตะขอยาว
SHB97 Linen Beige
ก3.80*สูง3.15 =2ผืน

ส่ง3-10-68', 'หนูนา', NULL, NULL,
       NULL, 48, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0008%');
-- #0009 7/5/2026 | maymaymaymay521
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-07', 'Shopee', 'maymaymaymay521', NULL, NULL, 'ร้าน', 'สรุุปตกหล่นไปอย่างละ2ผืน',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB24", "color_name": "White Cream", "color_desc": "ตาไก่สีสัก", "width": "1.10", "height": "2.20", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB24", "color_name": "White Cream", "color_desc": "ตาไก่สีสัก", "width": "1.30", "height": "2.20", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าโปร่งตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "Mid Modern", "color_desc": "ตาไก่สีสัก", "width": "1.10", "height": "2.20", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าโปร่งตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "Mid Modern", "color_desc": "ตาไก่สีสัก", "width": "1.30", "height": "2.20", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'นางสาวศินันท์ญภา สุขลี่ 
10/33 หมู่7 ต.เกาะแก้ว อ.เมือง จ.ภูเก็ต 83000', 'โทร 080-6487668', 'Flash Express', NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0009 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งไปเพิ่มให้ถูกต้องตามที่ลูกค้าสั่งเข้ามา', '4 เม.ย. 2026
Shopee: maymaymaymay521
2604040FWPVCQA
2604040FWPVCQB

ผ้าม่านตาไก่   ตาไก่สีสัก
HB24 White Cream
ก1.10 *ส2.20 =2 ผืน
ก1.30 *ส2.20 =2 ผืน

ผ้าโปร่งตาไก่   ตาไก่สีสัก
โปร่ง Mid Modern
ก1.10 *ส2.20 =2 ผืน
ก1.30 *ส2.20 =2 ผืน

รางตาไก่ 2ชั้น  กลมเรียบ สีสัก
2.20  = 2 ชิ้น
2.60  = 2 ชิ้น

ตกหล่น กำหนดส่ง 21.04.2569', 'หนูนา', NULL, NULL,
       NULL, 33, 8700, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0009%');
-- #0010 7/5/2026 | evesarunrukk919
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-07', 'Tiktok', 'evesarunrukk919', NULL, NULL, 'ร้าน', '8/5/69
Tiktok : evesarunrukk919
ทำผิดค่ะ ลูกค้าได้รับผ้า1.50*1.60 = 3 ผืน
1.50*2.00 = 1 ผืน',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB81", "color_name": "ครีมหม่นขาว", "color_desc": "ตาไก่สีขาว", "width": "1.50", "height": "2.00", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่
ของอีฟ
87/1 ซอยพหลโยธิน26 แยก3 
ถนนพหลโยธิน แขวงจอมพล เขตจตุจักร กทม. 10900', 'Tel 0969162365', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0010 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ไก่ · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 200 บาท · วิธีแก้: ส่งเป็น
ผ้าม่านตาไก่ ตาไก่สีขาว 
HB81 ครีมหม่นขาว
1.50*ส2.00 = 1 ผืน', '2 พ.ค. 2026
Tiktok : evesarunrukk919
583813981229384721

ผ้าม่านตาไก่ ตาไก่สีขาว 
HB81 ครีมหม่นขาว
ก1.50*ส1.60 = 2 ผืน
ก1.50*ส2.00 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, 50, 764, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0010%');
-- #0011 8/5/2026 | mildpiyanut
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-08', 'Shopee', 'mildpiyanut', NULL, NULL, NULL, 'รางงอจากการขนส่ง',
       '[{"type": "รางม่านลอนเทป (เฉพาะราง)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "2.00", "height": "", "quantity": 2, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'คุณปิยนุช
หมู่บ้านกมลลักษณ์ 50/63 ซอย3 หมู่2 ซอยวัดมะเดื่อ ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี 11110', '0853571650', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0011 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: รางเทป สีขาว เฉพาะราง
2.00=2ชิ้น', 'รางม่านลอนเทป2ชั้น 
ขาว แยกกลาง 2.00 =1ชุด', 'หนูนา', NULL, NULL,
       NULL, 63, 1560, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0011%');
-- #0012 9/5/2026 | kukkai10
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-09', 'Shopee', 'kukkai10', NULL, NULL, 'ร้าน', 'ได้้ตะขอเกี่ยวม่านไม่ครบ',
       '[{"type": "ตะขอเกี่ยวม่าน อะลูมิเนียม", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'คุณ วัชรชัย บุญถนอม 
224/70 ต.แพรกษาใหม่ อ.เมือง จ. สมุทรปราการ 10280', 'เบอร์ 0871546799', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0012 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: บอย · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งตะขอไป 1 ตัว', 'ตะขอเกี่ยวม่าน อะลูมิเนียม สีดำ', 'หนูนา', NULL, NULL,
       NULL, 18, 2, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0012%');
-- #0013 9/5/2026 | pthumdee
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-09', 'Shopee', 'pthumdee', NULL, NULL, 'ร้าน', 'รับผ้าความสูงขนาดไม่กับที่สั่งไว้',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB94", "color_name": "Brick Brown", "color_desc": "ตาไก่สีขาว", "width": "2.00", "height": "2.53", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB94", "color_name": "Brick Brown", "color_desc": "ตาไก่สีขาว", "width": "2.00", "height": "2.52", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB94", "color_name": "Brick Brown", "color_desc": "ตาไก่สีขาว", "width": "2.20", "height": "2.77", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ปอ พนิฏฐะยาต์ 168/2 หมู่บ้านดีวาดี5 ม.1 (ตรงข้ามห้องเช่าเจ๊นงเยาว์2) ต.ชากบก อ.บ้านค่าย จ.ระยอง 21120', '(0809364551)', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0013 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ยุ้ย · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 427.6 บาท · วิธีแก้: แก้เป็น
ผ้าม่านตาไก่ ตาไก่สีขาว
SHB94 Brick Brown
ก2.00*ส2.53 = 1 ผืน
ก2.00*ส2.52 = 1 ผืน
2.20*2.77=2ผืน', 'เดิม
ผ้าม่านตาไก่ ตาไก่สีขาว
SHB94 Brick Brown
ก2.00*ส2.54 = 2 ผืน
ก2.20*ส2.79 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, 4276, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0013%');
-- #0014 3/5/2026 | meili.994
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-03', 'Tiktok', 'meili.994', NULL, NULL, 'ร้าน', 'สรุปไม่ครบ',
       '[{"type": "รางม่านตาไก่", "floors": 2, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "สัก", "color_desc": "", "width": "3.20", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}, {"type": "ผ้าโปร่งตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวนวล", "color_desc": "ตาไก่สุ่มสีขาว", "width": "3.50", "height": "2.80", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "ตาไก่สุ่มสีขาว", "width": "2.50", "height": "2.80", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "ตาไก่สุ่มสีขาว", "width": "3.50", "height": "2.80", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'บ้านเลขที่ 5 ห้วยอื้น หมู่10 ต.เทอดไทย อ.แม่ฟ้าหลวง จ.เชียงราย 57240', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0014 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: หนูนา · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งเพิ่ม
รางม่านตาไก่ ราง2ชั้น 
สีสัก
ขนาด 3.20 = 1 ชุด

ผ้าม่านตาไก่ ตาไก่สุ่มสีขาว 
ผ้าโปร่งลายฝนขาวนวล
ก3.50*ส2.80 = 2 ผืน

ผ้าม่านตาไก่ ตาไก่สุ่มสีขาว 
SHB97 Linen Beige 
ก2.50*ส2.80 = 4 ผืน
ก3.50*ส2.80 = 2 ผืน', '03/05/2026
tiktok : meili.994
583843297812580307

รางม่านตาไก่ สีสักลายไม้
ราง1ชั้น, 2.80 = 2 ชุด', 'หนูนา', NULL, NULL,
       NULL, 33, 4043, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0014%');
-- #0015 10/5/2026 | sirinapapskss
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-10', 'Shopee', 'sirinapapskss', NULL, NULL, NULL, 'สั่งรางยึดผนัง แจ้งว่าไม่ได้รับ
ตัวข้อต่อระบบสปริงยืดหด',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0015 · สถานะในชีท: งานเสร็จแล้ว · วิธีแก้: แจ้งลูกค้าเรียบร้อย ของอยู่ในห่อพัสดุ', '21 เม.ย. 2026, 
shopee: sirinapapskss
260421E0DY6DX2

รางยึดผนังแบบไม่ต้องเจาะ ยืดได้1.10-3.10เมตร 
ขาวล้วน ·  =1

(สั่งตัด) ผ้าม่านซ่อนหู ใส่เคมี
HB87 ลินินหม่นขาว 
· กว้าง1.50*สูง1.97 = 1 ผืน 
· กว้าง2.50*สูง2.05 = 2 ผืน

ส่งก่อน 2026-05-05 21:38', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0015%');
-- #0016 11/5/2026 | thanapol22622
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-11', 'Shopee', 'thanapol22622', NULL, NULL, NULL, 'ไม่ได้รับราง',
       '[{"type": "รางม่านลอนเทป", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ไม้อ่อน", "color_desc": "", "width": "2.50", "height": "", "quantity": 3, "unit": "ชุด", "hooks": "", "note": "แยกกลาง"}]'::jsonb, 'ธนพล นวลแสง
114 ม.1 ต.ลมศักดิ์ อ.ขุขันธ์ จ.ศรีสะเกษ 33140', '0940367002', 'Flash Express', NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0016 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งรางแยก เนื่องจากส่งของไม่ทัน เลยส่งผ้าไปก่อน 
shopee: thanapol22622

รางม่านลอนเทป 1 ชั้น
สีไม้อ่อน แยกกลาง
ขนาด 2.50 = 3 ชุด', '15 เม.ย. 2026
shopee: thanapol22622
260415V1F74XQR

รางม่านลอนเทป 1 ชั้น
สีไม้อ่อน แยกกลาง
ขนาด 2.50 = 3 ชุด

ผ้าม่านลอนเทป 
S01 สีครีมมินิมอล
ก1.25* ส2.38 = 6 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, 2925, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0016%');
-- #0017 11/5/2026 | kukkai10
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-11', 'Shopee', 'kukkai10', NULL, NULL, 'ร้าน', 'ขาดหัวรางม่าน',
       '[{"type": "หัวรางม่านตาไก่ หัวกลมเรียบ", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่ 
คุณ วัชรชัย บุญถนอม 
224/70 ต.แพรกษาใหม่ อ.เมือง จ. สมุทรปราการ 10280', '0871546799', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0017 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: พงศ์ · ส่งแก้: หน้าร้าน · วิธีแก้: หัวกลมเรียบไป 1 ตัว', '16 เม.ย. 2026
shopee : kukkai10
2604160B7SWC69


รางม่านตาไก่ หัวกลมเรียบ 
ราง2ชั้น (สีดำ) 
1.50 = 3 ชุด
1.53 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, 18, 15, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0017%');
-- #0018 11/5/2026 | Xoxo
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-11', 'LineOA', 'Xoxo', NULL, NULL, NULL, 'สายดึงหลุด',
       '[{"type": "สายดึงมู่ลี่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่ในการจัดส่ง
พรลภัส บุญประสิทธิ์ บ้านเลขที่ 1 หมู่ 6 
ต.โคคลาน อ. ตาพระยา จ. สระแก้ว ( 27180)', '0822860597', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0018 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ทำการส่งตัวสายดึงมูลี่', 'มู่ลี่ไม้ ✅ฝากบริษัทส่ง เราส่งฟุกน็อตค่ะ
 H-40-103-32 sand บังราง
1.70*1.32 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, NULL, 0, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0018%');
-- #0019 11/5/2026 | earth_upsidedown
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-11', 'Shopee', 'earth_upsidedown', NULL, NULL, 'ร้าน', 'ลูกค้าไม่ได้ผ้า 1 ผืน
เนื่องจากแอดมินทำการแก้ไขแต่ไม่แจ้งหน้าร้าน',
       '[{"type": "ผ้าม่านจีบ 2 จีบ ตะขอสั้นบังราง", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M21", "color_name": "sand", "color_desc": "", "width": "1.50", "height": "1.50", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'หจก. นอร์ทเทอร์นเอกซ์โพเรชั่น สำนักงานใหญ่
271 ถ.ช้างเผือก ต.ช้างเผือก อ.เมือง จ.เชียงใหม่ 50300', '053-221659', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0019 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ส่่งเพิ่ม
(สั่งตัด) ผ้าม่านจีบ  2 จีบ ตะขอสั้นบังราง
M21 sand 
· ก1.50*สูง1.50 =1ผืน', '22 เม.ย. 2026, 
shopee: earth_upsidedown
260422GH88YWAY

📍(สั่งตัด) ผ้าม่านจีบ  2 จีบ ตะขอสั้นบังราง
M21 sand 
· ก1.50*สูง1.50 =1ผืน 

📍รางม่านจีบ รางเอ็ม 
ไม้อ่อน1ชั้น เดี่ยว · 1.00 =2ชุด
ไม้อ่อน1ชั้น เดี่ยว · 1.50 =2ชุด
ไม้อ่อน2ชั้น เดี่ยว · 2.20=1ชุด

📍(สั่งตัด) ม่านพับมินิมอล 
HB87 ลินินหม่นขาว 
· ก1.30*สูง1.50 =1ชุด ดึงซ้าย', 'หนูนา', NULL, NULL,
       NULL, 41, 1244, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0019%');
-- #0020 13/5/2026 | htqq9usd3m
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-13', 'Shopee', 'htqq9usd3m', NULL, NULL, 'ร้าน', 'จัดขารางผิด',
       '[{"type": "ขาราง 2 ชั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "จัดขารางผิด"}]'::jsonb, 'ซันนี่ 0808238790
75/6 ม.10 ต.คุระ อ.ครุบุรีจ.พังงา 82150', '0808238790', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0020 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: พงศ์ · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 100 บาท · วิธีแก้: ส่งเป็น
ขาราง2 ชั้น = 1 ชุด', '21 เม.ย. 2026, 
shopee: htqq9usd3m
260421D10SNHD6

📍รางsnake1ชั้น สีไม้อ่อนแยกกลาง  1.40 = 3 ชุด (12+12)

ม่านลอนเทป S01 สีครีมมินิมอล 
0.70*1.60 = 6 ผืน (12+12)

📍รางsnake2ชั้น สีไม้อ่อนแยกกลาง 1.60 = 1 ชุด (14+14)', 'หนูนา', NULL, NULL,
       NULL, 25, 98, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0020%');
-- #0021 13/5/2026 | tono_tomo
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-13', 'Shopee', 'tono_tomo', NULL, NULL, 'ร้าน', 'ลูกค้าแก้ไขรางแต่
แอดมินทำการแก้ไขแต่ไม่แจ้งหน้าร้าน',
       '[{"type": "รางม่านลอนโซ่ไข่ปลา", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "3.50", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "แยกกลาง"}, {"type": "รางม่านลอนโซ่ไข่ปลา", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "3.20", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "แยกกลาง"}]'::jsonb, 'ที่อยู่
มะลิวัลย์ ทองแก้ว
219-221 ถนนราษอุทิศ 
ต.หาดใหญ่ อ.หาดใหญ่
จ.สงขลา   90110', '894675588', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0021 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 100 บาท · วิธีแก้: ส่งใหม่เป็น
รางม่านลอนโซ่ไข่ปลา1ชั้น 
แยกกลาง(ขาว) · 
3.50= 1 ชุด
3.20= 1 ชุด', 'ออเดอร์เดิม
shopee : tono_tomo
 260507S7B0DY76

ตัวต่อโค้ง รางม่านจีบ
ตัวต่อรางจีบ = 2 ชุด

รางม่านลอนโซ่ไข่ปลา1ชั้น 
เดี่ยว(ดำ) · 
4.00 = 1 ชุด
3.50=1 ชุด
3.20= 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, 25, 1876, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0021%');
-- #0022 13/5/2026 | mamoomint
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-13', 'Shopee', 'mamoomint', NULL, NULL, NULL, 'ผ้าเป็นรู',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "KB-1", "color_name": "Mocha gray", "color_desc": "ตาไก่โอ๊ค", "width": "2.50", "height": "2.10", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่ 
คุณ สุประวีณ์ ประเสริฐสกุลไชย
168/321 หมู่บ้านอรุณทอง 5 ซอย 2 
ถ.เลียบคลองภาษีเจริญฝั่งเหนือ แขวง/เขต หนองแขม 
กทม. 10160', '0902540815', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0022 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งใหม่เป็็น

ผ้าม่านตาไก่ ตาไก่โอ๊ค
KB-1 Mocha gray 
ก2.50*ส2.10 = 2 ผืน', 'ผ้าม่านตาไก่ ตาไก่โอ๊ค
KB-1 Mocha gray 
ก2.50*ส2.10 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, 2545, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0022%');
-- #0023 15/5/2026 | myspeare11
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-15', 'Shopee', 'myspeare11', NULL, NULL, NULL, 'ตกหล่นระหว่างขนส่ง',
       '[{"type": "หัวปิดรางม่านตาไก่ หัวกระดูม", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 5, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่ในการจัดส่ง 
คุณ เพ็ญพิชชา รัตนปัญญาโชติ
63/18 ถ.ศรีน้ำซึม ต.อุทัยใหม่ อ.เมือง จ.อุทัยธานี 61000', '0848220977', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0023 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งเป็็น

หัวปิดรางม่านตาไก่ สีดำ หัวกระดูม = 5 ชิ้น', '26 เม.ย. 2026
Shopee : myspeare11
260426THEW7K5N

รางม่านตาไก่ 2ชั้น 
หัวกระดูม สีดำ 
ขนาด 1.50 = 1 ชุด
ขนาด 1.685 = 1 ชุด
ขนาด 2.485 = 1 ชุด 
ขนาด 2.785 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, 25, 30, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0023%');
-- #0024 1/6/2026 | mitra
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'mitra', NULL, NULL, NULL, 'ความกว้างและความสูงตัดผิด
รอผ้าถึงร้านและทำการรีเช็คอีกครั้ง',
       '[{"type": "ผ้าม่านจีบ 2 จีบ ตะขอสั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M21", "color_name": "sand", "color_desc": "", "width": "0.605", "height": "1.60", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านจีบ 2 จีบ ตะขอสั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M21", "color_name": "sand", "color_desc": "", "width": "0.75", "height": "1.60", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0024 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ลูกค้าเข้าใจผิดการวัดจีบ ของร้านเรา แต่พอดีตอนรีด ผ้ามีปัญหา เลย ทำใหม่ให้ลูกค้าเลย · หมายเหตุ: เช็คแล้ว ไม่เบี้ยว', '27 เม.ย. 2026
Shopee : mitra
260427VPY1XQHG

รางม่านจีบ 1 ชั้น
เดี่ยว สีสักเข้ม 
ขนาด 0.605 = 1 ชิ้น

รางม่านจีบ 1 ชั้น
แยกกลาง สีสักเข้ม 
ขนาด 1.50 = 1 ชิ้น

ผ้าม่านม่านจีบ 2 จีบ ตะขอสั้น
M21 sand  
ก0.605*ส1.60 = 1 ผืน 
ก0.75*ส1.60 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, 88, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0024%');
-- #0025 16/5/2026 | uribouz
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-16', 'Shopee', 'uribouz', NULL, NULL, 'ร้าน', 'ได้รับผ้าเกิน
คาดว่าเป็นของเจ้า garoove
260427VHSUSA6K',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0025 · ประเภทงานในชีท: งานตกหล่นส่งเพิ่ม · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ที · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งผ้าเกินกลับ', '28 เม.ย. 2026, 
shopee: uribouz
2604292PTST494

(สั่งตัด) ผ้าม่านจีบ 2 จีบ ตะขอยาว
หนาพิเศษ richy
1.00*1.20 =1ผืน', 'หนูนา', NULL, NULL,
       NULL, 100, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0025%');
-- #0026 16/5/2026 | aumworld
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-16', 'Shopee', 'aumworld', NULL, NULL, NULL, 'ฝาปิดหัก 2 ชิ้น',
       '[{"type": "ฝาปิดสายดึงม่าน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 2, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่จัดส่ง
นายวิษณุ เสนจันตะ
บ้านเลขที่ 124 หมู่ 2 บ้านกลาง ตำบลด่านม่วงคำ อำเภอโคกศรีสุพรรณ จังหวัดสกลนคร 47280', '0800059615', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0026 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งใหม่
ฝาปิดสายดึงม่าน 2 ชิ้น', '6 เม.ย. 2026
Shopee : aumworld
2604064V2AUT39
2604064UY8PF47

มู่ลี่ไม้ โซ่วน ดึงขวา
ใบ50mm GW-103 Muji Cloud
ก1.30*ส1.25 = 1 ชุด 
ก1.25*ส1.25 = 2 ชุด', 'หนูนา', NULL, NULL,
       NULL, NULL, 0, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0026%');
-- #0027 16/5/2026 | bankkp.liamkittipan
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-16', 'Shopee', 'bankkp.liamkittipan', NULL, NULL, 'ร้าน', NULL,
       '[{"type": "ตัวพุก สกรู ยึดฝ้า", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่ในการจัดส่ง 
คุณพิเชษฐ เลี่ยมกิตติพันธุ์ 
77/560 ม.ชลลดาสายไหม ซ.สายไหม 34
แขวงสายไหม เขตสายไหม กทม. 10220', '95-789-8365', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0027 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ที · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งใหม่่
 ตัวพุก สกรู ยึดฝ้า = 1 ชุด', '1 พ.ค. 2026,
sopee: bankkp.liamkittipan
2605019VSNX12R

(สั่งตัด) ผ้าม่านจีบ 1 จีบ ตะขอสั้นบังราง
H22-9 เบจน้ำตาลเข้ม · ก1.00*สูง2.47 =1ผืน 

รางม่านจีบ1ชั้น รางเอ็ม 
ขาว1ชั้น เดี่ยว · 1.00 =1ชุด', 'หนูนา', NULL, NULL,
       NULL, 18, 25, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0027%');
-- #0028 16/5/2026 | kenji2
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-16', 'Shopee', 'kenji2', NULL, NULL, 'ร้าน', 'แอดมินสรุปข้อมูลออเดอร์ไม่ครบถ้วน
*รางสไลด์หรือแยกกลาง*',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "1.80", "height": "2.90", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "แก้เป็นแยกกลาง ความสูงลด 7 cm"}]'::jsonb, 'ที่อยู่เข้าไปรับผ้าแก้ไข 
คุณ ชลธิชา หยีมะเหร็บ
585 หมู่ 3 ตำบลละงูอำเภอละงูจังหวัดสตูล 91110/', '083-652-6263 หรือ 081-798-2274', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0028 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งผ้าใหม่
แก้ไขเป็น แยกกลาง ขนาดความสูงลดลงไป 7 cm 
ผ้าลอนเทป ขนาด ก1.80*ส2.90 = 2 ผืน', '4 เม.ย. 2026
Shopee : kenji2 
260404VXTAE4D3

ใช้บัญชี : yod8950 
260411HW8D3K5S (อัพเดทเลขสั่งซื้อใหม่)

รางม่านลอนเทป1ชั้น
ขนาด 3.6 = 1 ชิ้น 
ขนาด 2.2 = 1 ชิ้น 

ผ้าม่านลอนเทป
S01 สีครีมมินิมอล ·
ก2.2*ส2.7 = 1 ผืน
SHB98 Oatmeal 
ก3.60*ส2.9 = 1 ผืน', 'หนูนา', NULL, NULL,
       NULL, 50, 4316, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0028%');
-- #0030 16/5/2026 | kone_baby
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-16', 'Shopee', 'kone_baby', NULL, NULL, 'ร้าน', 'สรุปไม่ครบ',
       '[{"type": "ผ้าม่านซ่อนหู ใส่เคมี", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "S42", "color_name": "เทากรม", "color_desc": "", "width": "1.30", "height": "1.60", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'เอนก ประดิษฐารมณ์  1035 ซอยนวมินทร์14 แยก3 ถนนนวมินทร์ คลองจั่น บางกะปิ กทม. 10240', '0655545547', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0030 · ประเภทงานในชีท: งานตกหล่นส่งเพิ่ม · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: หนูนา · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งเพิ่ม

shopee : kone_baby

ผ้าม่านซ่อนหู ใส่เคมี
S42 เทากรม
ก1.30*ส1.60 = 1ผืน', '10 พ.ค. 2026
shopee : kone_baby
2605103J8VV7EH

ผ้าม่านซ่อนหู ใส่เคมี
S42 เทากรม
ก1.30*ส1.60 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, 18, 1063, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0030%');
-- #0031 1/6/2026 | bababal
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'bababal', NULL, NULL, NULL, 'ขนาดความสูงผิด',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Ash Linen", "color_desc": "", "width": "", "height": "", "quantity": 4, "unit": "ผืน", "hooks": "", "note": "แก้ความสูง 4 บาน (ของจริงสั้นกว่าป้าย 1-4 cm)"}]'::jsonb, 'ที่อยู่ในการส่งผ้ากลับ 
ฐิติพร อิสระวิริยะกุล
11 อ่อนนุช 59 แยก 1 แขวง/เขตประเวศ กทม. 10250', '0853433989', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0031 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 200 บาท · วิธีแก้: แก้
บานที่ 1 ป้ายระบุ 2.75*265.5 ของจริงยาว 261cm
บานที่ 2 ป้ายระบุ 1.05*265.5 ของจริงยาว 263cm
บานที่ 3 ป้ายระบุ 0.85*204.5 ของจริงยาว 201cm
บานที่ 4 ป้ายระบุ 0.85*204.5 ของจริงยาว 202cm', 'shopee: bababal
สั่งตัดผ้าม่านลอนเทป
ผ้าม่านลอนเทป 
SHB97 Ash Linen
ก0.85*ส2.045 = 2 ผืน(16)
ก1.05*ส2.655 = 2 ผืน(18+18)
ก1.05*ส2.045 = 2 ผืน(18+18)
ก2.75*ส2.655 = 1 ผืน(44)', 'หนูนา', NULL, NULL,
       NULL, 50, 13189, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0031%');
-- #0032 28/5/2026 | Olive 😆❤
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-28', 'LineOA', 'Olive 😆❤', NULL, NULL, 'ร้าน', 'ลุกค้าแจ้งว่าชายผ้าไม่เท่ากัน หากผ้ามาถึงร้านแล้ว
*** รบกวนเช็คความสูงให้ละเอียดทุกผืนก่อนส่งหน่อยนะคะ รอบก่อนความสูงไม่เท่ากันทั้ง4ผืนค่ะ***',
       '[{"type": "ม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB24", "color_name": "", "color_desc": "", "width": "1.10", "height": "2.15", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่จัดส่ง
ศุภณัฐฐา ทิพปภาพัฒน์
207/69 (ตึกแถว) หมู่บ้าน เมืองทอง 2/2
ถ.พัฒนาการ ซ. 61
แขวง ประเวศ เขต ประเวศ
กทม. 10250', '089 446 0404', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0032 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: น้าดาว · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 500 บาท · วิธีแก้: ทำใหม่เป็น 
ม่านลอนเทป 
HB24
ก1.10*ส2.15 = 4 ผืน · หมายเหตุ: เสียค่าติดตั้ง 1500', 'ออเดอร์เดิม
ม่านลอนเทป 
HB24
ก1.10*ส2.14 = 4 ผืน', 'หนูนา', NULL, NULL,
       NULL, 52, 5276, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0032%');
-- #0033 18/5/2026 | farfarjung
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-18', 'Shopee', 'farfarjung', NULL, NULL, 'ร้าน', 'ตกหล่น',
       '[{"type": "ตัวต่อรางตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 4, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่ง
ดวงใจ  (086-689-2679)
118/9 ม.9  ถนนสาริกาซอย 1 ต.โคกหล่อ อ.เมือง จ.ตรัง 92000', '0866892679', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0033 · ประเภทงานในชีท: งานตกหล่นส่งเพิ่ม · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: เกมส์ · ส่งแก้: หน้าร้าน · วิธีแก้: ตัวต่อรางตาไก่ =4 ชิ้น', '24 เม.ย. 2026
shopee: farfarjung
260424M9WEY55W

รางม่านตาไก่ 1 ชั้น
สีสักลายไม้ 
ขนาด 1.70 = 1 ชุด

รางม่านตาไก่ 2 ชั้น
สีสักลายไม้ 
ขนาด 2.00 = 2 ชุด

ผ้าม่านซ่อนหู ไม่ใส่เคมี  
S05 เทาเบจ
ก1.70*ส1.90 = 1 ผืน
ก2.50*ส1.90 = 2 ผืน 

ผ้าม่านซ่อนหู ไม่ใส่เคมี  
ผ้าโปร่งลายฝน ขาวนวล (Off-White)
ก2.00*ส1.90 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, 25, 116, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0033%');
-- #0034 18/5/2026 | pporr_apple
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-18', 'Shopee', 'pporr_apple', NULL, NULL, 'ร้าน', 'หัวปิดรางและลูกล้อขาด',
       '[{"type": "ตัวนำสไลด์และลูกล้อรางจีบ", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 3, "unit": "ชุด", "hooks": "", "note": "ราง 2 ชั้น = 6 ชิ้น"}, {"type": "ตัวปิดราง", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 6, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'ปอ พนิฏฐะยาต์ 168/2 หมู่บ้านดีวาดี5 ม.1 (ตรงข้ามห้องเช่าเจ๊นงเยาว์2) ต.ชากบก อ.บ้านค่าย จ.ระยอง 21120', '(0809364551)', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0034 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: พงศ์ · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 50 บาท · วิธีแก้: ส่งเป็น
ตัวนำสไลด์และลูกล้อรางจีบ =3ชุด (ราง2ชั้น =6ชิ้น)
ตัวปิดราง  =6 ชิ้น', '30 เม.ย. 2026
shopee: pporr_apple
2604306QD2CE0M

รางม่านจีบ2ชั้น 
สีขาว แยกกลาง 
ขนาด 1.80 = 1 ชุด 792 บาท หน้าต่างห้องทำงาน
ขนาด 1.70 = 1 ชุด 748 บาท หน้าต่างห้องโถง
ขนาด 1.90 = 1 ชุด 836 บาท ประตูระเบียงห้องนอน
ขนาด 3.30 = 1 ชุด 1,452 บาท ประตูเลื่อน

ม่านลอนตะขอ ตะขอสั้น
Macadamia 
ก1.80*ส2.285 = 2 ผืน 1,616 บาท หน้าต่างห้องทำงาน
ก1.90*ส2.985 = 2 ผืน 1,706 บาท ประตูระเบียงห้องนอน
ก3.30*ส2.545 = 2 ผืน 2,963 บาท ประตูเลื่อน

ผ้าโปร่งลอนตะขอ ตะขอสั้น 
ผ้าโปร่ง Linen
ก1.80*ส2.285 = 2 ผืน 1,220 บาท หน้าต่างห้องทำงาน
ก1.90*ส2.985 = 2 ผืน 1,288 บาท ประตูระเบียงห้องนอน
ก3.30*ส2.545 = 2 ผืน  2,237 บาท ประตูเลื่อน

ผ้าม่านลอนตะขอ ตะขอเพดาน
Macadamia 
ก1.70*ส2.30 = 2 ผืน 1,527 บาท หน้าต่างห้องโถง

ผ้าม่านลอนตะขอ ตะขอเพดาน
ผ้าโปร่ง Linen
ก1.70*ส2.30 = 2 ผืน 1,153 บาท หน้าต่างห้องโถง

รวมทั้งหมด 17,538 บาท', 'หนูนา', NULL, NULL,
       NULL, 32, 444, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0034%');
-- #0035 19/5/2026 | miilldthaa
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-19', 'Shopee', 'miilldthaa', NULL, NULL, 'ร้าน', 'ผู้ช่วยช่างใส่สีตาไก่ผิด ลูกค้าสั่งดำได้สีสัก',
       '[{"type": "ห่วงตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "ผู้ช่วยช่างใส่สีตาไก่ผิด ส่งตาไก่กลับให้ลูกค้า"}]'::jsonb, 'จ.ท.หญิง ธมลวรรณ  โคตรบรรเทา
บ้านเลขที่ 53/2450 หมู่บ้านพฤกษา 20 ซอย 8/3 ต.คูคต อ.ลำลูกกา จ.ปทุมธานี 12130', '0899801078', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0035 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ผู้ช่วยช่างทุกคน · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 50 บาท · วิธีแก้: ส่งแค่ตาไก่กลับให้ลูกค้า', 'Shopee : miilldthaa
สังผ้าม่านตาไก่ ออร์เดอร์ 260503EYBJX8S3
ผ้าม่านตาไก่ ตาไก่สีดำ
SHB97 Linen Beige
ก1.80*ส1.50 = 2 ผืน
ก1.80*ส1.60 = 4 ผืน', 'หนูนา', NULL, NULL,
       NULL, 25, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0035%');
-- #0036 20/5/2026 | momo.closet.shop
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-20', 'Shopee', 'momo.closet.shop', NULL, NULL, 'ร้าน', 'แอดมินไม่ได้ทำการเผื่อขนาดให้ลูกค้าค่ะ',
       '[{"type": "ผ้าม่านสอด", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ผ้าโปร่ง Richy", "color_desc": "", "width": "1.10", "height": "2.16", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านสอด", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ผ้าโปร่ง Richy", "color_desc": "", "width": "4.80", "height": "1.55", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่ในการจัดส่ง
คลเมขลา พิริยะเกียรติสกุล
สถานีรถไฟจิระ โครงการจิระไฮสปีดทาวน์ (MN Wedding Studio), เลขที่ 258/42 ถนน วัชรสฤษดิ์, ตำบลในเมือง, อำเภอเมืองนครราชสีมา ตำบลในเมือง อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา 30000', '0958981973', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0036 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ออเดอร์ใหม่
ผ้าม่านสอด
ผ้าโปร่ง Richy 
1.10*2.16 =2ผืน 746 บาท
4.80*1.55 =1ผืน 1627 บาท
รวม 2373 บาท', 'ออเดอร์เดิม
ผ้าม่านสอด
ผ้าโปร่ง Richy  
ก0.55*ส2.16 = 2 ผืน 
ก2.40*ส1.55 = 1', 'หนูนา', NULL, NULL,
       NULL, 46, 2373, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0036%');
-- #0037 21/5/2026 | yammiii
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-21', 'Shopee', 'yammiii', NULL, NULL, NULL, 'ลูกล้อรางจีบ ขาด 13 ตัว',
       '[{"type": "ลูกล้อรางจีบ", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 13, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'แยม
5/121 หมู่บ้านลลิลกรีนวิลล์ (บ้านสายเมนประตูครีมขาวตรงข้ามสนามเด็กเล่น) หมู่16 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540', '0920869325', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0037 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: จัดส่งลูกล้อรางจีบ13 ตัว · หมายเหตุ: ผิดหลายอย่าง', '3 ม.ค. 2026
shopee : yammiiigiftshop
260103496WUBXX

รางม่านจีบ1ชั้น 
สีขาว1ชั้น
3.64 = 1 ชุด 

(สั่งตัด) ผ้าโปร่งลอนตะขอ 
Richy
7.28*2.035 = 1 ผืน', 'หนูนา', NULL, NULL,
       NULL, 18, 26, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0037%');
-- #0038 21/5/2026 | newnani
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-21', 'Tiktok', 'newnani', NULL, NULL, 'ร้าน', 'ตาไก่่ผิด',
       '[{"type": "เปลี่ยนห่วงตาไก่ สีขาว", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "2.00", "height": "2.00", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ผ้าม่านโปร่งเรียบ ตาไก่สีขาว — ลูกค้าส่งผ้ากลับมาเปลี่ยนตาไก่"}]'::jsonb, 'จัดส่งด่วน
คุณ น.ส.พัชร์ณิษา เลิศวศินชุติพร
178/48 ตำรวจน้ำ ซอยเจริญนคร53 ถ.เจริญนคร 
เขตคลองสาน แขวงบางลำภูล่าง กทม. 10600', '0825916146', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0038 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: แพท · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 50 บาท · วิธีแก้: ให้ลูกค้าส่งผ้ากลับมา แล้วเราเปลี่ยนตาไก่ให้', '10 พ.ค. 2026
tiktok : newnani
583955384983979025


ผ้าม่านโปร่งเรียบ ตาไก่สีขาว
ก2.00*ส2.00 =2ผืน', 'หนูนา', NULL, NULL,
       NULL, 18, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0038%');
-- #0039 1/6/2026 | mybadminton_store
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'mybadminton_store', NULL, NULL, 'ร้าน', 'สรุปปเป็น2.30
ช่างเย็บเป็น2.50',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB81", "color_name": "ครีมหม่นขาว", "color_desc": "ตาไก่สีขาว", "width": "2.50", "height": "2.30", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "แก้ความสูงเป็น 2.30"}]'::jsonb, 'จัดส่ง 
นันท์ธณัษฐ์
41/300 August Condo อาคาร B ซอยเจริญกรุง80 ถนนเจริญกรุง แขวงวัดพระยาไกร เขตบางคอแหลม กทม. 10120', '0919422996', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0039 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: สู้ · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 50 บาท · วิธีแก้: แก้้ความสูงใหม่
เป็น2.30', '6 พ.ค. 2026,
shopee: MY BADMINTON STORE
260506PKJ3S2FM

สั่งตัด) ผ้าม่านตาไก่  สีขาว
HB81 ครีมหม่นขาว · ก2.50*สูง2.30 =2ผืน', 'หนูนา', NULL, NULL,
       NULL, 73, 2545, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0039%');
-- #0040 24/5/2026 | tassaneesu
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-24', 'Shopee', 'tassaneesu', NULL, NULL, 'ร้าน', 'ลูกค้าได้ม่านสลับค่ะ
คาดว่าสลับกับเจ้า momo',
       '[{"type": "ผ้าม่านซ่อนหู ไม่ใส่เคมี", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "5700", "color_name": "ครีมลาเต้", "color_desc": "", "width": "1.50", "height": "2.00", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านซ่อนหู ไม่ใส่เคมี", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวนวล", "color_desc": "", "width": "1.50", "height": "2.00", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'จัดส่ง
ทัศนีย์ ทรัพย์แสนชัยกุล
85/91 หมู่บ้านลิฟวิ่ง เรสซิเดนท์  หมู่ที่ 5 ต.บางพูน อ.เมือง จ.ปทุมธานี 12000 โทร.', '0962895592', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0040 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ที · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 50 บาท · วิธีแก้: shopee: tassaneesu
260504HHNBUCUF

(สั่งตัด) ผ้าม่านซ่อนหู ไม่ใส่เคมี 5700 ครีมลาเต้
• กว้าง1.50*สูง2.00 =4ผืน

(สั่งตัด) ผ้าม่านซ่อนหู ไม่ใส่เคมี โปร่งลายฝนขาวนวล
ก1.50*สูง2.00=4ผืน', 'shopee: tassaneesu
260504HHNBUCUF

(สั่งตัด) ผ้าม่านซ่อนหู ไม่ใส่เคมี 5700 ครีมลาเต้
• กว้าง1.50*สูง2.00 =4ผืน

(สั่งตัด) ผ้าม่านซ่อนหู ไม่ใส่เคมี โปร่งลายฝนขาวนวล
ก1.50*สูง2.00=4ผืน', 'หนูนา', NULL, NULL,
       NULL, 63, 2454, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0040%');
-- #0041 24/5/2026 | pongkasem.in
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-24', 'Shopee', 'pongkasem.in', NULL, NULL, NULL, 'ลูกค้าได้ตัวรางม่านตาไก่เสียหาย มีสนิม 
ลูกค้าค้าต้องการรางตัวใหม่',
       '[{"type": "รางม่านตาไก่", "floors": 1, "rail_head": "หัวกระดูม", "fabric_type": "", "color_code": "", "color_name": "โอ๊ค", "color_desc": "", "width": "2.20", "height": "", "quantity": 4, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่จัดส่ง 
คุณ ปองเกษม อินเลี้ยง
80/1 ม.1 ต.จันทิมา
อ.ลานกระบือ จ.กำแพงเพชร
62170', '0805616994', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0041 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: รางม่านตาไก่ 1 ชั้น 
หัวกระดูม สีโอ๊ค 
ขนาด 2.20 = 4 ชุด', '8/2/2026
Shopee: pongkasem.in
2602086UDY281T

ราง1ชั้น หัวกระดูม สีโอ๊ค
2.20 = 4 ชุด', 'หนูนา', NULL, NULL,
       NULL, 63, 1320, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0041%');
-- #0042 24/5/2026 | sasipanapradit
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-24', 'Shopee', 'sasipanapradit', NULL, NULL, 'ร้าน', 'สรุุปผิด',
       '[{"type": "ม่านพับมินิมอล 2 ชั้น (ดึงขวา)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Ash Linen", "color_desc": "", "width": "0.60", "height": "1.80", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}, {"type": "ม่านพับโปร่งเรียบขาวนวล", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "0.60", "height": "1.80", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'ศศิภา นาประดิษฐ์
43 ซอยอ่อนนุช 48
สวนหลวง กทม. 10250', 'โทร.0992915478', NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0042 · สถานะในชีท: อยู่ในกำหนด · ผิดโดย: แพท · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 300 บาท · วิธีแก้: ตัดใหม่เป็น
(สั่งตัด) ม่านพับมินิมอล 2ชั้น (ดึงขวา) SHB97 Ash Linen, 0.60*สูง1.80 =1ชุด ม่านพับโปร่งเรียบขาวนวล 0.60*สูง1.80=1ชุด', '3/5/2026
Shopee: sasipanapradit
260503DUAJ4SFV
(LineOA: paa.)

(สั่งตัด) ม่านพับมินิมอล 2ชั้น (ดึงขวา)
SHB97 Ash Linen,
 0.75*สูง1.80  =1ชุด
ม่านพับโปร่งเรียบขาวนวล 
0.75*สูง1.80=1ชุด

พุก สกรู ครบชุด พร้อมติดตั้ง
ยึดผนัง =3

รางม่านลอนเทป2ชั้น  (เปิดซ้าย)
ขาว สไลด์เดี่ยว 1.90 =1ชุด

(สั่งตัด) ผ้าม่านลอนเทป
SHB97 Linen Beige,
1.90*2.20=1ผืน
โปร่งเรียบขาวนวล
1.90*2.20=1ผืน', 'หนูนา', NULL, NULL,
       NULL, 38, 1890, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0042%');
-- #0043 26/5/2026 | Olive 😆❤
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-26', 'LineOA', 'Olive 😆❤', NULL, NULL, 'ร้าน', 'ลุกค้าแจ้งว่าชายผ้าไม่เท่ากัน หากผ้ามาถึงร้านแล้ว
*** รบกวนเช็คความสูงให้ละเอียดทุกผืนก่อนส่งหน่อยนะคะ รอบก่อนความสูงไม่เท่ากันทั้ง4ผืนค่ะ***',
       '[{"type": "ม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB24", "color_name": "", "color_desc": "", "width": "1.10", "height": "2.15", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ี่อยู่จัดส่ง
ศุภณัฐฐา ทิพปภาพัฒน์
207/69 (ตึกแถว) หมู่บ้าน เมืองทอง 2/2
ถ.พัฒนาการ ซ. 61
แขวง ประเวศ เขต ประเวศ
กทม. 10250', '089 446 0404', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0043 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: น้าดาว · ส่งแก้: หน้าร้าน · วิธีแก้: ทำใหม่เป็น 
ม่านลอนเทป 
HB24
ก1.10*ส2.15 = 4 ผืน', 'ออเดอร์เดิม
ม่านลอนเทป 
HB24
ก1.10*ส2.14 = 4 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, 5276, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0043%');
-- #0044 26/5/2026 | mildpiyanut
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-26', 'Shopee', 'mildpiyanut', NULL, NULL, NULL, 'รางงาอจากขนส่ง',
       '[{"type": "รางตาไก่ (เฉพาะราง)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "1.80", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่งด่วน
คุณปิยนุช
หมู่บ้านกมลลักษณ์ 50/63 ซอย3 หมู่2 ซอยวัดมะเดื่อ ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี 11110', '0853571650', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0044 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: รางตาไก่สีขาว เฉพาะราง
1.80=1ชิ้น', 'รางตาไก่สีขาว 
1.80=1ชิ้น', 'หนูนา', NULL, NULL,
       NULL, 63, 270, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0044%');
-- #0045 26/5/2026 | kairaymond700
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-05-26', 'LineOA', 'kairaymond700', NULL, NULL, 'ร้าน', 'เคลมมู่ลี่งานคุณไก่ทีมช่างวัดผิด',
       '[{"type": "มู่ลี่ (ดึงขวา)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "1.065", "height": "2.155", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เพิ่มความสูง 10 cm"}, {"type": "มู่ลี่ (ดึงขวา)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "0.895", "height": "2.18", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เพิ่มความสูง 10 cm"}, {"type": "มู่ลี่ (ดึงซ้าย)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "0.535", "height": "2.18", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เพิ่มความสูง 10 cm"}]'::jsonb, 'งานติดตั้ง', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0045 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ยุนและทีมช่าง · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 938.43 บาท · วิธีแก้: เพิ่มความสูงชุดละ 10 cm.
1.06.5*2.15.5 = 1 ชุด ดึงขวา=63.90 บาท
0.89.5*2.18 = 1 ชุด ดึงขวา =60 บาท
0.53.5*2.18 = 1 ชุด ดึงซ้าย=60 บาท
ค่าเทปผ้า =398 บาท
ค่าแก้ไข =1500 บาท

ยอดรวม=2081.90 บาทค่ะ', NULL, 'หนูนา', NULL, NULL,
       NULL, 300, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0045%');
-- #0046 1/6/2026 | ii_irada
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Tiktok', 'ii_irada', NULL, NULL, 'ร้าน', 'ลูกค้าสั่งห่วงตาไก่สีขาว แต่ได้ห่วงตาไก่สีสักไป 1 ผืน 
เป็นโปร่งเรียบ ขาวสว่าง, ก1.30*ส1.60 = 1 ผืน',
       '[{"type": "ห่วงตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "1.30", "height": "1.60", "quantity": 1, "unit": "ผืน", "hooks": "", "note": "โปร่งเรียบ ขาวสว่าง — ได้ห่วงตาไก่สีสักไป"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0046 · ผิดโดย: หนูนา · ค่าเคลมสินค้า: 30 บาท · วิธีแก้: ส่งห่วงตาไก่สีขาวใหม่', 'แอดมินสรุปตาไก่ผิด', 'ยุน', NULL, NULL,
       NULL, 36, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0046%');
-- #0047 1/6/2026 | gxh37fm611
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'gxh37fm611', NULL, NULL, 'ร้าน', 'สรุปความสูงผิด "พี่แพท และ หนูนา สรุป ตกหล่น คนละ ออเดอร์ สรุปรายการใหม่นะครับ 
28/5/2026
shopee เคลม : gxh37fm611

สรุปความสูงผิด  รอส่งม่านกลับ

สั่งตัด) ผ้าม่านตาไก่ สีขาว SHB98 Oatmeal 
ก2.00*สูง2.70 =2ผืน 

แก้เป็น 
ก2.00*สูง 2.15=2 ผืน
เป็นผ้าของออร์เดอร์ 260515DVU9CXBP 

และส่งผ้าออร์เดอร์ 260508TDF5TH66 
(สั่งตัด) ผ้าม่านตาไก่ ขาว
SHB97 Linen Beige 
· ก1.80*สูง2.80 =2ผืน

แก้เป็น 
ก1.80*สูง2.70 =2ผืน

"',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB98", "color_name": "Oatmeal", "color_desc": "ตาไก่สีขาว", "width": "2.00", "height": "2.15", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "ตาไก่สีขาว", "width": "1.80", "height": "2.70", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'อรปรียา
25/6 หมู่ที่ 7 หมู่บ้านบ่อน้ำ ตำบลหมูม่น หลังแรกก่อนถึงบ้านวิจิตรา, ตำบลหมูม่น, อำเภอ มืองอุดรธานี, จังหวัดอุดรธานี 41000', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0047 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: แพท, หนูนา · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 200 บาท · วิธีแก้: แก้เป็น 
ก2.00*สูง 2.15=2 ผืน
ก1.80*สูง2.70 =2ผืน', '(สั่งตัด) ผ้าม่านตาไก่ สีขาว SHB98 Oatmeal 
ก2.00*สูง2.70 =2ผืน

(สั่งตัด) ผ้าม่านตาไก่ ขาว
SHB97 Linen Beige 
· ก1.80*สูง2.80 =2ผืน', 'หนูนา', NULL, NULL,
       65, 43, 3412, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0047%');
-- #0048 1/6/2026 | mrs.mojito
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'mrs.mojito', NULL, NULL, 'ร้าน', 'ม่านสรุป ตกหล่น/ 
ตัวต่อสรุปแล้ว คาดว่าตกหล่นพี่แทพสรุป ตกหล่น ม่านตาไก่ ทำส่งลูกค้า',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB25", "color_name": "อัลมอนด์", "color_desc": "ตาไก่สีสัก", "width": "1.50", "height": "1.80", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ตัวต่อรางลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 2, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่งด่วน
80 ซ.อ่อนนุช 27 แขวงสวนหลวง เขตสวนหลวง 10250 ติดต่อ', '0624539615', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0048 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: แพท · ส่งแก้: หน้าร้าน · วิธีแก้: ผ้าม่านตาไก่ สีสัก
HB25 อัลมอนด์,
ก1.50*ส1.80 =4ผืน 

ตัวต่อรางลอนเทป =2 ชิ้น', NULL, 'หนูนา', NULL, NULL,
       NULL, 63, 3052, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0048%');
-- #0049 1/6/2026 | k2fmcfmy8f
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-01', 'Shopee', 'k2fmcfmy8f', NULL, NULL, NULL, 'ลูกค้าส่งมาแก้เอง จ่ายเงินเพิ่ม',
       '[{"type": "ผ้าม่านจีบ 2 จีบ ตะขอยาว", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M21", "color_name": "sand", "color_desc": "", "width": "1.50", "height": "1.50", "quantity": 1, "unit": "ผืน", "hooks": "", "note": "แก้ความสูงจาก 2.00 ลูกค้าจ่ายค่าแก้เอง"}]'::jsonb, NULL, NULL, NULL, 199, 'เก็บลูกค้า', NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0049 · ประเภทงานในชีท: งานแก้ลูกค้าเพิ่มเงินเอง · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน', 'ลูกค้า Shopee : k2fmcfmy8f 
ส่งม่านจีบมาแก้ความสูงครับ 
จาก 
 ผ้าม่านจีบ  2 จีบ ตะขอยาว
M21 sand · 
ก1.50*สูง2.00 =1ผืน

เป็น 
ก1.50*สูง1.50 =1ผืน 

แจ้งค่าแก้ไขแล้ว ค่าแก้ไข 149 +ค่าส่ง 50 บาท 
รวม 199 บาท 
รอลูกค้าโอนให้ครับ 
ลูกค้า ส่งของมาให้แล้วครับ 

ทีอยู่จัดส่งกลับ 
คุณ ประภาพร สีบุญเรือง
454 ซอย จรัญสนิทวงศ์ 65
แขวงบางบำหรุ  เขตบางพลัด
กรุงเทพฯ 10700
เบอร์โทรศัพท์ 0972982495', 'สู้', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0049%');
-- #0050 2/6/2026 | ZORN
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-02', 'LineOA', 'ZORN', NULL, NULL, 'ร้าน', 'แอดมินทำการสรุปสีม่านผิดค่ะ

ออเดอร์เดิม
ม่านลอนเทป  HB85 เทาเข้ม
1.10*2.10 = 2 ผืน',
       '[{"type": "ม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB25", "color_name": "", "color_desc": "", "width": "1.10", "height": "2.10", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "แอดมินสรุปสีผิด (เดิม HB85 เทาเข้ม)"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0050 · ผิดโดย: แพท · ค่าเคลมสินค้า: 200 บาท · วิธีแก้: ทำใหม่เป็น
ม่านลอนเทป  HB25
1.10*2.10 = 2 ผืน', 'แอดมินทำการสรุปสีม่านผิดค่ะ

ออเดอร์เดิม
ม่านลอนเทป  HB85 เทาเข้ม
1.10*2.10 = 2 ผืน 

ทำใหม่เป็น
ม่านลอนเทป  HB25
1.10*2.10 = 2 ผืน', 'ยุน', NULL, NULL,
       143, 26, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0050%');
-- #0051 2/6/2026 | pumpapica
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-02', 'Shopee', 'pumpapica', '260525BBR7B4U1', NULL, 'ร้าน', 'ทีมผู้ช่วยช่างใส่ตาไก่สีผิด',
       '[{"type": "ห่วงตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 44, "unit": "ห่วง", "hooks": "", "note": "ทีมผู้ช่วยช่างใส่ตาไก่สีผิด"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0051 · ผิดโดย: เมย์, หาญ · ค่าเคลมสินค้า: 44 บาท · วิธีแก้: จัดส่งใหม่ ตาไก่สีขาว  44 ห่วง"', '25 พ.ค. 2026
shopee : pumpapica
260525BBR7B4U1

(สั่งตัด) ผ้าม่านตาไก่ ขาว
SHB98 Oatmeal 
3.50*2.90 =2 ผืน', 'ยุน', NULL, NULL,
       NULL, 40, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0051%');
-- #0052 5/6/2026 | khunkhaoworld
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-05', 'Tiktok', 'khunkhaoworld', NULL, NULL, 'ร้าน', 'หน้าร้านปลิ้นออเดอร์ผิด',
       '[{"type": "รางม่านตาไก่", "floors": 2, "rail_head": "หัวกระดูม", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "2.00", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0052 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ส้ม · ส่งแก้: หน้าร้าน · วิธีแก้: เคลมราง2.00 สีขาวใหม่', '02/06/2026
tiktok : khunkhaoworld
584315352191567381

รางม่านตาไก่ 
1ชั้น(กระดูม) สีดำ, 1.80  = 1 ชุด
2ชั้น(กระดูม) สีดำ, 1.80 = 1 ชุด
2ชั้น(กระดูม) สีขาว, 2.00  =1 ชุด', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0052%');
-- #0053 6/6/2026 | juliemayjuliemay
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-06', 'Shopee', 'juliemayjuliemay', NULL, NULL, 'ขนส่ง', 'หัวปิดรางม่านลอนเทปแตก,ลูกล้อหลุด',
       '[{"type": "หัวปิดรางม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 10, "unit": "ตัว", "hooks": "", "note": ""}, {"type": "ลูกล้อรางลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 5, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่
18/6 ม2 ทุ่งเบญจา ท่าใหม่ จันทบุรี
รัชนก', '0805655695', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0053 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งเป็น
หัวปิดรางม่านลอนนเทปสีขาว  = 10 ตัว
ลูกล้อรางลอนเทปสีขาว = 5 ตัว', '19 พ.ค. 2026,
shopee: juliemayjuliemay
260519SW70BCUG
260519SAFJ4CPG
260519RS23QQ0N (ราง)

📍รางsnake2ชั้น สีขาว แยกกลาง
3.74 = 4 ชุด (30+30)

📍ม่านลอนเทป 
A11 · 
1.87*2.79 = 8 ผืน  (30+30)

📍ผ้าโปร่งลอนเทป 
Mid modern
1.87*2.79 = 8 ผืน  (30+30)

ใช้เทปของออร์เดอร์ 260519RS23QQ0N', 'หนูนา', NULL, NULL,
       NULL, 36, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0053%');
-- #0054 6/6/2026 | monrudeemonrudee056
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-06', 'Shopee', 'monrudeemonrudee056', NULL, NULL, 'ร้าน', 'สรุปตกหล่น วันที่ 26/5 เนื่องจากแอดมินสรุปผิดไม่ได้แจ้งว่าไม่เอาโซ่ถ่วงครับ',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB91", "color_name": "Cotton", "color_desc": "ตาไก่โอ๊ต", "width": "1.50", "height": "1.80", "quantity": 4, "unit": "ผืน", "hooks": "", "note": "ถอดโซ่ถ่วงและเย็บชายผ้า"}]'::jsonb, 'ที่อยู่จัดส่งกลับ พัชราภรณ์ เหมเดโช
22ซ.นายพล ถ.ราชดำเนิน 
ต.ในเมือง อ.เมือง จ.นครศรีธรรมราช 80000', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0054 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: แพท · ส่งแก้: หน้าร้าน · วิธีแก้: ผ้าม่านตาไก่ โอ๊ต
SHB91 Cotton ·
1.50*1.80 = 4 ผืน 
ถอดโซ่ถ่วงและเย็บชายผ้า', '26 พ.ค. 2026,
shopee : puy2549
260526E00QR7Q3

(สั่งตัด) ผ้าม่านตาไก่ โอ๊ต
SHB91 Cotton ·
1.50*1.80 =2 ผืน', 'หนูนา', NULL, NULL,
       105, 63, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0054%');
-- #0055 7/6/2026 | k.ppatty
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-07', 'Shopee', 'k.ppatty', NULL, NULL, 'ร้าน', 'ม่่านเป็นรู2ผืน',
       '[{"type": "ผ้าม่านซ่อนหู ไม่ใส่เคมี", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "KB-5", "color_name": "Sky gray", "color_desc": "", "width": "1.00", "height": "1.30", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านซ่อนหู ไม่ใส่เคมี", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "KB-5", "color_name": "Sky gray", "color_desc": "", "width": "1.80", "height": "1.30", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่
พิชามญชุ์ นพวงศ์
7/161 ซ.4/3 หมู่ 13 ถ.รัตนาธิเบศร์ ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี 11110', '064-9292298', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0055 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ไก่ · ส่งแก้: หน้าร้าน · วิธีแก้: ทำใหม่
ผ้าม่านซ่อนหู ไม่ใส่เคมี
KB-5 Sky gray
ก1.00* ส1.30 = 1 ผืน
ก1.80* ส1.30 = 1 ผืน', 'ผ้าม่านซ่อนหู ไม่ใส่เคมี
KB-5 Sky gray
ก1.00* ส1.30 = 1 ผืน
ก1.80* ส1.30 = 1 ผืน', 'หนูนา', NULL, NULL,
       73, 38, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0055%');
-- #0056 7/6/2026 | everything365
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-07', 'Shopee', 'everything365', NULL, NULL, 'ขนส่ง', 'ตัวปิดหัวรางแตก',
       '[{"type": "หัวปิดรางม่าน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่งด่วน
Aum 47/1 ม.11 ต.อ่างทอง อ.เมือง จ.กำแพงเพชร 62000', '0998089073', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0056 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ส่่งหัวปิดรางม่าน', '27 พ.ค. 2026
shopee : everything365
260527FTUACWGB

รางม่านลอนเทป2ชั้น 
ขาว แยกกลาง · 1.80 = 1 ชุด

(สั่งตัด) ผ้าม่านลอนเทป
M20 เบจ 
09.0*2.70 = 2ผืน

ผ้าโปร่งลอนเทป 
ลายฝนขาวสว่าง
0.90*2.70 =2 ผืน', 'หนูนา', NULL, NULL,
       NULL, 36, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0056%');
-- #0057 7/6/2026 | paictd
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-07', 'Shopee', 'paictd', NULL, NULL, 'ร้าน', 'ผู้ช่วยช่างลงตาไก่ผิดสี',
       '[{"type": "ห่วงตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 32, "unit": "ห่วง", "hooks": "", "note": "ผู้ช่วยช่างลงตาไก่ผิดสี"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0057 · ผิดโดย: ผู้ช่วยช่าง · ค่าเคลมสินค้า: 32 บาท · วิธีแก้: ลูกค้าต้องการตาไก่สีขาวครับ ทั้งหมด 32 ห่วง', '30 พ.ค. 2026
shopee : paictd
260530PTNGAGAK

(สั่งตัด) ผ้าม่านตาไก่ ขาว
SHB91 Cotton
2.50*2.50 = 2 ผืน', 'ยุน', NULL, NULL,
       NULL, 40, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0057%');
-- #0058 8/6/2026 | poopay_jj
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-08', 'Shopee', 'poopay_jj', NULL, NULL, 'ร้าน', 'กระดุมผ้าขาด',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "S18", "color_name": "เทาเมฆ", "color_desc": "", "width": "1.90", "height": "2.20", "quantity": 2, "unit": "ผืน", "hooks": "30", "note": ""}, {"type": "ผ้าโปร่งลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวนวล", "color_desc": "", "width": "1.90", "height": "2.20", "quantity": 2, "unit": "ผืน", "hooks": "30", "note": ""}]'::jsonb, 'กัลยาณี นวลแก้ว
33/4 หมู่ 9 ตำบลสวนเมี่ยง อำเภอชาติตระการ จังหวัดพิษณุโลก 65170', '061-5979-055', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0058 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: สู้ · ส่งแก้: หน้าร้าน · วิธีแก้: ทำใหม่
📍ผ้าม่านลอนเทป 
S18 เทาเมฆ
ก1.90*ส2.20 = 2 ผืน (30)

📍ผ้าม่านลอนเทป
ผ้าโปร่งลายฝนขาวนวล
ก1.90*ส2.20 = 2 ผืน (30)', 'ออเดอร์เดิม
260528K25MYAPW  (สั่งตัด)
📍ผ้าม่านลอนเทป
S18 เทาเมฆ
ก1.90*ส2.20 = 2 ผืน (16+16)

📍ผ้าม่านลอนเทป
ผ้าโปร่งลายฝนขาวนวล
ก1.90*ส2.20 = 2 ผืน (16+16)', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0058%');
-- #0059 8/6/2026 | oatlodthanong
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-08', 'Shopee', 'oatlodthanong', NULL, NULL, 'ร้าน', 'ลูกล้้อ+กระดุมขาด',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HJJ-5", "color_name": "เทาเข้ม", "color_desc": "", "width": "0.90", "height": "1.80", "quantity": 2, "unit": "ผืน", "hooks": "16+16", "note": ""}, {"type": "ลูกล้อ", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 12, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'จัดส่ง
ดิว
155/9-10 หมู่ 2 ต.ทับมา อ.เมืองระยอง จ.ระยอง 21000', '0830303553', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0059 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: สู้ · ส่งแก้: หน้าร้าน · วิธีแก้: 🩷ตัดใหม่
สั่งตัด) ผ้าม่านลอนเทป
HJJ-5 เทาเข้ม
0.90*1.80 = 2 ผืน (16+16)

+เพิ่มลูกล้อ 12 ตัว', '🩷ม่านเดิม
สั่งตัด) ผ้าม่านลอนเทป
HJJ-5 เทาเข้ม
0.90*1.80 = 2 ผืน (10+10)', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0059%');
-- #0060 8/6/2026 | gxh37fm6l1
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-08', 'Shopee', 'gxh37fm6l1', NULL, NULL, 'ร้าน', 'ขาด1ชุด',
       '[{"type": "ผ้าม่านพับ (ดึงขวา)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Ash Linen", "color_desc": "", "width": "0.80", "height": "2.20", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'คุณ อรปรียา 
725/6 ม.7 บ้านบ่อน้ำ ต.หมู่ม่น อ.เมือง จ.อุดรธานี 41000
บ้านหลังแรกตรงบ้านวิจิตรา บ่อน้ำ 2', '0648599390', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0060 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ขาดตัวม่านพับไป 1 ชุดครับ 
(สั่งตัด) ผ้าม่านพับ ดึงขวา
SHB97 Ash Linen
ก0.80*ส2.20 = 1 ชุด', '25 พ.ค. 2026
shopee: gxh37fm6l1
2605259X2BN72T (สั่งตัด)

(สั่งตัด) ผ้าม่านพับ ดึงขวา
SHB97 Ash Linen
ก0.80*ส2.20 = 1 ชุด 

(สั่งตัด) ผ้าม่านตาไก่ ตาไก่สีขาว
HB26 Cinnamon 
ก2.80*ส2.70 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, 53, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0060%');
-- #0061 9/6/2026 | พลอย ดิษญา
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-09', 'LineOA', 'พลอย ดิษญา', NULL, NULL, NULL, 'ขาดขาราง',
       '[{"type": "ขาราง 2 ชั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 6, "unit": "ตัว", "hooks": "", "note": ""}, {"type": "รางลอนเทป (เฉพาะราง)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "1.50", "height": "", "quantity": 1, "unit": "เส้น", "hooks": "", "note": "เดี่ยว"}, {"type": "รางลอนเทป (เฉพาะราง)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "1.20", "height": "", "quantity": 1, "unit": "เส้น", "hooks": "", "note": "เดี่ยว"}, {"type": "รางลอนเทป (เฉพาะราง)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "1.30", "height": "", "quantity": 1, "unit": "เส้น", "hooks": "", "note": "เดี่ยว"}]'::jsonb, 'ดิษญา  กุหลาบเพชร
องค์การบริหารส่วนตำบลกุดค้า
294 หมู่ 12 ตำบลทุ่งฝน อำเภอทุ่งฝน  จังหวัดอุดรธานี 41310', '0828601141', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0061 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ขาราง2ชั้น = 6ตัว
รางลอนเทป สีขาว เดี่ยว
1.50 = 1เส้น 26
1.20 = 1เส้น 20
1.30 = 1เส้น 22', 'รางsnake2ชั้น สีขาว
3.30+1.20=1ชุด  แยกกลาง+สไลด์เดี่ยวเก็บขวา
1.30=1ชุด สไลด์เดี่ยวเก็บขวา
1.50=1ชุด ไลด์เดี่ยวเก็บซ้าย 
3.00=1ชุด แยกกลาง
=8034 บาท

ม่านลอนเทป blackout  hb81
1.65*2.995 =2ผืน
1.20*2.995=1ผืน  ฿5,396
1.30*2.995 =1ผืน ฿1,559
1.50*2.995 =3ผืน ฿5,396

ลอนเทป ผ้าโปร่งเรียบขาวสว่าง
1.65*2.995 =2ผืน
1.20*2.995=1ผืน  ฿3,596
1.30*2.995 =1ผืน฿1,039
1.50*2.995 =3ผืน  ฿3,596

รวมทั้งหมด 28,616บาท +75 บาท=28691 บาท
มัดจำ50% 14465.5 บาท ชำระก่อนจัดส่งอีก 14225.5 บาท', 'หนูนา', NULL, NULL,
       NULL, 63, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0061%');
-- #0062 10/6/2026 | juliemayjuliemay
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-10', 'Shopee', 'juliemayjuliemay', NULL, NULL, 'ร้าน', 'ชายเบี้ยว2ผืน',
       '[{"type": "ม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "A11", "color_name": "", "color_desc": "", "width": "1.87", "height": "2.79", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ชายเบี้ยว ลูกค้าส่งกลับมาแก้"}]'::jsonb, 'ที่อยู่
18/6 ม2 ทุ่งเบญจา ท่าใหม่ จันทบุรี
รัชนก', '0805655695', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0062 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กุ้ง, น้าดาว, เจน, ศรี · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 446 บาท · วิธีแก้: ชายเบี้ยว2ผืน ส่งกลับมาแก้ค่ะ', 'รางsnake2ชั้น สีขาว แยกกลาง
3.74 = 4 ชุด 11,669 บาท

ม่านลอนเทป 
A11 · 
1.87*2.79 = 8 ผืน 14,945 บาท

ผ้าโปร่งลอนเทป 
Mid modern
1.87*2.79 = 8 ผืน 11,953 บาท', 'หนูนา', NULL, NULL,
       NULL, 46, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0062%');
-- #0063 10/6/2026 | hell03ynameissafe
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-10', 'Shopee', 'hell03ynameissafe', NULL, NULL, 'ขนส่ง', 'รางงอ',
       '[{"type": "รางม่านลอนเทป (เฉพาะราง)", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "1.80", "height": "", "quantity": 1, "unit": "เส้น", "hooks": "", "note": ""}]'::jsonb, 'เซ้บ 
295/2 ซอย ร่วมใจ แขวง ตลิ่งชัน เขต ตลิ่งชัน จังหวัด กรุงเทพมหานคร รหัสรไปรษณีย์ 10170', '0854424255', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0063 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: รางม่านลอนเทป1 ชั้น 
สีขาว 1.80 =1 เส้น', 'รางม่านลอนเทป1 ชั้น 
สีขาว แยกกลาง, 1.80 =1ชุด', 'หนูนา', NULL, NULL,
       NULL, 63, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0063%');
-- #0064 10/6/2026 | achsda
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-10', 'Shopee', 'achsda', NULL, NULL, NULL, 'ผ้าหด',
       '[{"type": "ม่านพับ (ดึงขวา)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB98", "color_name": "Oatmeal", "color_desc": "", "width": "0.75", "height": "1.90", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "ผ้าหด ตัดเย็บใหม่"}, {"type": "ม่านพับ (ดึงซ้าย 1 ขวา 1)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB91", "color_name": "Cotton", "color_desc": "", "width": "0.83", "height": "2.22", "quantity": 2, "unit": "ชุด", "hooks": "", "note": "ผ้าหด ตัดเย็บใหม่"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0064 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: แก้ม่านพับตัดเย็บผ้าใหม่', '12/5/2026
Shopee: achsda
2605127W615U79

ม่านพับ
 สีSHB98 (Oatmeal)
กว้าง0.75 × สูง1.90=1ชุด
(ดึงม่านขวา)

ม่านพับ
 สีSHB91 (Cotton)
กว้าง0.83 × สูง2.22= 2ชุด
(ดึงม่านซ้าย1 ขวา1)', 'หนูนา', NULL, NULL,
       NULL, 18, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0064%');
-- #0065 11/6/2026 | pitchaya2328
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-11', 'Tiktok', 'pitchaya2328', NULL, NULL, 'ร้าน', 'ผ้ารัน เป็นรอยด้วย',
       '[{"type": "ม่านสอด", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวสว่าง", "color_desc": "", "width": "1.00", "height": "2.50", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่
พิฐชญาณ อธิรัตน์วรชัย
เลขที่ 190/82 มบ.ดีพร้อมดิไพรม์มารี่
ซอย 11 หมู่ 5 ต.แพรกษา อ.เมือง จ.สมุทรปราการ 10280', '0867892328', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0065 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ยู, ลา · ส่งแก้: หน้าร้าน · วิธีแก้: ม่านสอด
โปร่งลายฝนขาวสว่าง,
1.00*2.50= 2ผืน', '7/6/2026
tiktok: pitchaya2328
584413374425957983

ม่านสอด
โปร่งลายฝนขาวสว่าง,
1.00*2.50= 2ผืน', 'หนูนา', NULL, NULL,
       NULL, 63, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0065%');
-- #0066 11/6/2026 | gogjaiart
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-11', 'Shopee', 'gogjaiart', NULL, NULL, 'ขนส่ง', 'ขนส่งทำรางงอ',
       '[{"type": "รางม่านตาไก่", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "สัก", "color_desc": "", "width": "3.50", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'คุณ gogjaiart
58/2, หมู่ที่ 1, ถนน เพกระษัตรี, ตำบล เกาะแก้ว, อำเภอเมืองภูเก็ต 
ตำบลเกาะแก้ว อำเภอเมืองภูเก็ต จังหวัดภูเก็ต 83000', '0 98 191 5659', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0066 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งราง
รางม่านตาไก่ 1ชั้น 
1ชั้น สีสัก ขนาด 3.50  =1ชุด', 'รางม่านตาไก่ 1ชั้น 
1ชั้น(กระดูม) สีสัก · 3.50  =1ชุด', 'หนูนา', NULL, NULL,
       NULL, 76, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0066%');
-- #0067 11/6/2026 | ponthiplin
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-11', 'Shopee', 'ponthiplin', NULL, NULL, NULL, 'ขาด',
       '[{"type": "ตัวสไลด์รางจีบ แบบตรง", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 5, "unit": "ชิ้น", "hooks": "", "note": "ต่อไปสไลด์เดี่ยวใช้ตัวสไลด์ตรงเท่านั้น"}]'::jsonb, 'นางพรทิพย์ วงศ์ลิมปิยะรัตน์
4/17 ซอยสุขใจ ถนนสุขุมวิท 40 แขวงพระโขนง เขตคลองเตย กรุงเทพฯ 10110', '081 3741477', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0067 · สถานะในชีท: งานเสร็จแล้ว · วิธีแก้: ตัวสไลด์รางจีบ แบบตรง =5 ชิ้น ปกติถ้าสั่งสไลด์เดี่ยวเราจะส่งตัวสไลด์ตัวงอไปให้ แต่ลูกค้าแจ้งว่า มันทำให้เกิดช่องแสงขึ้น เลยขอเป็นตัวสไลด์ตรง แะหลังจากนี้ จะใช้สไลด์ตรงเท่านั้น สำหรับสไลด์เดี่ยว', 'ตัวสไลด์รางจีบ', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0067%');
-- #0068 13/6/2026 | pchy1411
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-13', NULL, 'pchy1411', NULL, NULL, NULL, 'ลูกค้าแจ้งว่าความสูงไม่ถึง2.50 และทำการจ่ายเอง',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB85", "color_name": "เทาเข้ม", "color_desc": "ตาไก่สีเงิน", "width": "2.50", "height": "2.50", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ลูกค้าจ่ายค่าแก้เอง"}]'::jsonb, 'น.ส.พิชญธิดา กลิ่นกาหลง
หมู่บ้านอยู่ดีวิลล่า เลขที่ 73/19 หมู่ที่ 8 ตำบลนาหนองปลาไหล อำเภอบางละมุง จังหวัดชลบุรี 20150', '0640058959', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0068 · ประเภทงานในชีท: งานแก้ลูกค้าเพิ่มเงินเอง · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: (สั่งตัด) ผ้าม่านตาไก่ เงิน
HB85 เทาเข้ม 
2.50*2.50 = 2 ผืน', '(สั่งตัด) ผ้าม่านตาไก่ เงิน
HB85 เทาเข้ม 
2.50*2.50 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0068%');
-- #0069 13/6/2026 | thita3029
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-13', 'Shopee', 'thita3029', NULL, NULL, 'ร้าน', 'ส่งขารางผิด',
       '[{"type": "ขาราง 2 ชั้น (ม่านจีบ)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 6, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'ฐิตารีย์ ทรัพย์ธนารี
119/379
หมูู่ 8
ตำบลลำโพ อำเภอบางบัวทอง
จังหวัด นนทบุรี 11110', '0911219074', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0069 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: พงศ์ · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 60 บาท · วิธีแก้: ส่งขาราง2ชั้นสีดำ ม่านจีบ  = 6 ชิ้น', '11 มิ.ย. 2026
shopee : thita3029
260611RNFEXE48

รางม่านจีบ1ชั้น
ดำ1ชั้น เดี่ยว ·
0.70 = 1 ชุด
1.00 = 1 ชุด

ดำ2ชั้น แยกกลาง · 2.50  = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, 31, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0069%');
-- #0070 13/6/2026 | Nok-Su
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-13', 'Shopee', 'Nok-Su', NULL, NULL, NULL, 'ไม่ได้รับสายรวบม่าน',
       '[{"type": "สายรวบม่าน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 14, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'ชื่อ สุพัตรา ชิดทองหลาง
ที่อยู่ 78 /1 หมู่7 ต.โตนด อ.โนนสูง
จ.นครราชสีมา', '0896303742', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0070 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ทำการส่ง สายรวบม่าน14 ชิ้น งานบ้านพี่ฟอง ร้านเราทำให้', NULL, 'หนูนา', NULL, NULL,
       NULL, 25, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0070%');
-- #0071 13/6/0205 | suthirakmakham
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-13', 'Shopee', 'suthirakmakham', NULL, NULL, 'ร้าน', 'แอดมินสรุปผิดลูกค้าสั่งม่านสอดสรุปเป็นม่านตาไก่',
       '[{"type": "ผ้าม่านสอด", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "D038", "color_name": "ขาวครีม", "color_desc": "", "width": "1.30", "height": "1.30", "quantity": 4, "unit": "ผืน", "hooks": "", "note": "แอดมินสรุปผิดเป็นม่านตาไก่"}]'::jsonb, 'น้องแพลน
เลขที่ 50/755 หมู่บ้าน ชุมชนพหลโยธิน 45 ซอย พหลโยธิน 45 ซอย 3 
แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900', '0806618629', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0071 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 100 บาท · วิธีแก้: ผ้าม่านสอด
D038 ขาวครีม
ก1.30*ส1.30 = 4 ผืน', '2 มิ.ย. 2026
Shopee : suthirakmakham
2606022CN7V4N7 

ผ้าม่านตาไก่ ตาไก่สุ่มสีขาว
D038 ขาวครีม
ก1.30*ส1.30 = 4 ผืน', 'หนูนา', NULL, NULL,
       48, 31, 910, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0071%');
-- #0073 15/6/2026 | oeioeioeioei
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-15', 'Shopee', 'oeioeioeioei', NULL, NULL, NULL, 'ม่านเป็นรอย-รอลุกค้าส่งคืนกลับมาที่ร้าน',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "D038", "color_name": "ขาวครีม", "color_desc": "", "width": "1.65", "height": "2.35", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ม่านเป็นรอย"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0073 · สถานะในชีท: เลยกำหนด · วิธีแก้: ผ้าม่านลอนเทป
D038 ขาวครีม
ก1.65*ส2.35 = 2 ผืน', 'ผ้าม่านลอนเทป
D038 ขาวครีม
ก1.65*ส2.35 = 2 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0073%');
-- #0074 15/6/2026 | tcg5kg6khp
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-15', 'Shopee', 'tcg5kg6khp', NULL, NULL, NULL, 'ลูกค้าได้รับสีผ้าผิดสั่งขวานวลได้ขวาสว่าง',
       '[{"type": "ม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวนวล", "color_desc": "ตาไก่สีดำ", "width": "2.00", "height": "2.20", "quantity": 1, "unit": "ผืน", "hooks": "", "note": "ผ้าคนละล็อตสี"}]'::jsonb, 'สุภาวรรณ์ วงษ์ยีเมาะ
495 พัฒนาการ 69 แยก 6 (ริมคลอง) แขวงประเวศ เขตประเวศ กทม 10250', '0649856928', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0074 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ทำใหม่
(สั่งตัด) ม่านตาไก่ สีดำ
โปร่งลายฝนขาวนวล
 ก2.00*สูง2.20 =1ผืน ปัญหาคือผ้าม้วนมาคนละล๊อตสี', '(สั่งตัด) ม่านตาไก่ สีดำ
โปร่งลายฝนขาวนวล
 ก2.00*สูง2.20 =1ผืน', 'หนูนา', NULL, NULL,
       NULL, 31, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0074%');
-- #0075 15/6/2026 | satawatthongplud
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-15', 'Shopee', 'satawatthongplud', NULL, NULL, NULL, 'ความสูงได้ไม่เท่ากันค่ะ ความสูงผิดไป1ผืนค่ะ ลูกค้าวัดผิด',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M80", "color_name": "เทาเข้ม", "color_desc": "ตาไก่สีขาว", "width": "3.50", "height": "2.22", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "แก้ความสูงจาก 2.15"}]'::jsonb, '120/97 ซอยจอมทอง 8 ถนนจอมทอง แขวงบ้างค้อ เขตจอมทอง กรุงเทพมหานคร 10150
 
ศตวรรษ ทองพรัด', '0985673766', NULL, 343, 'เก็บลูกค้า', NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0075 · ประเภทงานในชีท: งานแก้ลูกค้าเพิ่มเงินเอง · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ทำใหม่เป็น
(สั่งตัด) ผ้าม่านตาไก่ สีขาว
M80 เทาเข้ม, 
3.50*สูง2.22 =2ผืน', '260609KRV5N5X2

(สั่งตัด) ผ้าม่านตาไก่ สีขาว
M80 เทาเข้ม, 
3.50*สูง2.15 =2ผืน', 'หนูนา', NULL, NULL,
       NULL, 38, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0075%');
-- #0076 16/6/2026 | moriart_y
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-16', 'Shopee', 'moriart_y', NULL, NULL, 'ขนส่ง', 'รางบุบระหว่างขนส่ง',
       '[{"type": "รางม่านจีบ", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ไม้อ่อน", "color_desc": "", "width": "2.40", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "แยกกลาง"}]'::jsonb, 'ฉัตรนรินทร์ ฉัตรเชียงกาญจน์

120/211 โกลเด้น ทาวน์ ฟิวเจอร์-รังสิต ถนนรังสิต-นครนายก
ต.ประชาธิปัตย์ อ.ธัญบุรี จ.ปทุมธานี 12130', '0616535643', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0076 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งใหม่
รางม่านจีบ1ชั้น  สีไม้อ่อน แยกกลาง
ขนาด 2.40 = 1 ชุด', 'รางม่านจีบ1ชั้น  สีไม้อ่อน แยกกลาง
ขนาด 2.40 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, 31, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0076%');
-- #0077 17/6/2026 | adisorn2u
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-17', 'Shopee', 'adisorn2u', NULL, NULL, 'ร้าน', 'ลูกค้าส่งม่านมาแก้ความสูงค่ะ
แอดมินสรุปความสูงผิดค่ะ ความสูงวงกบลูกค้าอยู่ที่2.05 จะเผื่อเป็น2.25
แอดมินสรุปเป็น2.335ค่ะ',
       '[{"type": "ผ้าม่านลอนตะขอ ตะขอสั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "", "width": "2.335", "height": "2.23", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าโปร่งลอนตะขอ ตะขอสั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ผ้าโปร่ง Richy", "color_desc": "", "width": "2.335", "height": "2.23", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'อดิสรณ์ 
อาคารชุดแกรนด์โมเดิร์นคอนโด ตึกบี 59/129
ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120', '0816262322', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0077 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · ค่าเคลมสินค้า: 100 บาท · วิธีแก้: แก้เป็น
(สั่งตัด) ผ้าม่านลอนตะขอ ตะขอสั้น
SHB97 Linen Beige 
ก2.335*ส2.23 = 2 ผืน 

(สั่งตัด) ผ้าม่านลอนตะขอ ตะขอสั้น
ผ้าโปร่ง Richy
ก2.335*ส2.23 = 2 ผืน', '8 มิ.ย. 2026
shopee: adisorn2u
260608HSGYQ8J3 (สั่งตัด)

รางม่านจีบ 2 ชั้น
สีดำ แยกกลาง 
ขนาด 2.335 = 1 ชุด

(สั่งตัด) ผ้าม่านลอนตะขอ ตะขอสั้น
SHB97 Linen Beige 
ก2.335*ส2.335 = 2 ผืน 

(สั่งตัด) ผ้าม่านลอนตะขอ ตะขอสั้น
ผ้าโปร่ง Richy
ก2.335*ส2.335 = 2 ผืน', 'หนูนา', NULL, NULL,
       173, 38, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0077%');
-- #0079 21/6/2026 | dql7skc2xh
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-21', 'Shopee', 'dql7skc2xh', '260607EW4M5X6Y', NULL, 'ร้าน', 'รางเจ้านี้ได้ใส่ลูกล้อและโซ่แยกไหมคะ พอดีลูกค้าบอกว่าไม่มีลูกล้อและโซ่ไข่ปลาค่ะ',
       '[{"type": "โซ่ไข่ปลา + ลูกล้อ + ตัวปิดราง 2 ด้าน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "3.78", "height": "", "quantity": 2, "unit": "ชุด", "hooks": "", "note": "แยกกลาง"}, {"type": "ตัวนำสไลด์คู่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 2, "unit": "คู่", "hooks": "", "note": ""}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0079 · ผิดโดย: พงศ์ · วิธีแก้: จัดส่งด่วน

โซ่ไข่ปลา +ลูกล้อ +ตัวปิดราง 2ด้าน แยกกลาง  3.78  =2ชุด 
+ตัวนำสไลด์คู่ =2คู่', 'shopee: dql7skc2xh
260607EW4M5X6Y  (สั่งตัด)

📍รางม่านลอนโซ่ไข่ปลา 2 ชั้น สีเงิน แยกกลาง 
ขนาด 3.78 = 1 ชุด', 'ยุน', NULL, NULL,
       108, 60, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0079%');
-- #0080 21/6/2026 | nongrch
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-21', 'Shopee', 'nongrch', NULL, NULL, NULL, 'ลูกค้าจะใช้รางม่านจีบ แต่กดสั่งรางม่านลอนเทปเข้ามา เลยขอส่งเทปไปให้',
       '[{"type": "เซตลูกล้อลอนเทป + ตัวปิด", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "0.80", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เดี่ยว"}]'::jsonb, 'K.ภูริชญา สิทธิประชาราษฎร์
119/234 หมู่บ้านริมภู ซอย3 
(บ้านหลังสีดำ) หมู่1 ถ.เทศบาล4 ต.ทับกวาง อ.แก่งคอย 
จ.สระบุรี 18260', '055936990', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0080 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: เซตลูกล้อลอนเทป +ตัวปิด 
เดี่ยว 0.80=1ชุด', '18 มิ.ย. 2026
shopee : nongrch
260618D9PXANH0

รางม่านลอนเทป1ชั้น
สีไม้อ่อนสไลด์เดี่ยว
0.80 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, 36, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0080%');
-- #0081 22/6/2026 | sunareesathukan
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-22', 'Tiktok', 'sunareesathukan', NULL, NULL, NULL, 'ตัวผ้าที่ได้รับมีตำหนิ ขาดเป็นรู เหมือนโดนของมีคนสะกิด เข้าใจว่าเป็นตอนลูกค้าแกะห่อ เพราะไม่น่าจะเกิดจากทางร้าน เพราะแผลค่อนข้างใหญ่',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M20", "color_name": "เบจ", "color_desc": "ตาไก่สีขาว", "width": "1.50", "height": "2.30", "quantity": 1, "unit": "ผืน", "hooks": "", "note": "ทำผืนใหม่ ผืนเดิมส่งเข้าคลัง"}]'::jsonb, 'คุณ สุนารี 
88/38 หมู่ที่ 5 หมู่บ้าน เอส-วิลเลจ ( S-Village ) 
ตำบลมาบโป่ง อำเภอพานทอง จังหวัดชลบุรี 20160', '0610152912', NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0081 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ผ้าม่านตาไก่ สีขาว 
M20 เบจ, ก1.50*ส2.30 = 1 ผืน ทำผืนใหม่ ผืนเดิมส่งเข้าคลัง', 'ผ้าม่านตาไก่ สีขาว
M20 เบจ, ก1.50*ส2.30 = 1 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0081%');
-- #0082 24/6/2026 | naytumaekkasak
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-24', NULL, 'naytumaekkasak', NULL, NULL, NULL, 'งานเคลมเพิ่มความสูง 40cm ลูกค้าวัดผิด จ่ายเพิ่มแก้ผ้าต่อชาย',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB26", "color_name": "ชินนาม่อน", "color_desc": "ตาไก่สีสัก", "width": "1.50", "height": "2.20", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ต่อชายเพิ่มความสูง 40 cm ลูกค้าจ่ายเพิ่ม"}]'::jsonb, 'รอที่อยู่', NULL, NULL, 302, 'เก็บลูกค้า', NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0082 · ประเภทงานในชีท: งานแก้ลูกค้าเพิ่มเงินเอง · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: ผ้าม่านตาไก่ สีสัก
HB26 ชินนาม่อน ·
ก1.50*ส2.20 =2ผืน', 'ออเดอร์เดิม 
ผ้าม่านตาไก่ สีสัก
HB26 ชินนาม่อน · 
ก1.50*ส1.80 =2ผืน', 'หนูนา', NULL, NULL,
       NULL, 50, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0082%');
-- #0083 27/6/2026 | ambientrock
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-27', 'Shopee', 'ambientrock', NULL, NULL, NULL, 'ความสูงหาย ไป 3 cm เกิดจากผ้า SHB หด',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวสว่าง", "color_desc": "", "width": "1.50", "height": "2.25", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ผ้า SHB หด ทำใหม่"}]'::jsonb, 'รอทำการรีเช็ค', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0083 · สถานะในชีท: งานเสร็จแล้ว · ส่งแก้: หน้าร้าน · วิธีแก้: (สั่งตัด) ผ้าม่านลอนเทป 
โปร่งลายฝน ขาวสว่าง
· กว้าง1.50*สูง2.25 =2ผืน ทำใหม่', '(สั่งตัด) ผ้าม่านลอนเทป 
SHB98 Oatmeal 
· กว้าง1.50*สูง2.25 =2ผืน', 'หนูนา', NULL, NULL,
       NULL, 76, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0083%');
-- #0084 29/6/2026 | meawsasisom
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-29', 'Shopee', 'meawsasisom', NULL, NULL, NULL, 'ขาดอุปกรณ์ราง',
       '[{"type": "ขารางเทป 2 ชั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 6, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "ตัวต่อราง", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 2, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "พุก + น็อต", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'เหมียว มิลรญา 
35/123 ม.ทัสคานี ซอย ประชาร่วมใจ 37 แขวงทรายกองดินใต้ เขต คลองสามวา กทม 10510
0971585101', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0084 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ขารางเทป2ชั้นสีดำ =6 ชิ้น 
ตัวต่อราง =2ชิ้น
พุก+น๊อต =1ชุด', 'ขารางเทป2ชั้นสีดำ ตัวต่อราง
พุก+น๊อต', 'หนูนา', NULL, NULL,
       71, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0084%');
-- #0085 30/6/2026 | kook_pichaya
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-30', 'Shopee', 'kook_pichaya', NULL, NULL, 'ร้าน', 'ตกหล่น',
       '[{"type": "ผ้าม่านลอนตะขอ เพดาน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "D038", "color_name": "ขาวครีม", "color_desc": "", "width": "3.00", "height": "2.50", "quantity": 4, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0085 · สถานะในชีท: เลยกำหนด · ผิดโดย: ส้ม · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งเป็นขนาด
(สั่งตัด) ผ้าม่านลอนตะขอ เพดาน
D038 ขาวครีม · 
ก3.00*สูง2.50 =4ผืน', 'shopee : kook_pichaya
2606240B91XWEA

(สั่งตัด) ผ้าม่านลอนตะขอ เพดาน
D038 ขาวครีม · 
ก3.00*สูง2.50 =4ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0085%');
-- #0086 30/6/2026 | m_tira
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-30', 'Shopee', 'm_tira', '2606250MNF0WT0', NULL, NULL, NULL,
       '[{"type": "ห่วงตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 20, "unit": "ห่วง", "hooks": "", "note": "ลูกค้าได้ตาไก่สีโอ๊ค"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0086 · วิธีแก้: 20 ห่วง ไปลูกค้าด้วยนะครับ', 'ลูกค้าสั่งผ้า ผ้าม่านตาไก่  ตาไก่สีขาว 
แต่ทางลูกค้าได้รับเป็นตาไก่สี โอ๊ค 
รบกวนทำการส่ง ห่วงตาไก่สีขาว =  20 ห่วง ไปลูกค้าด้วยนะครับ', 'ยุน', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0086%');
-- #0087 30/6/2026 | maitaemdee
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-30', 'Shopee', 'maitaemdee', '2605127U26M09A', NULL, 'ขนส่ง', 'เคลมอะไหล่หักจากการขนส่ง',
       '[{"type": "ลูกล้อลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 5, "unit": "ตัว", "hooks": "", "note": ""}, {"type": "ตัวปิดรางเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "", "height": "", "quantity": 3, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'จัดส่งด่วน
ปิยวรรณ แต้มดี 0954539946
11/5 หมู่ 6 ต.กมลา อ.กะทู้ จ.ภูเก็ต 83150', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0087 · สถานะในชีท: เลยกำหนด · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ลูกล้อลอนเทป สีดำ =5ตัว
ตัวปิดรางเทป สีดำ3ตัว', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0087%');
-- #0088 30/6/2026 | aiyadaalanda
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-06-30', 'Shopee', 'aiyadaalanda', NULL, NULL, NULL, 'ตกหล่น',
       '[{"type": "ขาราง 1 ชั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 6, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "ตัวต่อราง", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "พุก + น็อต", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": ""}]'::jsonb, 'สุขเกษม ระวังงาน 
43 ม.4 ต.ตากแดด
ตากแดด เมืองพังงา พังงา 82000', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0088 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ขาราง 1ชั้น =6ชิ้น
ตัวต่อราง=1
พุ๊กน๊อต =1', 'อุปกรณ์รางม่าน', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0088%');
-- #0089 2/7/2026 | kanom_phuket
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-02', 'Shopee', 'kanom_phuket', NULL, NULL, 'ร้าน', 'แอดมินทำการประเมินสลับกว้าง*สูงเป็นสูง*กว้างค่ะ',
       '[{"type": "ม่านพับมินิมอล", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB87", "color_name": "", "color_desc": "", "width": "0.91", "height": "1.47", "quantity": 4, "unit": "ชุด", "hooks": "", "note": "ซ้าย 2 / ขวา 2 · ระยะใส่ห่วงข้างละ 15 ซม. (สลับกว้าง-สูง)"}]'::jsonb, 'พรทิพย์ ปริณ
36 ซ.วชิรธรรมสาธิต 20 สุขุมวิท 101/1 บางนา กทม 10260
โทร 0911456222', NULL, NULL, NULL, NULL, NULL,
       NULL, 'ส่งแล้ว', 'ชีทเคลม #0089 · สถานะในชีท: งานเสร็จแล้ว · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: แก้ใหม่เป็น

(สั่งตัด) ม่านพับมินิมอล ระยะที่ใส่ห่วง ข้างละ 15 ซม
HB87
0.91*1.47 = 4 ชุดซ้าย2/ขวา2', '260620HSJ5TUPK
(สั่งตัด) ม่านพับมินิมอล ระยะที่ใส่ห่วง ข้างละ 15 ซม
HB87
1.47*0.91 = 4 ชุดซ้าย2/ขวา2', 'หนูนา', NULL, NULL,
       213, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0089%');
-- #0090 2/7/2026 | ratchaneeporn_wan
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-02', 'Shopee', 'ratchaneeporn_wan', NULL, NULL, NULL, 'จัดอุปรกรณ์ไม่ครบ',
       '[{"type": "ขารางม่านพับ", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่งด่วน
คุณบัว (ปลายนาพาสุข)
257 หมู่ 7 บ้านสุขสุขเกษม
ต.โพธิ์ตาก อ เมือง นครพนม 48000

โทร 0948755591', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0090 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ขารางม่านพับ =1ชิ้น', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0090%');
-- #0091 3/7/22026 | wan mai
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-03', 'LineOA', 'wan mai', NULL, NULL, 'ร้าน', 'แอดมินสรุปสีผิด',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "HB24", "color_name": "White Cream", "color_desc": "", "width": "1.29", "height": "2.395", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "แอดมินสรุปสีผิด (เดิม S581 Whip Cream)"}]'::jsonb, 'ส่ง นายกิตติบงกช ชมมณี 
083-566-4464 (โม)
54/67 หมู่บ้านปัฐวิกรณ์  ซ.นวมินทร์ 72 
แขวงคลองกุ่ม เขตบึงกุ่ม 10240 กท', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0091 · สถานะในชีท: เลยกำหนด · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: เปลี่ยน
ผ้าม่านลอนเทป 
HB24 White Cream 
ก1.29*ส2.395 = 2 ผืน', 'ผ้าม่านลอนเทป 
S581 Whip Cream
ก1.29*ส2.395 = 2 ผืน 2,577 บาท', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0091%');
-- #0092 4/7/2026 | atcharaphonk
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-04', 'Shopee', 'atcharaphonk', '2606276MX6Y6DP', NULL, NULL, 'รางขาด1เส้น',
       '[{"type": "รางม่านตาไก่ (เฉพาะราง)", "floors": 2, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "สักลายไม้", "color_desc": "", "width": "2.80", "height": "", "quantity": 1, "unit": "เส้น", "hooks": "", "note": ""}]'::jsonb, 'ที่อยู่
อัจฉราภรณ์ แก่นแก้ว
124/256 ม.1 มบ.ปิยวรารมย์ ต.บึงยี่โถ อ.ธัญบุรี จ.ปทุมธานี 12130
091-820-1714', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0092 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งเป็นขนาด
รางม่านตาไก่ สีสักลายไม้ 
ราง2ชั้น · 2.80 = 1 เส้น', 'รางขาด1เส้น', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0092%');
-- #0093 4/7/2026 | chaba_koy
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-04', 'Shopee', 'chaba_koy', NULL, NULL, NULL, 'ไม่ได้สารัดผ้า 1 ผืน',
       '[{"type": "สายรัดผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB98", "color_name": "Oatmeal", "color_desc": "", "width": "3.00", "height": "2.20", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'ก้อย
286/322 หมู่ที่ 10 ซอย 11 ซอย ประวรรณดา ตำบลโพธิ์กลาง อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา 30000
0931098745', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0093 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งเป็น
สายรัดผ้าม่านตาไก่ 
SHB98 Oatmeal · 
ก3.00*ส2.20    = 1 ชิ้น', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0093%');
-- #0094 5/7/2026 | thaninpisutyuwaratanaporn
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-05', 'Shopee', 'thaninpisutyuwaratanaporn', NULL, NULL, NULL, 'จัดอุปรกรณ์ไม่ครบ',
       '[{"type": "ขาราง ลอนโซ่ 2 ชั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 5, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'นาย ธนินพิศุทธิ์ ยุวรัตนาพร
49/682 ซอย เสรีไทย39 ถนน เสรีไทย บึงก ทย ปิงกุ่ม คลองกุ่ม กรุงเทพ 10240 เบอร์โทรศัพท์ 0959353999', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0094 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ขาราง.ลอนโซ่ 2 ชั้นสีขาว
=5 ชิ้น', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0094%');
-- #0095 6/7/2026 | thaninpisutyuwaratanaporn
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-06', 'Shopee', 'thaninpisutyuwaratanaporn', NULL, NULL, NULL, 'จัดอุปรกรณ์ไม่ครบ',
       '[{"type": "ขาราง ลอนโซ่ 2 ชั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "ตะขอเกี่ยวม่าน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 2, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'นาย ธนินพิศุทธิ์ ยุวรัตนาพร
49/682 ซอย เสรีไทย39 ถนน เสรีไทย บึงก ทย ปิงกุ่ม คลองกุ่ม กรุงเทพ 10240 
เบอร์โทรศัพท์ 0959353999', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0095 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ขาราง.ลอนโซ่ 2 ชั้นสีขาว = 1 ชิ้น 
ตะขอเกี่ยวม่าน = 2 ชื้น', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0095%');
-- #0096 6/7/2026 | phimonpan
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-06', 'Shopee', 'phimonpan', NULL, NULL, 'ขนส่ง', 'อะไหล่ ลื่อลูมิเนียมหัก',
       '[{"type": "อะไหล่ล้ออลูมิเนียม", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'พิมลพรรณ แก้วมน
(+66) 81 264 8104
เครือพูลทรัพย์ 14/1 ม.6 บ้านนาใหญ่ ต.นากลาง ตำบลนากลาง, อำเภอสูงเนิน, จังหวัดนครราชสีมา, 30380', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0096 · สถานะในชีท: เลยกำหนด · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: อะไหล่ ลื่อลูมิเนียม', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0096%');
-- #0097 6/7/2026 | hpear
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-06', 'Shopee', 'hpear', NULL, NULL, NULL, 'ลูกค้าแจ้งไว้ได้รับความกว้างแค่ 3.70 ครับ
กระดุมม่านไม่ตรง',
       '[{"type": "ผ้าโปร่งลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ผ้าโปร่ง Mid-modern", "color_desc": "", "width": "4.985", "height": "2.945", "quantity": 1, "unit": "ผืน", "hooks": "78", "note": "ได้ความกว้างแค่ 3.70 + กระดุมไม่ตรง"}]'::jsonb, 'ที่อยู่จัดส่ง
คุณ เฮเลน  
166/8 หมู่ที่6 ห้องที่5 อำเภอบางกรวย นนทบุรี 11130 
ร้านปิยดาสลีพซาลอน
เบอร์โทรศัพท์ 0851809008', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0097 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: แก้ไขเป็น  
ผ้าโปร่ง Mid-modern  
ก4.985*ส2.945 = 1 ผืน  ( 78)', 'ผ้าลูกค้า ออร์เดอร์ 
260620K67G2CH7 (สั่งตัด)
(สั่งตัด) ผ้าโปร่งลอนเทป
ผ้าโปร่ง Mid-modern  
ก4.985*ส2.945 = 1 ผืน', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0097%');
-- #0098 6/7/2026 | guyguydw17
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-06', 'Shopee', 'guyguydw17', '2606275HRX6EX0', NULL, NULL, 'ลูกค้าแจ้งว่าได้รับรางผิดขนาดครับได้รับเป็นขนาด 1.50 = 1 ชุด',
       '[{"type": "รางม่านจีบ", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "1.80", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เดี่ยว — ได้รับผิดขนาด 1.50"}]'::jsonb, 'คุณกิติยา ใจชุ่มชื่น 
133/17 ม.1 ต.แคราย อ.กระทุ่มแบน จ.สมุทรสาคร 74110 
เบอร์โทรศัพท์ 0863595027', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0098 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: รางม่านจีบ 1 ชั้น 
สีดำ เดี่ยว 
ขนาด 1.80 = 1 ชุด', 'รางม่านจีบ 1 ชั้น 
สีดำ เดี่ยว 
ขนาด 1.80 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0098%');
-- #0099 7/7/2026 | .wannarot0506
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-07', 'Shopee', '.wannarot0506', NULL, NULL, NULL, 'มู่ลี่อะไหล่หัก 
ตัวปิดหัก1',
       '[{"type": "อะไหล่มู่ลี่ ตัวปิด", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่ง
บุญส่ง ประทุมทอง
177/57 วปอ.11 ซอย 10 หมู่ 4 ถนนเศรษฐกิจ1 ตำบลท่าไม้ อำเภอกระทุ่มแบน จังหวัดสมุทรสาคร 74110
0613288188', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0099 · สถานะในชีท: เลยกำหนด · วิธีแก้: มู่ลี่อะไหล่
ตัวปิด', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0099%');
-- #0100 8/7/2026 | ming2302
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-08', 'Shopee', 'ming2302', '2606277NH2WKXD', NULL, 'ขนส่ง', 'ราง3.00 บุบ ระหว่างขนส่งค่ะ',
       '[{"type": "รางม่านลอนเทป", "floors": 2, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "3.00", "height": "", "quantity": 1, "unit": "เส้น", "hooks": "", "note": "ราง 3.00 บุบระหว่างขนส่ง"}]'::jsonb, 'อภิชาต อาภัสพงศ์
0899866991
กรุงเทพ เขตคลองสามวา แขวนสามวาตะวันตก 10510
234/232 ซอย33 หมู่บ้าน แกรนด์ บริทาเนีย วงแหวน-รามอินทรา
ถนน 01 กาญจนาภิเษ', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0100 · สถานะในชีท: เลยกำหนด · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งใหม่เป็น
รางม่านลอนเทป 2 ชั้น  
ขนาด 3.00 = 1 เส้น', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0100%');
-- #0101 8/7/2026 | ming2302
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-08', 'Shopee', 'ming2302', '2606277NH2WKXD', NULL, 'ขนส่ง', 'อุปกรณืรางม่านตกหล่น ระหว่างขนส่งค่ะ',
       '[{"type": "ขาราง 2 ชั้น ลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 22, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "หัวปิดรางม่าน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 1, "unit": "ตัว", "hooks": "", "note": ""}, {"type": "ตัวต่อรางลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 2, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "ตะขอรวบม่าน", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 10, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'อภิชาต อาภัสพงศ์
0899866991
กรุงเทพ เขตคลองสามวา แขวนสามวาตะวันตก 10510
234/232 ซอย33 หมู่บ้าน แกรนด์ บริทาเนีย วงแหวน-รามอินทรา
ถนน 01 กาญจนาภิเษ', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0101 · สถานะในชีท: เลยกำหนด · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งใหม่เป็น
ขาราง2ชั้น ลอนเทปสีขาว = 22 
หัวปิดรางม่านสีขาว  = 1 ตัว
ตัวต่อรางลอนเทป =  2 ชิ้น
ตะขอรวบม่านสีขาว = 10 ตัว', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0101%');
-- #0102 8/7/2026 | warapornkengsenput
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-08', 'Tiktok', 'warapornkengsenput', '584873758155769555', NULL, 'ร้าน', 'สรุป ตกหล่นจัดส่งด่วน',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "M80", "color_name": "เทาเข้ม", "color_desc": "ตาไก่สีสัก", "width": "2.50", "height": "2.60", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'ชื่อ สิริพันธ์ สมเกตุ
ที่อยู่ 54หมู่3 ต.แปลงยาว อ.แปลงยาว จ.ฉะเชิงเทรา 24190
0628844918', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0102 · สถานะในชีท: เลยกำหนด · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ผ้าม่านตาไก่ ตาไก่สีสัก
M80 เทาเข้ม
ก2.50*ส2.60 = 2 ผืน', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0102%');
-- #0103 8/7/2026 | guyguydw17
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-08', 'Shopee', 'guyguydw17', '2606275HRX6EX0', NULL, NULL, 'เคลมรางสั่นกว่าที่สั่ง',
       '[{"type": "รางม่านจีบ (เฉพาะราง)", "floors": 1, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ดำ", "color_desc": "", "width": "1.80", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เดี่ยว"}]'::jsonb, 'จัดส่งด่วน
กิติยา ใจชุ่มชื่น 0863595027
133/17 ม.1 ต.แคราย อ.กระทุ่มแบน จ.สมุทรสาคร 74110', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0103 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: รางม่านจีบ 1 ชั้น (เฉพาะราง)
สีดำ เดี่ยว 1.80 =1ชุด', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0103%');
-- #0104 9/7/2026 | thuntuchkongsakul
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-09', 'Shopee', 'thuntuchkongsakul', '2606252TK7M40G', NULL, NULL, 'ลูกค้าแจ้งว่าตัวผ้าทึบของลูกค้าความสูงหายไป 2 cm ครับ ผ้าขนาด',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB97", "color_name": "Linen Beige", "color_desc": "", "width": "1.25", "height": "2.05", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ความสูงหายไป 2 cm"}]'::jsonb, 'ทีอยู่จัดส่ง 
คุณ ธัญวรรณ พิริยะโยธิน
คอนโด the key ประชาชื่น  111/230 ถนนประชาชื่น
ต.บางเขน อ.เมืองนนทบุรี จ.นนทบุรี 11000
เบอร์โทรศัพท์ 0955966391', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0104 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: (สั่งตัด) ผ้าม่านลอนเทป
SHB97 Linen Beige 
ก1.25*ส2.05 = 2 ผืน', NULL, 'หนูนา', NULL, NULL,
       165, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0104%');
-- #0105 9/7/2026 | atikan.sudlapa
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-09', 'Shopee', 'atikan.sudlapa', '260702KADCY9JQ', NULL, 'ขนส่ง', 'รางงอจากการขนส่ง',
       '[{"type": "รางsnake (เฉพาะราง)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "เมเปิ้ล", "color_desc": "", "width": "2.00", "height": "", "quantity": 2, "unit": "ราง", "hooks": "", "note": ""}]'::jsonb, 'จัดส่ง
0858069622 
อติกันต์ สุดลาภา 
96/55 หมู่ 5 หมู่บ้านกรุงศรีธานี 
ต.วัดตูม อ.พระนครศรีอยุธยา 
จ.พระนครศรีอยุธยา 13000', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0105 · สถานะในชีท: เลยกำหนด · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: รางsnake สีเมเปิ้ล  2.00=2ราง (เฉพาะราง)', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0105%');
-- #0106 9/7/2026 | supawanseenaksai1
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-09', 'Tiktok', 'supawanseenaksai1', '584888154777683915', NULL, 'ร้าน', 'แอดมินทำการสรุปตกหล่น
ลูกค้าตีกลับได้แจ้งทางลูกค้าแล้วว่าหากต้องการให้สั่งเข้ามาใหม่อีกครั้ง 
จะรีบทำกรผลิตให้ครับ ออร์นี้่นะครับผม',
       '[{"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB92", "color_name": "Cloud Whisper", "color_desc": "ตาไก่สีดำ", "width": "1.50", "height": "1.80", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "SHB92", "color_name": "Cloud Whisper", "color_desc": "ตาไก่สีดำ", "width": "2.00", "height": "1.80", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0106 · สถานะในชีท: เลยกำหนด · ผิดโดย: กาย · วิธีแก้: ส่งใหม่
ผ้าม่านตาไก่ ตาไก่สีดำ
SHB92 Cloud Whisper
ก1.50*ส1.80 = 2 ผืน
ก2.00*ส1.80 = 2 ผืน', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0106%');
-- #0107 10/7/2026 | by_nee
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-10', 'Shopee', 'by_nee', '2606277VE92M85', NULL, 'ร้าน', 'ขนาดรางผิด',
       '[{"type": "รางม่านจีบ", "floors": 2, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "2.56", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เดี่ยว — เดิมส่งขนาด 1.14 ผิด"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0107 · สถานะในชีท: เลยกำหนด · ผิดโดย: แพท · ส่งแก้: หน้าร้าน · วิธีแก้: รางต้อง2.56', 'รางม่านจีบ 2 ชั้น  สีขาว เดี่ยว  ขนาด 1.14 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0107%');
-- #0108 10/7/2026 | p_gamsaii
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-10', 'Tiktok', 'p_gamsaii', '584893402302088437', NULL, 'ร้าน', 'แอดมินสรุปผิด',
       '[{"type": "ผ้าโปร่งตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งลายฝนขาวสว่าง", "color_desc": "ตาไก่สุ่มสีสัก", "width": "2.50", "height": "2.60", "quantity": 2, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'คุณ แก้ม 
336/18 ม.4 วังศาลาการ์เด้น ซอย 4 ตำบลวังศาลา 
อำเภอท่าม่วง จังหวัดกาญจนบุรี 71110
เบอร์โทรศัพท์ 0831138961', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0108 · สถานะในชีท: เลยกำหนด · ผิดโดย: หนูนา · ส่งแก้: หน้าร้าน · วิธีแก้: ผ้าม่านตาไก่ สุ่มสีสัก
ผ้าโปร่งลายฝนขาวสว่วง  
ก2.50*ส2.60 = 2 ผืน', 'ผ้าม่านตาไก่ สุ่มสีสัก
M20 เบจ, 
ก2.50*ส2.60 = 2 ผืน

ผ้าม่านตาไก่ สุ่มสีสัก
ผ้าโปร่งลายฝนขาวสว่วง  
ก2.50*ส2.60 = 2 ผืน', 'หนูนา', NULL, NULL,
       123, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0108%');
-- #0109 15/7/2026 | yositachaisuthad
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-15', 'Shopee', 'yositachaisuthad', NULL, NULL, 'ร้าน', 'สรุปสีผิด',
       '[{"type": "ม่านตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โปร่งเรียบขาวนวล", "color_desc": "ตาไก่สีขาว", "width": "2.00", "height": "2.50", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ห่วงตาไก่", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ขาว", "color_desc": "", "width": "", "height": "", "quantity": 12, "unit": "ห่วง", "hooks": "", "note": ""}]'::jsonb, 'คุณ ไอลีน เลขที่ 344/122 หมู่บ้านพฤกษา ธานีประโดก ซอย55 ต.หมื่นไวย, อำเภอเมือง นครราชสีมา ตำบลหมื่นไวย อำเภอเมืองนครราชสีมา จังหวัด

นครราชสีมา 30000

เบอร์โทรศัพท์ 098-5954827', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0109 · สถานะในชีท: เลยกำหนด · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ม่านตาไก่ สีขาว
โปร่งเรียบขาวนวล
2.00*2.50=1ผืน 

+ตาไก่สีขาว 12ห่วง', NULL, 'หนูนา', NULL, NULL,
       48, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0109%');
-- #0110 19/7/2026 | ammkkkk
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-19', 'Shopee', 'ammkkkk', NULL, NULL, NULL, 'ราง 1.5 ไม่มีตัวปิดรางค่ะ',
       '[{"type": "ตัวปิดรางจีบ", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 6, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่ง
เกศรินทร์ แก้วอุดม
เลขที่ 82/5 หมู่ที่ 1 ถนนหนองพญา-ก้นหนอง  ต.ตะพง อ.เมือง จ.ระยอง 21000
0835363623', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0110 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: จัดส่งด่วน
ตัวปิดรางจีบ =6 ชิ้น', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0110%');
-- #0111 19/7/2026 | mr_bobbo
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-19', 'Shopee', 'mr_bobbo', '260623RJWQY2H9, 260622RCGD2P94', NULL, 'ร้าน', 'ผ้าทั้งสองออร์เดอร์ความสูงสลับกันครับผม',
       '[{"type": "ผ้าม่าน (แก้ขนาด)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "1.00", "height": "2.45", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}, {"type": "ผ้าม่าน (แก้ขนาด)", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "1.60", "height": "2.70", "quantity": 1, "unit": "ผืน", "hooks": "", "note": ""}]'::jsonb, 'นายชลายุทธ  แก้วคำ
หมู่บ้าน Everyday Village 222/32 หมู่ 3  
ต.สันทรายน้อย อ.สันทราย จ.เชียงใหม่ 50210', '099-4129982', NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0111 · สถานะในชีท: เลยกำหนด · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ทำการแก้ไขขนาดผ้าเป็นขนาด 
ผ้าขนาด 1.00*2.45 = 1 ผืน และ 
ผ้าขนาด 1.60*2.70 = 1 ผืน', NULL, 'หนูนา', NULL, NULL,
       93, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0111%');
-- #0112 20/7/2026 | deerdent2021
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-20', 'Shopee', 'deerdent2021', '260715R1E8K9WJ', NULL, NULL, 'อุปกรณืืไม่ครบ',
       '[{"type": "ขารางม่านตาไก่ 1 ชั้น", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "สัก", "color_desc": "", "width": "", "height": "", "quantity": 4, "unit": "ขา", "hooks": "", "note": ""}]'::jsonb, 'ณัฏฐา นครชัย
181/96 ถ.บางขุนนนท์ ซอย31 แยก6
แขวงบางขุนนนท์ เขตบางกอกน้อย กทม. 10700', '0805664269', NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0112 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ขารางม่านตาไก่ 1ชั้น
ขาราง1ชั้น (สีสัก)  = 4 ขา', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0112%');
-- #0113 20/7/2026 | apichasangaroon
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-20', 'Shopee', 'apichasangaroon', '260621NRBVESFF', NULL, 'ร้าน', 'แอดมินแนะนำการสั่งขนาดรางผิดค่ะ',
       '[{"type": "รางม่านตาไก่", "floors": 1, "rail_head": "หัวกลมจุก", "fabric_type": "", "color_code": "", "color_name": "โอ๊ค", "color_desc": "", "width": "2.20", "height": "", "quantity": 1, "unit": "ชุด", "hooks": "", "note": "เดิมสั่ง 1.80 แอดมินแนะนำขนาดผิด"}]'::jsonb, 'นาย​ กฤตภาส​ แสงอรุณ​
146/1 ถ.สมุทร​สงคราม​บางแพ​ ต.แม่​กลอง​ อ.เมือง​ จ.สมุทร​สงคราม​ 75000​', '0614655856​', NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0113 · สถานะในชีท: เลยกำหนด · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ส่งใหม่เป็น
รางม่านตาไก่ 1 ชั้น  หัวกลมจุก สีโอ๊ค 
ขนาด 2.20 = 1 ชุด', '260621NRBVESFF ออเดอร์เดิม
รางม่านตาไก่ 1 ชั้น  หัวกลมจุก สีโอ๊ค 
ขนาด 1.80 = 1 ชุด', 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0113%');
-- #0114 20/7/2026 | ppangsc
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-20', 'Shopee', 'ppangsc', '260717URCNS57T', NULL, 'ร้าน', 'แอดมินสรุปผิดเป็นตาไก่ แต่ลูกค้าสั่งเป็นม่านสอดครับผม',
       '[{"type": "ผ้าม่านสอด", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "ผ้าโปร่ง Richy", "color_desc": "", "width": "2.00", "height": "1.80", "quantity": 1, "unit": "ผืน", "hooks": "", "note": "แอดมินสรุปผิดเป็นตาไก่"}]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0114 · สถานะในชีท: เลยกำหนด · ผิดโดย: กาย · ส่งแก้: หน้าร้าน · วิธีแก้: ผ้าม่านสอด
ผ้าโปร่ง Richy
ก2.00*ส1.80 = 1 ผืน', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0114%');
-- #0115 21/7/2026 | ammkkkk
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-21', 'Shopee', 'ammkkkk', '2607098NWMP2Y6', NULL, NULL, 'รางม่านจีบขนาด  1.50 และขนาด 2.80 แบบ 2 ชั้น ได้ตัวนำสไลด์ไปแค่ 1 ตัว ทุกราง',
       '[{"type": "ตัวนำสไลด์", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 8, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'เกศรินทร์ แก้วอุดม
เลขที่ 82/5 หมู่ที่ 1 ถนนหนองพญา-ก้นหนอง  ต.ตะพง อ.เมือง จ.ระยอง 21000
0835363623', NULL, NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0115 · ส่งแก้: หน้าร้าน · วิธีแก้: ตัวนำสไลด์ = 8 ชิ้น', NULL, 'หนูนา', NULL, NULL,
       93, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0115%');
-- #0116 22/7/2026 | sunisa.fame
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-22', 'Shopee', 'sunisa.fame', NULL, NULL, NULL, 'อุปกรณ์ขาด',
       '[{"type": "หัวกลมจุก", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "โอ๊ค", "color_desc": "", "width": "", "height": "", "quantity": 2, "unit": "ชิ้น", "hooks": "", "note": ""}]'::jsonb, 'จัดส่งด่วน
สุนิษา เหินชัย  181 ม.2 บ.โสกตลับ ต.โคกสูง อ.เมือง จ.ชัยภูมิ 36000', '0630694503', NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0116 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: หัวกลมจุกสีโอ๊ค =2', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0116%');
-- #0117 23/7/2026 | aunaun_z8
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-23', 'Shopee', 'aunaun_z8', '2607073XG0W0PR', NULL, NULL, 'ลูกค้าไม่ได้ผ้าทึบค่ะ ได้รับเป็นผ้าโปร่ง2ชุดแทน',
       '[{"type": "ผ้าม่านลอนเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "D038", "color_name": "ขาวครีม", "color_desc": "", "width": "1.35", "height": "2.545", "quantity": 2, "unit": "ผืน", "hooks": "", "note": "ลูกค้าได้ผ้าโปร่งแทนผ้าทึบ"}]'::jsonb, 'ที่อยู่
พัทยา จอมหาร
131 ม.3 ต.หนองบัว อ.ไชยปราการ จ.เชียงใหม่ 50320', '0817465038', NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0117 · สถานะในชีท: เลยกำหนด · ส่งแก้: หน้าร้าน · วิธีแก้: ทำใหม่เป็น
(สั่งตัด) ผ้าม่านลอนเทป
D038 ขาวครีม
ก1.35*ส2.545 = 2 ผืน', 'ออเดอร์เดิม
shopee: aunaun_z8
2607073XG0W0PR (สั่งตัด) 
(สั่งตัด) ผ้าม่านลอนเทป
D038 ขาวครีม
ก1.35*ส2.545 = 2 ผืน', 'หนูนา', NULL, NULL,
       63, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0117%');
-- #0118 23/7/2026 | q62ci92gmn
insert into public.claims
  (claim_date, channel, customer_username, original_order_number, claim_type, fault, cause,
   items, ship_address, ship_phone, courier, refund_amount, money_direction, payment_target,
   money_status, status, notes, raw_text, admin_name, closed_by, closed_at,
   ship_back_cost, ship_return_cost, estimated_price, created_at, updated_at)
select '2026-07-23', 'Shopee', 'q62ci92gmn', NULL, NULL, 'ขนส่ง', 'อุปกรณ์ชำรุด',
       '[{"type": "ตัวปิดรางเทป", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 3, "unit": "ชิ้น", "hooks": "", "note": ""}, {"type": "ลูกล้อ", "floors": null, "rail_head": "", "fabric_type": "", "color_code": "", "color_name": "", "color_desc": "", "width": "", "height": "", "quantity": 5, "unit": "ตัว", "hooks": "", "note": ""}]'::jsonb, 'อยู่
หทัยกัญญา บัวสังข์
 45/2 ถนนชัยเพชรมงคล ตำบลบ่อยาง อำเภอเมือง จังหวัดสงขลา 90000', '098-7270976', NULL, NULL, NULL, NULL,
       NULL, 'รอของคืน', 'ชีทเคลม #0118 · สถานะในชีท: เลยกำหนด · ผิดโดย: ระบบขนส่ง · ส่งแก้: หน้าร้าน · วิธีแก้: ตัวปิดรางเทป =3
ลูกล้อ =5', NULL, 'หนูนา', NULL, NULL,
       NULL, NULL, NULL, now(), now()
where not exists (select 1 from public.claims where notes like 'ชีทเคลม #0118%');

-- ============================================================================
-- ตรวจผล: จำนวนเคลมที่นำเข้าจากชีท (ควรได้ 115 แถว)
select count(*) as "นำเข้าจากชีทแล้ว" from public.claims where notes like 'ชีทเคลม #%';
-- ดูรายการทั้งหมด: select claim_date, channel, customer_username, status, notes from public.claims where notes like 'ชีทเคลม #%' order by claim_date;
-- ย้อนกลับทั้งหมด (ถ้าอยากลบที่นำเข้าไป): delete from public.claims where notes like 'ชีทเคลม #%';
-- ============================================================================
