// ของที่ต้องเก็บคืนสต็อกจากออเดอร์ที่ถูกยกเลิก — โชว์ในหมวดสต็อก แท็บ "งานยกเลิก-ตีกลับ"
// กติกา (user กำหนด 22ก.ย.69):
//   • ม่าน (ทุกอย่างที่ไม่ใช่ราง) เข้ามาเมื่อเคยถึงขั้น "เย็บแล้ว" หรือขั้นหลังจากนั้น (ดูจาก status_history)
//   • ราง + อุปกรณ์ราง เข้ามาเมื่อติ๊ก "แพ็ครางแล้ว" (rail_packed)
//   • ส่งไปแล้วแล้วโดนยกเลิก = ของกลับมาทั้งใบ
//   ยังไม่ถึงขั้นไหนเลย = ไม่มีของต้องเก็บ ไม่ขึ้น · หมวดออเดอร์แท็บยกเลิกยังเห็นทั้งใบเหมือนเดิม
import { PROD_STATUSES } from '@/lib/orderTabs'
import type { RawItem } from '@/lib/itemFormat'

export type CancelledOrder = {
  id: string
  order_number: string | null
  customer_name: string | null
  platform: string | null
  items: RawItem[] | null
  status_history: { status?: string; at?: string }[] | null
  rail_packed: boolean | null
  shipped_at: string | null
  shipments: unknown[] | null
  updated_at: string | null
}

export const CANCELLED_COLS = 'id, order_number, customer_name, platform, items, status_history, rail_packed, shipped_at, shipments, updated_at'

// อุปกรณ์ราง (แพ็คไปกับราง) — ชื่อตาม normalizeItemType ใน lib/itemFormat.ts
const RAIL_PART = /^(ราง|พุก สกรู|ลูกล้อ|ตัวสไลด์|หัวปิดราง|ลวดสลิง)/
export const isRailItem = (it: RawItem) => RAIL_PART.test(String(it.type ?? '').trim())

// เริ่มนับจากวันนี้ — ของจากออเดอร์ที่ยกเลิกก่อนหน้านี้ถูกเอาไปใช้หมดแล้ว (user สั่ง 22ก.ย.69)
// ดูเวลากดยกเลิกจาก status_history เท่านั้น (updated_at ขยับทุกครั้งที่แก้ใบ ใช้ไม่ได้)
export const COUNT_FROM = '2026-09-22T00:00:00+07:00'

const SEWN_AT = PROD_STATUSES.indexOf('เย็บแล้ว')
// ขั้นที่นับว่า "เย็บแล้วหรือหลังจากนั้น" (รวมรอติดตั้งของงานติดตั้ง)
const AFTER_SEW = new Set([...PROD_STATUSES.slice(SEWN_AT), 'รอติดตั้ง', 'งานเสร็จ'])

export type ReturnedFromOrder = {
  order: CancelledOrder
  items: RawItem[]
  kind: 'ยกเลิก' | 'ยกเลิกหลังส่ง'
  what: string          // ม่าน / ราง / ม่าน+ราง / ทั้งใบ
  cancelledAt: string   // เวลาที่กดยกเลิก (จาก status_history)
}

export function returnedFromOrder(o: CancelledOrder): ReturnedFromOrder | null {
  const items = Array.isArray(o.items) ? o.items : []
  if (!items.length) return null
  const hist = Array.isArray(o.status_history) ? o.status_history : []
  const cancelledAt = [...hist].reverse().find(h => h?.status === 'ยกเลิก')?.at ?? ''
  if (!cancelledAt || new Date(cancelledAt) < new Date(COUNT_FROM)) return null
  const shipped = hist.some(h => h?.status === 'จัดส่งแล้ว') || !!o.shipped_at || (Array.isArray(o.shipments) && o.shipments.length > 0)
  if (shipped) return { order: o, items, kind: 'ยกเลิกหลังส่ง', what: 'ทั้งใบ', cancelledAt }
  const sewn = hist.some(h => AFTER_SEW.has(String(h?.status ?? '')))
  const rails = items.filter(isRailItem)
  const curtains = items.filter(it => !isRailItem(it))
  const take = [...(sewn ? curtains : []), ...(o.rail_packed ? rails : [])]
  if (!take.length) return null
  const hasC = sewn && curtains.length > 0, hasR = !!o.rail_packed && rails.length > 0
  return { order: o, items: take, kind: 'ยกเลิก', what: hasC && hasR ? 'ม่าน+ราง' : hasC ? 'ม่าน' : 'ราง', cancelledAt }
}
