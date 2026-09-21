-- สต็อกหมวดอื่นนอกจากผ้า (หน้า /stock แท็บ อุปกรณ์ราง / อุปกรณ์สำนักงาน / งานนอก / งานยกเลิก-ตีกลับ)
-- category: rail = อุปกรณ์ราง · office = อุปกรณ์สำนักงาน · outsource = ของที่สั่งข้างนอกที่มาถึงร้านแล้ว · returned = งานยกเลิก/ตีกลับ
create table if not exists stock_items (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('rail','office','outsource','returned')),
  code        text,
  name        text not null default '',
  qty         numeric not null default 0,
  unit        text,
  min_qty     numeric,            -- ต่ำกว่าหรือเท่านี้ = ควรสั่ง (rail/office)
  vendor      text,               -- งานนอก: ร้าน/ช่างที่ส่งไป
  sent_at     date,               -- งานนอก: วันที่ส่งไป
  due_at      date,               -- งานนอก: วันนัดรับ
  received_at date,               -- งานนอก: วันที่รับกลับแล้ว
  ref         text,               -- เลขออเดอร์/Serial ที่เกี่ยวข้อง
  po_id       uuid,               -- งานนอก: รายการสั่งซื้อ (purchase_orders) ที่ดึงมา
  order_id    uuid,               -- งานนอก: ออเดอร์ต้นทาง (order_entries) → ใช้ดูว่าจัดส่งแล้วหรือยัง
  source      text,               -- งานยกเลิก-ตีกลับ: ยกเลิก / ตีกลับ / พัสดุส่งกลับ
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table stock_items add column if not exists po_id uuid;
alter table stock_items add column if not exists order_id uuid;
create index if not exists stock_items_category_idx on stock_items (category);
alter table stock_items enable row level security;
do $$ begin
  create policy stock_items_all on stock_items for all using (true) with check (true);
exception when duplicate_object then null; end $$;
