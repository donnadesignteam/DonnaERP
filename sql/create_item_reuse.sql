-- "ใช้ของ" — ของจากพัสดุส่งกลับ / งานยกเลิก-ตีกลับ ที่มีคนสแกนเอาไปใช้ต่อแล้ว (13ต.ค.69)
-- ปริ้นใบใช้ของ (เมนู ⋯ → ปริ้นใช้ของ) มี QR ชี้ /use?k=<kind>&id=<ref_id> → สแกนแล้วเพิ่มแถวที่นี่ = ย้ายไปช่อง "ใช้แล้ว"
-- kind: parcel = แถว return_parcels · stock = แถว stock_items (category returned ที่ลงเอง) · order = ออเดอร์ที่ถูกยกเลิก (order_entries)
-- ‼️ แยกตารางเพราะแถวงานยกเลิกมาจาก 2 ที่ (stock_items + order_entries) — ไม่แตะตารางเดิม ลบแถวที่นี่ = กลับไปเป็นยังไม่ใช้
create table if not exists item_reuse (
  kind          text not null check (kind in ('parcel','stock','order')),
  ref_id        text not null,
  used_by_code  text,                              -- รหัสพนักงานที่สแกน (คุกกี้ donna_staff)
  used_by_name  text,                              -- ชื่อเล่นตอนสแกน
  used_at       timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table item_reuse enable row level security;
do $$ begin
  create policy item_reuse_all on item_reuse for all using (true) with check (true);
exception when duplicate_object then null; end $$;
