// แก้ปีที่แอดมินเขียนมาไม่เหมือนกัน (พ.ศ./ค.ศ.) ตอนกดแปลงข้อความ
// เจอบ่อย: 2568 (พ.ศ.) · 3111 (บวก 543 ซ้ำ) · 2025 (ค.ศ. ปกติ)
// กติกา: ปีไกลเกินไป = ยังเป็น พ.ศ. อยู่ → ลบ 543 (ลบซ้ำได้ถ้าโดนบวกมาหลายรอบ)
//        ลบจนสุดแล้วยังหลุดกรอบ (อดีตไกล/อนาคตไกล) = ค่าเพี้ยน ทิ้งเป็น null ให้คนกรอกเอง ดีกว่าลงวันผิด

const YEARS_AHEAD = 2    // งานล่วงหน้าได้ไม่เกิน 2 ปี
const YEARS_BACK = 3     // ย้อนหลังได้ไม่เกิน 3 ปี (ออเดอร์เก่าที่เพิ่งมาลง)

export function normalizeThaiDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  let y = Number(m[1])
  const now = new Date().getFullYear()
  let guard = 0
  while (y > now + YEARS_AHEAD && guard++ < 3) y -= 543
  if (y > now + YEARS_AHEAD || y < now - YEARS_BACK) return null
  const d = new Date(`${y}-${m[2]}-${m[3]}T00:00:00`)
  if (isNaN(d.getTime()) || d.getMonth() + 1 !== Number(m[2]) || d.getDate() !== Number(m[3])) return null
  return `${y}-${m[2]}-${m[3]}`
}

// ── วันที่แบบ YYYY-MM-DD ตามเวลาเครื่อง ────────────────────────────
// ‼️ ห้ามใช้ new Date().toISOString().slice(0,10) — นั่นคือเวลา UTC
//    ไทยเป็น UTC+7 ช่วง 00:00–07:00 ตามเวลาไทย UTC ยังเป็น "เมื่อวาน" อยู่
//    ทำให้ลงออเดอร์/เปิดเคลมตอนดึกได้วันย้อนหลัง 1 วัน และการ์ด "ครบกำหนดวันนี้" เลื่อนทั้งแผง
export function ymdLocal(d: Date | string | number): string {
  const x = d instanceof Date ? d : new Date(d)
  if (isNaN(x.getTime())) return ''
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// วันนี้ (YYYY-MM-DD) ตามเวลาเครื่อง
export const todayYmd = () => ymdLocal(new Date())
