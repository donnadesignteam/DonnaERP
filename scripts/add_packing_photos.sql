-- รูปถ่ายจากช่าง (ราง/แพ็คแล้ว/ม่านรีด) — เก็บเป็น array ของ URL
ALTER TABLE order_entries
  ADD COLUMN IF NOT EXISTS packing_photos JSONB;

-- bucket เก็บรูป (public อ่านได้ผ่าน URL ตรง)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('packing-photos', 'packing-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- อนุญาตให้หน้า scan (anon key) อัพโหลด + ทุกคนอ่านได้
DROP POLICY IF EXISTS "packing photos read" ON storage.objects;
CREATE POLICY "packing photos read" ON storage.objects
  FOR SELECT USING (bucket_id = 'packing-photos');

DROP POLICY IF EXISTS "packing photos upload" ON storage.objects;
CREATE POLICY "packing photos upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'packing-photos');
