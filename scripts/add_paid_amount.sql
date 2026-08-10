-- คอลัมน์ "ชำระแล้ว" ในหมวดออเดอร์ (แท็บงานติดตั้ง/งานนอก)
-- ยอดที่ลูกค้าชำระมาแล้ว — กรอกเอง แล้วช่องยอดชำระหลังติดตั้ง/ก่อนจัดส่งจะคิดให้ (ยอดทั้งหมด − ยอดนี้)
ALTER TABLE public.order_entries
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT NULL;

-- แถวเก่าที่เคยลง "มัดจำ50%" ไว้ → ชำระแล้ว = ครึ่งหนึ่งของยอดทั้งหมด (ค่าเดิมที่ระบบคิดให้อยู่แล้ว)
UPDATE public.order_entries
SET paid_amount = price / 2
WHERE paid_amount IS NULL AND payment_status = 'มัดจำ50%' AND price IS NOT NULL;
