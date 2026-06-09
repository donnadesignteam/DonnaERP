-- ตารางงานเคลม (แยกจาก order_entries) — เก็บเคสเคลม/ส่งผิด/ของหาย/แก้ไขขนาด
-- รันใน Supabase SQL editor (เลือก "Run" ได้เลย มี policy ให้ anon ใช้งานครบ)

create table if not exists public.claims (
  id                     uuid primary key default gen_random_uuid(),
  claim_date             date,                         -- วันที่แจ้งเคลม
  channel                text,                         -- ช่องทาง: Shopee/Lazada/Tiktok/Facebook/LineOA/หน้าร้าน
  customer_username      text,                         -- username/ชื่อลูกค้าในแพลตฟอร์ม
  original_order_number  text,                         -- เลขออเดอร์เดิมที่เคลม
  claim_type            text,                          -- ประเภทเคลม (ของขาด/ส่งผิด/เสียหายขนส่ง/ชำรุด/ลูกค้าแจ้งผิด/เปลี่ยนสินค้า/ส่งคืนไม่แจ้ง)
  fault                  text,                         -- ผู้รับผิดชอบ: ร้าน/ลูกค้า/ขนส่ง
  cause                  text,                         -- รายละเอียดสาเหตุ
  resolution             text,                         -- วิธีจัดการ
  items                  jsonb,                        -- รายการที่เคลม (โครงสร้างเดียวกับออเดอร์)
  ship_name              text,                         -- ชื่อผู้รับ (ส่งใหม่)
  ship_address           text,                         -- ที่อยู่จัดส่ง
  ship_phone             text,                         -- เบอร์โทร
  return_tracking        text,                         -- เลขพัสดุที่ลูกค้าส่งคืน
  outbound_tracking      text,                         -- เลขพัสดุที่ร้านส่งใหม่
  courier                text,                         -- ขนส่งที่ใช้ส่งออก
  refund_amount          numeric,                      -- ยอดเงิน (คืน/เก็บ)
  money_direction        text,                         -- 'คืนลูกค้า' | 'เก็บลูกค้า'
  payment_target         text,                         -- พร้อมเพย์/เลขบัญชี
  money_status           text,                         -- 'รอ' | 'โอนแล้ว' | 'ชำระแล้ว'
  status                 text not null default 'รอของคืน', -- สถานะ workflow
  is_urgent              boolean not null default false,   -- เร่งด่วน 🔥
  notes                  text,
  raw_text               text,                         -- ข้อความไลน์ดิบที่ paste มา (อ้างอิงย้อนหลัง)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_claims_status on public.claims(status);
create index if not exists idx_claims_date   on public.claims(claim_date desc);

-- RLS: เปิดไว้ + policy อนุญาต anon/authenticated ใช้งานครบ (เหมือนตารางอื่นที่เว็บเรียกผ่าน anon key)
alter table public.claims enable row level security;
drop policy if exists claims_all on public.claims;
create policy claims_all on public.claims for all to anon, authenticated using (true) with check (true);
