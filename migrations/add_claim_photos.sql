-- รูปงานเคลม (โมดัล "เพิ่มเคลม" / "แก้ไขเคลม" หน้า /claims) — แนวเดียวกับรูปหน้างานของงานติดตั้ง
-- เก็บเป็น array ของ { "url": "...", "caption": "..." } — ไฟล์จริงอยู่บน Cloudflare R2 โฟลเดอร์ claims/
-- ‼️ ต้องรันก่อนใช้งานปุ่ม "+ เพิ่มรูป" (ยังไม่รัน = เพิ่ม/แก้เคลมได้ตามปกติ แต่พอกดบันทึกเคสที่มีรูปจะขึ้น error)
alter table claims
  add column if not exists photos jsonb not null default '[]'::jsonb;
