// ค่าคงที่ + ตรรกะแท็บของหมวดออเดอร์ — ใช้ร่วมกันระหว่างหน้าเดสก์ท็อป (OrderWorkspace)
// กับหน้ามือถือ (/m/orders) เพื่อไม่ให้ 2 หน้ากรองข้อมูลไม่ตรงกัน
// ‼️ ย้ายมาจาก OrderWorkspace.tsx — ห้ามก๊อปไปเขียนซ้ำที่อื่น ให้ import จากที่นี่เสมอ

import { effShipping } from '@/lib/shipping'

export const OUTSIDE_PLATFORMS = [
  'Facebook', 'LineOA', 'Tiktok-Chat', 'Shopee-Chat', 'หน้าร้าน',
  'Lineส่วนตัวยุน', 'Lineส่วนตัวเฟิร์น', 'Lineส่วนตัวสู้', 'Lineส่วนตัวน็อต',
  'เคลม:Shopee', 'เคลม:Lazada', 'เคลม:Tiktok', 'เคลม:Facebook', 'เคลม:LineOA', 'เคลม:หน้าร้าน',
  'เคลม:Lineส่วนตัวยุน', 'เคลม:Lineส่วนตัวเฟิร์น', 'เคลม:Lineส่วนตัวสู้', 'เคลม:Lineส่วนตัวน็อต',
]

// แพลตฟอร์มมาร์เก็ตเพลส (แท็บ "งานแพลตฟอร์ม") — คนละชุดกับ OUTSIDE_PLATFORMS
export const PLATFORM_NAMES = ['Shopee', 'Tiktok', 'Lazada']

export const PROD_STATUSES = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'ตรวจสอบแล้ว', 'รีดแล้ว', 'แพ็คแล้ว', 'รอจัดส่ง', 'จัดส่งแล้ว']
export const INSTALL_STATUSES = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'ตรวจสอบแล้ว', 'รีดแล้ว', 'แพ็คแล้ว', 'รอติดตั้ง']

// สีแยกตามขั้นผลิต: รอ=เหลือง → ตัด=ฟ้า → เย็บ=ม่วง → ตรวจสอบ(ผู้ช่วยช่าง)=คราม → รีด=ชมพู → แพ็ค=เขียวอมฟ้า
// (คำเก่า "กำลังX" สีเดียวกับ "Xแล้ว")
export const PROD_STATUS_COLOR: Record<string, string> = {
  'รอดำเนินการ': '#f59e0b',
  'ตัดผ้าแล้ว': '#0ea5e9',
  'เย็บแล้ว': '#8b5cf6',
  'ตรวจสอบแล้ว': '#6366f1',
  'รีดแล้ว': '#ec4899',
  'แพ็คแล้ว': '#14b8a6',
  'กำลังตัด': '#0ea5e9',
  'กำลังเย็บ': '#8b5cf6',
  'กำลังรีด': '#ec4899',
  'กำลังแพ็ค': '#14b8a6',
  'งานเสร็จ': '#22c55e',
  'รอจัดส่ง': '#6366f1',
  'จัดส่งแล้ว': '#22c55e',
  'รอติดตั้ง': '#f97316',
}

export type QuickTab = 'all' | 'platform' | 'outside' | 'install' | 'shipped' | 'cancelled' | 'claim'

export const ORDER_TABS: { id: QuickTab; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'platform', label: 'งานแพลตฟอร์ม' },
  { id: 'outside', label: 'งานนอก' },
  { id: 'install', label: 'งานติดตั้ง' },
  { id: 'claim', label: 'งานเคลม' },
  { id: 'shipped', label: 'จัดส่งแล้ว' },
  { id: 'cancelled', label: 'ยกเลิก' },
]

type TabRow = {
  platform?: string | null
  order_status?: string | null
  is_installation?: boolean | null
}

type DueRow = TabRow & {
  deadline?: string | null
  is_dropoff?: boolean | null
  shipping_datetime?: string | null
}

// "วันต้องส่ง" ที่ใช้จริงของแถวนี้ — คนละที่มาตามชนิดงาน
// ‼️ งานนอก/งานติดตั้ง → deadline (วันนัด/วันกำหนดเอง) · งานแพลตฟอร์ม → shipping_datetime ที่ปรับ dropoff+วันหยุดแล้ว
// กติกานี้ต้องตรงกันทุกที่ ไม่งั้นหน้ามือถือกับหน้าคอมจะโชว์ "วันที่เหลือ" คนละเลข
export function effectiveDueDate(r: DueRow): string | null {
  const isOutsideRow = OUTSIDE_PLATFORMS.includes(r.platform ?? '') || !!r.is_installation
  return isOutsideRow ? (r.deadline ?? null) : effShipping(r)
}

export function daysRemaining(dateStr: string): number | null {
  if (!dateStr) return null
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  const target = m ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])) : new Date(dateStr)
  const result = Math.ceil((target.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
  return isNaN(result) ? null : result
}

// ── ลำดับแถวเริ่มต้นของหมวดออเดอร์ (เรียงตามคอลัมน์ "วันผลิตที่เหลือ") ──
// ‼️ ใช้ร่วมกัน: หมวดออเดอร์ (computeSortOrder) กับตารางรายการใต้ปฏิทินงานติดตั้ง
//    กติกา: ใบที่ติ๊ก "งานเสร็จ" แล้วไปอยู่ท้ายสุด · ที่เหลือเรียงตามวันต้องส่ง · ใบที่ไม่มีวันไปอยู่ท้าย
//    (ลำดับของใบที่เทียบกันไม่ได้ = คงลำดับเดิมที่โหลดมา — Array.sort ของ JS เป็น stable sort)
export type DaysSortRow = { is_urgent?: boolean | null; is_dropoff?: boolean | null; shipping_datetime?: string | null }

export function parseSortDate(s: string | null | undefined): Date | null {
  if (!s || s === '-') return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    return isNaN(d.getTime()) ? null : d
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function cmpDaysSort(a: DaysSortRow, b: DaysSortRow, sort: 'asc' | 'desc'): number {
  if (a.is_urgent && b.is_urgent) return 0
  if (a.is_urgent) return 1
  if (b.is_urgent) return -1
  const da = parseSortDate(effShipping(a)), db = parseSortDate(effShipping(b))
  if (!da && !db) return 0
  if (!da) return 1
  if (!db) return -1
  return sort === 'asc' ? da.getTime() - db.getTime() : db.getTime() - da.getTime()
}

// ── ลำดับของตารางงานนอก/งานติดตั้ง (ชั้นที่ 2 ต่อจาก cmpDaysSort) ──
// เรียงตามคอลัมน์ "วันผลิตที่เหลือ" = วันกำหนด/วันนัด น้อย→มาก · งานเสร็จแล้ว (is_urgent) ไปล่างสุดเสมอ
// ‼️ ใช้ร่วมกัน: หมวดออเดอร์ (displayedOut) กับตารางรายการใต้ปฏิทินงานติดตั้ง
export type DeadlineSortRow = { is_urgent?: boolean | null; deadline?: string | null }

export function cmpDeadlineSort(a: DeadlineSortRow, b: DeadlineSortRow, dir: 'asc' | 'desc'): number {
  if (dir === 'asc' && !!a.is_urgent !== !!b.is_urgent) return a.is_urgent ? 1 : -1
  const ms = (r: DeadlineSortRow) => (r.deadline ? new Date(r.deadline).getTime() : null)
  const da = ms(a), db = ms(b)
  if (da === null && db === null) return 0
  if (da === null) return dir === 'asc' ? 1 : -1      // ไม่มีวันกำหนด = ท้ายกลุ่ม
  if (db === null) return dir === 'asc' ? -1 : 1
  return dir === 'asc' ? da - db : db - da
}

// สี/ข้อความคอลัมน์วันที่เหลือ: เกินกำหนด+0 วัน = แดง (0 = ต้องจัดส่งวันนี้), 1-10 วัน = เหลือง, >10 วัน = เขียว
export const daysLabel = (d: number) => d < 0 ? `เกิน ${Math.abs(d)} วัน` : d === 0 ? 'ต้องจัดส่งวันนี้' : `${d} วัน`
export const daysColor = (d: number) => d <= 0 ? 'var(--red)' : d <= 10 ? '#eab308' : '#34c759'

// แถวนี้อยู่ในแท็บที่เลือกไหม
// ‼️ จัดส่งแล้ว/ยกเลิก → ไปอยู่แท็บของตัวเองแท็บเดียว หายจากแท็บอื่นทั้งหมด (รวมถึง "ทั้งหมด")
export function matchQuickTab(r: TabRow, tab: QuickTab): boolean {
  const p = r.platform ?? ''
  const isClaim = p.startsWith('เคลม:')
  const isShipped = r.order_status === 'จัดส่งแล้ว'
  const isCancelled = r.order_status === 'ยกเลิก'
  return tab === 'shipped' ? isShipped
    : tab === 'cancelled' ? isCancelled
    : tab === 'claim' ? isClaim
    : (isShipped || isCancelled) ? false
    : tab === 'all' ? true
    : tab === 'platform' ? (!isClaim && PLATFORM_NAMES.includes(p))
    : tab === 'outside' ? (!isClaim && OUTSIDE_PLATFORMS.includes(p) && !r.is_installation)
    : r.is_installation === true
}
