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
// ทำงานไม่ครบ 365 วัน = ยังไม่มีสิทธิลาพักร้อน → ขึ้นว่า "ยังไม่มีสิทธิ" แทนตัวเลข (ทั้งคอมและมือถือ)
// (ถ้าไม่มีวันเริ่มงานในระบบ = เช็คไม่ได้ → ถือว่ายังไม่มีสิทธิไว้ก่อน กันเลขสิทธิเก่าค้างในฐานข้อมูลโผล่)
export const VACATION_MIN_DAYS = 365

export function tenureDays(start: string | null): number | null {
  if (!start) return null
  const t = new Date(start.length === 10 ? start + 'T00:00:00' : start).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

export function hasVacationRight(start: string | null): boolean {
  const d = tenureDays(start)
  return d == null ? false : d >= VACATION_MIN_DAYS
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

// includeInactive = true → เอาคนที่ถูกลบ/ลาออกมาด้วย (ใช้ในหน้าพนักงานตอนกดดู "คนที่ลบแล้ว")
export async function fetchStaffList(includeInactive = false): Promise<Staff[]> {
  const q = supabase.from('staff').select('*')
  const { data, error } = await (includeInactive ? q : q.eq('active', true)).order('code')
  if (error) throw error
  return (data || []).map(rowToStaff)
}

// ── เพิ่ม/ลบพนักงาน (ทำได้เฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน — เช็คที่หน้าเว็บ) ──
export type NewStaff = {
  code: string; name: string; nickname: string
  position: string; division: string; start_date: string
}

export async function createStaff(s: NewStaff): Promise<void> {
  const { error } = await supabase.from('staff').insert({
    code: s.code.trim().toUpperCase(),
    name: s.name.trim() || null,
    nickname: s.nickname.trim() || null,
    position: s.position.trim() || null,
    division: s.division || null,
    start_date: s.start_date || null,
    active: true,
    // สิทธิลาตั้งต้นตามกติการ้าน — พักร้อนเป็น 0 เพราะปีแรกยังไม่มีสิทธิ (แก้เพิ่มได้ในหน้าประวัติรายคน)
    sick_avail: 30, sick_used: 0, sick_left: 30,
    personal_avail: 1, personal_full: 0, personal_half: 0, personal_left: 1,
    vacation_avail: 0, vacation_used: 0, vacation_left: 0,
    wop_full: 0, wop_half: 0, wop_hours: 0, late: 0,
  })
  if (error) throw error
}

// ลบแบบเก็บข้อมูลไว้ = active:false (หายจากรายชื่อ ล็อกอินไม่ได้ ประวัติลา/ประวัติแก้ไขยังอยู่ครบ)
export async function setStaffActive(code: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('staff').update({ active }).eq('code', code.toUpperCase())
  if (error) throw error
}

// ลบถาวร = ลบแถวออกจากตาราง staff จริงๆ (กู้ไม่ได้)
export async function deleteStaff(code: string): Promise<void> {
  const { error } = await supabase.from('staff').delete().eq('code', code.toUpperCase())
  if (error) throw error
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
