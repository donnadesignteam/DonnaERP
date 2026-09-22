-- ใบที่ช่องแพลตฟอร์มว่าง → ใส่ตามใบอื่นของลูกค้าคนเดียวกัน (เช็กแล้ว 22ก.ย.69)
update order_entries set platform = 'Shopee' where platform is null and is_installation = false and customer_name in ('sosoenjoy', 'about_the_phone');
update order_entries set platform = 'Tiktok' where platform is null and is_installation = false and customer_name = 'jirayu0230';

-- พิมภักดิ์ บู่เอียด = งานนอก (ไม่รู้ช่องทาง → ใช้ entry_kind แทน ไม่ต้องเดาแพลตฟอร์ม)
alter table order_entries add column if not exists entry_kind text;
update order_entries set entry_kind = 'outside' where id = '2da12263-3c0d-4e70-8794-aa80f98af59a';
