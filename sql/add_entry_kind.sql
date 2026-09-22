-- จำประเภทงานที่กดเลือกตอน "เพิ่มรายการ" (platform / outside / install / claim)
-- ใบที่ช่องแพลตฟอร์มว่าง จะได้ไปอยู่แท็บตามที่เลือกไว้
alter table order_entries add column if not exists entry_kind text;
