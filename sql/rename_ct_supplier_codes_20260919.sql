-- ผ้าโปร่ง AB ที่ซื้อจาก CT store: เปลี่ยนรหัสซัพพลายจาก DS08-DS11 (ซ้ำกับรหัสผ้า DS08/DS09 ของร้าน)
-- เป็น CT + เลขตามรหัสร้าน · AB21→CT21 · AB22→CT22 · AB58→CT58 · AB41→CT41
update stock set shop_code = 'CT21', updated_at = now() where fabric_code = 'AB21' and shop_name = 'CT store' and shop_code = 'DS08';
update stock set shop_code = 'CT22', updated_at = now() where fabric_code = 'AB22' and shop_name = 'CT store' and shop_code = 'DS09';
update stock set shop_code = 'CT58', updated_at = now() where fabric_code = 'AB58' and shop_name = 'CT store' and shop_code = 'DS10';
update stock set shop_code = 'CT41', updated_at = now() where fabric_code = 'AB41' and shop_name = 'CT store' and shop_code = 'DS11';

-- ตรวจ: ต้องขึ้น 4 แถว CT21 CT22 CT58 CT41
select fabric_code, shop_code, shop_name from stock where shop_name = 'CT store' and fabric_code in ('AB21','AB22','AB58','AB41') order by sort_order;
