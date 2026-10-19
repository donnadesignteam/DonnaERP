-- 19ต.ค.69 user ขอ: HB93 เปลี่ยนชื่อสี Mocha Grey → Mocha Mint (ตารางสต็อก)
update stock set color_name = 'Mocha Mint', updated_at = now() where fabric_code = 'HB93';
select fabric_code, color_name from stock where fabric_code = 'HB93';
