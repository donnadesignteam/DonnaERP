-- 29ต.ค.69 ลิงก์เช็คสถานะแบบสั้น /t/<รหัส 8 ตัว> (lib/trackLink.ts shortTrackCode) — ยังไม่รัน = ระบบใช้ลิงก์ยาวแบบเดิม
alter table order_entries add column if not exists track_code text;
create unique index if not exists order_entries_track_code_key on order_entries (track_code) where track_code is not null;
