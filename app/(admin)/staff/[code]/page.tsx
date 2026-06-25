'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Leave = { filed: string | null; date: string | null; time: string | null; type: string | null; reason: string | null; redzone: string | null; lateMin: string | null; status: string | null; supervisor: string | null }
type Scan = { order_number: string; customer_name: string | null; status: string | null; stages: string[]; last: string | null }
type AdminOrder = { order_number: string | null; customer_name: string | null; platform: string | null; status: string | null; price: number; category: string }
type Claim = { order_number: string | null; customer: string | null; type: string | null; status: string | null }
type CatSum = { cat: string; count: number; sales: number }
type OrderSummary = { count: number; sales: number; byCat: CatSum[] }
type Work = { scans: Scan[]; orders: AdminOrder[]; claims: Claim[]; orderSummary?: OrderSummary }
type Emp = {
  code: string; name: string | null; nickname: string | null; position: string | null; division: string | null
  sick: { avail: number | null; used: number | null; left: number | null }
  personal: { avail: number | null; full: number | null; half: number | null; left: number | null }
  vacation: { avail: number | null; used: number | null; left: number | null }
  wop: { full: number | null; half: number | null; hours: number | null }
  late: number | null; warning: string | null; note: string | null
}

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

export default function StaffDetailPage() {
  const { code } = useParams<{ code: string }>()
  const [emp, setEmp] = useState<Emp | null>(null)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [work, setWork] = useState<Work | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/staff/${code}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else { setEmp(d.employee); setLeaves(d.leaves || []); setStartDate(d.startDate); setWork(d.work || null) } })
      .catch(() => setError('เชื่อมต่อไม่ได้'))
      .finally(() => setLoading(false))
  }, [code])

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
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
                {emp.name || '—'} {emp.nickname && <span style={{ color: 'var(--ink-3)', fontWeight: 500, fontSize: 18 }}>({emp.nickname})</span>}
              </h1>
              <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 3 }}>
                {emp.code} · {emp.position || '—'}{emp.division ? ` · ${emp.division}` : ''}{startDate ? ` · เริ่มงาน ${startDate}` : ''}
              </div>
            </div>
          </div>

          {emp.warning && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 600 }}>
              ⚠️ ใบเตือน: {emp.warning}
            </div>
          )}
          {emp.note && (
            <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--border-2)', color: 'var(--ink-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              📌 {emp.note}
            </div>
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
              {work.orderSummary && (
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
              )}

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

          {/* เคลมที่ผูกกับออเดอร์ของแอดมิน */}
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={th}>วันที่ลา</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>เหตุผล</th>
                  <th style={th}>สถานะ</th>
                  <th style={th}>วันที่ยื่น</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{l.date || '—'}{l.time ? ` (${l.time})` : ''}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{l.type || '—'}</td>
                    <td style={{ ...td, color: 'var(--ink-3)', fontSize: 12 }}>{l.reason || ''}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: STATUS_COLOR[l.status || ''] || 'var(--ink-3)', fontWeight: 600 }}>{l.status || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>{l.filed || '—'}</td>
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
