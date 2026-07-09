-- สั่งนอกในหมวดออเดอร์ → sync ไปหมวดสั่งซื้ออัตโนมัติ
-- เพิ่มคอลัมน์ผูกรายการสั่งซื้อกับออเดอร์ต้นทาง (กันสร้างซ้ำเวลาแก้ข้อความสั่งนอก)
-- รันใน Supabase SQL Editor ครั้งเดียว

alter table purchase_orders
  add column if not exists source_order_id uuid references order_entries(id) on delete set null;

create index if not exists idx_po_source_order on purchase_orders(source_order_id);
