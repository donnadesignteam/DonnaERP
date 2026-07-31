// ตัวช่วยแปลงแถว activity_logs → ข้อความอ่านง่าย
// ‼️ ใช้ร่วมกัน 3 ที่ ห้ามก๊อปไปเขียนซ้ำ: หน้าตั้งค่า (ActivityLog), โฟลเดอร์ลูกค้า (OrderHistory),
//    ประวัติของตัวเอง (MyActivity)

export type Change = { from: unknown; to: unknown }

export type Log = {
  id: string
  table_name: string
  category: string
  action: 'insert' | 'update' | 'delete'
  row_id: string | null
  label: string | null
  changes: Record<string, Change> | null
  created_at: string
  actor_code: string | null
  actor_name: string | null
}

// หมวด → สีป้าย
export const CAT_COLOR: Record<string, string> = {
  'ออเดอร์': '#C47E3A',
  'เคลม': '#f43f5e',
  'งานติดตั้ง': '#ff9f0a',
  'สั่งซื้อ': '#5e9eff',
  'สต็อก': '#30d158',
  'ใบลา': '#bf5af2',
  'สแกนผลิต': '#5ac8fa',
  'ผู้จัดจำหน่าย': '#8e8e93',
}

// action → คำกริยา + สี
export function actionLabel(a: Log['action'], table: string) {
  if (a === 'insert') return table === 'production_scans' ? { t: 'สแกน', c: '#5ac8fa' } : { t: 'เพิ่ม', c: '#30d158' }
  if (a === 'delete') return { t: 'ลบ', c: '#f43f5e' }
  return { t: 'แก้ไข', c: '#C47E3A' }
}

// ชื่อฟิลด์ → ภาษาไทย (ไม่เจอ = ใช้ชื่อดิบ)
export const FIELD_TH: Record<string, string> = {
  order_status: 'สถานะงาน', status: 'สถานะ', deadline: 'กำหนดส่ง',
  shipping_datetime: 'วันส่ง', shipped_at: 'จัดส่งเมื่อ', customer_name: 'ลูกค้า',
  platform: 'แพลตฟอร์ม', notes: 'หมายเหตุ', price: 'ราคา', deposit: 'มัดจำ',
  payment_status: 'การชำระ', is_urgent: 'งานเสร็จ', items: 'รายการสินค้า',
  technician: 'ช่าง', admin_name: 'แอดมิน', courier: 'ขนส่ง', order_number: 'เลขออเดอร์',
  province: 'จังหวัด', phone: 'เบอร์โทร', installation_date: 'วันติดตั้ง',
  install_time: 'เวลานัด', work_type: 'ลักษณะงาน', location_link: 'ลิงก์โลเคชั่น',
  refund_amount: 'ยอดเงินคืน', money_status: 'สถานะเงิน', return_tracking: 'เลขพัสดุคืน',
  in_use_rolls: 'ม้วนที่ใช้', remaining_meters: 'เมตรคงเหลือ', stock_count: 'จำนวนสต็อก',
  color_name: 'ลาย/สี', fabric_code: 'รหัสผ้า', fabric_type: 'ชนิดผ้า',
  supplier: 'ผู้จัดจำหน่าย', leave_date: 'วันลา', leave_end_date: 'วันสิ้นสุดลา',
  leave_type: 'ประเภทลา', order_assigned: 'ผู้รับผิดชอบ', outsource: 'สั่งนอก',
  address: 'ที่อยู่', install_status: 'สถานะติดตั้ง', printed_at: 'ปริ้นใบออเดอร์',
  shipments: 'เลขพัสดุ', packing_photos: 'รูปแพ็ค', admin_code: 'รหัสแอดมิน',
}

export function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  if (typeof v === 'object') return 'อัปเดต' // jsonb/array เช่น รายการสินค้า
  const s = String(v)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

export function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diff === 0) return 'วันนี้'
  if (diff === 1) return 'เมื่อวาน'
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function dateTimeLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} ${hhmm(iso)}`
}

// สรุปการเปลี่ยนแปลงให้อยู่บรรทัดเดียว
export function changeSummary(changes: Record<string, Change> | null, max = 2): string {
  if (!changes) return ''
  const keys = Object.keys(changes)
  const parts = keys.slice(0, max).map(k => `${FIELD_TH[k] || k}: ${fmtVal(changes[k].from)} → ${fmtVal(changes[k].to)}`)
  if (keys.length > max) parts.push(`+${keys.length - max}`)
  return parts.join(' · ')
}

// จัดกลุ่มตามวัน (logs เรียงใหม่→เก่าอยู่แล้ว)
export function groupByDay(logs: Log[]): { key: string; label: string; items: Log[] }[] {
  const groups: { key: string; label: string; items: Log[] }[] = []
  let cur: { key: string; label: string; items: Log[] } | null = null
  for (const log of logs) {
    const k = dayKey(log.created_at)
    if (!cur || cur.key !== k) {
      cur = { key: k, label: dayLabel(log.created_at), items: [] }
      groups.push(cur)
    }
    cur.items.push(log)
  }
  return groups
}

// ‼️ ชื่อคนแก้โชว์ให้ "คนที่ล็อกอินด้วยรหัสรวมของร้าน" เท่านั้น (user เคาะ 2026-07-31)
//    พนักงานทุกคนรวมถึงแอดมิน เห็นแค่ว่ามีการแก้อะไร ไม่เห็นชื่อ — ดู isOwnerLogin ใน lib/adminActor.ts
export function actorName(log: Log, canSeeNames: boolean): string | null {
  if (!canSeeNames || !log.actor_code) return null
  return log.actor_name || log.actor_code
}

export const SQL_HINT = 'ยังไม่ได้รัน sql/admin_activity.sql ใน Supabase'
