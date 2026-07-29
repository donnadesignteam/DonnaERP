-- รูปหน้างานของรายการติดตั้ง (โมดัล "+ เพิ่มรายการติดตั้ง" / "แก้ไขรายการ" หน้า /installations)
-- เก็บเป็น array ของ { "url": "...", "caption": "..." } — ไฟล์จริงอยู่บน Cloudflare R2 โฟลเดอร์ installations/
-- ‼️ ต้องรันก่อนใช้งานปุ่ม "+ เพิ่มรูป" (ยังไม่รัน = เพิ่ม/แก้รายการได้ตามปกติ แต่พอกดบันทึกรายการที่มีรูปจะขึ้น error)
alter table installations
  add column if not exists photos jsonb not null default '[]'::jsonb;
