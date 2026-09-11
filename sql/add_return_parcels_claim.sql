-- พัสดุส่งกลับ: ช่อง "จากออเดอร์" เปลี่ยนเป็นผูกกับงานเคลม (ค้นจากตาราง claims)
-- รันใน Supabase → SQL Editor (รันซ้ำได้) · ตาราง return_parcels สร้างจาก sql/create_return_parcels.sql
alter table public.return_parcels
  add column if not exists claim_id uuid references public.claims(id) on delete set null;
create index if not exists return_parcels_claim_idx on public.return_parcels (claim_id);

-- ตรวจหลังรัน: ต้องขึ้น 1
select count(*) as claim_id_column from information_schema.columns
 where table_schema = 'public' and table_name = 'return_parcels' and column_name = 'claim_id';
