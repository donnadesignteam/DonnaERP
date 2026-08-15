'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fetchStaffList, hasVacationRight, createStaff, setStaffActive, type Staff, type NewStaff } from '@/lib/staffDb'
import StaffTabs from '@/components/StaffTabs'
import { isOwnerLogin } from '@/lib/adminActor'
import { useConfirm } from '@/components/ConfirmDialog'

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

const btnPlain: React.CSSProperties = { border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }
const menuItem: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 7 }
const modalInput: React.CSSProperties = { width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)' }

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

const EMPTY_NEW: NewStaff = { code: '', name: '', nickname: '', position: '', division: '', start_date: '' }

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [div, setDiv] = useState('')
  // เพิ่ม/ลบพนักงาน = เห็นเฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน (พนักงานที่ล็อกอินด้วยรหัสตัวเองไม่เห็นปุ่ม)
  const [owner, setOwner] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)   // แถวที่เปิดเมนู ···
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<NewStaff>(EMPTY_NEW)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const { ask, confirmDialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      setStaff(await fetchStaffList())
      setError('')
    } catch (e) {
      const err = e as { message?: string; code?: string }
      setError(err?.message?.includes('staff') || err?.code === '42P01' ? 'ยังไม่ได้รัน scripts/add_staff_table.sql + migrate_staff_from_sheet.mjs' : (err?.message || 'เชื่อมต่อไม่ได้'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // อ่านคุกกี้ล็อกอินหลัง mount (ฝั่งเซิร์ฟเวอร์ไม่มี document — อ่านตอน render จะทำให้ hydrate ไม่ตรง)
    const init = async () => { setOwner(isOwnerLogin()); await load() }
    void init()
  }, [])

  const addStaff = async () => {
    const code = form.code.trim().toUpperCase()
    if (!code) { setMsg('ต้องใส่รหัสพนักงาน เช่น DN038'); return }
    if (staff.some((s) => s.code === code)) { setMsg(`มีรหัส ${code} อยู่แล้ว`); return }
    setSaving(true); setMsg('')
    try {
      await createStaff({ ...form, code })
      setAddOpen(false); setForm(EMPTY_NEW)
      await load()
    } catch (e) {
      setMsg((e as { message?: string })?.message || 'เพิ่มไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  // ลบ = เอาออกจากรายชื่อ (active:false) — ประวัติลา/ประวัติการแก้ไขยังอยู่ครบ กู้คืนได้ที่ฐานข้อมูล
  const removeStaff = async (s: Staff) => {
    setMenuFor(null)
    const who = `${s.nickname || s.name || ''} (${s.code})`
    if (!(await ask(`ลบ ${who} ออกจากรายชื่อ?\n\nชื่อจะหายจากหมวดพนักงานและล็อกอินไม่ได้อีก แต่ประวัติลา/ประวัติการแก้ไขยังอยู่ครบ`, { okText: 'ลบออกจากรายชื่อ', danger: true }))) return
    try { await setStaffActive(s.code, false); await load() }
    catch (e) { setMsg((e as { message?: string })?.message || 'ลบไม่สำเร็จ') }
  }

  const divisions = useMemo(() => [...new Set(staff.map((s) => s.division).filter(Boolean))] as string[], [staff])

  // ตัวเลขสรุปนับเฉพาะคนที่ยังอยู่ในรายชื่อ (ไม่รวมคนที่ลบแล้ว ถึงจะกดโชว์อยู่ก็ตาม)
  const stats = useMemo(() => ({
    total: staff.filter((s) => s.active).length,
    positions: new Set(staff.map((s) => s.position).filter(Boolean)).size,
    warnings: staff.filter((s) => s.warning).length,
    late: staff.filter((s) => (s.late || 0) > 0).length,
    // นับเฉพาะคนที่มีสิทธิพักร้อนแล้ว (ทำงานครบ 365 วัน)
    lowVac: staff.filter((s) => hasVacationRight(s.start_date) && s.vacation.left != null && s.vacation.left <= 1).length,
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
      {menuFor && <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>พนักงาน</h1>
          <p style={{ color: 'var(--ink-3)', marginBottom: 16, fontSize: 14 }}>
            ข้อมูลพนักงานและสิทธิการลา
          </p>
        </div>
        {owner && (
          <button onClick={() => { setMsg(''); setAddOpen(true) }}
            style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            + เพิ่มพนักงาน
          </button>
        )}
      </div>

      {msg && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}>✕</button>
        </div>
      )}

      <StaffTabs />

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
                {owner && <th style={{ ...th, textAlign: 'center' }}>จัดการ</th>}
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
                  <td style={{ ...td, textAlign: 'center' }}>
                    {hasVacationRight(s.start_date)
                      ? <Bal left={s.vacation.left} avail={s.vacation.avail} used={s.vacation.used} />
                      : <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>ยังไม่มีสิทธิ</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>{n(s.wop.full)}/{n(s.wop.half)}/{n(s.wop.hours)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{s.late ? <b style={{ color: 'var(--red)' }}>{s.late}</b> : <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{s.warning ? <b style={{ color: 'var(--red)' }}>{s.warning}</b> : <span style={{ color: 'var(--ink-4)' }}>—</span>}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--ink-3)', minWidth: 180 }}>{s.note || ''}</td>
                  {owner && (
                    <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap', position: 'relative' }}>
                      <button onClick={() => setMenuFor(menuFor === s.code ? null : s.code)} title="ตัวเลือก"
                        style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '2px 8px', borderRadius: 8 }}>···</button>
                      {menuFor === s.code && (
                        <div style={{ position: 'absolute', top: '100%', right: 8, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 4, minWidth: 120, textAlign: 'left' }}>
                          <Link href={`/staff/${s.code}?edit=1`} onClick={() => setMenuFor(null)} style={{ ...menuItem, color: 'var(--ink)', textDecoration: 'none' }}>แก้ไข</Link>
                          <button onClick={() => removeStaff(s)} style={{ ...menuItem, color: 'var(--red)' }}>ลบ</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={owner ? 11 : 10} style={{ ...td, textAlign: 'center', color: 'var(--ink-3)', padding: 32 }}>ไม่พบพนักงาน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ป๊อปอัปเพิ่มพนักงาน — เห็นเฉพาะบัญชีร้าน */}
      {addOpen && owner && (
        <div onClick={() => setAddOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, width: 420, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>เพิ่มพนักงาน</h2>
            {msg && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12.5 }}>{msg}</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              {([
                ['รหัสพนักงาน (เช่น DN038)', 'code', 'text'],
                ['ชื่อ-นามสกุล', 'name', 'text'],
                ['ชื่อเล่น', 'nickname', 'text'],
                ['ตำแหน่ง', 'position', 'text'],
              ] as [string, keyof NewStaff, string][]).map(([label, k, type]) => (
                <div key={k}>
                  <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={modalInput} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>เนื้องาน</label>
                <select value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} style={modalInput}>
                  <option value="">—</option><option value="ธุรการ">ธุรการ</option><option value="ปฏิบัติการ">ปฏิบัติการ</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>วันเริ่มงาน (ใช้เป็นรหัสผ่านล็อกอินของพนักงาน)</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={modalInput} />
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.6 }}>
              สิทธิลาตั้งต้น: ลาป่วย 30 · ลากิจ 1 · พักร้อน 0 (ปีแรกยังไม่มีสิทธิ) — แก้ตัวเลขได้ในหน้าประวัติรายคน
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setAddOpen(false)} style={{ ...btnPlain, padding: '9px 18px', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={addStaff} disabled={saving}
                style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'กำลังบันทึก…' : 'เพิ่มพนักงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  )
}
