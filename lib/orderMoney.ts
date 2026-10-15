// ยอดเงินของใบออเดอร์: ค่าส่ง/ค่าติดตั้ง + เหลือชำระ — ใช้ร่วมกันทั้งฟอร์ม ตาราง ใบคัดลอก/ปริ้น (หมวดออเดอร์ + ปฏิทินติดตั้ง)
// ‼️ ค่าส่ง (งานนอก) / ค่าติดตั้ง (งานติดตั้ง) รวมอยู่ใน price (ยอดทั้งหมด) แล้ว — ไม่บวกเพิ่ม
//    เก็บแยกคอลัมน์ ship_fee / install_fee (sql/add_order_fees.sql) ไม่ใส่ใน items เพราะ items ไปใบงานช่าง/สต็อก/แพ็ค
import { OUTSIDE_PLATFORMS } from '@/lib/orderTabs'

export type MoneyOrder = {
  platform?: string | null
  is_installation?: boolean | null
  price?: number | string | null
  ship_fee?: number | string | null
  install_fee?: number | string | null
  payment_status?: string | null
  paid_amount?: number | string | null
  deposit?: number | string | null
}

const n = (v: unknown): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))
export const baht = (v: number) => v.toLocaleString('th-TH', { maximumFractionDigits: 2 })

// งานที่มียอดเงินให้เก็บเอง (งานนอก/งานติดตั้ง) — งานแพลตฟอร์มลูกค้าจ่ายผ่านแพลตฟอร์มแล้ว
export const isOwnSale = (r: MoneyOrder) => !!r.is_installation || (OUTSIDE_PLATFORMS.includes(r.platform ?? '') && !(r.platform ?? '').startsWith('เคลม:'))

// ค่าส่ง (งานนอก) หรือ ค่าติดตั้ง (งานติดตั้ง) ของใบนี้
export function feeOf(r: MoneyOrder): { label: 'ค่าส่ง' | 'ค่าติดตั้ง'; amount: number | null } | null {
  if (!isOwnSale(r)) return null
  return r.is_installation
    ? { label: 'ค่าติดตั้ง', amount: n(r.install_fee) }
    : { label: 'ค่าส่ง', amount: n(r.ship_fee) }
}
export const feeText = (r: MoneyOrder) => {
  const f = feeOf(r)
  return f && f.amount != null ? `${f.label} ${f.amount ? baht(f.amount) : 'ฟรี'}` : ''
}

// ชำระแล้ว / เหลือชำระ — กติกาเดียวกับคอลัมน์ "ชำระแล้ว" + "ยอดชำระก่อนจัดส่ง/หลังติดตั้ง"
export function payOf(r: MoneyOrder): { paid: number | null; remain: number | null } {
  const price = n(r.price)
  const st = r.payment_status || 'ยังไม่ชำระ'
  if (st === 'ชำระครบ') return { paid: n(r.paid_amount) ?? price, remain: 0 }
  if (st === 'ยังไม่ชำระ') return { paid: null, remain: price }
  const paid = n(r.paid_amount) ?? (st === 'มัดจำ50%' && price != null ? price / 2 : null)
  if (paid != null && price != null) return { paid, remain: Math.max(0, price - paid) }
  return { paid, remain: n(r.deposit) }
}

// บรรทัดยอดเงินในใบคัดลอก/ปริ้น (เฉพาะงานนอก/งานติดตั้งที่ลงยอดไว้)
export function moneyLines(r: MoneyOrder): string[] {
  const price = n(r.price)
  if (!isOwnSale(r) || price == null) return []
  // มีค่าส่ง/ค่าติดตั้ง → รวม (ค่าสินค้า) · ค่าส่ง · รวมทั้งหมด · ไม่มี → รวมทั้งหมดบรรทัดเดียว
  const out: string[] = []
  const f = feeOf(r)
  if (f && f.amount != null) {
    out.push(`รวม ${baht(price - f.amount)} บาท`)
    out.push(f.amount ? `${f.label} ${baht(f.amount)} บาท` : `${f.label} ฟรี`)
  }
  out.push(`รวมทั้งหมด ${baht(price)} บาท`)
  const { paid, remain } = payOf(r)
  if (remain === 0) out.push('ชำระครบแล้ว')
  else {
    if (paid) out.push(`ชำระแล้ว ${baht(paid)} บาท`)
    if (remain != null) out.push(`เหลือชำระ ${baht(remain)} บาท`)
  }
  return out
}

// คอลัมน์ "รายการ" แถวสูง 2 บรรทัด: รายการ + ค่าส่ง/ค่าติดตั้งต่อท้าย
// 2 บรรทัดพอ = โชว์ครบ · เกิน = บรรทัดแรก + "+ อีก N รายการ · ค่าส่ง 100"
export function itemsPreview(itemLines: string[], fee: string): { lines: string[]; more: string } {
  const feeLine = fee ? `+ ${fee}` : ''
  const all = feeLine ? [...itemLines, feeLine] : itemLines
  if (all.length <= 2) return { lines: all, more: '' }
  return { lines: itemLines.slice(0, 1), more: [`+ อีก ${itemLines.length - 1} รายการ`, fee].filter(Boolean).join(' · ') }
}
