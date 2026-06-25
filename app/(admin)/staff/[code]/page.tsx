'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchStaffOne, type Staff } from '@/lib/staffDb'

type Leave = { filed: string | null; date: string | null; time: string | null; type: string | null; reason: string | null; status: string | null; supervisor: string | null }
type Scan = { order_number: string; customer_name: string | null; status: string | null; stages: string[]; last: string | null }
type AdminOrder = { order_number: string | null; customer_name: string | null; platform: string | null; status: string | null; price: number; category: string }
type Claim = { order_number: string | null; customer: string | null; type: string | null; status: string | null }
type CatSum = { cat: string; count: number; sales: number }
type OrderSummary = { count: number; sales: number; byCat: CatSum[] }
type Work = { scans: Scan[]; orders: AdminOrder[]; claims: Claim[]; orderSummary: OrderSummary }

const PLATFORMS = ['Shopee', 'Tiktok', 'Lazada']
const categorize = (platform: string | null, isInstall: boolean) =>
  isInstall ? 'ติดตั้ง' : PLATFORMS.includes(platform || '') ? 'แพลตฟอร์ม' : 'งานนอก'

const n = (v: number | null | undefined) => (v == null ? '—' : String(v))
const baht = (v: number) => '฿' + v.toLocaleString('th-TH')

function BalanceCard({ title, left, avail, used, color }: { title: string; left: number | null; avail: number | null; used: number | null; color: string }) {
  const pct = avail && avail > 0 && used != null ? Math.min(100, Math.round((used / avail) * 100)) : 0
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 0' }}>
        <span style={{ fontSize: 30, fontWeight: 700, color }}>{n(left)}</span>
        <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>/ {n(avail)} วัน</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 7 }}>ใช้ไป {n(used)} วัน</div>
    </div>
  )
}

const stat = (label: string, value: string, color = 'var(--ink)'): React.ReactElement => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, boxShadow: 'var(--shadow)' }}>
    <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 8 }}>{value}</div>
  </div>
)

const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)' }

const STATUS_COLOR: Record<string, string> = { 'อนุมัติ': 'var(--green)', 'ใบลาเรียบร้อย': 'var(--green)', 'ไม่อนุมัติ': 'var(--red)' }

// ===== ฟอร์มแก้ไข =====
type Form = Record<string, string | boolean>
const NUM_FIELDS: { k: string; label: string }[] = [
  { k: 'sick_avail', label: 'ลาป่วยที่ใช้ได้' }, { k: 'sick_used', label: 'ลาป่วยใช้ไป' }, { k: 'sick_left', label: 'ลาป่วยคงเหลือ' },
  { k: 'personal_avail', label: 'ลากิจที่ใช้ได้' }, { k: 'personal_full', label: 'ลากิจเต็มวัน' }, { k: 'personal_half', label: 'ลากิจครึ่งวัน' }, { k: 'personal_left', label: 'ลากิจคงเหลือ' },
  { k: 'vacation_avail', label: 'พักร้อนที่ใช้ได้' }, { k: 'vacation_used', label: 'พักร้อนใช้ไป' }, { k: 'vacation_left', label: 'พักร้อนคงเหลือ' },
  { k: 'wop_full', label: 'WOP เต็มวัน' }, { k: 'wop_half', label: 'WOP ครึ่งวัน' }, { k: 'wop_hours', label: 'WOP ชั่วโมง' },
  { k: 'late', label: 'มาสาย (ครั้ง)' },
]

function staffToForm(s: Staff): Form {
  return {
    position: s.position || '', division: s.division || '', active: s.active, start_date: s.start_date || '',
    warning: s.warning || '', note: s.note || '',
    sick_avail: s.sick.avail ?? '', sick_used: s.sick.used ?? '', sick_left: s.sick.left ?? '',
    personal_avail: s.personal.avail ?? '', personal_full: s.personal.full ?? '', personal_half: s.personal.half ?? '', personal_left: s.personal.left ?? '',
    vacation_avail: s.vacation.avail ?? '', vacation_used: s.vacation.used ?? '', vacation_left: s.vacation.left ?? '',
    wop_full: s.wop.full ?? '', wop_half: s.wop.half ?? '', wop_hours: s.wop.hours ?? '',
    late: s.late ?? '',
  } as Form
}

export default function StaffDetailPage() {
  const { code } = useParams<{ code: string }>()
  const [emp, setEmp] = useState<Staff | null>(null)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [work, setWork] = useState<Work | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Form>({})
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const s = await fetchStaffOne(code)
      if (!s) { setError('ไม่พบพนักงาน'); setLoading(false); return }
      setEmp(s)
      const cc = code.toUpperCase()
      const nickname = s.nickname

      // ยิงพร้อมกัน: ประวัติลา + สแกน + ออเดอร์ที่รับผิดชอบ (เดิมยิงเรียงกันทำให้ช้า)
      const [lvR, scR, aoR] = await Promise.all([
        supabase.from('leave_requests').select('*').eq('employee_code', cc).order('leave_date', { ascending: false }),
        supabase.from('production_scans').select('order_number, stage, status, scanned_at').eq('tech_code', cc),
        nickname
          ? supabase.from('order_entries').select('order_number, customer_name, platform, is_installation, order_status, price, updated_at').eq('admin_name', nickname).order('updated_at', { ascending: false })
          : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      ])

      // ประวัติลา
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLeaves((lvR.data || []).map((l: any) => ({
        filed: null, date: l.leave_date, time: l.leave_time, type: l.leave_type,
        reason: l.reason, status: l.leave_status, supervisor: l.supervisor_approval,
      })))

      // งานช่าง — เตรียมเลขออเดอร์จากการสแกน
      const scValid = ((scR.data as { order_number: string; stage: string | null; status: string | null; scanned_at: string | null }[]) || []).filter((s2) => s2.order_number && !String(s2.order_number).startsWith('http'))
      const scNums = [...new Set(scValid.map((s2) => s2.order_number))]

      // แอดมิน — ออเดอร์ที่รับผิดชอบ
      const orders: AdminOrder[] = (aoR.data || [])
        .filter((o) => !String((o as { platform?: string }).platform || '').startsWith('เคลม:'))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((o: any) => ({
          order_number: o.order_number, customer_name: o.customer_name, platform: o.platform,
          status: o.order_status, price: typeof o.price === 'number' ? o.price : Number(o.price) || 0,
          category: categorize(o.platform, !!o.is_installation),
        }))
      const CATS = ['แพลตฟอร์ม', 'งานนอก', 'ติดตั้ง']
      const orderSummary: OrderSummary = {
        count: orders.length,
        sales: orders.reduce((sum, o) => sum + o.price, 0),
        byCat: CATS.map((cat) => {
          const list = orders.filter((o) => o.category === cat)
          return { cat, count: list.length, sales: list.reduce((sum, o) => sum + o.price, 0) }
        }).filter((c) => c.count > 0),
      }

      // เฟส 2 (ยิงพร้อมกัน): ออเดอร์ของเลขที่สแกน + เคลมที่ผูกกับออเดอร์แอดมิน
      const orderNums = orders.map((o) => o.order_number).filter(Boolean) as string[]
      const [scOeR, clR] = await Promise.all([
        scNums.length
          ? supabase.from('order_entries').select('order_number, customer_name, order_status').in('order_number', scNums)
          : Promise.resolve({ data: [] as { order_number: string; customer_name: string | null; order_status: string | null }[] }),
        orderNums.length
          ? supabase.from('claims').select('original_order_number, customer_username, claim_type, status').in('original_order_number', orderNums)
          : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      ])

      // งานช่าง — ประกอบกับชื่อลูกค้า/สถานะออเดอร์
      const oeMap = new Map((scOeR.data || []).map((o) => [o.order_number, o]))
      const scans: Scan[] = scNums.map((num) => {
        const items = scValid.filter((s2) => s2.order_number === num)
        const o = oeMap.get(num)
        return {
          order_number: num, customer_name: o?.customer_name || null,
          status: o?.order_status || items[items.length - 1]?.status || null,
          stages: [...new Set(items.map((s2) => s2.stage).filter(Boolean))] as string[],
          last: items.map((s2) => s2.scanned_at).sort().slice(-1)[0] || null,
        }
      }).sort((a, b) => String(b.last).localeCompare(String(a.last)))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const claims: Claim[] = (clR.data || []).map((c: any) => ({ order_number: c.original_order_number, customer: c.customer_username, type: c.claim_type, status: c.status }))

      setWork({ scans, orders, claims, orderSummary })
    } catch (e) {
      const err = e as { message?: string; code?: string }
      setError(err?.message?.includes('staff') || err?.code === '42P01' ? 'ยังไม่ได้รัน staff migration (add_staff_table.sql + migrate_staff_from_sheet.mjs)' : (err?.message || 'เชื่อมต่อไม่ได้'))
    }
    setLoading(false)
  }, [code])

  useEffect(() => { loadAll() }, [loadAll])

  const startEdit = () => { if (emp) { setForm(staffToForm(emp)); setEditing(true) } }
  const setF = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const saveEdit = async () => {
    setSaving(true)
    const numOrNull = (v: unknown) => { const s = String(v ?? '').trim(); if (s === '') return null; const x = Number(s); return Number.isFinite(x) ? x : null }
    const txtOrNull = (v: unknown) => { const s = String(v ?? '').trim(); return s === '' ? null : s }
    const payload: Record<string, unknown> = {
      position: txtOrNull(form.position), division: txtOrNull(form.division), active: !!form.active,
      start_date: txtOrNull(form.start_date), warning: txtOrNull(form.warning), note: txtOrNull(form.note),
      updated_at: new Date().toISOString(),
    }
    for (const { k } of NUM_FIELDS) payload[k] = numOrNull(form[k])
    const { error: err } = await supabase.from('staff').update(payload).eq('code', code.toUpperCase())
    setSaving(false)
    if (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); return }
    setEditing(false)
    loadAll()
  }

  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <Link href="/staff" style={{ fontSize: 13, color: 'var(--blue)', textDecoration: 'none' }}>← กลับรายชื่อพนักงาน</Link>

      {loading && <div style={{ color: 'var(--ink-3)', padding: 24 }}>กำลังโหลด…</div>}
      {error && <div style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, padding: '12px 16px', marginTop: 12 }}>{error}</div>}

      {emp && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '14px 0 22px' }}>
            <div style={{ width: 60, height: 60, borderRadius: 30, background: 'linear-gradient(135deg, #C47E3A, #9D6025)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
              {(emp.nickname || emp.name || '?').charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
                {emp.name || '—'} {emp.nickname && <span style={{ color: 'var(--ink-3)', fontWeight: 500, fontSize: 18 }}>({emp.nickname})</span>}
                {!emp.active && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginLeft: 8 }}>ลาออกแล้ว</span>}
              </h1>
              <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 3 }}>
                {emp.code} · {emp.position || '—'}{emp.division ? ` · ${emp.division}` : ''}{emp.start_date ? ` · เริ่มงาน ${new Date(emp.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              </div>
            </div>
            {!editing && (
              <button onClick={startEdit} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✎ แก้ไขข้อมูล</button>
            )}
          </div>

          {/* ===== ฟอร์มแก้ไข ===== */}
          {editing ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, boxShadow: 'var(--shadow)', marginBottom: 26 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>แก้ไขข้อมูลพนักงาน</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div><label style={{ fontSize: 11, color: 'var(--ink-3)' }}>ตำแหน่ง</label><input style={inputStyle} value={String(form.position ?? '')} onChange={(e) => setF('position', e.target.value)} /></div>
                <div><label style={{ fontSize: 11, color: 'var(--ink-3)' }}>เนื้องาน</label>
                  <select style={inputStyle} value={String(form.division ?? '')} onChange={(e) => setF('division', e.target.value)}>
                    <option value="">—</option><option value="ธุรการ">ธุรการ</option><option value="ปฏิบัติการ">ปฏิบัติการ</option>
                  </select>
                </div>
                <div><label style={{ fontSize: 11, color: 'var(--ink-3)' }}>วันเริ่มงาน</label><input type="date" style={inputStyle} value={String(form.start_date ?? '')} onChange={(e) => setF('start_date', e.target.value)} /></div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 7 }}>
                  <label style={{ fontSize: 13, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.active} onChange={(e) => setF('active', e.target.checked)} /> ยังทำงานอยู่ (ไม่ลาออก)
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
                {NUM_FIELDS.map(({ k, label }) => (
                  <div key={k}><label style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</label>
                    <input type="number" step="0.5" style={inputStyle} value={String(form[k] ?? '')} onChange={(e) => setF(k, e.target.value)} /></div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><label style={{ fontSize: 11, color: 'var(--ink-3)' }}>ใบเตือน</label><input style={inputStyle} value={String(form.warning ?? '')} onChange={(e) => setF('warning', e.target.value)} /></div>
                <div><label style={{ fontSize: 11, color: 'var(--ink-3)' }}>หมายเหตุ</label><input style={inputStyle} value={String(form.note ?? '')} onChange={(e) => setF('note', e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditing(false)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
                <button onClick={saveEdit} disabled={saving} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
              </div>
            </div>
          ) : (
            <>
              {emp.warning && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 600 }}>⚠️ ใบเตือน: {emp.warning}</div>
              )}
              {emp.note && (
                <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--border-2)', color: 'var(--ink-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>📌 {emp.note}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
                <BalanceCard title="ลาป่วย คงเหลือ" left={emp.sick.left} avail={emp.sick.avail} used={emp.sick.used} color="#5ac8fa" />
                <BalanceCard title="ลากิจ คงเหลือ" left={emp.personal.left} avail={emp.personal.avail} used={emp.personal.avail != null && emp.personal.left != null ? emp.personal.avail - emp.personal.left : null} color="#C47E3A" />
                <BalanceCard title="ลาพักร้อน คงเหลือ" left={emp.vacation.left} avail={emp.vacation.avail} used={emp.vacation.used} color="#30c759" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 26 }}>
                {stat('WOP (เต็ม/ครึ่ง/ชม.)', `${n(emp.wop.full)}/${n(emp.wop.half)}/${n(emp.wop.hours)}`)}
                {stat('ลากิจ (เต็ม/ครึ่งวัน)', `${n(emp.personal.full)}/${n(emp.personal.half)}`)}
                {stat('มาสาย', n(emp.late) + ' ครั้ง', (emp.late || 0) > 0 ? 'var(--red)' : 'var(--ink)')}
              </div>
            </>
          )}

          {/* งานช่าง — ออเดอร์ที่สแกน */}
          {work && work.scans.length > 0 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>ออเดอร์ที่ทำ (จากการสแกน) · {work.scans.length}</h2>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', boxShadow: 'var(--shadow)', marginBottom: 26 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead><tr>
                    <th style={th}>ออเดอร์</th><th style={th}>ลูกค้า</th><th style={th}>ขั้นที่ทำ</th><th style={th}>สถานะปัจจุบัน</th><th style={th}>ล่าสุด</th>
                  </tr></thead>
                  <tbody>
                    {work.scans.map((s, i) => (
                      <tr key={i}>
                        <td style={{ ...td, color: 'var(--blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.order_number}</td>
                        <td style={td}>{s.customer_name || '—'}</td>
                        <td style={td}>{s.stages.map((st) => <span key={st} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--blue-bg)', color: 'var(--blue)', marginRight: 4 }}>{st}</span>)}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{s.status || '—'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 12 }}>{s.last ? new Date(s.last).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* แอดมิน — สรุปยอด + ออเดอร์ที่รับผิดชอบ */}
          {work && work.orders.length > 0 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>สรุปยอดของแอดมิน</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 14 }}>
                {stat('ออเดอร์ทั้งหมด', `${work.orderSummary.count} ออเดอร์`)}
                {stat('ยอดขายรวม', baht(work.orderSummary.sales), '#30c759')}
                {work.orderSummary.byCat.map((c) => (
                  <div key={c.cat} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{c.cat}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 8 }}>{baht(c.sales)}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>{c.count} ออเดอร์</div>
                  </div>
                ))}
              </div>

              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: '12px 0' }}>ออเดอร์ที่รับผิดชอบ · {work.orders.length}</h2>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', boxShadow: 'var(--shadow)', marginBottom: 26 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 660 }}>
                  <thead><tr>
                    <th style={th}>ออเดอร์</th><th style={th}>ลูกค้า</th><th style={th}>ประเภท</th><th style={th}>แพลตฟอร์ม</th><th style={th}>สถานะ</th><th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                  </tr></thead>
                  <tbody>
                    {work.orders.map((o, i) => (
                      <tr key={i}>
                        <td style={{ ...td, color: 'var(--blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>{o.order_number || '—'}</td>
                        <td style={td}>{o.customer_name || '—'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--blue-bg)', color: 'var(--blue)' }}>{o.category}</span></td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{o.platform || '—'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{o.status || '—'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{o.price ? baht(o.price) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* เคลม */}
          {work && work.claims.length > 0 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>งานเคลม · {work.claims.length}</h2>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', boxShadow: 'var(--shadow)', marginBottom: 26 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead><tr><th style={th}>ออเดอร์เดิม</th><th style={th}>ลูกค้า</th><th style={th}>ประเภทเคลม</th><th style={th}>สถานะ</th></tr></thead>
                  <tbody>
                    {work.claims.map((c, i) => (
                      <tr key={i}>
                        <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{c.order_number || '—'}</td>
                        <td style={td}>{c.customer || '—'}</td>
                        <td style={td}>{c.type || '—'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>ประวัติการลา ({leaves.length})</h2>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', boxShadow: 'var(--shadow)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={th}>วันที่ลา</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>เหตุผล</th>
                  <th style={th}>สถานะ</th>
                  <th style={th}>หัวหน้า</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{l.date ? new Date(l.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}{l.time ? ` (${l.time})` : ''}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{l.type || '—'}</td>
                    <td style={{ ...td, color: 'var(--ink-3)', fontSize: 12 }}>{l.reason || ''}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: STATUS_COLOR[l.status || ''] || 'var(--ink-3)', fontWeight: 600 }}>{l.status || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: STATUS_COLOR[l.supervisor || ''] || 'var(--ink-3)' }}>{l.supervisor || '—'}</td>
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--ink-3)', padding: 28 }}>ยังไม่มีประวัติการลา</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
