-- เติมช่อง platform ที่ว่าง (AI แปลงแล้วไม่ตอบช่องทาง) โดยเดาจากรูปแบบเลขคำสั่งซื้อ
-- กติกาเดียวกับ inferPlatform() ใน lib/orderTabs.ts
update order_entries set platform = 'Shopee'
where platform is null and upper(trim(order_number)) ~ '^[0-9]{6}[A-Z0-9]{8}$' and upper(trim(order_number)) ~ '[A-Z]';

update order_entries set platform = 'Tiktok'
where platform is null and trim(order_number) ~ '^[0-9]{18}$';

update order_entries set platform = 'Lazada'
where platform is null and trim(order_number) ~ '^[0-9]{12,17}$';
