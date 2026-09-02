// sync ย้อนทาง: ปฏิทินงานติดตั้ง (installations) → ใบออเดอร์ (order_entries)
// ‼️ งานติดตั้งลงที่หมวดออเดอร์ (เพิ่มรายการ → งานติดตั้ง) แล้ว syncInstallation สร้างแถวในปฏิทินให้
//    ส่วนงานที่ลงจากหน้าปฏิทินเอง พอคอลัมน์ "งาน" เป็น "งานติดตั้ง" ระบบจะสร้างใบออเดอร์ให้ ฝ่ายผลิตถึงจะเห็นในหมวดออเดอร์
//    ใบที่สร้างแล้วผูกกลับด้วย installations.source_order_id → เปลี่ยนซ้ำจะไม่สร้างใบซ้ำ
// ทางกลับกัน (ออเดอร์ → ปฏิทิน) อยู่ที่ syncInstallation ใน components/OrderWorkspace.tsx

import { supabase } from '@/lib/supabase'
import { oeInsert } from '@/lib/adminActor'

export const INSTALL_WORK_TYPE = 'งานติดตั้ง'

// สถานะชำระของปฏิทินคนละชุดกับของออเดอร์ — คำที่ไม่ตรงกันถือว่ายังไม่ชำระ
const ORDER_PAYMENTS = ['ยังไม่ชำระ', 'มัดจำ', 'มัดจำ50%', 'ชำระครบ']

type InstallRow = {
  id: string
  work_type?: string | null
  source_order_id?: string | null
  appointment_datetime?: string | null
  platform?: string | null
  customer_id?: string | null
  customer_real_name?: string | null
  province?: string | null
  phone?: string | null
  location_link?: string | null
  work_details?: string | null
  notes?: string | null
  price?: number | null
  payment_status?: string | null
  installation_status?: string | null
  entered_by?: string | null
}

// สร้างใบออเดอร์ให้งานติดตั้งที่ยังไม่มีใบ — คืน id ของใบใหม่ (null = ไม่ต้องสร้าง/สร้างไม่สำเร็จ)
export async function createOrderForInstall(ins: InstallRow): Promise<{ orderId: string | null; error?: string }> {
  if (ins.work_type !== INSTALL_WORK_TYPE) return { orderId: null }
  if (ins.source_order_id) return { orderId: null }

  // กันซ้ำ: มีใบที่ผูกกับแถวนี้อยู่แล้วในฐาน (source_order_id ในหน่วยความจำอาจเก่า)
  const { data: cur } = await supabase.from('installations').select('source_order_id').eq('id', ins.id).maybeSingle()
  if (cur?.source_order_id) return { orderId: cur.source_order_id }

  const dt = ins.appointment_datetime ? new Date(ins.appointment_datetime) : null
  const date = dt && !isNaN(dt.getTime()) ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` : null
  const time = dt && !isNaN(dt.getTime()) ? `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}` : '9:00'
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const pay = ORDER_PAYMENTS.includes(ins.payment_status ?? '') ? ins.payment_status : 'ยังไม่ชำระ'

  const { data, error } = await oeInsert({
    entry_date: today,
    customer_name: ins.customer_real_name || ins.customer_id || null,
    platform: ins.platform || null,
    is_installation: true,
    deadline: date,
    installation_date: date,
    install_time: time,
    province: ins.province || null,
    phone: ins.phone || null,
    location_link: ins.location_link || null,
    notes: [ins.work_details, ins.notes].map(v => (v ?? '').trim()).filter(Boolean).join(' · ') || null,
    price: ins.price ?? null,
    payment_status: pay,
    order_status: 'รอดำเนินการ',
    status: 'อยู่ในกำหนด',
    order_assigned: 'รออัพเดท',
    admin_name: ins.entered_by || null,
    updated_at: now,
  }).select().single()

  if (error) return { orderId: null, error: error.message }
  return { orderId: (data as { id: string }).id }
}

// ===== ทิศทาง: ใบออเดอร์ → แถวปฏิทิน =====
// แก้ช่องไหนในหมวดออเดอร์ (แท็บงานติดตั้ง) → แก้ช่องเดียวกันในแถวปฏิทินที่ผูกกันไว้
// ‼️ ส่งเฉพาะช่องที่เพิ่งแก้ (patch) เหมือนทิศทางกลับ — ไม่ push ทั้งแถว
// ‼️ ชุดช่องต้องตรงกับ onsite ใน syncInstallation (components/OrderWorkspace.tsx) ที่ใช้ตอนบันทึกจากกล่องแก้ออเดอร์
type OrderRow = {
  deadline?: string | null
  installation_date?: string | null
  install_time?: string | null
  platform?: string | null
  customer_name?: string | null
  province?: string | null
  phone?: string | null
  location_link?: string | null
  price?: number | null
  notes?: string | null
  admin_name?: string | null
  payment_status?: string | null
  install_status?: string | null
}

// คอลัมน์ "ติดตั้ง" ของหมวดออเดอร์ → สถานะในปฏิทิน (ทางกลับของ INSTALL_STATUS_TO_ORDER)
const ORDER_STATUS_TO_INSTALL: Record<string, string> = {
  'ติดตั้งแล้ว': 'ติดตั้งเสร็จ',
  'ติดตั้ง50%': 'ติดตั้ง50%',
}

export function installPatchFromOrder(patch: Record<string, unknown>, merged: OrderRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(patch, k)

  if (has('deadline') || has('installation_date') || has('install_time')) {
    const d = merged.installation_date || merged.deadline
    const t = String(merged.install_time || '9:00').split(':')
    const hhmm = `${(t[0] || '9').padStart(2, '0')}:${(t[1] || '00').padStart(2, '0')}`
    out.appointment_datetime = d ? `${String(d).slice(0, 10)}T${hhmm}:00+07:00` : null
  }
  if (has('platform')) out.platform = merged.platform || ''
  if (has('customer_name')) {
    out.customer_id = merged.customer_name || ''
    out.customer_real_name = merged.customer_name || ''
  }
  if (has('province')) out.province = merged.province || ''
  if (has('phone')) out.phone = merged.phone || ''
  if (has('location_link')) out.location_link = merged.location_link || ''
  if (has('price')) out.price = merged.price ?? 0
  if (has('notes')) out.notes = merged.notes || ''
  if (has('admin_name')) out.entered_by = merged.admin_name || ''
  // สถานะชำระคนละชุดคำกัน — ส่งเฉพาะคำที่ฝั่งออเดอร์มีจริง (ว่าง = ไม่แตะของเดิม)
  if (has('payment_status') && merged.payment_status) out.payment_status = merged.payment_status
  if (has('install_status')) {
    const mapped = ORDER_STATUS_TO_INSTALL[merged.install_status ?? '']
    if (mapped) out.installation_status = mapped
  }
  return out
}

// สถานะติดตั้งในปฏิทิน → คอลัมน์ "ติดตั้ง" ของหมวดออเดอร์ (คำที่ไม่มีคู่ = ไม่แตะของเดิม)
const INSTALL_STATUS_TO_ORDER: Record<string, string> = {
  'ติดตั้งเสร็จ': 'ติดตั้งแล้ว',
  'ติดตั้ง50%': 'ติดตั้ง50%',
}

// แก้อะไรในปฏิทิน → แก้ช่องเดียวกันในใบออเดอร์ที่ผูกกันไว้
// ‼️ ส่งเฉพาะช่องที่เพิ่งแก้ (patch) ไม่ push ทั้งแถว ไม่งั้นค่าที่ฝั่งออเดอร์แก้ไว้จะโดนของเก่าทับ
export function orderPatchFromInstall(patch: Record<string, unknown>, merged: InstallRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(patch, k)

  if (has('appointment_datetime')) {
    const dt = merged.appointment_datetime ? new Date(merged.appointment_datetime) : null
    const ok = dt && !isNaN(dt.getTime())
    out.deadline = ok ? `${dt!.getFullYear()}-${String(dt!.getMonth() + 1).padStart(2, '0')}-${String(dt!.getDate()).padStart(2, '0')}` : null
    out.installation_date = out.deadline
    out.install_time = ok ? `${dt!.getHours()}:${String(dt!.getMinutes()).padStart(2, '0')}` : '9:00'
  }
  if (has('price')) out.price = merged.price ?? null
  if (has('phone')) out.phone = merged.phone || null
  if (has('province')) out.province = merged.province || null
  if (has('location_link')) out.location_link = merged.location_link || null
  if (has('platform')) out.platform = merged.platform || null
  if (has('customer_id') || has('customer_real_name')) out.customer_name = merged.customer_real_name || merged.customer_id || null
  if (has('notes') || has('work_details')) {
    out.notes = [merged.work_details, merged.notes].map(v => (v ?? '').trim()).filter(Boolean).join(' · ') || null
  }
  if (has('payment_status') && ORDER_PAYMENTS.includes(merged.payment_status ?? '')) out.payment_status = merged.payment_status
  if (has('installation_status')) {
    const mapped = INSTALL_STATUS_TO_ORDER[merged.installation_status ?? '']
    if (mapped) out.install_status = mapped
  }
  return out
}

