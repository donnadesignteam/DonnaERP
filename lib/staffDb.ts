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

export async function fetchStaffOne(code: string): Promise<Staff | null> {
  const { data, error } = await supabase.from('staff').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error) throw error
  return data ? rowToStaff(data) : null
}
