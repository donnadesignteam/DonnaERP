-- ปิดไม่ให้ดึงตารางสำรองสต็อกผ่านเว็บ (สำรองไว้ตอนอัปเดตสต็อกตามชีท 19 ก.ย. 69)
alter table public.stock_backup_20260919 enable row level security;
