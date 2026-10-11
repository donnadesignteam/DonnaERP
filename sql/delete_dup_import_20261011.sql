-- ลบออเดอร์ซ้ำ 4 ใบ ที่นำเข้าไฟล์ Shopee ตอน 11/10/69 08:14 (ใบเดิมที่กายลงไว้มีรายการครบ ไม่แตะ)
-- ลบเฉพาะแถวที่ไม่มีรายการสินค้า + สร้างในนาทีที่นำเข้าเท่านั้น
delete from order_entries
where id in (
  '80386392-2a6e-46e3-a565-d5706c8c5fd0',  -- 2610109T1Y8JR0 suwanna1554
  'c7befce6-0275-44c3-9afc-fedbcabcbc1e',  -- 2610109RNH9N15 asma270717
  '94f1fd51-b641-4227-b384-6f90e6444576',  -- 2610109RTJGVXR asma270717
  '26d22681-f4f9-4f55-bccf-77cc1e52c172'   -- 2610107PXRXT6V katekkaattee
)
and items is null
and created_at >= '2026-10-11 01:14:00+00' and created_at < '2026-10-11 01:15:00+00'
returning order_number, customer_name;
