'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { fetchStaffOne, type Staff } from '@/lib/staffDb'
import { readStaffSession } from '@/lib/staffSession'
import { usePullToRefresh, PullIndicator, CardSkeleton } from './mobileUi'

// แดชบอร์ด "ของฉัน" — พนักงานที่ล็อกอินด้วยรหัสตัวเองเห็นเฉพาะข้อมูลของตัวเอง
// เข้าจากปุ่มมุมขวาบนของหน้า /hub · ข้อมูลชุดเดียวกับหน้าเดสก์ท็อป /staff/[code] แต่ตัดส่วนของแอดมิน
// (ออเดอร์/ยอดขาย/โบนัส) ออกตามที่ user เลือก — เหลือ วันลา · งานที่ตัวเองสแกน · มาสาย/WOP/ใบเตือน

type Leave = { date: string | null; time: string | null; type: string | null; reason: string | null; status: string | null }
type ScanRow = { order_number: string; stage: string | null; scanned_at: string | null }

const STAGE_ORDER = ['ตัด', 'เย็บ', 'รีด', 'แพ็ค', 'แพ็คราง', 'จัดส่งแล้ว']
const STATUS_COLOR: Record<string, string> = { 'อนุมัติ': 'var(--green)', 'ใบลาเรียบร้อย': 'var(--green)', 'ไม่อนุมัติ': 'var(--red)' }

const n = (v: number | null | undefined) => (v == null ? '—' : String(v))
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
const ymOf = (d: string) => d.slice(0, 7)

// อายุงานแบบ "x ปี y เดือน" จากวันเริ่มงาน
function tenure(start: string | null): string {
  if (!start) return '—'
  const s = new Date(start), now = new Date()
  let months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth())
  if (now.getDate() < s.getDate()) months--
  if (months < 0) return '—'
  const y = Math.floor(months / 12), m = months % 12
  return [y ? `${y} ปี` : '', m ? `${m} เดือน` : '', !y && !m ? 'เพิ่งเริ่ม' : ''].filter(Boolean).join(' ')
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow)' }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', margin: '22px 0 10px' }

function Balance({ title, left, avail, used, color }: { title: string; left: number | null; avail: number | null; used: number | null; color: string }) {
  const pct = avail && avail > 0 && used != null ? Math.min(100, Math.round((used / avail) * 100)) : 0
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '6px 0' }}>
        <span style={{ fontSize: 26, fontWeight: 700, color }}>{n(left)}</span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>/ {n(avail)} วัน</span>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>ใช้ไป {n(used)} วัน</div>
    </div>
  )
}

const miniStat = (label: string, value: string, color = 'var(--ink)') => (
  <div key={label} style={{ ...card, padding: 12, textAlign: 'center' }}>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{label}</div>
  </div>
)

export default function MobileMe() {
  const router = useRouter()
  const [session, setSession] = useState<ReturnType<typeof readStaffSession> | 'unknown'>('unknown')
  const [emp, setEmp] = useState<Staff | null>(null)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [scans, setScans] = useState<ScanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [allLeaves, setAllLeaves] = useState(false)
  const [allScans, setAllScans] = useState(false)

  // คุกกี้อ่านได้เฉพาะบนเบราว์เซอร์ — อ่านตอน render แรกจะไม่ตรงกับที่ server เรนเดอร์ (hydration mismatch)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSession(readStaffSession()) }, [])

  const code = session && session !== 'unknown' ? session.code : ''

  const load = useCallback(async () => {
    if (!code) return
    setError('')
    try {
      const s = await fetchStaffOne(code)
      if (!s) { setError('ไม่พบข้อมูลพนักงานรหัสนี้'); setLoading(false); return }
      setEmp(s)
      const [lv, sc] = await Promise.all([
        supabase.from('leave_requests').select('leave_date, leave_time, leave_type, reason, leave_status')
          .eq('employee_code', code).order('leave_date', { ascending: false }),
        fetchAllRows<ScanRow>(() => supabase.from('production_scans').select('order_number, stage, scanned_at')
          .eq('tech_code', code).order('scanned_at', { ascending: false })),
      ])
      setLeaves((lv.data ?? []).map(l => ({ date: l.leave_date, time: l.leave_time, type: l.leave_type, reason: l.reason, status: l.leave_status })))
      // ทิ้งแถวขยะเก่าที่เก็บ URL ไว้ในช่องเลขออเดอร์ (เหมือนหน้า /staff/[code])
      setScans(((sc.data as ScanRow[]) ?? []).filter(x => x.order_number && !String(x.order_number).startsWith('http')))
    } catch (e) {
      setError((e as { message?: string })?.message || 'โหลดข้อมูลไม่สำเร็จ')
    }
    setLoading(false)
  }, [code])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (code) { setLoading(true); load() } }, [code, load])

  const { pull, refreshing, refresh } = usePullToRefresh(load)

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
  }

  // ยังไม่ได้ล็อกอินด้วยรหัสพนักงาน (เข้าด้วยรหัสรวมของร้าน) → ชวนให้ล็อกอินก่อน
  if (session !== 'unknown' && !session) {
    return (
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 60px) 22px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🙋</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ยังไม่ได้เข้าด้วยรหัสพนักงาน</div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.6 }}>
          เข้าสู่ระบบด้วยรหัสพนักงานของตัวเอง<br />แล้วจะเห็นวันลา งานที่สแกน และสถิติของตัวเอง
        </p>
        <button onClick={() => router.push('/login')}
          style={{ marginTop: 20, minHeight: 44, padding: '0 26px', borderRadius: 12, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
          เข้าสู่ระบบพนักงาน
        </button>
      </div>
    )
  }

  const thisYm = new Date().toISOString().slice(0, 7)
  const scansThisMonth = scans.filter(s => s.scanned_at && ymOf(s.scanned_at) === thisYm).length
  const byStage = STAGE_ORDER.map(st => ({ stage: st, count: scans.filter(s => s.stage === st).length })).filter(s => s.count > 0)
  const shownScans = allScans ? scans : scans.slice(0, 8)
  const shownLeaves = allLeaves ? leaves : leaves.slice(0, 6)

  return (
    <div>
      <PullIndicator pull={pull} refreshing={refreshing} />
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ข้อมูลของฉัน</span>
          <button onClick={logout}
            style={{ minHeight: 32, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-3)', borderRadius: 999, padding: '0 13px', fontSize: 12.5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 14px 24px' }}>
        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
            {error}
            <button onClick={refresh} style={{ marginLeft: 10, border: 'none', background: 'transparent', color: 'var(--red)', textDecoration: 'underline', fontSize: 13, cursor: 'pointer' }}>ลองใหม่</button>
          </div>
        )}

        {loading && !emp ? <CardSkeleton n={4} /> : emp && (
          <>
            {/* หัว — ใครกำลังดูอยู่ */}
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* วงกลมเปล่าๆ ไม่ใส่ตัวอักษรย่อ (user สั่ง) */}
              <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--blue-bg)', border: '1px solid var(--border)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>{emp.nickname || emp.name || emp.code}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{emp.name || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
                  {emp.code} · {emp.position || '—'}{emp.division ? ` · ${emp.division}` : ''}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '8px 2px 0' }}>
              เริ่มงาน {fmtDate(emp.start_date)} · อายุงาน {tenure(emp.start_date)}
            </div>

            {emp.warning && (
              <div style={{ ...card, marginTop: 14, background: 'var(--red-bg)', borderColor: 'var(--red)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>ใบเตือน</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4, lineHeight: 1.6 }}>{emp.warning}</div>
              </div>
            )}

            <div style={sectionTitle}>วันลาคงเหลือ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Balance title="ลาป่วย" left={emp.sick.left} avail={emp.sick.avail} used={emp.sick.used} color="var(--blue)" />
              <Balance title="ลาพักร้อน" left={emp.vacation.left} avail={emp.vacation.avail} used={emp.vacation.used} color="var(--green)" />
              <div style={{ gridColumn: '1 / -1' }}>
                <Balance title="ลากิจ" left={emp.personal.left} avail={emp.personal.avail}
                  used={(emp.personal.full ?? 0) + (emp.personal.half ?? 0) * 0.5} color="#8B5CF6" />
              </div>
            </div>

            <div style={sectionTitle}>สถิติอื่น</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {miniStat('มาสาย', n(emp.late), (emp.late ?? 0) > 0 ? 'var(--red)' : 'var(--ink)')}
              {miniStat('WOP เต็มวัน', n(emp.wop.full))}
              {miniStat('WOP ครึ่งวัน', n(emp.wop.half))}
              {miniStat('WOP ชม.', n(emp.wop.hours))}
            </div>

            <div style={sectionTitle}>งานที่ฉันสแกน</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {miniStat('ทั้งหมด (ครั้ง)', String(scans.length), 'var(--blue)')}
              {miniStat('เดือนนี้', String(scansThisMonth), 'var(--blue)')}
            </div>
            {byStage.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                {byStage.map(s => (
                  <span key={s.stage} style={{ background: 'var(--blue-bg)', color: 'var(--blue)', borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: 600 }}>
                    {s.stage} {s.count}
                  </span>
                ))}
              </div>
            )}
            {scans.length === 0 ? (
              <div style={{ ...card, marginTop: 10, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12.5 }}>ยังไม่มีประวัติการสแกน</div>
            ) : (
              <div style={{ ...card, marginTop: 10, padding: 0, overflow: 'hidden' }}>
                {shownScans.map((s, i) => (
                  <div key={`${s.order_number}-${s.scanned_at}-${i}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 13px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(s.order_number).startsWith('id:') ? '(ไม่มีเลขออเดอร์)' : s.order_number}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                        {s.scanned_at ? new Date(s.scanned_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, background: 'var(--blue-bg)', color: 'var(--blue)', borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 600 }}>{s.stage || '—'}</span>
                  </div>
                ))}
                {scans.length > 8 && (
                  <button onClick={() => setAllScans(v => !v)}
                    style={{ width: '100%', minHeight: 40, border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {allScans ? 'ย่อ' : `ดูทั้งหมด (${scans.length})`}
                  </button>
                )}
              </div>
            )}

            <div style={sectionTitle}>ประวัติการลา</div>
            {leaves.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12.5 }}>ยังไม่มีประวัติการลา</div>
            ) : (
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                {shownLeaves.map((l, i) => (
                  <div key={`${l.date}-${i}`} style={{ padding: '10px 13px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmtDate(l.date)} · {l.type || '—'}</span>
                      {l.status && (
                        <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: STATUS_COLOR[l.status] || 'var(--ink-3)' }}>{l.status}</span>
                      )}
                    </div>
                    {(l.time || l.reason) && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
                        {[l.time, l.reason].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
                {leaves.length > 6 && (
                  <button onClick={() => setAllLeaves(v => !v)}
                    style={{ width: '100%', minHeight: 40, border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {allLeaves ? 'ย่อ' : `ดูทั้งหมด (${leaves.length})`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
