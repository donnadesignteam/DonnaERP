-- หมวด "พัสดุส่งกลับ" — พัสดุที่ลูกค้าส่งคืนเข้าร้าน (แกะแล้วถ่ายวิดีโอ/รูปเก็บไว้ + ผูกกับออเดอร์ต้นทาง)
-- หน้าเว็บ: /returns · รันใน Supabase → SQL Editor (รันซ้ำได้)

create table if not exists public.return_parcels (
  id                 uuid primary key default gen_random_uuid(),
  sender_name        text,                        -- ชื่อผู้ส่ง (ตามหน้ากล่อง)
  items              text,                        -- รายการของที่อยู่ในกล่อง
  carrier            text,                        -- บริษัทขนส่ง (ขาส่งกลับ)
  tracking_no        text,                        -- เลขพัสดุ (ขาส่งกลับ)
  orig_carrier       text,                        -- บริษัทขนส่งเดิม (ขาที่ร้านส่งออกไป) ถ้ามี
  orig_tracking_no   text,                        -- เลขพัสดุเดิม ถ้ามี
  orig_order_number  text,                        -- เลขออเดอร์เดิม (ตามที่ลูกค้าแจ้ง/เขียนมา)
  address            text,
  phone              text,
  videos             jsonb not null default '[]', -- วิดีโอตอนแกะ [{url, name}] — ไฟล์อยู่บน R2 โฟลเดอร์ returns/
  photos             jsonb not null default '[]', -- รูป [{url, caption}]
  order_id           uuid references public.order_entries(id) on delete set null,  -- "จากออเดอร์" ที่ผูกไว้
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists return_parcels_created_idx on public.return_parcels (created_at desc);
create index if not exists return_parcels_order_idx   on public.return_parcels (order_id);

alter table public.return_parcels enable row level security;

-- เว็บใช้ anon key อ่าน/เขียนเองเหมือนตารางอื่นในระบบนี้ (claims, purchase_orders)
drop policy if exists return_parcels_all on public.return_parcels;
create policy return_parcels_all on public.return_parcels
  for all to anon, authenticated using (true) with check (true);

-- ตรวจหลังรัน (ต้องขึ้น 0 แถว ไม่ error)
select count(*) as จำนวนพัสดุส่งกลับ from public.return_parcels;
