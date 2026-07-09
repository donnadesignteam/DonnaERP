// สั่งนอกในหมวดออเดอร์ → sync ไปหมวดสั่งซื้อ (purchase_orders) อัตโนมัติ
// ผูกกันด้วย purchase_orders.source_order_id (ต้องรัน sql/add_po_source_order.sql ก่อน)
// - ใส่/แก้ข้อความสั่งนอก → สร้าง/อัปเดตรายการสั่งซื้อ:
//   ชื่อลูกค้า+เลขออเดอร์ตามออเดอร์, รายการ = รายการสินค้าในออเดอร์ (เฉพาะชิ้นที่ติดสั่งนอก ถ้าไม่ได้ติดต่อชิ้นใช้ทั้งออเดอร์),
//   Supplier = ข้อความที่พิมพ์ในช่องสั่งนอก
// - ล้างข้อความสั่งนอก → ลบรายการสั่งซื้อที่ sync ไว้ เฉพาะที่ยังสถานะ "รอของ" (ของเข้าแล้วเก็บเป็นประวัติ)

import { supabase } from '@/lib/supabase'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'

export async function syncOutsourcePO(
  orderId: string,
  customerName: string | null | undefined,
  orderNumber: string | null | undefined,
  outsourceText: string | null | undefined,
  items?: RawItem[] | null,
) {
  try {
    const text = (outsourceText ?? '').trim()
    const { data: existing, error: selErr } = await supabase
      .from('purchase_orders').select('id').eq('source_order_id', orderId).maybeSingle()
    if (selErr) return   // คอลัมน์ source_order_id ยังไม่มี (ยังไม่รัน migration) → ข้ามเงียบๆ
    if (!text) {
      if (existing) await supabase.from('purchase_orders').delete().eq('id', existing.id).eq('status', 'รอของ')
      return
    }
    // รายการ = รายการสินค้าในออเดอร์ — ชิ้นที่ติดสั่งนอกไว้เท่านั้น ถ้าไม่มีชิ้นไหนติดใช้ทั้งหมด
    const all = Array.isArray(items) ? items : []
    const outsourced = all.filter(it => (it.outsource ?? '').trim())
    const itemsText = formatItemLines(outsourced.length ? outsourced : all).join('\n') || text
    const payload = {
      customer_name: customerName || '',
      order_number: orderNumber || '',
      items: itemsText,
      supplier: text,
      updated_at: new Date().toISOString(),
    }
    if (existing) {
      await supabase.from('purchase_orders').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('purchase_orders').insert({ ...payload, source_order_id: orderId, status: 'รอของ', notes: '' })
    }
  } catch { /* sync สั่งซื้อพังไม่ให้กระทบการบันทึกออเดอร์ */ }
}
