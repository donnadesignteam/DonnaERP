-- 29ต.ค.69 งานติดตั้งที่ช่อง "ติดตั้ง" = ติดตั้งแล้ว แต่สถานะงานยังค้าง (เช่น รอติดตั้ง) → เปลี่ยนเป็น จัดส่งแล้ว (จอโชว์ "ติดตั้งแล้ว")
-- + ปฏิทินที่ยังไม่เป็น ติดตั้งเสร็จ → ติดตั้งเสร็จ (ถึงจะนับในยอดติดตั้ง)

-- ดูก่อนว่าจะแก้ใบไหนบ้าง
select id, customer_name, order_status, install_status, done_at
from order_entries
where is_installation = true and install_status = 'ติดตั้งแล้ว'
  and coalesce(order_status, '') not in ('จัดส่งแล้ว', 'ยกเลิก');

update order_entries
set status_history = coalesce(status_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', 'จัดส่งแล้ว', 'at', now())),
    order_status = 'จัดส่งแล้ว',
    is_urgent = true,
    done_at = coalesce(done_at, now()),
    updated_at = now()
where is_installation = true and install_status = 'ติดตั้งแล้ว'
  and coalesce(order_status, '') not in ('จัดส่งแล้ว', 'ยกเลิก');

update installations i
set installation_status = 'ติดตั้งเสร็จ', updated_at = now()
from order_entries o
where i.source_order_id = o.id
  and o.install_status = 'ติดตั้งแล้ว'
  and coalesce(i.installation_status, '') <> 'ติดตั้งเสร็จ';
