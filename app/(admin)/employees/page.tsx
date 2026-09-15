'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { fetchAllRows } from '@/lib/fetchAll'
import { HOLIDAYS } from '@/lib/holidays'
// ค่าคงที่ปฏิทินย้ายไป lib/shopCalendar.ts — ใช้ร่วมกับหน้ามือถือ (/m/calendar)
import { RED_ZONES, CAMPAIGNS, LEAVE_STATUS_COLOR as STATUS_COLOR, DAYS_TH as DAYS, TH_MONTHS } from '@/lib/shopCalendar'
import { EMPLOYEES } from '@/lib/staff'
import { fetchEmployeeOptions } from '@/lib/staffDb'
import { recordAction } from '@/lib/history'
import { tUpdate } from '@/lib/trackedDb'
import { useConfirm } from '@/components/ConfirmDialog'
import { LEAVE_TYPES, rangeDays, vacationMaxDays, applyLeaveToStaff, isQuotaApplied, isApproved } from '@/lib/leave'
import { todayYmd } from '@/lib/thaiDate'
import { useStableView } from '@/lib/useStableView'
import CreamSelect from '@/components/CreamSelect'
import AnchoredMenu from '@/components/AnchoredMenu'
import { useColumnFilters, useHiddenColumns, SearchPill, MonthSelect, SortSelect, ColumnPicker, Tab, type FilterDef } from '@/components/ListFilters'

// คอลัมน์ของรายการลา (ซ่อน/โชว์ได้ + ตัวกรองหัวคอลัมน์ แบบเดียวกับหมวดออเดอร์)
const LEAVE_COLS = [
  { id: 'code', label: 'รหัส' }, { id: 'name', label: 'ชื่อ-นามสกุล' }, { id: 'nickname', label: 'ชื่อเล่น' },
  { id: 'department', label: 'แผนก' }, { id: 'date', label: 'วันที่ลา' }, { id: 'type', label: 'ประเภท' },
  { id: 'reason', label: 'เหตุผล' }, { id: 'cert', label: 'ใบรับรอง' }, { id: 'status', label: 'สถานะ' },
  { id: 'supervisor', label: 'หัวหน้า' }, { id: 'hr', label: 'บุคคล' },
]
const APPROVAL_OPTS = ['รออนุมัติ', 'อนุมัติ', 'ไม่อนุมัติ']
const LEAVE_STATUS_OPTS = ['ใบลาเรียบร้อย', 'ยังไม่เขียนไปลา', 'รออนุมัติ']
// ป้ายเลือกในรายการลา — .dn-pill ครีมมุมมนชุดเดียวกับป้ายสถานะหมวดออเดอร์ (เขียว = ผ่าน · ชมพู = ไม่ผ่าน/ยังไม่ทำ · ส้มครีม = รอ)
const LEAVE_PILL: Record<string, { bg: string; dot: string }> = {
  'ใบลาเรียบร้อย': { bg: '#D5E6C6', dot: '#6F8F6A' }, 'อนุมัติ': { bg: '#D5E6C6', dot: '#6F8F6A' },
  'ยังไม่เขียนไปลา': { bg: '#F0C0B7', dot: '#C0563F' }, 'ไม่อนุมัติ': { bg: '#F0C0B7', dot: '#C0563F' },
  'รออนุมัติ': { bg: '#F9E0C3', dot: '#C79A4B' },
}

type Leave = {
  id: string
  employee_code: string
  employee_name: string
  employee_nickname: string
  department: string
  leave_date: string
  leave_end_date: string
  leave_time: string
  leave_type: string
  reason: string
  leave_status: string
  supervisor_approval: string
  hr_approval: string
  medical_cert_url: string | null
  quota_applied?: boolean | null   // false = ใบที่พนักงานแจ้งเองจากมือถือ ยังไม่หักสิทธิจนกว่าจะอนุมัติ
  created_at: string
}





function toYMD(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// วันเริ่มงานพนักงาน (จาก Google Sheet Master_Data คอลัมน์ G) — ใช้คำนวณอายุงาน
const START_DATES: Record<string, string> = {
  DN001:'2022-01-17', DN002:'2022-03-01', DN003:'2022-09-29', DN004:'2022-10-15',
  DN005:'2022-12-01', DN006:'2022-12-18', DN007:'2023-06-15', DN008:'2023-08-02',
  DN009:'2023-11-13', DN010:'2023-10-01', DN011:'2024-01-15', DN013:'2024-03-31',
  DN014:'2024-04-01', DN015:'2024-03-31', DN016:'2024-02-01', DN017:'2024-06-17',
  DN018:'2025-01-10', DN019:'2025-02-10', DN020:'2025-02-07', DN021:'2025-02-13',
  DN022:'2025-03-02', DN023:'2025-05-21', DN024:'2025-05-28', DN025:'2025-11-02',
  DN026:'2025-08-25', DN027:'2025-08-20', DN028:'2025-09-08', DN029:'2025-09-08',
  DN030:'2025-10-02', DN031:'2025-10-21', DN032:'2025-10-09', DN033:'2026-01-05',
  DN034:'2026-01-27', DN035:'2026-03-23', DN037:'2026-06-08',
  // DN036 (ปูน) ยังไม่มีวันเริ่มงาน → ถือว่ายังไม่มีสิทธิลาพักร้อนไปก่อน
}

// อายุงานเป็นวัน (วันนี้ − วันเริ่มงาน); null = ไม่พบวันเริ่มงาน
function tenureDays(code: string): number | null {
  const s = START_DATES[code]
  if (!s) return null
  return Math.floor((Date.now() - new Date(s + 'T00:00:00').getTime()) / 86400000)
}

// ข้อความอายุงาน เช่น "4 ปี 28 วัน"
function tenureText(days: number): string {
  const y = Math.floor(days / 365), d = days % 365
  return y > 0 ? `${y} ปี ${d} วัน` : `${d} วัน`
}

export default function EmployeesPage() {
  // เปิดหน้าซ้ำ → โชว์ข้อมูลรอบก่อนทันที แล้ว load() ดึงของใหม่เบื้องหลัง (stale-while-revalidate)
  const cached = getPageCache<Leave[]>('leave_requests')
  const [leaves, setLeaves] = useState<Leave[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  // กล่องยืนยันของเว็บเอง (ไม่ใช้ window.confirm — ดูเหตุผลใน components/ConfirmDialog.tsx)
  const { ask, confirmDialog } = useConfirm()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nickname: '', employee_code: '', employee_name: '', department: '', leave_date: '', leave_end_date: '', leave_time: '08:00', leave_type: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState('')
  const [suggestions, setSuggestions] = useState<typeof EMPLOYEES>([])
  // รายชื่อพนักงานดึงจากตาราง staff (active) — อัปเดตเองเมื่อมีคนเข้า/ออก, fallback รายชื่อในโค้ดถ้าดึงไม่ได้
  const [employees, setEmployees] = useState<typeof EMPLOYEES>(EMPLOYEES)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certBusy, setCertBusy] = useState<string | null>(null)  // id แถวที่กำลังอัปโหลดใบรับรองทีหลัง
  const [dayModal, setDayModal] = useState<{ ymd: string; day: number; leaves: Leave[] } | null>(null)
  // กล่อง "รออนุมัติ" เหนือรายการลา — แบบเดียวกับปุ่มกรอง "ข้อมูลไม่ครบ / ยังไม่ปริ้น" ในหมวดออเดอร์
  const [pendingFilter, setPendingFilter] = useState(false)
  // รายการลา: ค้นหา / เดือน / ตัวกรองหัวคอลัมน์ / ซ่อนคอลัมน์
  const [leaveSearch, setLeaveSearch] = useState('')
  const [leaveMonth, setLeaveMonth] = useState('all')
  // เมนู ··· ท้ายแถวรายการลา (แบบเดียวกับหมวดออเดอร์/งานเคลม) — rect ของปุ่ม ให้ AnchoredMenu พลิกขึ้นเองถ้าชิดขอบล่าง
  const [leaveMenu, setLeaveMenu] = useState<{ id: string; rect: DOMRect } | null>(null)
  const { snapshot, stable, live } = useStableView<Leave>(leaves)
  const hc = useHiddenColumns('leave_hidden_cols')
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [selDay, setSelDay] = useState(new Date().getDate())   // วันที่ยึดของมุมมองสัปดาห์/วัน

  const load = async () => {
    setError('')
    const { data, error: err } = await fetchAllRows<Leave>(() =>
      supabase.from('leave_requests').select('*').order('leave_date', { ascending: false }).order('id', { ascending: true }))
    if (err) { setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return }
    const rows = (data ?? []) as Leave[]
    setPageCache('leave_requests', rows)
    setLeaves(rows)
    snapshot(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { fetchEmployeeOptions().then(list => { if (list.length) setEmployees(list) }).catch(() => {}) }, [])

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const onNicknameChange = (val: string) => {
    setF('nickname', val)
    if (val.length < 1) { setSuggestions([]); return }
    const matches = employees.filter(e =>
      e.nickname.includes(val) || e.realName.includes(val) || e.code.includes(val)
    ).slice(0, 6)
    setSuggestions(matches)
  }

  const selectEmployee = (emp: typeof EMPLOYEES[0]) => {
    setForm(f => ({ ...f, nickname: emp.nickname, employee_code: emp.code, employee_name: emp.realName, department: emp.dept }))
    setSuggestions([])
    setConflict('')
  }

  const checkConflict = async (start: string, end: string, dept: string) => {
    if (!start || !dept) return
    const e = end || start
    const { data } = await fetchAllRows<{ employee_nickname: string; leave_date: string; leave_end_date: string | null }>(() =>
      supabase.from('leave_requests').select('employee_nickname, leave_date, leave_end_date').eq('department', dept).order('id', { ascending: true }))
    const overlap = (data ?? []).filter((d: any) => {
      const ds = d.leave_date
      const de = d.leave_end_date || d.leave_date
      return ds <= e && de >= start // ช่วงทับซ้อนกัน
    })
    if (overlap.length > 0) {
      setConflict(`⚠️ มีพนักงานขอหยุดแล้วในช่วงดังกล่าวโปรดพิจารณาเลือกวันอื่น (${[...new Set(overlap.map((d: any) => d.employee_nickname))].join(', ')})`)
    } else setConflict('')
  }

  // อัปโหลดรูปใบรับรองแพทย์เข้า Supabase Storage → คืน public URL (null = ไม่มีไฟล์/พลาด)
  const uploadCert = async (file: File, code: string): Promise<string | null> => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${code || 'unknown'}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('medical-certs').upload(path, file, { upsert: true })
    if (error) { alert('อัปโหลดใบรับรองแพทย์ไม่สำเร็จ: ' + error.message); return null }
    return supabase.storage.from('medical-certs').getPublicUrl(path).data.publicUrl
  }

  const save = async () => {
    // กันลาพักร้อนเมื่อยังไม่มีสิทธิ / เกินจำนวนวันต่อเนื่อง (เผื่อปุ่มถูกข้าม)
    const td = form.employee_code ? tenureDays(form.employee_code) : null
    if (form.leave_type === 'ลาพักร้อน') {
      if (td == null) return  // ไม่มีวันเริ่มงานในระบบ = เช็คสิทธิไม่ได้ → ถือว่ายังไม่มีสิทธิ
      const max = vacationMaxDays(td)
      if (max === 0) return
      if (rangeDays(form.leave_date, form.leave_end_date) > max) return
    }
    setSaving(true)
    // แนบใบรับรองแพทย์ถ้ามี (ไม่บังคับ — ไม่แนบก็บันทึกได้)
    const certUrl = certFile ? await uploadCert(certFile, form.employee_code) : null
    const payload = {
      employee_code: form.employee_code,
      employee_name: form.employee_name,
      employee_nickname: form.nickname,
      department: form.department,
      leave_date: form.leave_date,
      leave_end_date: form.leave_end_date || form.leave_date,
      leave_time: form.leave_time,
      leave_type: form.leave_type,
      reason: form.reason,
      leave_status: 'รออนุมัติ',
      supervisor_approval: 'รออนุมัติ',
      hr_approval: 'รออนุมัติ',
      medical_cert_url: certUrl,
      quota_applied: true,   // ลงจากคอม = หักสิทธิทันทีตอนบันทึก (พนักงานแจ้งเองจากมือถือถึงจะเป็น false)
    }
    const days = rangeDays(form.leave_date, form.leave_end_date || form.leave_date)
    let { data: inserted } = await supabase.from('leave_requests').insert(payload).select().single()
    // ยังไม่ได้รัน sql/add_leave_quota_applied.sql → ลงใหม่แบบไม่มีคอลัมน์นั้น (ของเดิมหักสิทธิทันทีอยู่แล้ว)
    if (!inserted) {
      const legacy: Record<string, unknown> = { ...payload }
      delete legacy.quota_applied
      inserted = (await supabase.from('leave_requests').insert(legacy).select().single()).data
    }
    // ‼️ ลงใบลาไม่สำเร็จ = ห้ามหักสิทธิ — เดิมหักก่อนเช็ก ถ้า insert พังทั้ง 2 รอบ สิทธิลาจะหายทั้งที่ไม่มีใบลาในระบบ
    if (!inserted) {
      setSaving(false)
      alert('บันทึกใบลาไม่สำเร็จ — สิทธิลายังไม่ถูกหัก ลองอีกครั้ง')
      return
    }
    // อัปเดตสิทธิลาในหน้าพนักงาน (staff) ให้ตรงกัน
    await applyLeaveToStaff(form.employee_code, form.leave_type, days, 1)
    {
      const code = form.employee_code, type = form.leave_type, nick = form.nickname
      const row = inserted
      recordAction({
        label: `เพิ่มใบลา ${nick}`,
        undo: async () => { await supabase.from('leave_requests').delete().eq('id', row.id); await applyLeaveToStaff(code, type, days, -1); await load() },
        redo: async () => { await supabase.from('leave_requests').insert(row); await applyLeaveToStaff(code, type, days, 1); await load() },
      })
    }
    setSaving(false)
    setModal(false)
    setForm({ nickname: '', employee_code: '', employee_name: '', department: '', leave_date: '', leave_end_date: '', leave_time: '08:00', leave_type: '', reason: '' })
    setCertFile(null)
    load()
  }

  // แนบ/เปลี่ยนใบรับรองแพทย์ทีหลังจากในตาราง
  const attachCert = async (l: Leave, file: File) => {
    setCertBusy(l.id)
    const url = await uploadCert(file, l.employee_code)
    if (url) await supabase.from('leave_requests').update({ medical_cert_url: url }).eq('id', l.id)
    setCertBusy(null)
    load()
  }

  const del = async (id: string) => {
    if (!(await ask('ลบรายการนี้?', { okText: 'ลบ', danger: true }))) return
    const l = leaves.find((x) => x.id === id)
    setError('')
    // ‼️ ลบไม่สำเร็จต้องฟ้องเสมอ ห้ามเงียบ (ไม่งั้นดูเหมือนกดปุ่มไม่ติด) — และห้ามคืนสิทธิลาให้ทั้งที่ยังลบไม่ออก
    const { error: delErr } = await supabase.from('leave_requests').delete().eq('id', id)
    if (delErr) { setError(`ลบไม่สำเร็จ: ${delErr.message}`); return }
    // ย้อนสิทธิลาในตาราง staff กลับ (เฉพาะใบที่หักสิทธิไปแล้ว — ใบที่พนักงานแจ้งเองแล้วยังไม่อนุมัติ ยังไม่เคยหัก)
    if (l) {
      const days = rangeDays(l.leave_date, l.leave_end_date || l.leave_date)
      if (isQuotaApplied(l)) await applyLeaveToStaff(l.employee_code, l.leave_type, days, -1)
      recordAction({
        label: `ลบใบลา ${l.employee_nickname || ''}`,
        undo: async () => { await supabase.from('leave_requests').insert(l); await applyLeaveToStaff(l.employee_code, l.leave_type, days, 1); await load() },
        redo: async () => { await supabase.from('leave_requests').delete().eq('id', id); await applyLeaveToStaff(l.employee_code, l.leave_type, days, -1); await load() },
      })
    }
    load()
  }

  const updateLeave = async (id: string, field: string, val: string) => {
    const old = leaves.find((x) => x.id === id)
    await tUpdate('leave_requests', id, { [field]: val }, { [field]: old ? (old as any)[field] ?? null : null }, `แก้ใบลา ${old?.employee_nickname || ''}`, load)
    if (old) {
      const next = { ...old, [field]: val } as Leave
      const daysOf = (l: Leave) => rangeDays(l.leave_date, l.leave_end_date || l.leave_date)
      const applied = isQuotaApplied(old)
      const wasApproved = isApproved(old), nowApproved = isApproved(next)
      if (!applied && nowApproved) {
        // ใบที่พนักงานแจ้งเองจากมือถือยังไม่หักสิทธิ — พออนุมัติ (หัวหน้าหรือ HR คนใดคนหนึ่ง) ค่อยหักให้ครั้งเดียว
        await applyLeaveToStaff(next.employee_code, next.leave_type, daysOf(next), 1)
        await supabase.from('leave_requests').update({ quota_applied: true }).eq('id', id)
      } else if (applied && wasApproved && !nowApproved) {
        // ‼️ ถอนอนุมัติ/เปลี่ยนเป็นไม่อนุมัติ = คืนสิทธิที่หักไว้ ไม่งั้นพนักงานเสียสิทธิฟรี (อนุมัติใหม่ค่อยหักอีกรอบ)
        // ปักธงก่อนแล้วค่อยคืนสิทธิ — ถ้ายังไม่ได้รัน sql/add_leave_quota_applied.sql ปักธงไม่ได้ ก็อย่าคืน
        // ไม่งั้นคืนไปแล้วระบบจำไม่ได้ พออนุมัติใหม่จะไม่หักกลับ สิทธิเกินจริง
        const { error: qErr } = await supabase.from('leave_requests').update({ quota_applied: false }).eq('id', id)
        if (!qErr) await applyLeaveToStaff(old.employee_code, old.leave_type, daysOf(old), -1)
      } else if (applied && (field === 'leave_date' || field === 'leave_end_date' || field === 'leave_type')) {
        // ‼️ แก้วัน/ประเภทลาของใบที่หักสิทธิไปแล้ว ต้องคืนของเก่าแล้วหักของใหม่ ไม่งั้นสิทธิค้างเลขเดิม
        await applyLeaveToStaff(old.employee_code, old.leave_type, daysOf(old), -1)
        await applyLeaveToStaff(next.employee_code, next.leave_type, daysOf(next), 1)
      }
    }
    load()
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const dim = new Date(year, month + 1, 0).getDate()
  const first = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => { const d = i - first + 1; return d > 0 && d <= dim ? d : null })

  // อายุงาน + สิทธิลาพักร้อน ของพนักงานที่เลือกในฟอร์มลา
  const selTenure = form.employee_code ? tenureDays(form.employee_code) : null
  const selVacMax = selTenure == null ? null : vacationMaxDays(selTenure)
  const selRangeDays = rangeDays(form.leave_date, form.leave_end_date)
  const vacNoRight = form.leave_type === 'ลาพักร้อน' && (selVacMax === 0 || selTenure == null)
  const vacOverDays = form.leave_type === 'ลาพักร้อน' && selVacMax != null && selVacMax > 0 && selRangeDays > selVacMax
  const vacBlocked = vacNoRight || vacOverDays

  // ใบลาที่ยังไม่มีใครตัดสิน — ยังไม่มีใครกดอนุมัติ และยังไม่มีใครกดไม่อนุมัติ
  const isPending = (l: Leave) =>
    !isApproved(l) && l.supervisor_approval !== 'ไม่อนุมัติ' && l.hr_approval !== 'ไม่อนุมัติ'
  const pendingLeaves = leaves.filter(isPending)

  // กรอง/เรียงบนค่า stable (แถวไม่เด้งหนีตอนกดอนุมัติ) แล้วคืนค่าสดก่อนวาด
  const leaveDefs: FilterDef<Leave>[] = [
    { id: 'code', label: 'รหัส', kind: 'text', get: l => l.employee_code },
    { id: 'name', label: 'ชื่อ-นามสกุล', kind: 'text', get: l => l.employee_name },
    { id: 'nickname', label: 'ชื่อเล่น', kind: 'pick', get: l => l.employee_nickname },
    { id: 'department', label: 'แผนก', kind: 'pick', get: l => l.department },
    { id: 'date', label: 'วันที่ลา', kind: 'date', get: l => l.leave_date },
    { id: 'type', label: 'ประเภท', kind: 'pick', get: l => l.leave_type },
    { id: 'cert', label: 'ใบรับรอง', kind: 'bool', get: l => l.medical_cert_url, yes: 'แนบใบรับรองแล้ว', no: 'ยังไม่แนบ' },
    { id: 'status', label: 'สถานะ', kind: 'pick', get: l => l.leave_status, options: ['ใบลาเรียบร้อย', 'ยังไม่เขียนไปลา', 'รออนุมัติ'] },
    { id: 'supervisor', label: 'หัวหน้า', kind: 'pick', get: l => l.supervisor_approval, options: APPROVAL_OPTS },
    { id: 'hr', label: 'บุคคล', kind: 'pick', get: l => l.hr_approval, options: APPROVAL_OPTS },
  ]
  const lf = useColumnFilters(leaveDefs)
  const leaveMonths = Array.from(new Set(leaves.map(l => (l.leave_date ?? '').slice(0, 7)).filter(Boolean))).sort().reverse()
  const monthLeaves = leaves.map(stable).filter(l => leaveMonth === 'all' || (l.leave_date ?? '').slice(0, 7) === leaveMonth)
  const lq = leaveSearch.trim().toLowerCase()
  const searchedLeaves = !lq ? monthLeaves : monthLeaves.filter(l =>
    [l.employee_code, l.employee_name, l.employee_nickname, l.department, l.leave_type, l.reason].some(v => (v ?? '').toLowerCase().includes(lq)))
  const shownLeaves = lf.apply(pendingFilter ? searchedLeaves.filter(isPending) : searchedLeaves).map(live)
  // ช่องเลือกในรายการลา = ป้าย .dn-pill กดแล้วเมนูครีมคลี่ลง (CreamSelect ชุดเดียวกับหมวดออเดอร์)
  const leavePill = (value: string, opts: string[], onPick: (v: string) => void) => (
    <CreamSelect value={value || ''} onChange={v => { if (v !== value) onPick(v) }}
      className="dn-pill ow-pill" style={{ color: '#6B4326', background: LEAVE_PILL[value]?.bg ?? '#EFE3D4' }} menuMinWidth={170}
      options={Array.from(new Set([...opts, value].filter(Boolean))).map(o => ({ value: o, label: o, color: LEAVE_PILL[o]?.dot }))}
      renderValue={o => <span>{o?.label ?? (value || '—')}</span>} />
  )

  // กดชื่อคนลาในปฏิทิน → เลื่อนลงไปที่แถวใบลานั้นในรายการลา แล้วกระพริบ (ปิดตัวกรอง "รออนุมัติ" ก่อน เผื่อแถวถูกซ่อน)
  const [flashLeave, setFlashLeave] = useState<string | null>(null)
  const jumpToLeave = (id: string) => {
    setDayModal(null)
    // แถวโดนตัวกรองซ่อนอยู่ → ล้างตัวกรองทั้งหมดก่อน จะได้เลื่อนไปเจอ
    if (!shownLeaves.some(l => l.id === id)) { setPendingFilter(false); setLeaveSearch(''); setLeaveMonth('all'); lf.clearFilters() }
    setFlashLeave(null)
    setTimeout(() => {
      document.querySelector(`[data-leave-row="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashLeave(id)
    }, 60)
  }
  useEffect(() => {
    if (!flashLeave) return
    const t = setTimeout(() => setFlashLeave(null), 3200)
    return () => clearTimeout(t)
  }, [flashLeave])
  // ── ปฏิทิน: เลื่อน/ไปวันที่ ──
  const goTo = (dt: Date) => { setYear(dt.getFullYear()); setMonth(dt.getMonth()); setSelDay(dt.getDate()) }
  const shift = (dir: number) => {
    if (view === 'month') goTo(new Date(year, month + dir, 1))
    else goTo(new Date(year, month, selDay + dir * (view === 'week' ? 7 : 1)))
  }
  const openDay = (ymd: string, d: number, y = year, m = month) => {
    const dayLeaves = leaves.filter(l => ymd >= l.leave_date && ymd <= (l.leave_end_date || l.leave_date))
    if (y !== year || m !== month) { setYear(y); setMonth(m) }
    setDayModal({ ymd, day: d, leaves: dayLeaves })
  }
  const weekStart = new Date(year, month, selDay - ((new Date(year, month, selDay).getDay() + 6) % 7))
  const navTitle = view === 'week'
    ? (() => { const e = new Date(weekStart); e.setDate(e.getDate() + 6)
        return weekStart.getMonth() === e.getMonth()
          ? `${weekStart.getDate()}–${e.getDate()} ${TH_MONTHS[e.getMonth()]} ${e.getFullYear() + 543}`
          : `${weekStart.getDate()} ${TH_MONTHS[weekStart.getMonth()].slice(0, 3)}. – ${e.getDate()} ${TH_MONTHS[e.getMonth()].slice(0, 3)}. ${e.getFullYear() + 543}` })()
    : view === 'day' ? `${selDay} ${TH_MONTHS[month]} ${year + 543}`
    : `${TH_MONTHS[month]} ${year + 543}`
  // เดือน = เฉพาะแถวที่มีวันจริง (ไม่ต้องครบ 6 แถว) · สัปดาห์ = 7 ช่องของสัปดาห์ที่เลือก
  const gridCells: ({ y: number; m: number; d: number } | null)[] = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => { const dt = new Date(weekStart); dt.setDate(dt.getDate() + i); return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() } })
    : Array.from({ length: Math.ceil((first + dim) / 7) * 7 }, (_, i) => { const d = i - first + 1; return d > 0 && d <= dim ? { y: year, m: month, d } : null })
  // รายการของวัน → การ์ดในช่อง (ลำดับ: วันหยุด · ร้านปิด · แคมเปญ · RedZone · ใบลา)
  const dayItems = (ymd: string): CalItem[] => {
    const [yy, mm, dd] = ymd.split('-').map(Number)
    const out: CalItem[] = []
    if (HOLIDAYS[ymd]) out.push({ key: 'h', kind: 'holiday', title: HOLIDAYS[ymd], sub: 'วันหยุดร้าน' })
    if (new Date(yy, mm - 1, dd).getDay() === 0) out.push({ key: 's', kind: 'closed', title: 'ร้านปิด', sub: 'วันอาทิตย์' })
    if (CAMPAIGNS[ymd]) out.push({ key: 'c', kind: 'campaign', title: CAMPAIGNS[ymd], sub: 'แคมเปญ' })
    if (RED_ZONES.has(ymd)) out.push({ key: 'r', kind: 'redzone', title: 'RedZone', sub: 'ช่วงห้ามลา' })
    leaves.filter(l => ymd >= l.leave_date && ymd <= (l.leave_end_date || l.leave_date)).forEach(l => out.push({
      key: l.id, kind: 'leave', title: l.employee_nickname || l.employee_name,
      sub: [l.leave_type, l.leave_time].filter(Boolean).join(' · '), status: l.leave_status,
    }))
    return out
  }

  return (
    <div>
      <div className="sc-head">
        <div>
          <h1 className="sc-title">ปฏิทินร้าน</h1>
          <p className="sc-sub">วันหยุด แคมเปญ ช่วงห้ามลา และใบลาของทีม ในที่เดียว</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="sc-btn-ghost" onClick={() => window.print()}>🖨️ ปริ้นปฏิทิน</button>
          <button className="sc-btn-main" onClick={() => setModal(true)}>+ เพิ่มรายการ</button>
        </div>
      </div>

      {/* Calendar — ดีไซน์ตามภาพต้นแบบ: แท็บ เดือน/สัปดาห์/วัน · ช่องมีเส้นบาง · รายการเป็นการ์ดพาสเทลมีจุดสี */}
      <div className="print-area sc-card">
        <div className="sc-toolbar">
          <div className="sc-seg no-print">
            {([['month', 'เดือน'], ['week', 'สัปดาห์'], ['day', 'วัน']] as const).map(([k, l]) => (
              <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
          <div className="sc-nav">
            <button className="sc-circle no-print" onClick={() => shift(-1)} aria-label="ก่อนหน้า">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <h2 className="sc-month">{navTitle}</h2>
            <button className="sc-circle no-print" onClick={() => shift(1)} aria-label="ถัดไป">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <label className="sc-circle no-print" title="เลือกเดือน" style={{ position: 'relative' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
              <input type="month" value={`${year}-${String(month + 1).padStart(2, '0')}`}
                onChange={e => { const [y, m] = e.target.value.split('-').map(Number); if (y && m) goTo(new Date(y, m - 1, 1)) }}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            </label>
            <button className="sc-pill no-print" onClick={() => goTo(new Date())}>วันนี้</button>
          </div>
          <div className="sc-legend">
            {[['#C0564A', 'RedZone'], ['#C79A4B', 'Campaign'], ['#D9AE86', 'วันหยุด'], ['#A8714F', 'ใบลา'], ['#9A9AA6', 'ร้านปิด (อา.)']].map(([c, l]) => (
              <span key={l}><i style={{ background: c }} />{l}</span>
            ))}
          </div>
        </div>

        {view === 'day' ? (
          (() => {
            const ymd = toYMD(year, month, selDay)
            const items = dayItems(ymd)
            return (
              <div className="sc-dayview">
                <div className="sc-dayview-head">{DAYS[(new Date(year, month, selDay).getDay() + 6) % 7]} {selDay} {TH_MONTHS[month]} {year + 543}</div>
                {items.length === 0
                  ? <div className="sc-empty">ไม่มีรายการในวันนี้</div>
                  : items.map(it => <EventChip key={it.key} it={it} big onClick={it.kind === 'leave' ? () => jumpToLeave(it.key) : () => openDay(ymd, selDay)} />)}
              </div>
            )
          })()
        ) : (
          <div className="sc-grid">
            {DAYS.map(d => <div key={d} className="sc-dow">{d}</div>)}
            {gridCells.map((c, i) => {
              if (!c) return <div key={i} className="sc-cell sc-out" />
              const ymd = toYMD(c.y, c.m, c.d)
              const items = dayItems(ymd)
              const isToday = ymd === todayYmd()
              const max = view === 'week' ? 99 : 3
              return (
                <div key={i} className={`sc-cell${view === 'week' ? ' sc-tall' : ''}${isToday ? ' sc-today' : ''}${c.m !== month ? ' sc-dim' : ''}`}
                  onClick={() => openDay(ymd, c.d, c.y, c.m)}>
                  <div className="sc-num">{c.d}</div>
                  {items.slice(0, max).map(it => <EventChip key={it.key} it={it} onClick={it.kind === 'leave' ? () => jumpToLeave(it.key) : undefined} />)}
                  {items.length > max && <div className="sc-more">+{items.length - max} รายการ</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Leave list — แถบเครื่องมือชุดเดียวกับหมวดออเดอร์: ค้นหา + เดือน + เรียง · แท็บ ทั้งหมด / รออนุมัติ + ปุ่มคอลัมน์ชิดขวา */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>รายการลา</h2>
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <SearchPill value={leaveSearch} onChange={setLeaveSearch} placeholder="ค้นหา รหัส / ชื่อ / ชื่อเล่น / แผนก / ประเภท / เหตุผล…" />
        <MonthSelect value={leaveMonth} onChange={setLeaveMonth} months={leaveMonths} title="เดือนที่ลา" />
        <SortSelect cf={lf} defs={leaveDefs} presets={[['date', 'desc'], ['date', 'asc'], ['nickname', 'asc']]} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tab active={!pendingFilter} count={searchedLeaves.length} onClick={() => { setPendingFilter(false); lf.clearFilters() }}
          title={lf.anyFilter ? 'กดเพื่อล้างตัวกรองคอลัมน์' : undefined}>ทั้งหมด</Tab>
        {/* รออนุมัติ = ใบที่ยังไม่มีใครกดอนุมัติ/ไม่อนุมัติ */}
        <Tab active={pendingFilter} count={searchedLeaves.filter(isPending).length} onClick={() => setPendingFilter(true)}
          title="ใบลาที่ยังไม่มีใครกดอนุมัติ/ไม่อนุมัติ">รออนุมัติ</Tab>
        <ColumnPicker cols={LEAVE_COLS} hc={hc} />
      </div>
      {lf.renderMenu(searchedLeaves)}
      <div className="dn-list-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
        {error ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>โหลดข้อมูลไม่สำเร็จ</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>{error}</div>
            <button onClick={() => { setLoading(true); load() }}
              style={{ border: 'none', background: 'var(--blue)', color: '#fff', borderRadius: 10, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>ลองใหม่</button>
          </div>
        ) : loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : shownLeaves.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            {lf.anyFilter ? 'ไม่มีใบลาที่ตรงกับตัวกรองคอลัมน์' : pendingFilter ? 'ไม่มีใบลาที่รออนุมัติ' : 'ไม่มีรายการลา'}
            {lf.anyFilter && <div><button onClick={lf.clearFilters} style={{ marginTop: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--brand)', borderRadius: 999, padding: '6px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>ล้างตัวกรองคอลัมน์</button></div>}
          </div>
        ) : (
          <table className="dn-list" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {LEAVE_COLS.filter(c => hc.show(c.id)).map(c => (
                  <th key={c.id} style={{ textAlign: 'left', padding: '11px 13px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{lf.head(c.id, c.label)}</th>
                ))}
                <th style={{ padding: '11px 13px' }} />
              </tr>
            </thead>
            <tbody>
              {shownLeaves.map(l => (
                <tr key={l.id} data-leave-row={l.id} className={flashLeave === l.id ? 'row-flash' : undefined} style={{ borderBottom: '1px solid var(--border)', background: isPending(l) ? '#C79A4B0f' : undefined }}>
                  {hc.show('code') && (
                  <td style={{ padding: '11px 13px', fontWeight: 700, color: 'var(--blue)' }}>{l.employee_code}</td>
                  )}
                  {hc.show('name') && (
                  <td style={{ padding: '11px 13px' }}>{l.employee_name}</td>
                  )}
                  {hc.show('nickname') && (
                  <td style={{ padding: '11px 13px' }}>{l.employee_nickname}</td>
                  )}
                  {hc.show('department') && (
                  <td style={{ padding: '11px 13px', color: 'var(--ink-3)' }}>{l.department}</td>
                  )}
                  {hc.show('date') && (
                  <td style={{ padding: '11px 13px', whiteSpace: 'nowrap' }}>
                    {l.leave_date ? new Date(l.leave_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    {l.leave_end_date && l.leave_end_date !== l.leave_date && (
                      <> – {new Date(l.leave_end_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}> ({rangeDays(l.leave_date, l.leave_end_date)} วัน)</span></>
                    )}
                  </td>
                  )}
                  {hc.show('type') && (
                  <td style={{ padding: '11px 13px' }}>{l.leave_type}</td>
                  )}
                  {hc.show('reason') && (
                  <td style={{ padding: '11px 13px', color: 'var(--ink-3)', maxWidth: 140 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason || '-'}</div></td>
                  )}
                  {hc.show('cert') && (
                  <td style={{ padding: '11px 13px', whiteSpace: 'nowrap' }}>
                    {l.leave_type !== 'ลาป่วย' ? (
                      <span style={{ color: 'var(--ink-4)' }}>-</span>
                    ) : certBusy === l.id ? (
                      <span style={{ color: 'var(--ink-3)' }}>กำลังอัปโหลด…</span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {l.medical_cert_url && (
                          <a href={l.medical_cert_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>📄 ดู</a>
                        )}
                        <label style={{ color: l.medical_cert_url ? 'var(--ink-3)' : 'var(--blue)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>
                          {l.medical_cert_url ? 'เปลี่ยน' : '+ แนบไฟล์'}
                          <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) attachCert(l, f); e.target.value = '' }} />
                        </label>
                      </span>
                    )}
                  </td>
                  )}
                  {hc.show('status') && (
                  <td style={{ padding: '11px 13px' }}>
                    {leavePill(l.leave_status, LEAVE_STATUS_OPTS, v => updateLeave(l.id, 'leave_status', v))}
                  </td>
                  )}
                  {hc.show('supervisor') && (
                  <td style={{ padding: '11px 13px' }}>
                    {leavePill(l.supervisor_approval, APPROVAL_OPTS, v => updateLeave(l.id, 'supervisor_approval', v))}
                  </td>
                  )}
                  {hc.show('hr') && (
                  <td style={{ padding: '11px 13px' }}>
                    {leavePill(l.hr_approval, APPROVAL_OPTS, v => updateLeave(l.id, 'hr_approval', v))}
                  </td>
                  )}
                  <td style={{ padding: '11px 13px' }}>
                    <button onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setLeaveMenu(m => m?.id === l.id ? null : { id: l.id, rect }) }}
                      title="ตัวเลือก"
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: leaveMenu?.id === l.id ? 'var(--bg)' : '#fff', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1, padding: 0 }}>
                      ···
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* เมนู ··· ของแถวรายการลา */}
      {leaveMenu && (
        <>
          <div onClick={() => setLeaveMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <AnchoredMenu rect={leaveMenu.rect}>
            <button onClick={() => { const id = leaveMenu.id; setLeaveMenu(null); del(id) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--red)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
              ลบ
            </button>
          </AnchoredMenu>
        </>
      )}

      {/* Day detail modal (คลิกวันในปฏิทิน) */}
      {dayModal && (
        <div className="sc-mback" onClick={() => setDayModal(null)}>
          <div className="sc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="sc-mhead">
              <div className="sc-mdate">
                <div className="sc-mday">{dayModal.day}</div>
                <div>
                  <div className="sc-mdow">{['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][new Date(dayModal.ymd + 'T00:00').getDay()]}</div>
                  <div className="sc-mmon">{TH_MONTHS[month]} {year + 543}</div>
                </div>
              </div>
              <button className="sc-mclose" onClick={() => setDayModal(null)} aria-label="ปิด">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {/* แถบสถานะวัน — การ์ดสีเดียวกับในปฏิทิน */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {new Date(dayModal.ymd + 'T00:00').getDay() === 0 && <ModalTag kind="closed" title="ร้านปิด" sub="วันอาทิตย์" />}
              {HOLIDAYS[dayModal.ymd] && <ModalTag kind="holiday" title={HOLIDAYS[dayModal.ymd]} sub="วันหยุดร้าน" />}
              {CAMPAIGNS[dayModal.ymd] && <ModalTag kind="campaign" title={CAMPAIGNS[dayModal.ymd]} sub="แคมเปญ" />}
              {RED_ZONES.has(dayModal.ymd) && <ModalTag kind="redzone" title="RedZone" sub="ช่วงห้ามลา" />}
            </div>

            <div className="sc-msec">การลา <span>{dayModal.leaves.length}</span></div>
            {dayModal.leaves.length === 0 ? (
              <div className="sc-mempty">ไม่มีการลาในวันนี้</div>
            ) : dayModal.leaves.map(l => (
              <div key={l.id} className="sc-mitem sc-link" title="กดเพื่อไปที่ใบลานี้ในรายการลา"
                onClick={e => { if ((e.target as HTMLElement).closest('a')) return; jumpToLeave(l.id) }}>
                <i className="sc-dot" style={{ background: '#A8714F' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span className="sc-mname">{l.employee_nickname || l.employee_name} <small>{l.employee_code}{l.department ? ` · ${l.department}` : ''}</small></span>
                    {l.leave_time && <span className="sc-mtime">{l.leave_time}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                    <span className="sc-mpill">{l.leave_type}</span>
                    {l.leave_status && <span className="sc-mpill" style={{ color: STATUS_COLOR[l.leave_status] || 'var(--ink-3)', background: (STATUS_COLOR[l.leave_status] || '#8B7460') + '1f' }}>{l.leave_status}</span>}
                    {l.leave_end_date && l.leave_end_date !== l.leave_date && <span className="sc-mtime">{rangeDays(l.leave_date, l.leave_end_date)} วัน</span>}
                  </div>
                  {l.reason && <div className="sc-mnote">{l.reason}</div>}
                  {l.medical_cert_url && <a href={l.medical_cert_url} target="_blank" rel="noreferrer" className="sc-mlink">📄 ใบรับรองแพทย์</a>}
                </div>
              </div>
            ))}

            <button className="sc-madd" onClick={() => { setForm(f => ({ ...f, leave_date: dayModal.ymd, leave_end_date: dayModal.ymd })); setDayModal(null); setModal(true) }}>
              + เพิ่มลาในวันนี้
            </button>
          </div>
        </div>
      )}

      {/* Add leave modal */}
      {modal && (
        <div className="sc-mback" onClick={() => { setModal(false); setCertFile(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div className="sc-modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="sc-mtitle">+ เพิ่มรายการลา</h2>

            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>ชื่อพนักงาน (ชื่อเล่น / ชื่อจริง / รหัส)</label>
              <input value={form.nickname} onChange={e => onNicknameChange(e.target.value)} placeholder="พิมพ์เพื่อค้นหา…"
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
                  {suggestions.map(e => (
                    <div key={e.code} onClick={() => selectEmployee(e)}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--blue)', minWidth: 56 }}>{e.code}</span>
                      <span>{e.nickname} — {e.realName}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontSize: 11 }}>{e.dept}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {form.employee_code && (
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: 'var(--ink-3)' }}>รหัส: </span><strong>{form.employee_code}</strong></div>
                <div><span style={{ color: 'var(--ink-3)' }}>แผนก: </span><strong>{form.department}</strong></div>
                <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--ink-3)' }}>ชื่อจริง: </span><strong>{form.employee_name}</strong></div>
                <div style={{ gridColumn: '1/-1' }}>
                  <span style={{ color: 'var(--ink-3)' }}>อายุงาน: </span>
                  <strong>{selTenure == null ? 'ไม่พบวันเริ่มงาน' : tenureText(selTenure)}</strong>
                </div>
                {selTenure != null && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <span style={{ color: 'var(--ink-3)' }}>เงื่อนไขลาพักร้อน: </span>
                    <strong style={{ color: selVacMax === 0 ? 'var(--red)' : '#6F8F6A' }}>
                      {selVacMax === 0 ? 'ยังไม่มีสิทธิ (ทำงานไม่ครบ 1 ปี)' : `ต่อเนื่องได้ไม่เกิน ${selVacMax} วัน/ครั้ง`}
                    </strong>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>วันที่เริ่มลา</label>
                <input type="date" lang="en-GB" value={form.leave_date} onChange={e => {
                    const v = e.target.value
                    // ถ้ายังไม่เลือกวันสิ้นสุด หรือวันสิ้นสุดเดิมก่อนวันเริ่มใหม่ → ตั้งวันสิ้นสุด = วันเริ่ม
                    const end = (!form.leave_end_date || form.leave_end_date < v) ? v : form.leave_end_date
                    setForm(f => ({ ...f, leave_date: v, leave_end_date: end }))
                    checkConflict(v, end, form.department)
                  }}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>วันที่สิ้นสุด</label>
                <input type="date" lang="en-GB" value={form.leave_end_date} min={form.leave_date} onChange={e => { setF('leave_end_date', e.target.value); checkConflict(form.leave_date, e.target.value, form.department) }}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>เวลา</label>
              <input type="time" value={form.leave_time} onChange={e => setF('leave_time', e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {rangeDays(form.leave_date, form.leave_end_date) > 1 && (
              <div style={{ marginTop: -4, marginBottom: 14, fontSize: 12.5, color: 'var(--ink-3)' }}>
                รวม <strong style={{ color: 'var(--ink)' }}>{rangeDays(form.leave_date, form.leave_end_date)} วัน</strong> ({new Date(form.leave_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} – {new Date(form.leave_end_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })})
              </div>
            )}

            {conflict && (
              <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#856404' }}>
                {conflict}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>ประเภทของการลา</label>
              <select value={form.leave_type} onChange={e => setF('leave_type', e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
                <option value="">— เลือก —</option>
                {LEAVE_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
              {form.leave_type === 'ลาพักร้อน' && form.employee_code && (
                <div style={{ marginTop: 8, padding: '9px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                  background: vacBlocked ? '#ff375f11' : '#6F8F6A15',
                  border: `1px solid ${vacBlocked ? '#ff375f44' : '#6F8F6A44'}`,
                  color: vacBlocked ? 'var(--red)' : '#1a7f37' }}>
                  {selTenure == null
                    ? '❌ ไม่พบวันเริ่มงานในระบบ — ยังไม่มีสิทธิลาพักร้อน บันทึกไม่ได้ (ใส่วันเริ่มงานในหมวดพนักงานก่อน)'
                    : vacNoRight
                    ? `❌ อายุงาน ${tenureText(selTenure)} — ทำงานไม่ครบ 1 ปี ยังไม่มีสิทธิลาพักร้อน บันทึกไม่ได้`
                    : vacOverDays
                    ? `❌ เลือกไว้ ${selRangeDays} วัน — เกินสิทธิลาพักร้อนต่อเนื่อง (ไม่เกิน ${selVacMax} วัน/ครั้ง) บันทึกไม่ได้`
                    : `✅ ลาพักร้อนต่อเนื่องได้ไม่เกิน ${selVacMax} วัน/ครั้ง (อายุงาน ${tenureText(selTenure)})`}
                </div>
              )}
            </div>

            {form.leave_type === 'ลาป่วย' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>ใบรับรองแพทย์ <span style={{ color: 'var(--ink-4)' }}>(ไม่บังคับ — แนบทีหลังได้)</span></label>
                <input type="file" accept="image/*,application/pdf" onChange={e => setCertFile(e.target.files?.[0] || null)}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                {certFile && <div style={{ fontSize: 12, color: '#6F8F6A', marginTop: 5 }}>✓ เลือกไฟล์: {certFile.name}</div>}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>เหตุผล</label>
              <textarea value={form.reason} onChange={e => setF('reason', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="sc-mcancel" onClick={() => { setModal(false); setCertFile(null) }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button className="sc-msave" onClick={save} disabled={saving || !form.employee_code || !form.leave_date || !form.leave_type || vacBlocked}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: vacBlocked ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: (!form.employee_code || !form.leave_date || !form.leave_type || vacBlocked) ? 0.5 : 1 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* กล่องยืนยัน (ลบใบลา) — ต้องอยู่ท้ายสุดเพื่อทับทุกโมดัล */}
      {confirmDialog}
    </div>
  )
}

// ── การ์ดรายการในช่องปฏิทิน (สีตามชนิด เหมือนภาพต้นแบบ) ──
type CalItem = { key: string; kind: 'holiday' | 'closed' | 'campaign' | 'redzone' | 'leave'; title: string; sub?: string; status?: string }
function EventChip({ it, big, onClick }: { it: CalItem; big?: boolean; onClick?: () => void }) {
  return (
    <div className={`sc-chip sc-${it.kind}${big ? ' sc-big' : ''}${onClick ? ' sc-link' : ''}`}
      onClick={onClick ? e => { e.stopPropagation(); onClick() } : undefined}
      title={[it.title, it.sub, it.status].filter(Boolean).join(' · ')}>
      <i className="sc-dot" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="sc-chip-title">{it.title}</div>
        {it.sub && <div className="sc-chip-sub">{it.sub}</div>}
      </div>
      <svg className="sc-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </div>
  )
}

// แถบสถานะวันในหน้าต่างรายละเอียดวัน (สีเดียวกับการ์ดในปฏิทิน)
function ModalTag({ kind, title, sub }: { kind: CalItem['kind']; title: string; sub: string }) {
  return (
    <div className={`sc-chip sc-${kind}`} style={{ padding: '10px 14px', cursor: 'default' }}>
      <i className="sc-dot" />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div className="sc-chip-title" style={{ fontSize: 13 }}>{title}</div>
        <div className="sc-chip-sub" style={{ marginTop: 0, fontSize: 12 }}>{sub}</div>
      </div>
    </div>
  )
}
