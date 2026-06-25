'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fetchStaffList, type Staff } from '@/lib/staffDb'

const n = (v: number | null | undefined) => (v == null ? '—' : String(v))

// เซลล์คงเหลือ: ตัวใหญ่ = คงเหลือ, ตัวเล็ก = /ทั้งหมด · ใช้ไป
function Bal({ left, avail, used }: { left: number | null; avail: number | null; used?: number | null }) {
  if (left == null && avail == null) return <span style={{ color: 'var(--ink-4)' }}>—</span>
  const low = left != null && avail != null && left <= avail * 0.25
  return (
    <span>
      <b style={{ color: low ? 'var(--red)' : 'var(--ink)', fontSize: 14 }}>{n(left)}</b>
      <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>/{n(avail)}</span>
      {used != null && used > 0 && <span style={{ color: 'var(--ink-3)', fontSize: 11 }}> · ใช้ {used}</span>}
    </span>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [div, setDiv] = useState('')

  useEffect(() => {
    fetchStaffList()
      .then(setStaff)
      .catch((e) => setError(e?.message?.includes('staff') || e?.code === '42P01' ? 'ยังไม่ได้รัน scripts/add_staff_table.sql + migrate_staff_from_sheet.mjs' : (e?.message || 'เชื่อมต่อไม่ได้')))
      .finally(() => setLoading(false))
  }, [])

  const divisions = useMemo(() => [...new Set(staff.map((s) => s.division).filter(Boolean))] as string[], [staff])

  const stats = useMemo(() => ({
    total: staff.length,
    positions: new Set(staff.map((s) => s.position).filter(Boolean)).size,
    warnings: staff.filter((s) => s.warning).length,
    late: staff.filter((s) => (s.late || 0) > 0).length,
    lowVac: staff.filter((s) => s.vacation.left != null && s.vacation.left <= 1).length,
  }), [staff])

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return staff.filter((s) => {
      if (div && s.division !== div) return false
      if (!kw) return true
      return [s.code, s.name, s.nickname, s.position, s.division].some((v) => (v || '').toLowerCase().includes(kw))
    })
  }, [staff, q, div])

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>พนักงาน</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 20, fontSize: 14 }}>
        ข้อมูลพนักงานและสิทธิการลา
      </p>

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'พนักงานทั้งหมด', value: stats.total, color: 'var(--blue)' },
            { label: 'ตำแหน่ง', value: stats.positions, color: 'var(--ink)' },
            { label: 'มีใบเตือน', value: stats.warnings, color: stats.warnings ? 'var(--red)' : 'var(--ink)' },
            { label: 'มาสาย', value: stats.late, color: stats.late ? 'var(--red)' : 'var(--ink)' },
            { label: 'พักร้อนเหลือ ≤1', value: stats.lowVac, color: stats.lowVac ? 'var(--yellow)' : 'var(--ink)' },
          ].map((c) => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ / ชื่อเล่น / รหัส / ตำแหน่ง"
          style={{ flex: 1, minWidth: 220, padding: '9px 13px', border: '1px solid var(--border-2)', borderRadius: 9, fontSize: 14, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}
        />
        <select value={div} onChange={(e) => setDiv(e.target.value)}
          style={{ padding: '9px 13px', border: '1px solid var(--border-2)', borderRadius: 9, fontSize: 14, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}>
          <option value="">แยกตามเนื้องาน (ทั้งหมด)</option>
          {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading && <div style={{ color: 'var(--ink-3)', padding: 24 }}>กำลังโหลด…</div>}
      {error && <div style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, padding: '12px 16px' }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>}

      {!loading && !error && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>รหัส</th>
                <th style={th}>ชื่อเล่น</th>
                <th style={th}>ตำแหน่ง</th>
                <th style={{ ...th, textAlign: 'center' }}>ลาป่วย</th>
                <th style={{ ...th, textAlign: 'center' }}>ลากิจ</th>
                <th style={{ ...th, textAlign: 'center' }}>ลาพักร้อน</th>
                <th style={{ ...th, textAlign: 'center' }}>WOP<br /><span style={{ fontWeight: 400 }}>เต็ม/ครึ่ง/ชม.</span></th>
                <th style={{ ...th, textAlign: 'center' }}>มาสาย</th>
                <th style={{ ...th, textAlign: 'center' }}>ใบเตือน</th>
                <th style={th}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.code}>
                  <td style={{ ...td, color: 'var(--blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.code}</td>
                  <td style={td}>
                    <Link href={`/staff/${s.code}`} style={{ textDecoration: 'none', color: 'var(--blue)', fontWeight: 600 }}>
                      {s.nickname || s.name || '—'}
                    </Link>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{s.position || '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}><Bal left={s.sick.left} avail={s.sick.avail} used={s.sick.used} /></td>
                  <td style={{ ...td, textAlign: 'center' }}><Bal left={s.personal.left} avail={s.personal.avail} /></td>
                  <td style={{ ...td, textAlign: 'center' }}><Bal left={s.vacation.left} avail={s.vacation.avail} used={s.vacation.used} /></td>
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>{n(s.wop.full)}/{n(s.wop.half)}/{n(s.wop.hours)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{s.late ? <b style={{ color: 'var(--red)' }}>{s.late}</b> : <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{s.warning ? <b style={{ color: 'var(--red)' }}>{s.warning}</b> : <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--ink-3)', minWidth: 180 }}>{s.note || ''}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: 'var(--ink-3)', padding: 32 }}>ไม่พบพนักงาน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
