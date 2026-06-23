'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HOLIDAYS } from '@/lib/holidays'
import { EMPLOYEES } from '@/lib/staff'

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
  created_at: string
}

// RedZone dates (YYYY-MM-DD)
const RED_ZONES = new Set(['2026-01-02','2026-01-03','2026-01-16','2026-01-17','2026-01-26','2026-01-27','2026-01-28','2026-02-03','2026-02-04','2026-02-05','2026-02-16','2026-02-17','2026-02-18','2026-02-26','2026-02-27','2026-02-28','2026-03-04','2026-03-05','2026-03-16','2026-03-17','2026-03-26','2026-03-27','2026-04-06','2026-04-07','2026-04-08','2026-04-16','2026-04-17','2026-04-18','2026-04-27','2026-04-28','2026-04-29','2026-05-06','2026-05-07','2026-05-18','2026-05-19','2026-05-20','2026-05-26','2026-05-27','2026-05-28','2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-16','2026-06-17','2026-06-18','2026-06-26','2026-06-27','2026-07-08','2026-07-09','2026-07-10','2026-07-16','2026-07-17','2026-07-18','2026-07-27','2026-07-28','2026-07-29','2026-07-30','2026-07-31','2026-08-10','2026-08-11','2026-08-12','2026-08-13','2026-08-14','2026-08-17','2026-08-18','2026-08-19','2026-08-26','2026-08-27','2026-08-28','2026-09-10','2026-09-11','2026-09-12','2026-09-16','2026-09-17','2026-09-18','2026-09-28','2026-09-29','2026-09-30','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-26','2026-10-27','2026-10-28','2026-11-16','2026-11-17','2026-11-18','2026-11-26','2026-11-27','2026-11-28','2026-12-16','2026-12-17','2026-12-18'])

const CAMPAIGNS: Record<string, string> = {'2026-07-25':'Payday','2026-08-08':'Fashion and Beauty Sale','2026-08-15':'Mid month Sale','2026-08-25':'Payday','2026-09-09':'SuperShoping Day','2026-09-15':'Mid month Sale','2026-09-25':'Payday','2026-10-10':'Brand Festival','2026-10-15':'Mid month Sale','2026-10-25':'Payday','2026-11-11':'Big Sale','2026-11-15':'Mid month Sale','2026-11-25':'Payday','2026-12-12':'BirthDay Sale','2026-12-15':'Mid month Sale','2026-12-25':'Payday'}


const DAYS = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function toYMD(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// จำนวนวันแบบนับรวมหัวท้าย (เช่น 23→25 = 3 วัน); คืน 0 ถ้าข้อมูลไม่ครบ/วันสิ้นสุดก่อนวันเริ่ม
function rangeDays(start: string, end: string): number {
  if (!start) return 0
  const e = end || start
  const diff = Math.round((new Date(e + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000)
  return diff < 0 ? 0 : diff + 1
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
  DN034:'2026-01-27',
}

// อายุงานเป็นวัน (วันนี้ − วันเริ่มงาน); null = ไม่พบวันเริ่มงาน
function tenureDays(code: string): number | null {
  const s = START_DATES[code]
  if (!s) return null
  return Math.floor((Date.now() - new Date(s + 'T00:00:00').getTime()) / 86400000)
}

// เงื่อนไขลาพักร้อน: คืนจำนวนวันต่อเนื่องสูงสุดต่อครั้ง (0 = ยังไม่มีสิทธิ)
// ยึดตามสูตรใน Google Sheet 'ชีทบันทึกการลา' คอลัมน์ H (อายุงาน = วันยื่นลา − วันเริ่มงาน):
//   ≤365 ไม่มีสิทธิ (ไม่ครบ 1 ปี) · ≤730 ไม่เกิน 3 · ≤1095 ไม่เกิน 4 · มากกว่านั้น 6
// (ในชีท >1460 คืนค่าว่าง ซึ่งดูเป็นบั๊ก — ที่นี่ให้ >1095 ได้ 6 ตามเจตนา ไม่ปล่อยว่าง)
function vacationMaxDays(days: number): number {
  if (days <= 365) return 0
  if (days <= 730) return 3
  if (days <= 1095) return 4
  return 6
}

// ข้อความอายุงาน เช่น "4 ปี 28 วัน"
function tenureText(days: number): string {
  const y = Math.floor(days / 365), d = days % 365
  return y > 0 ? `${y} ปี ${d} วัน` : `${d} วัน`
}

export default function EmployeesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nickname: '', employee_code: '', employee_name: '', department: '', leave_date: '', leave_end_date: '', leave_time: '08:00', leave_type: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState('')
  const [suggestions, setSuggestions] = useState<typeof EMPLOYEES>([])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('leave_requests').select('*').order('leave_date', { ascending: false })
    setLeaves((data ?? []) as Leave[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const onNicknameChange = (val: string) => {
    setF('nickname', val)
    if (val.length < 1) { setSuggestions([]); return }
    const matches = EMPLOYEES.filter(e =>
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
    const { data } = await supabase.from('leave_requests').select('employee_nickname, leave_date, leave_end_date').eq('department', dept)
    const overlap = (data ?? []).filter((d: any) => {
      const ds = d.leave_date
      const de = d.leave_end_date || d.leave_date
      return ds <= e && de >= start // ช่วงทับซ้อนกัน
    })
    if (overlap.length > 0) {
      setConflict(`⚠️ มีพนักงานขอหยุดแล้วในช่วงดังกล่าวโปรดพิจารณาเลือกวันอื่น (${[...new Set(overlap.map((d: any) => d.employee_nickname))].join(', ')})`)
    } else setConflict('')
  }

  const save = async () => {
    // กันลาพักร้อนเมื่อยังไม่มีสิทธิ / เกินจำนวนวันต่อเนื่อง (เผื่อปุ่มถูกข้าม)
    const td = form.employee_code ? tenureDays(form.employee_code) : null
    if (form.leave_type === 'ลาพักร้อน' && td != null) {
      const max = vacationMaxDays(td)
      if (max === 0) return
      if (rangeDays(form.leave_date, form.leave_end_date) > max) return
    }
    setSaving(true)
    await supabase.from('leave_requests').insert({
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
    })
    setSaving(false)
    setModal(false)
    setForm({ nickname: '', employee_code: '', employee_name: '', department: '', leave_date: '', leave_end_date: '', leave_time: '08:00', leave_type: '', reason: '' })
    load()
  }

  const del = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('leave_requests').delete().eq('id', id)
    load()
  }

  const updateLeave = async (id: string, field: string, val: string) => {
    await supabase.from('leave_requests').update({ [field]: val }).eq('id', id)
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
  const vacNoRight = form.leave_type === 'ลาพักร้อน' && selVacMax === 0
  const vacOverDays = form.leave_type === 'ลาพักร้อน' && selVacMax != null && selVacMax > 0 && selRangeDays > selVacMax
  const vacBlocked = vacNoRight || vacOverDays

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>ปฏิทินร้าน</h1>
        <button onClick={() => setModal(true)}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3)' }}>
          + เพิ่มรายการ
        </button>
      </div>

      {/* Calendar */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={prevMonth} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, background: '#fff' }}>‹</button>
          <h2 style={{ fontSize: 17, fontWeight: 600, flex: 1, textAlign: 'center', color: 'var(--ink)' }}>{TH_MONTHS[month]} {year + 543}</h2>
          <button onClick={nextMonth} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, background: '#fff' }}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
          {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '6px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const ymd = toYMD(year, month, day)
            const isRedZone = RED_ZONES.has(ymd)
            const campaign = CAMPAIGNS[ymd]
            const holiday = HOLIDAYS[ymd]
            const dayLeaves = leaves.filter(l => ymd >= l.leave_date && ymd <= (l.leave_end_date || l.leave_date))
            const isToday = ymd === new Date().toISOString().split('T')[0]
            const isSunday = new Date(year, month, day).getDay() === 0

            let bg = '#fff'
            if (holiday) bg = '#fff9e6'
            else if (campaign) bg = '#fff3e6'
            else if (isRedZone) bg = '#fff0f0'
            else if (isSunday) bg = '#f4f4f5'

            return (
              <div key={i} style={{ minHeight: 85, background: bg, borderRadius: 8, padding: '6px 7px', border: isToday ? '2px solid var(--blue)' : '1px solid rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--blue)' : 'var(--ink)', marginBottom: 2 }}>{day}</div>
                {isSunday && <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>ร้านปิด</div>}
                {holiday && <div style={{ fontSize: 9, color: '#b45309', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{holiday}</div>}
                {campaign && <div style={{ fontSize: 9, color: '#c2510a', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{campaign}</div>}
                {dayLeaves.slice(0, 2).map(l => (
                  <div key={l.id} style={{ background: 'var(--blue)22', borderLeft: '2px solid var(--blue)', borderRadius: 2, padding: '1px 4px', fontSize: 9, color: 'var(--blue)', fontWeight: 600, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.employee_nickname} ({l.leave_type?.replace('ลา', '')})
                  </div>
                ))}
                {dayLeaves.length > 2 && <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>+{dayLeaves.length - 2}</div>}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          {[['var(--red)','RedZone'],['#f59e0b','Campaign'],['#eab308','วันหยุด'],['var(--blue)','ใบลา'],['#9ca3af','ร้านปิด (อา.)']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leave list */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>รายการลา</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : leaves.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>ไม่มีรายการลา</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {['รหัส','ชื่อ-นามสกุล','ชื่อเล่น','แผนก','วันที่ลา','ประเภท','เหตุผล','สถานะ','หัวหน้า','บุคคล',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 13px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 13px', fontWeight: 700, color: 'var(--blue)' }}>{l.employee_code}</td>
                  <td style={{ padding: '11px 13px' }}>{l.employee_name}</td>
                  <td style={{ padding: '11px 13px' }}>{l.employee_nickname}</td>
                  <td style={{ padding: '11px 13px', color: 'var(--ink-3)' }}>{l.department}</td>
                  <td style={{ padding: '11px 13px', whiteSpace: 'nowrap' }}>
                    {l.leave_date ? new Date(l.leave_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    {l.leave_end_date && l.leave_end_date !== l.leave_date && (
                      <> – {new Date(l.leave_end_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}> ({rangeDays(l.leave_date, l.leave_end_date)} วัน)</span></>
                    )}
                  </td>
                  <td style={{ padding: '11px 13px' }}>{l.leave_type}</td>
                  <td style={{ padding: '11px 13px', color: 'var(--ink-3)', maxWidth: 140 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason || '-'}</div></td>
                  <td style={{ padding: '11px 13px' }}>
                    <select value={l.leave_status} onChange={e => updateLeave(l.id, 'leave_status', e.target.value)}
                      style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 11, outline: 'none' }}>
                      {['ใบลาเรียบร้อย','ยังไม่เขียนไปลา','รออนุมัติ'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '11px 13px' }}>
                    <select value={l.supervisor_approval} onChange={e => updateLeave(l.id, 'supervisor_approval', e.target.value)}
                      style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 11, outline: 'none', color: l.supervisor_approval === 'อนุมัติ' ? '#34c759' : l.supervisor_approval === 'ไม่อนุมัติ' ? 'var(--red)' : 'var(--ink-3)' }}>
                      {['รออนุมัติ','อนุมัติ','ไม่อนุมัติ'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '11px 13px' }}>
                    <select value={l.hr_approval} onChange={e => updateLeave(l.id, 'hr_approval', e.target.value)}
                      style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 11, outline: 'none', color: l.hr_approval === 'อนุมัติ' ? '#34c759' : l.hr_approval === 'ไม่อนุมัติ' ? 'var(--red)' : 'var(--ink-3)' }}>
                      {['รออนุมัติ','อนุมัติ','ไม่อนุมัติ'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '11px 13px' }}>
                    <button onClick={() => del(l.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ff375f22', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add leave modal */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>+ เพิ่มรายการลา</h2>

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
                    <strong style={{ color: selVacMax === 0 ? 'var(--red)' : '#34c759' }}>
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
                {['ลาป่วย','ลากิจเต็มวัน','ลากิจครึ่งวัน','ลาพักร้อน','WOPเต็มวัน','WOPครึ่งวัน','WOPรายชั่วโมง','มาสาย'].map(o => <option key={o}>{o}</option>)}
              </select>
              {form.leave_type === 'ลาพักร้อน' && selTenure != null && (
                <div style={{ marginTop: 8, padding: '9px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                  background: vacBlocked ? '#ff375f11' : '#34c75915',
                  border: `1px solid ${vacBlocked ? '#ff375f44' : '#34c75944'}`,
                  color: vacBlocked ? 'var(--red)' : '#1a7f37' }}>
                  {vacNoRight
                    ? `❌ อายุงาน ${tenureText(selTenure)} — ทำงานไม่ครบ 1 ปี ยังไม่มีสิทธิลาพักร้อน บันทึกไม่ได้`
                    : vacOverDays
                    ? `❌ เลือกไว้ ${selRangeDays} วัน — เกินสิทธิลาพักร้อนต่อเนื่อง (ไม่เกิน ${selVacMax} วัน/ครั้ง) บันทึกไม่ได้`
                    : `✅ ลาพักร้อนต่อเนื่องได้ไม่เกิน ${selVacMax} วัน/ครั้ง (อายุงาน ${tenureText(selTenure)})`}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>เหตุผล</label>
              <textarea value={form.reason} onChange={e => setF('reason', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving || !form.employee_code || !form.leave_date || !form.leave_type || vacBlocked}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: vacBlocked ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: (!form.employee_code || !form.leave_date || !form.leave_type || vacBlocked) ? 0.5 : 1 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
