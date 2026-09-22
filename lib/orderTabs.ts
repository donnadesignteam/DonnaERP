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

// เดาแพลตฟอร์มจากรูปแบบเลขคำสั่งซื้อ — ใช้ตอน AI แปลงแล้วช่อง platform ว่าง
// (เคยเกิด 14ก.ย.69: ใบ Shopee platform=null เลยไม่เข้าแท็บไหนนอกจาก "ทั้งหมด")
// Shopee = YYMMDD + ตัวอักษร/ตัวเลข 8 ตัว (2609141W702MNB) · Tiktok = ตัวเลข 18 หลัก · Lazada = ตัวเลข 12-17 หลัก
export function inferPlatform(orderNumber: string | null | undefined): string | null {
  const n = (orderNumber ?? '').trim().toUpperCase()
  if (/^\d{6}[A-Z0-9]{8}$/.test(n) && /[A-Z]/.test(n)) return 'Shopee'
  if (/^\d{18}$/.test(n)) return 'Tiktok'
  if (/^\d{12,17}$/.test(n)) return 'Lazada'
  return null
}

export const PROD_STATUSES = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'ตรวจสอบแล้ว', 'รีดแล้ว', 'แพ็คแล้ว', 'รอจัดส่ง', 'จัดส่งแล้ว']
export const INSTALL_STATUSES = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'ตรวจสอบแล้ว', 'รีดแล้ว', 'แพ็คแล้ว', 'รอติดตั้ง']

// สีแยกตามขั้นผลิต: รอ=เหลือง → ตัด=ฟ้า → เย็บ=ม่วง → ตรวจสอบ(ผู้ช่วยช่าง)=คราม → รีด=ชมพู → แพ็ค=เขียวอมฟ้า
// (คำเก่า "กำลังX" สีเดียวกับ "Xแล้ว")
export const PROD_STATUS_COLOR: Record<string, string> = {
  'รอดำเนินการ': '#C79A4B',
  'ตัดผ้าแล้ว': '#6E8CA0',
  'เย็บแล้ว': '#9A7BA0',
  'ตรวจสอบแล้ว': '#7B7FA3',
  'รีดแล้ว': '#C2848E',
  'แพ็คแล้ว': '#6E9A92',
  'กำลังตัด': '#6E8CA0',
  'กำลังเย็บ': '#9A7BA0',
  'กำลังรีด': '#C2848E',
  'กำลังแพ็ค': '#6E9A92',
  'งานเสร็จ': '#6F8F6A',
  'รอจัดส่ง': '#7B7FA3',
  'จัดส่งแล้ว': '#6F8F6A',
  'รอติดตั้ง': '#B5715A',
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
  order_number?: string | null
  entry_kind?: string | null      // ประเภทที่กดเลือกตอน "เพิ่มรายการ" (platform/outside/install/claim) — sql/add_entry_kind.sql
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

// ‼️ วันของ deadline (งานติดตั้ง/งานนอก) เก็บเป็น YYYY-MM-DD — ห้ามส่งเข้า new Date() ตรงๆ
//    เพราะ JS อ่านเป็นเวลา UTC เที่ยงคืน = 07:00 ของไทย ทำให้ Math.ceil ปัดขึ้นไปอีก 1 วันเสมอ
//    (งานที่ต้องติดตั้งวันนี้เลยขึ้นว่า "1 วัน") — ต้องประกอบเป็นวันที่ท้องถิ่นเอง
export function daysRemaining(dateStr: string): number | null {
  if (!dateStr) return null
  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const target = dmy
    ? new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]))
    : ymd
      ? new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]))
      : new Date(dateStr)
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
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) {
    // ประกอบเป็นวันที่ท้องถิ่น (เหตุผลเดียวกับ daysRemaining) ไม่งั้นวันเดียวกันเรียงสลับกับแบบ D/M/YYYY
    const d = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]))
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
export const daysColor = (d: number) => d <= 0 ? 'var(--red)' : d <= 10 ? '#C79A4B' : '#6F8F6A'

// แถวนี้อยู่ในแท็บที่เลือกไหม
// ‼️ จัดส่งแล้ว/ยกเลิก → ไปอยู่แท็บของตัวเองแท็บเดียว หายจากแท็บอื่นทั้งหมด (รวมถึง "ทั้งหมด")
export function matchQuickTab(r: TabRow, tab: QuickTab): boolean {
  const p = r.platform || inferPlatform(r.order_number) || ''
  const isClaim = p.startsWith('เคลม:')
  const isShipped = r.order_status === 'จัดส่งแล้ว'
  const isCancelled = r.order_status === 'ยกเลิก'
  return tab === 'shipped' ? isShipped
    : tab === 'cancelled' ? isCancelled
    : tab === 'claim' ? (isClaim && !isShipped && !isCancelled)   // งานเคลมที่ส่งแล้ว/ยกเลิก ย้ายไปแท็บของตัวเองเหมือนออเดอร์ปกติ (user ขอ 15ก.ย.69)
    : (isShipped || isCancelled) ? false
    : tab === 'all' ? true
    // ช่องแพลตฟอร์มว่าง (เดาจากเลขคำสั่งซื้อไม่ได้) → ยึดประเภทที่กดเลือกตอนเพิ่มรายการ
    : tab === 'platform' ? (!isClaim && (p ? PLATFORM_NAMES.includes(p) : r.entry_kind === 'platform'))
    : tab === 'outside' ? (!isClaim && (p ? OUTSIDE_PLATFORMS.includes(p) : r.entry_kind === 'outside') && !r.is_installation)
    : r.is_installation === true
}
