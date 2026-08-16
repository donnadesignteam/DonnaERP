-- คอลัมน์ใหม่ในหมวดงานเคลม
-- fault_by   = "ผิดโดย" ใคร (พนักงานร้าน / ช่างพี่ฟอง-บัวบาน-กทม / บริษัทขนส่ง) — dropdown พิมพ์ค้นหาได้
-- fix_method = "วิธีแก้ไข" — พิมพ์เองได้อิสระ (คนละช่องกับ resolution ที่เป็นตัวเลือกวิธีจัดการเดิม)
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS fault_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fix_method TEXT DEFAULT NULL;
