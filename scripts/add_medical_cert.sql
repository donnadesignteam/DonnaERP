-- ════════════════════════════════════════════════════════════════════
-- DonnaERP — ใบรับรองแพทย์สำหรับการลาป่วย (2026-06-25)
-- เพิ่มคอลัมน์เก็บลิงก์รูป + bucket เก็บไฟล์ใน Supabase Storage
-- รันผ่าน:  node scripts/run_sql.mjs scripts/add_medical_cert.sql
-- (รันซ้ำได้ ไม่พัง)
-- ════════════════════════════════════════════════════════════════════

-- 1) คอลัมน์เก็บลิงก์รูปใบรับรองแพทย์ (null = ยังไม่แนบ)
alter table leave_requests
  add column if not exists medical_cert_url text;

-- 2) bucket เก็บรูป (public read — เว็บอยู่หลัง login อยู่แล้ว)
insert into storage.buckets (id, name, public)
values ('medical-certs', 'medical-certs', true)
on conflict (id) do update set public = true;

-- 3) policy ให้ anon อัปโหลด/อ่าน/แก้ ไฟล์ใน bucket นี้ (เขียนผ่านเว็บที่ login แล้ว)
drop policy if exists "medcert anon read"   on storage.objects;
drop policy if exists "medcert anon insert" on storage.objects;
drop policy if exists "medcert anon update" on storage.objects;
create policy "medcert anon read"   on storage.objects for select to anon using (bucket_id = 'medical-certs');
create policy "medcert anon insert" on storage.objects for insert to anon with check (bucket_id = 'medical-certs');
create policy "medcert anon update" on storage.objects for update to anon using (bucket_id = 'medical-certs');

-- ════════════════════════════════════════════════════════════════════
-- เสร็จ — ฟอร์มลาป่วยแนบใบรับรองแพทย์ได้ (ไม่บังคับ แนบทีหลังได้)
-- ════════════════════════════════════════════════════════════════════
