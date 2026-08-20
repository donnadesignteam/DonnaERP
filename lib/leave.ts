// กติกาการลา — ใช้ร่วมกันระหว่างปฏิทินพนักงานฝั่งคอม (/employees) และหน้าแจ้งลาในแอปมือถือ (/m/me)
import { supabase } from '@/lib/supabase'

export const LEAVE_TYPES = [
  'ลาป่วย', 'ลากิจเต็มวัน', 'ลากิจครึ่งวัน', 'ลาพักร้อน',
  'WOPเต็มวัน', 'WOPครึ่งวัน', 'WOPรายชั่วโมง', 'มาสาย',
] as const

// จำนวนวันแบบนับรวมหัวท้าย (เช่น 23→25 = 3 วัน); คืน 0 ถ้าข้อมูลไม่ครบ/วันสิ้นสุดก่อนวันเริ่ม
export function rangeDays(start: string, end: string): number {
  if (!start) return 0
  const e = end || start
  const diff = Math.round((new Date(e + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000)
  return diff < 0 ? 0 : diff + 1
}

// เงื่อนไขลาพักร้อน: คืนจำนวนวันต่อเนื่องสูงสุดต่อครั้ง (0 = ยังไม่มีสิทธิ)
// ยึดตามสูตรใน Google Sheet 'ชีทบันทึกการลา' คอลัมน์ H (อายุงาน = วันยื่นลา − วันเริ่มงาน):
//   ≤365 ไม่มีสิทธิ (ไม่ครบ 1 ปี) · ≤730 ไม่เกิน 3 · ≤1095 ไม่เกิน 4 · มากกว่านั้น 6
export function vacationMaxDays(days: number): number {
  if (days <= 365) return 0
  if (days <= 730) return 3
  if (days <= 1095) return 4
  return 6
}

// ผลของการลาแต่ละประเภทต่อช่องสิทธิลาในตาราง staff (จะคูณด้วย sign ตอนเพิ่ม/ลบ)
export function leaveEffect(type: string, days: number): Record<string, number> {
  switch (type) {
    case 'ลาป่วย':        return { sick_used: days, sick_left: -days }
    case 'ลากิจเต็มวัน':  return { personal_full: days, personal_left: -days }
    case 'ลากิจครึ่งวัน': return { personal_half: 1, personal_left: -0.5 }
    case 'ลาพักร้อน':     return { vacation_used: days, vacation_left: -days }
    case 'WOPเต็มวัน':     return { wop_full: 1 }
    case 'WOPครึ่งวัน':    return { wop_half: 1 }
    case 'WOPรายชั่วโมง':  return { wop_hours: 1 }
    case 'มาสาย':         return { late: 1 }
    default: return {}
  }
}

// อัปเดตสิทธิลาในตาราง staff ตามการลา (sign=1 หักสิทธิ, sign=-1 คืนสิทธิ)
export async function applyLeaveToStaff(code: string, type: string, days: number, sign: 1 | -1) {
  const delta = leaveEffect(type, days)
  if (!code || !Object.keys(delta).length) return
  const { data: s, error } = await supabase.from('staff').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error || !s) return  // ยังไม่ได้ migrate ตาราง staff → ข้ามไป ไม่ให้พัง
  const patch: Record<string, number> = {}
  for (const [k, v] of Object.entries(delta)) patch[k] = Number((s as Record<string, unknown>)[k] ?? 0) + sign * v
  await supabase.from('staff').update(patch).eq('code', code.toUpperCase())
}

// ── ใบลาที่พนักงานแจ้งเองจากมือถือ ────────────────────────────────
// ยื่นแล้วยัง "ไม่หักสิทธิ" (quota_applied = false) — หักตอนหัวหน้า/HR กดอนุมัติที่ปฏิทินพนักงาน
// แถวเก่า/ใบที่แอดมินลงเองจากคอม = true (หักไปแล้วตั้งแต่ตอนบันทึก)
export const isQuotaApplied = (row: { quota_applied?: boolean | null }) => row.quota_applied !== false
export const isApproved = (row: { supervisor_approval?: string | null; hr_approval?: string | null }) =>
  row.supervisor_approval === 'อนุมัติ' || row.hr_approval === 'อนุมัติ'
