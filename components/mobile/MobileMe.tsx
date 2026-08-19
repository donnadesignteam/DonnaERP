'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { fetchStaffOne, hasVacationRight, type Staff } from '@/lib/staffDb'
import { readStaffSession } from '@/lib/staffSession'
import { usePullToRefresh, PullIndicator, CardSkeleton } from './mobileUi'
import MyActivity from '@/components/MyActivity'

// แดชบอร์ด "ของฉัน" — พนักงานที่ล็อกอินด้วยรหัสตัวเองเห็นเฉพาะข้อมูลของตัวเอง
// เข้าจากปุ่มมุมขวาบนของหน้า /hub · ข้อมูลชุดเดียวกับหน้าเดสก์ท็อป /staff/[code] แต่ตัดส่วนของแอดมิน
// (ออเดอร์/ยอดขาย/โบนัส) ออกตามที่ user เลือก — เหลือ วันลา · งานที่ตัวเองสแกน · มาสาย/WOP/ใบเตือน

type Leave = { date: string | null; time: string | null; type: string | null; reason: string | null; status: string | null }
type ScanRow = { order_number: string; stage: string | null; scanned_at: string | null }
type OrderRow = { id: string; order_number: string | null; customer_name: string | null; order_status: string | null }
type OrderInfo = { customer: string | null; status: string | null }
type ClaimFault = {
  id: string
  claim_date: string | null
  original_order_number: string | null
  customer_username: string | null
  claim_type: string | null
  fault: string | null
  fix_method: string | null
  fault_review: string | null
}

// สถานะผลตรวจสอบเคสที่ถูกลงชื่อว่า "ผิดโดย" คนนี้ — พนักงานเห็นอย่างเดียว เปลี่ยนได้เฉพาะบัญชีร้าน (/staff/claims)
const CLAIM_PENDING = 'รอตรวจสอบ'
const CLAIM_REVIEW_COLOR: Record<string, string> = {
  [CLAIM_PENDING]: '#f59e0b',
  'ตรวจสอบแล้วไม่พบความผิด': 'var(--green)',
  'ตรวจสอบแล้วผิดจริง': 'var(--red)',
}

// เคสเคลมที่ช่อง "ผิดโดย" เป็นชื่อของคนนี้ (ชื่อในช่องนั้นเก็บเป็น ชื่อเล่น หรือ ชื่อจริง — เทียบทั้งสองแบบ)
async function fetchMyFaultClaims(names: string[]): Promise<ClaimFault[]> {
  if (!names.length) return []
  const COLS = 'id, claim_date, original_order_number, customer_username, claim_type, fault, fix_method'
  // ยังไม่ได้รัน sql/add_claim_fault_review.sql → ดึงแบบไม่มีคอลัมน์ผลตรวจสอบ จะได้เห็นเคสก่อน
  let r = await fetchAllRows<ClaimFault>(() => supabase.from('claims').select(`${COLS}, fault_review`).in('fault_by', names))
  if (r.error) r = await fetchAllRows<ClaimFault>(() => supabase.from('claims').select(COLS).in('fault_by', names))
  if (r.error) return []
  return [...((r.data as ClaimFault[]) ?? [])].sort((a, b) => (b.claim_date ?? '').localeCompare(a.claim_date ?? ''))
}

const STAGE_ORDER = ['ตัด', 'เย็บ', 'ผู้ช่วยช่าง', 'รีด', 'แพ็ค', 'แพ็คราง', 'จัดส่งแล้ว']
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

// หาชื่อลูกค้า/สถานะของออเดอร์ที่สแกนไป — เอาไว้โชว์ในรายการ + กดเข้าโฟลเดอร์ลูกค้าได้
// ‼️ กุญแจใน production_scans = order_number หรือ 'id:<uuid>' ถ้าออเดอร์นั้นไม่มีเลข (ดู MobileCustomer)
async function fetchOrderInfo(rows: ScanRow[]): Promise<Record<string, OrderInfo>> {
  const keys = [...new Set(rows.map(r => String(r.order_number)))]
  const nums = keys.filter(k => !k.startsWith('id:'))
  const ids = keys.filter(k => k.startsWith('id:')).map(k => k.slice(3))
  const chunk = <T,>(arr: T[], size = 200) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))
  const cols = 'id, order_number, customer_name, order_status'

  const results = await Promise.all([
    ...chunk(nums).map(c => fetchAllRows<OrderRow>(() => supabase.from('order_entries').select(cols).in('order_number', c))),
    ...chunk(ids).map(c => fetchAllRows<OrderRow>(() => supabase.from('order_entries').select(cols).in('id', c))),
  ])

  const map: Record<string, OrderInfo> = {}
  for (const r of results.flatMap(x => (x.data as OrderRow[]) ?? [])) {
    const info = { customer: r.customer_name, status: r.order_status }
    if (r.order_number) map[r.order_number] = info
    map[`id:${r.id}`] = info
  }
  return map
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

// หัวข้อพับได้ — ทุกหัวข้อในหน้านี้ปิดไว้ก่อน (user สั่ง) กดที่หัวข้อถึงจะกางออกมา
// เนื้อในเรนเดอร์ตอนกางเท่านั้น → ประวัติการแก้ไขจะไม่ยิงคิวรีถ้าไม่ได้เปิด
function Section({ title, badge, open, onToggle, children }: {
  title: string; badge?: string; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <>
      <button onClick={onToggle}
        style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7, width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', WebkitTapHighlightColor: 'transparent' }}>
        <svg width="13" height="13" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" viewBox="0 0 24 24"
          style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span>{title}</span>
        {badge && <span style={{ fontWeight: 600, color: 'var(--ink-4)', fontSize: 11.5 }}>{badge}</span>}
      </button>
      {open && <div>{children}</div>}
    </>
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
  const [orderInfo, setOrderInfo] = useState<Record<string, OrderInfo>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [allLeaves, setAllLeaves] = useState(false)
  const [allScans, setAllScans] = useState(false)
  const [claims, setClaims] = useState<ClaimFault[]>([])   // เคลมที่ถูกลงชื่อว่าผิดโดยฉัน
  const [allClaims, setAllClaims] = useState(false)
  const [claimQuery, setClaimQuery] = useState('')   // ค้นหาในงานที่ทำผิด (ลูกค้า/เลขออเดอร์/ประเภท/สาเหตุ/วิธีแก้ไข/สถานะ)
  const [open, setOpen] = useState<Record<string, boolean>>({})   // หัวข้อที่กางอยู่ — ค่าเริ่มต้น = ปิดหมด
  const [scanQuery, setScanQuery] = useState('')   // ค้นหาในรายการงานที่สแกน (เลขออเดอร์/ชื่อลูกค้า/ขั้นตอน)

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
      const [lv, sc, cl] = await Promise.all([
        supabase.from('leave_requests').select('leave_date, leave_time, leave_type, reason, leave_status')
          .eq('employee_code', code).order('leave_date', { ascending: false }),
        fetchAllRows<ScanRow>(() => supabase.from('production_scans').select('order_number, stage, scanned_at')
          .eq('tech_code', code).order('scanned_at', { ascending: false })),
        fetchMyFaultClaims([s.nickname, s.name].map(v => (v ?? '').trim()).filter(Boolean)),
      ])
      setClaims(cl)
      setLeaves((lv.data ?? []).map(l => ({ date: l.leave_date, time: l.leave_time, type: l.leave_type, reason: l.reason, status: l.leave_status })))
      // ทิ้งแถวขยะเก่าที่เก็บ URL ไว้ในช่องเลขออเดอร์ (เหมือนหน้า /staff/[code])
      const rows = ((sc.data as ScanRow[]) ?? []).filter(x => x.order_number && !String(x.order_number).startsWith('http'))
      setScans(rows)
      setOrderInfo(await fetchOrderInfo(rows))
    } catch (e) {
      setError((e as { message?: string })?.message || 'โหลดข้อมูลไม่สำเร็จ')
    }
    setLoading(false)
  }, [code])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (code) { setLoading(true); load() } }, [code, load])

  const sec = (key: string) => ({ open: !!open[key], onToggle: () => setOpen(o => ({ ...o, [key]: !o[key] })) })

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
  // ค้นจากเลขออเดอร์ ชื่อลูกค้า หรือขั้นตอน (พิมพ์เล็ก/ใหญ่ก็เจอ)
  const sq = scanQuery.trim().toLowerCase()
  const foundScans = !sq ? scans : scans.filter(s => {
    const info = orderInfo[String(s.order_number)]
    return [String(s.order_number).replace(/^id:/, ''), info?.customer ?? '', s.stage ?? '']
      .some(v => v.toLowerCase().includes(sq))
  })
  const shownScans = allScans || sq ? foundScans : foundScans.slice(0, 8)
  const shownLeaves = allLeaves ? leaves : leaves.slice(0, 6)
  const claimStat = {
    pending: claims.filter(c => !c.fault_review).length,
    guilty: claims.filter(c => c.fault_review === 'ตรวจสอบแล้วผิดจริง').length,
  }
  // ค้นในงานที่ทำผิด — ชื่อลูกค้า เลขออเดอร์ ประเภท สาเหตุ วิธีแก้ไข หรือสถานะผลตรวจสอบ
  const cq = claimQuery.trim().toLowerCase()
  const foundClaims = !cq ? claims : claims.filter(c =>
    [c.customer_username, c.original_order_number, c.claim_type, c.fault, c.fix_method, c.fault_review || CLAIM_PENDING, fmtDate(c.claim_date)]
      .some(v => (v ?? '').toLowerCase().includes(cq)))
  const shownClaims = allClaims || cq ? foundClaims : foundClaims.slice(0, 5)

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

            <Section title="วันลาคงเหลือ" {...sec('leave')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Balance title="ลาป่วย" left={emp.sick.left} avail={emp.sick.avail} used={emp.sick.used} color="var(--blue)" />
              {/* ทำงานไม่ครบ 365 วัน (หรือไม่มีวันเริ่มงาน) = ยังไม่มีสิทธิพักร้อน → ขึ้นว่ายังไม่มีสิทธิ */}
              {hasVacationRight(emp.start_date) ? (
                <Balance title="ลาพักร้อน" left={emp.vacation.left} avail={emp.vacation.avail} used={emp.vacation.used} color="var(--green)" />
              ) : (
                <div style={card}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>ลาพักร้อน</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-4)', margin: '8px 0 5px' }}>ยังไม่มีสิทธิ</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {emp.start_date ? 'อายุงานยังไม่ครบ 1 ปี' : 'ยังไม่มีวันเริ่มงานในระบบ'}
                  </div>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <Balance title="ลากิจ" left={emp.personal.left} avail={emp.personal.avail}
                  used={(emp.personal.full ?? 0) + (emp.personal.half ?? 0) * 0.5} color="#8B5CF6" />
              </div>
            </div>
            </Section>

            <Section title="สถิติอื่น" {...sec('stat')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {miniStat('มาสาย', n(emp.late), (emp.late ?? 0) > 0 ? 'var(--red)' : 'var(--ink)')}
              {miniStat('WOP เต็มวัน', n(emp.wop.full))}
              {miniStat('WOP ครึ่งวัน', n(emp.wop.half))}
              {miniStat('WOP ชม.', n(emp.wop.hours))}
            </div>
            </Section>

            <Section title="งานที่ฉันสแกน" {...sec('scan')} badge={`${scans.length} ครั้ง`}>
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
            {scans.length > 0 && (
              <div style={{ position: 'relative', marginTop: 10 }}>
                <input value={scanQuery} onChange={e => setScanQuery(e.target.value)}
                  placeholder="ค้นหา เลขออเดอร์ / ชื่อลูกค้า / ขั้นตอน"
                  style={{ width: '100%', minHeight: 42, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: '0 36px 0 13px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', color: 'var(--ink)' }} />
                {scanQuery && (
                  <button onClick={() => setScanQuery('')}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, border: 'none', background: 'transparent', color: 'var(--ink-4)', fontSize: 16, cursor: 'pointer' }}>✕</button>
                )}
              </div>
            )}
            {scans.length === 0 ? (
              <div style={{ ...card, marginTop: 10, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12.5 }}>ยังไม่มีประวัติการสแกน</div>
            ) : foundScans.length === 0 ? (
              <div style={{ ...card, marginTop: 10, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12.5 }}>ไม่เจองานที่ตรงกับ “{scanQuery}”</div>
            ) : (
              <div style={{ ...card, marginTop: 10, padding: 0, overflow: 'hidden' }}>
                {shownScans.map((s, i) => {
                  const info = orderInfo[String(s.order_number)]
                  const customer = info?.customer || ''
                  // มีชื่อลูกค้าถึงจะกดเข้าโฟลเดอร์ได้ (โฟลเดอร์ค้นด้วยชื่อลูกค้า) — ไม่มีชื่อก็แสดงเฉยๆ
                  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 13px', borderTop: i ? '1px solid var(--border)' : 'none' }
                  const body = (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {customer || (String(s.order_number).startsWith('id:') ? '(ไม่มีเลขออเดอร์)' : s.order_number)}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[
                            customer && !String(s.order_number).startsWith('id:') ? s.order_number : '',
                            s.scanned_at ? new Date(s.scanned_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span style={{ flexShrink: 0, background: 'var(--blue-bg)', color: 'var(--blue)', borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 600 }}>{s.stage || '—'}</span>
                      {customer && (
                        <svg width="15" height="15" fill="none" stroke="var(--ink-4)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      )}
                    </>
                  )
                  const key = `${s.order_number}-${s.scanned_at}-${i}`
                  return customer ? (
                    // ส่งเลขออเดอร์ไปด้วย → โฟลเดอร์เด้งใบที่เพิ่งสแกนขึ้นบนสุด (ลูกค้าที่สั่งหลายใบจะได้ไม่ต้องไล่หา)
                    <button key={key} className="m-card-tap" onClick={() => router.push(`/m/customers?name=${encodeURIComponent(customer)}&order=${encodeURIComponent(String(s.order_number))}`)}
                      style={{ ...rowStyle, border: 'none', borderTop: i ? '1px solid var(--border)' : 'none', background: 'transparent', cursor: 'pointer', font: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
                      {body}
                    </button>
                  ) : (
                    <div key={key} style={rowStyle}>{body}</div>
                  )
                })}
                {!sq && foundScans.length > 8 && (
                  <button onClick={() => setAllScans(v => !v)}
                    style={{ width: '100%', minHeight: 40, border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {allScans ? 'ย่อ' : `ดูทั้งหมด (${foundScans.length})`}
                  </button>
                )}
                {sq && (
                  <div style={{ padding: '8px 13px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--ink-4)' }}>
                    เจอ {foundScans.length} ครั้งที่สแกน
                  </div>
                )}
              </div>
            )}
            </Section>

            {/* งานเคลมที่ถูกลงชื่อในช่อง "ผิดโดย" — ขึ้นเฉพาะคนที่มีเคส */}
            {claims.length > 0 && (
              <>
                <Section title="งานที่ทำผิด" {...sec('fault')} badge={`${claims.length} เคส${claimStat.pending ? ` · รอตรวจสอบ ${claimStat.pending}` : ''}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {miniStat('ทั้งหมด', String(claims.length))}
                  {miniStat('รอตรวจสอบ', String(claimStat.pending), CLAIM_REVIEW_COLOR[CLAIM_PENDING])}
                  {miniStat('ผิดจริง', String(claimStat.guilty), 'var(--red)')}
                </div>
                <div style={{ position: 'relative', marginTop: 10 }}>
                  <input value={claimQuery} onChange={e => setClaimQuery(e.target.value)}
                    placeholder="ค้นหา ลูกค้า / เลขออเดอร์ / สาเหตุ / สถานะ"
                    style={{ width: '100%', minHeight: 42, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: '0 36px 0 13px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', color: 'var(--ink)' }} />
                  {claimQuery && (
                    <button onClick={() => setClaimQuery('')}
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, border: 'none', background: 'transparent', color: 'var(--ink-4)', fontSize: 16, cursor: 'pointer' }}>✕</button>
                  )}
                </div>
                {foundClaims.length === 0 ? (
                  <div style={{ ...card, marginTop: 10, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12.5 }}>ไม่เจอเคสที่ตรงกับ “{claimQuery}”</div>
                ) : (
                <div style={{ ...card, marginTop: 10, padding: 0, overflow: 'hidden' }}>
                  {shownClaims.map((c, i) => {
                    const cur = c.fault_review || CLAIM_PENDING
                    return (
                      <div key={c.id} style={{ padding: '10px 13px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmtDate(c.claim_date)}{c.customer_username ? ` · ${c.customer_username}` : ''}
                          </span>
                          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: CLAIM_REVIEW_COLOR[cur] ?? 'var(--ink-3)' }}>{cur}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
                          {[c.original_order_number, c.claim_type].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {(c.fault || c.fix_method) && (
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.55 }}>
                            {c.fault ? `สาเหตุ: ${c.fault}` : ''}{c.fault && c.fix_method ? ' · ' : ''}{c.fix_method ? `วิธีแก้ไข: ${c.fix_method}` : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {!cq && foundClaims.length > 5 && (
                    <button onClick={() => setAllClaims(v => !v)}
                      style={{ width: '100%', minHeight: 40, border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      {allClaims ? 'ย่อ' : `ดูทั้งหมด (${foundClaims.length})`}
                    </button>
                  )}
                  {cq && (
                    <div style={{ padding: '8px 13px', borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--ink-4)' }}>
                      เจอ {foundClaims.length} เคส
                    </div>
                  )}
                </div>
                )}
                </Section>
              </>
            )}
            {/* ประวัติการแก้ไขของตัวเองเท่านั้น (คนอื่นไม่เห็นของเรา) */}
            <Section title="ประวัติการแก้ไขของฉัน" {...sec('activity')}>
              <div style={{ ...card, padding: '2px 13px 13px' }}>
                <MyActivity code={code} mobile />
              </div>
            </Section>

            <Section title="ประวัติการลา" {...sec('leaves')} badge={`${leaves.length} ครั้ง`}>
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
            </Section>

          </>
        )}
      </div>
    </div>
  )
}
