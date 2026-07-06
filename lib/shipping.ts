// คำนวณ "วันต้องส่งภายใน" ที่ใช้จริงของงานแพลตฟอร์ม — ใช้ร่วมกันหน้าออเดอร์ (OrderWorkspace) และ dashboard
// กติกา: dropoff เลื่อนออก 2 วัน + วันส่งตรงวันอาทิตย์/วันหยุดร้าน (ร้านปิด ส่งไม่ได้) → เลื่อนขึ้นมาส่งก่อน 1 วัน
import { HOLIDAYS } from '@/lib/holidays'

// รูปแบบวันที่ shipping_datetime = "D/M/YYYY,HH:mm:ss"
export function shiftShippingDatetime(s: string, days: number): string {
  if (!s || s === '-') return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),(.+)$/)
  if (!m) return s
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
  d.setDate(d.getDate() + days)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()},${m[4]}`
}

// เลื่อนขึ้นมาทีละวันจนตรงวันเปิดร้าน (กันเคสวันหยุดติดกัน เช่น เสาร์หยุดพิเศษ+อาทิตย์)
export function avoidClosedDays(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),(.+)$/)
  if (!m) return s
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
  for (let i = 0; i < 7; i++) {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (d.getDay() !== 0 && !HOLIDAYS[ymd]) break
    d.setDate(d.getDate() - 1)
  }
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()},${m[4]}`
}

export function effShipping(r: { is_dropoff?: boolean | null; shipping_datetime?: string | null }): string | null {
  const s = (r.is_dropoff && r.shipping_datetime) ? shiftShippingDatetime(r.shipping_datetime, 2) : r.shipping_datetime
  return (s && s !== '-') ? avoidClosedDays(s) : (s ?? null)
}
