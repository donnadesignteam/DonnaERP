-- ช่างที่รับผิดชอบงานเคลม — หน้าเคลมมีคอลัมน์ "ช่าง" ให้เลือก
-- ตัวเลือกชุดเดียวกับหมวดออเดอร์ (lib/techs.ts): ช่างดอนน่า / ช่างพี่ฟอง / ช่างเชียงใหม่ / ช่างกทม / ช่างบัวบาน
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS technician TEXT DEFAULT NULL;
