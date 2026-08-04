// อ่าน/เขียนข้อมูลพนักงานจากตาราง staff ใน Supabase (แทน Google Sheet เดิม)
import { supabase } from '@/lib/supabase'

export type Staff = {
  code: string
  name: string | null
  nickname: string | null
  position: string | null
  division: string | null
  active: boolean
  start_date: string | null
  sick: { avail: number | null; used: number | null; left: number | null }
  personal: { avail: number | null; full: number | null; half: number | null; left: number | null }
  vacation: { avail: number | null; used: number | null; left: number | null }
  wop: { full: number | null; half: number | null; hours: number | null }
  late: number | null
  warning: string | null
  note: string | null
}

// ── สิทธิลาพักร้อน ─────────────────────────────────────────────
// ทำงานไม่ครบ 365 วัน = ยังไม่มีสิทธิลาพักร้อน → ไม่ต้องโชว์ข้อมูลพักร้อนเลย (ทั้งคอมและมือถือ)
// (ถ้าไม่มีวันเริ่มงานในระบบ = เช็คไม่ได้ → โชว์ตามเดิม)
export const VACATION_MIN_DAYS = 365

export function tenureDays(start: string | null): number | null {
  if (!start) return null
  const t = new Date(start.length === 10 ? start + 'T00:00:00' : start).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export function hasVacationRight(start: string | null): boolean {
  const d = tenureDays(start)
  return d == null ? true : d >= VACATION_MIN_DAYS
}

// แปลงแถวแบน (คอลัมน์ DB) → โครงสร้างซ้อนที่หน้าเว็บใช้
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToStaff(r: any): Staff {
  return {
    code: r.code, name: r.name, nickname: r.nickname, position: r.position,
    division: r.division, active: r.active !== false, start_date: r.start_date,
    sick: { avail: r.sick_avail, used: r.sick_used, left: r.sick_left },
    personal: { avail: r.personal_avail, full: r.personal_full, half: r.personal_half, left: r.personal_left },
    vacation: { avail: r.vacation_avail, used: r.vacation_used, left: r.vacation_left },
    wop: { full: r.wop_full, half: r.wop_half, hours: r.wop_hours },
    late: r.late, warning: r.warning, note: r.note,
  }
}

export async function fetchStaffList(): Promise<Staff[]> {
  const { data, error } = await supabase.from('staff').select('*').eq('active', true).order('code')
  if (error) throw error
  return (data || []).map(rowToStaff)
}

// รูปแบบเดียวกับ EMPLOYEES (lib/staff.ts) เพื่อใช้แทนในช่องเลือกพนักงาน/เดาชื่อ
// — ดึงจากตาราง staff (active) ให้รายชื่ออัปเดตเองเมื่อมีคนเข้า/ออก ไม่ต้องแก้โค้ด
export type EmployeeOption = { code: string; realName: string; nickname: string; role: string; dept: string }

export async function fetchEmployeeOptions(): Promise<EmployeeOption[]> {
  const list = await fetchStaffList()
  return list.map(s => ({
    code: s.code,
    realName: s.name || '',
    nickname: s.nickname || '',
    role: s.position || '',
    dept: s.division || '',
  }))
}

export async function fetchStaffOne(code: string): Promise<Staff | null> {
  const { data, error } = await supabase.from('staff').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error) throw error
  return data ? rowToStaff(data) : null
}
