-- งานเคลม: เพิ่มคอลัมน์ปริ้น/จัดส่ง/ค่าใช้จ่าย ให้ทำงานได้เหมือนหมวดออเดอร์
-- ปลอดภัย additive (IF NOT EXISTS) ไม่กระทบข้อมูลเดิม — รันใน Supabase SQL Editor ได้เลย

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS printed_at        timestamptz,   -- วันเวลาที่ปริ้นใบเคลมล่าสุด (โชว์สีเหลืองข้างปุ่มปริ้นในเมนู ···)
  ADD COLUMN IF NOT EXISTS shipped_at        timestamptz,   -- วันเวลาที่ติ๊กจัดส่งแล้ว
  ADD COLUMN IF NOT EXISTS shipments         jsonb,         -- เลขพัสดุที่ส่งออก [{ no, carrier }] — โครงเดียวกับ order_entries.shipments
  ADD COLUMN IF NOT EXISTS ship_back_cost    numeric,       -- ค่าส่งกลับ
  ADD COLUMN IF NOT EXISTS ship_return_cost  numeric,       -- ค่าส่งคืน
  ADD COLUMN IF NOT EXISTS estimated_price   numeric;       -- ราคาประเมิน
