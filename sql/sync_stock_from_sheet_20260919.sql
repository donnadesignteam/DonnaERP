-- ════════════════════════════════════════════════════════════════════════════
-- อัปเดตรายการผ้าในสต็อกตาม Google Sheet (แท็บ "ชีต21") — 19 ก.ย. 69
--   · รหัสผ้า/ชื่อสี/หน้าผ้า/ลักษณะผ้า/รหัสร้าน/ร้าน = ตามชีท (92 รายการ)
--   · ผ้าที่มีรหัสซัพพลาย 2 ร้าน → แยกเป็น 2 รายการ (รหัสผ้าเดียวกัน คนละร้าน)
--   · ไม่มีในชีท → ลบ · มีในชีทแต่ไม่มีในเว็บ → เพิ่ม · รหัสเดิม → แก้ข้อมูลในแถวเดิม (id เดิม)
--   · ทุกรายการ ม้วน/เมตร = 0 สถานะ "ของหมด" (จะเติมสต็อกใหม่ทีหลัง)
-- ‼️ รันกับฐานจริง = เว็บจริงเปลี่ยนทันที · สำรองของเดิมไว้ที่ตาราง stock_backup_20260919
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- 1) สำรองของเดิม (รันซ้ำได้ — มีแล้วไม่ทับ)
create table if not exists stock_backup_20260919 as select * from stock;

-- 2) รายการจากชีท
create temp table sheet_stock (ord int, fabric_code text, color_name text, fabric_width numeric, fabric_type text, shop_code text, shop_name text) on commit drop;
insert into sheet_stock values
  (1, 'S010', 'ครีมขาว', 2.8, 'DIMOUT สูงปกติ', 'DK85/01', 'Darika (DK)'),
  (2, 'D038', 'ขาวครีม', 2.8, 'DIMOUT สูงปกติ', 'AU004-26', 'ออร่า Aura Art'),
  (3, 'W17', 'ขาวควัน', 2.8, 'DIMOUT สูงปกติ', 'MU101-17', 'M&X'),
  (4, 'S700', 'ครีมลาเต้', 2.8, 'DIMOUT สูงปกติ', 'dk107/2', 'Darika (DK)'),
  (5, 'S05', 'เทาเบจ', 2.8, 'DIMOUT สูงปกติ', 'MU101-5', 'M&X'),
  (6, 'S18', 'เทาเมฆ', 2.8, 'DIMOUT สูงปกติ', 'MU101-18', 'M&X'),
  (7, 'M80', 'เทาเข้ม', 2.8, 'DIMOUT สูงปกติ', 'BSW-3', 'CT store'),
  (8, 'S61', 'เทาเบจ', 2.8, 'DIMOUT สูงปกติ', 'BSW-1', 'CT store'),
  (9, 'S10', 'Jet Black', 2.8, 'DIMOUT สูงปกติ', 'COS 18-13', 'Cosi'),
  (10, 'DS01', 'โปร่งลายฝนขาวสว่าง สูงปกติ', 2.8, 'SHEER ผ้าโปร่ง', '1S-101', 'CT store'),
  (11, 'DS02', 'โปร่งลายฝนขาวนวล สูงปกติ', 2.8, 'SHEER ผ้าโปร่ง', '1S-102', 'CT store'),
  (12, 'DS03', 'โปร่งเรียบขาวสว่าง สูงปกติ', 2.8, 'SHEER ผ้าโปร่ง', '1S-104', 'CT store'),
  (13, 'DS04', 'โปร่งเรียบขาวนวล สูงปกติ', 2.8, 'SHEER ผ้าโปร่ง', '1S-103', 'CT store'),
  (14, 'DS05', 'Mist Gray โปร่งเทา', 2.8, 'SHEER ผ้าโปร่ง', '1S-130', 'CT store'),
  (15, 'DS06', 'โปร่งลายฝนขาวสว่าง สูงพิเศษ', 3.2, 'SHEER ผ้าโปร่ง', 'OK301-21A', 'Sue M'),
  (16, 'DS07', 'โปร่งลายฝนขาวนวล สูงพิเศษ', 3.2, 'SHEER ผ้าโปร่ง', 'OK301-21B', 'Sue M'),
  (17, 'DS08', 'Clear Off White', 3, 'SHEER ผ้าโปร่ง', null, 'CT store'),
  (18, 'DS09', 'raindrop off white', 3.2, 'SHEER ผ้าโปร่ง', null, 'CT store'),
  (19, 'DS091', 'raindrop off white', 2.8, 'SHEER ผ้าโปร่ง', null, 'CT store'),
  (20, 'AB21', 'โปร่งเรียบหนา Mid-modern', 2.8, 'SHEER ผ้าโปร่ง', 'AB21', 'จิงจิง'),
  (21, 'AB21', 'โปร่งเรียบหนา Mid-modern', 2.8, 'SHEER ผ้าโปร่ง', 'DS08', 'CT store'),
  (22, 'AB22', 'โปร่งเรียบหนาพิเศษ Richy', 3.2, 'SHEER ผ้าโปร่ง', 'AB22', 'จิงจิง'),
  (23, 'AB22', 'โปร่งเรียบหนาพิเศษ Richy', 3.2, 'SHEER ผ้าโปร่ง', 'DS09', 'CT store'),
  (24, 'AB58', 'โปร่งลาย Linen', 3.2, 'SHEER ผ้าโปร่ง', 'AB58', 'จิงจิง'),
  (25, 'AB58', 'โปร่งลาย Linen', 3.2, 'SHEER ผ้าโปร่ง', 'DS10', 'CT store'),
  (26, 'AB41', 'โปร่งหนา Butter Cup linen Pie', 3.2, 'SHEER ผ้าโปร่ง', 'AB41', 'จิงจิง'),
  (27, 'AB41', 'โปร่งหนา Butter Cup linen Pie', 3.2, 'SHEER ผ้าโปร่ง', 'DS11', 'CT store'),
  (28, 'H01', 'ครีม', 3.2, 'DIMOUT สูงพิเศษ', 'G471', 'เดอะแกรน The Grand'),
  (29, 'HJJ-6', 'ครีมอ่อน', 3.2, 'DIMOUT สูงพิเศษ', '820-1', 'จิงจิง'),
  (30, 'HJJ-7', 'ครีมน้ำตาล', 3.2, 'DIMOUT สูงพิเศษ', '1018-6', 'จิงจิง'),
  (31, 'HJJ-5', 'เทาเข้ม', 3.2, 'DIMOUT สูงพิเศษ', '1018-7', 'จิงจิง'),
  (32, 'H222', 'เบจน้ำตาล', 3.2, 'DIMOUT สูงพิเศษ', '1018-5', 'จิงจิง'),
  (33, 'H222', 'เบจน้ำตาล', 3.2, 'DIMOUT สูงพิเศษ', 'DD2', 'จิงจิง'),
  (34, 'H99', 'เทาเบจ', 3.2, 'DIMOUT สูงพิเศษ', '820-3', 'โกลเฮ้าส์ Gold house'),
  (35, 'M11', 'แมคคาเดเมียแกมเขียว', 3.2, 'DIMOUT สูงพิเศษ', 'ha189', 'โกลเฮ้าส์ Gold house'),
  (36, 'A11', 'แมคคาเดเมียแกมครีมขาว', 3.2, 'DIMOUT สูงพิเศษ', 'ha188', 'โกลเฮ้าส์ Gold house'),
  (37, 'S01', 'ครีมมินิมอล', 3.2, 'DIMOUT สูงพิเศษ', 'DD-1', 'จิงจิง'),
  (38, 'M20', 'เบจ', 3.2, 'DIMOUT สูงพิเศษ', 'DD-2', 'จิงจิง'),
  (39, 'S581', 'ขาวครีมติดเนื้อ', 3.2, 'DIMOUT สูงพิเศษ', '5008-1', 'เควี KV'),
  (40, 'M14', 'นู๊ดเบจ', 3.2, 'DIMOUT สูงพิเศษ', 'PC-A-33', 'Pro textile'),
  (41, 'KW5-1', 'ขาวมุก วิ้งเกาหลี', 3.2, 'DIMOUT สูงพิเศษ วิ้งเกาหลี', 'CX5000-1', 'CX'),
  (42, 'HB81', 'เทาเบจน้ำตาล', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '8186-1', 'จิงจิง'),
  (43, 'HB16', 'ขาวออฟไวท์', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '8186-3', 'จิงจิง'),
  (44, 'HB82', 'เทาเมฆ', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '8186-2', 'จิงจิง'),
  (45, 'HB82', 'เทาเมฆ', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '422-2', 'CT store'),
  (46, 'HB83', 'เทาอ่อน', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '8186-5', 'จิงจิง'),
  (47, 'HB83', 'เทาอ่อน', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '422-5', 'CT store'),
  (48, 'HB85', 'เทาเข้ม', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '8186-4', 'จิงจิง'),
  (49, 'HB88', 'ขาวครีม', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'KK1', 'จิงจิง'),
  (50, 'HB87', 'ลินินหม่นขาว', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AF23-22', 'Asia fabric'),
  (51, 'HB87', 'ลินินหม่นขาว', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AF23-23', 'Asia fabric'),
  (52, 'HB93', 'Mocha Grey', null, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '777-3', null),
  (53, 'HB94', 'Cloud Grey', null, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '777-4', null),
  (54, 'HB95', 'Soft grey', null, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '777-5', null),
  (55, 'HB96', 'Charcoal Grey', null, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', '777-6', null),
  (56, 'SHB91', 'Cotton คอตต้อน', 3.4, 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AZ3401', 'Amazing อเมซิ่ง'),
  (57, 'SHB92', 'Cloud Whisper เทาเมฆ', 3.4, 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AZ3406', 'Amazing อเมซิ่ง'),
  (58, 'SHB93', 'Stone Echo เทาเข้ม', 3.4, 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AZ3407', 'Amazing อเมซิ่ง'),
  (59, 'SHB94', 'brich brown', 3.4, 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AZ3405', 'Amazing อเมซิ่ง'),
  (60, 'SHB97', 'Linen Beige ลินินเบจ', 3.4, 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AZ3403', 'Amazing อเมซิ่ง'),
  (61, 'SHB98', 'Oatmeal โอ้ตมิล', 3.4, 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AZ3402', 'Amazing อเมซิ่ง'),
  (62, 'SHB99', 'Mocha Stone ม่อคค่า', 3.4, 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AZ3404', 'Amazing อเมซิ่ง'),
  (63, 'HB-R1', 'มาชเมลโล่ว', 3.2, 'BLACKOUT สูงพิเศษ เรียบ', '8188-4', 'จิงจิง'),
  (64, 'HB-R2', 'น้ำตาลนู๊ด', 3.2, 'BLACKOUT สูงพิเศษ เรียบ', '8188-7', 'จิงจิง'),
  (65, 'HB-R3', 'เทาเมฆ', 3.2, 'BLACKOUT สูงพิเศษ เรียบ', '8188-2', 'จิงจิง'),
  (66, 'HB-R4', 'เทาเข้ม', 3.2, 'BLACKOUT สูงพิเศษ เรียบ', '8188-5', 'จิงจิง'),
  (67, 'KB-1', 'น้ำตาลเทา', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-1', 'CT store'),
  (68, 'KB-1', 'น้ำตาลเทา', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', '521-2', 'CT store'),
  (69, 'KB-2', 'ขาว', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-2', 'CT store'),
  (70, 'KB-3', 'ขาวครีม', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-3', 'CT store'),
  (71, 'KB-4', 'เทาขาว', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-4', 'CT store'),
  (72, 'KB-5', 'เทาเมฆ', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-5', 'CT store'),
  (73, 'KB-6', 'น้ำเงิน', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-6', 'CT store'),
  (74, 'KB-7', 'เทาอ่อน', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-7', 'CT store'),
  (75, 'KB-8', 'เทาน้ำเงิน', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-8', 'CT store'),
  (76, 'KB-9', 'เทากลาง', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-9', 'CT store'),
  (77, 'KB-10', 'เทาเข้มกลาง', 2.8, 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', 'ASW-10', 'CT store'),
  (78, 'A1', 'ครีมเบจ', 2.8, 'DIMOUT สูงปกติ', 'DK85/05', 'Darika (DK)'),
  (79, 'M21', 'เบจอ่อน', 2.8, 'DIMOUT สูงปกติ', 'AU004-27', 'ออร่า Aura Art'),
  (80, 'MS01', '-', 3.2, 'BLACKOUT สูงพิเศษ เรียบ', '8188-1', 'จิงจิง'),
  (81, 'B82', 'เทาเมฆ', 2.8, 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', '520-10', 'จิงจิง'),
  (82, 'B16', 'ขาวครีม', 2.8, 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', '520-16', 'จิงจิง'),
  (83, 'B85', 'เทาเข้ม', 2.8, 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', '520-29', 'จิงจิง'),
  (84, 'DS12', 'โปร่ง "สีทอง"', 2.8, 'SHEER ผ้าโปร่ง', '-', 'จิงจิง'),
  (85, 'DS13', 'โปร่ง"เรียบ"ขาวนวล สูงปกติ', 3, 'SHEER ผ้าโปร่ง', '301-22B', 'Cosi'),
  (86, 'DS14', 'โปร่ง"เรียบ"ขาวสว่าง สูงปกติ', 3, 'SHEER ผ้าโปร่ง', '301-22A', 'Cosi'),
  (87, 'HB24', 'ขาวครีม', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AF23-24', 'Asia fabric'),
  (88, 'HB25', 'อัลมอนด์', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AF23-25', 'Asia fabric'),
  (89, 'HB26', 'ซินนาม่อน', 3.2, 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', 'AF23-26', 'Asia fabric'),
  (90, 'D516', 'Hunter green / Forest green', 2.8, 'DIMOUT สูงปกติ', 'DK85-16', 'Darika (DK)'),
  (91, 'S40', 'butter ครีมเนย', 2.8, 'DIMOUT สูงปกติ', 'ART06-40', 'ออร่า Aura Art'),
  (92, 'S42', 'Navy gray เทากรม', 2.8, 'DIMOUT สูงปกติ', 'ART06-42', 'ออร่า Aura Art');

-- จับคู่ "รหัสผ้าเดียวกัน ลำดับที่เท่ากัน" (ตัวที่ 1 กับตัวที่ 1, ตัวที่ 2 กับตัวที่ 2)
create temp table pair on commit drop as
with s as (select *, row_number() over (partition by fabric_code order by ord) rn from sheet_stock),
     d as (select id, trim(fabric_code) code, row_number() over (partition by trim(fabric_code) order by sort_order nulls last, id) rn from stock)
select s.*, d.id as stock_id from s left join d on d.code = s.fabric_code and d.rn = s.rn;

-- 3) ลบรายการที่ไม่มีในชีท
delete from stock where id not in (select stock_id from pair where stock_id is not null);

-- 4) แก้รายการที่มีอยู่แล้ว
update stock t set
  fabric_code = p.fabric_code, color_name = p.color_name, fabric_width = p.fabric_width, fabric_type = p.fabric_type,
  shop_code = p.shop_code, shop_name = p.shop_name, sort_order = p.ord,
  roll_count = 0, unused_rolls = 0, in_use_rolls = 0, remaining_meters = 0, status = 'ของหมด', updated_at = now()
from pair p where p.stock_id = t.id;

-- 5) เพิ่มรายการใหม่
insert into stock (fabric_code, color_name, fabric_width, fabric_type, shop_code, shop_name, sort_order, roll_count, unused_rolls, in_use_rolls, remaining_meters, status, updated_at)
select fabric_code, color_name, fabric_width, fabric_type, shop_code, shop_name, ord, 0, 0, 0, 0, 'ของหมด', now()
from pair where stock_id is null;

commit;

-- ตรวจหลังรัน: ต้องได้ 92 รายการ และทุกแถวเป็น 0
select count(*) as total, sum(roll_count + unused_rolls + in_use_rolls) as rolls, sum(coalesce(remaining_meters, 0)) as meters from stock;

-- ย้อนกลับ (ถ้าจำเป็น):
--   begin; delete from stock; insert into stock select * from stock_backup_20260919; commit;
