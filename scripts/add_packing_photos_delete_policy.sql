-- อนุญาตลบไฟล์ใน bucket packing-photos (ปุ่ม ✕ ลบรูปในหน้า /scan)
-- ถ้าลบรูปแล้วรายการหายแต่ไฟล์ยังค้างใน storage แปลว่ายังไม่มี delete policy — รันนี้ใน Supabase SQL Editor
create policy "packing-photos delete"
  on storage.objects for delete
  using (bucket_id = 'packing-photos');
