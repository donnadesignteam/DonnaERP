-- กำหนดส่งของงานเคลม — หน้าเคลมมีคอลัมน์ "กำหนดส่ง" ให้กรอก
-- หมวดออเดอร์ดึงงานเคลมมาโชว์รวมกับงานอื่น แล้วใช้วันนี้คิดคอลัมน์ "วันที่เหลือ"
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS deadline DATE DEFAULT NULL;
