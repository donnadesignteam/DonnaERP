-- ยอดโอนจริงจากไฟล์รายรับ Shopee (Income) — ยอดหลังหักค่าธรรมเนียมครบทุกอย่าง
-- net_income = จำนวนเงินทั้งหมดที่โอนแล้ว (฿), net_income_at = วันที่โอนชำระเงินสำเร็จ
alter table order_entries add column if not exists net_income numeric;
alter table order_entries add column if not exists net_income_at date;
