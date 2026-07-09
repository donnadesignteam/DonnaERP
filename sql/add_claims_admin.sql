-- งานเคลม: คอลัมน์ "แอดมินที่รับผิดชอบ" — โชว์ใน dashboard พนักงานรายคนด้วย
-- รันใน Supabase SQL Editor ครั้งเดียว

alter table claims add column if not exists admin_name text;
