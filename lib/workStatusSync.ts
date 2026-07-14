// sync กระดานสถานะงาน (ตาราง work_status) จากการเปลี่ยนสถานะออเดอร์
// เทียบเลขออเดอร์/ชื่อลูกค้า "ตรงตัว" (case-insensitive) ไม่ใช่ %มีคำนี้อยู่ข้างใน%
// — เดิมใช้ ilike %term% แล้วจับผิดแถวได้เวลาเลข/ชื่อคล้ายกัน (เช่น 12 ไปโดน 120)
// ให้ตรรกะตรงกับ RPC scan_advance (sql/scan_advance_rpc.sql) ที่หน้าสแกนใช้
//
// ‼️ จุดที่ sync work_status มี 2 ที่ (dashboard markShipped + OrderWorkspace) — ใช้ helper นี้ทั้งคู่
import { supabase } from '@/lib/supabase'

export async function syncWorkStatus(
  orderNumber: string | null | undefined,
  customerName: string | null | undefined,
  status: string,
  now: string,
): Promise<void> {
  const on = (orderNumber || '').trim()
  const cn = (customerName || '').trim()
  // ครอบค่าด้วย "..." เพื่อกันอักขระพิเศษ (คอมมา/วงเล็บ) ทำให้ .or() เพี้ยน
  const conds: string[] = []
  if (on) conds.push(`order_number.ilike."${on.replace(/"/g, '')}"`) // ilike ไม่มี % = เทียบตรงตัวไม่สนตัวพิมพ์
  if (cn && cn.toLowerCase() !== on.toLowerCase()) conds.push(`order_number.ilike."${cn.replace(/"/g, '')}"`)
  if (!conds.length) return

  const { data: matches } = await supabase.from('work_status').select('id').or(conds.join(','))
  if (matches && matches.length > 0) {
    await supabase.from('work_status')
      .update({ status, status_updated_at: now })
      .in('id', matches.map((m: { id: string | number }) => m.id))
  }
}
