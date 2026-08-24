'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { fetchStaffOne, hasVacationRight, tenureDays, type Staff } from '@/lib/staffDb'
import { LEAVE_TYPES, rangeDays, vacationMaxDays } from '@/lib/leave'
import { readStaffSession } from '@/lib/staffSession'
import { usePullToRefresh, PullIndicator, CardSkeleton } from './mobileUi'
import MyActivity from '@/components/MyActivity'
import { compressImage, uploadPackingFile } from '@/lib/packingPhotos'

// แดชบอร์ด "ของฉัน" — พนักงานที่ล็อกอินด้วยรหัสตัวเองเห็นเฉพาะข้อมูลของตัวเอง
// เข้าจากปุ่มมุมขวาบนของหน้า /hub · ข้อมูลชุดเดียวกับหน้าเดสก์ท็อป /staff/[code] แต่ตัดส่วนของแอดมิน
// (ออเดอร์/ยอดขาย/โบนัส) ออกตามที่ user เลือก — เหลือ วันลา · งานที่ตัวเองสแกน · มาสาย/WOP/ใบเตือน

type Leave = { date: string | null; time: string | null; type: string | null; reason: string | null; status: string | null }
type LeaveForm = { leave_date: string; leave_end_date: string; leave_time: string; leave_type: string; reason: string }
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
  fault_appeal: string | null        // ข้อความอุทธรณ์ที่พนักงานยื่นเอง (ต้องรัน sql/add_claim_fault_appeal.sql)
  fault_appeal_at: string | null
  fault_appeal_photos: string[] | null   // รูปที่แนบมากับอุทธรณ์ (ต้องรัน sql/add_claim_appeal_photos.sql)
  ship_back_cost: number | null      // ค่าส่งกลับ
  ship_return_cost: number | null    // ค่าส่งคืน
  estimated_price: number | null     // ราคาประเมิน (ค่าของที่ต้องทำใหม่)
}

// มูลค่าที่ทำผิดของเคสหนึ่ง = ค่าส่งกลับ + ค่าส่งคืน + ราคาประเมิน (สูตรเดียวกับหน้า /staff/claims ของผู้จัดการ)
const claimCost = (c: ClaimFault) => (c.ship_back_cost ?? 0) + (c.ship_return_cost ?? 0) + (c.estimated_price ?? 0)
const baht = (v: number) => (v ? '฿' + Math.round(v).toLocaleString('th-TH') : '—')

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
  const COLS = 'id, claim_date, original_order_number, customer_username, claim_type, fault, fix_method, ship_back_cost, ship_return_cost, estimated_price'
  // ยังไม่ได้รัน sql/add_claim_appeal_photos.sql / add_claim_fault_appeal.sql / add_claim_fault_review.sql → ถอยไปดึงแบบไม่มีคอลัมน์ใหม่ จะได้เห็นเคสก่อน
  let r = await fetchAllRows<ClaimFault>(() => supabase.from('claims').select(`${COLS}, fault_review, fault_appeal, fault_appeal_at, fault_appeal_photos`).in('fault_by', names))
  if (r.error) r = await fetchAllRows<ClaimFault>(() => supabase.from('claims').select(`${COLS}, fault_review, fault_appeal, fault_appeal_at`).in('fault_by', names))
  if (r.error) r = await fetchAllRows<ClaimFault>(() => supabase.from('claims').select(`${COLS}, fault_review`).in('fault_by', names))
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
const fieldLabel: React.CSSProperties = { fontSize: 11.5, color: 'var(--ink-3)', display: 'block', marginBottom: 4, fontWeight: 600 }
const fieldInput: React.CSSProperties = { display: 'block', width: '100%', maxWidth: '100%', minWidth: 0, minHeight: 40, WebkitAppearance: 'none', appearance: 'none', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', fontSize: 16, background: 'var(--bg)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const leaveBtn: React.CSSProperties = { width: '100%', minHeight: 44, borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', margin: '22px 0 10px' }

// พื้นที่จอที่มองเห็นจริง (คีย์บอร์ดเด้งขึ้นมาแล้วเหลือเท่าไหร่) — ใช้กำหนดขนาดป๊อปอัปให้ไม่หลุดจอ
// visualViewport = มาตรฐานที่มือถือทุกตัวรองรับ; ไม่มีก็ถอยไปใช้ความสูงจอเต็ม
function useVisualViewport() {
  const [box, setBox] = useState<{ h: number; top: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onChange = () => setBox({ h: vv.height, top: vv.offsetTop })
    onChange()
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    return () => { vv.removeEventListener('resize', onChange); vv.removeEventListener('scroll', onChange) }
  }, [])
  return box
}

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
  const [appeal, setAppeal] = useState<{ claim: ClaimFault; text: string; photos: string[] } | null>(null)   // กล่องยื่นอุทธรณ์ (ข้อความ + รูปแนบ)
  const [appealUploading, setAppealUploading] = useState(false)
  const [appealSaving, setAppealSaving] = useState(false)
  const [appealError, setAppealError] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})   // หัวข้อที่กางอยู่ — ค่าเริ่มต้น = ปิดหมด
  const [scanQuery, setScanQuery] = useState('')   // ค้นหาในรายการงานที่สแกน (เลขออเดอร์/ชื่อลูกค้า/ขั้นตอน)
  // ── ฟอร์มแจ้งลาของตัวเอง (กางอยู่ในหัวข้อ "วันลาคงเหลือ") ──
  const EMPTY_FORM: LeaveForm = { leave_date: '', leave_end_date: '', leave_time: '08:00', leave_type: '', reason: '' }
  const [leaveForm, setLeaveForm] = useState<LeaveForm | null>(null)   // null = ยังไม่กดปุ่มแจ้งลา
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [leaveDone, setLeaveDone] = useState('')
  const [certFile, setCertFile] = useState<File | null>(null)   // ใบรับรองแพทย์ (ไม่บังคับ)

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
  const vv = useVisualViewport()
  const closeLeave = () => { setLeaveForm(null); setCertFile(null); setLeaveError('') }

  // ป๊อปอัปเปิดอยู่ = ล็อกไม่ให้หน้าข้างหลังเลื่อนตาม (กันจอกระตุกตอนเลื่อนในกล่อง)
  useEffect(() => {
    if (!leaveForm) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [leaveForm])

  // สิทธิลาพักร้อนของคนนี้ — 0 = ยังไม่มีสิทธิ (อายุงานไม่ครบ 1 ปี หรือไม่มีวันเริ่มงานในระบบ)
  const vacMax = (() => { const d = emp ? tenureDays(emp.start_date) : null; return d == null ? 0 : vacationMaxDays(d) })()

  // ยื่น/แก้ข้อความอุทธรณ์ของเคสนั้น — ผู้จัดการจะเห็นในหน้า หมวดพนักงาน → งานเคลม แล้วตัดสินผลตรวจสอบต่อ
  const sendAppeal = async () => {
    if (!appeal) return
    const text = appeal.text.trim()
    if (!text) { setAppealError('พิมพ์เหตุผลก่อนส่ง'); return }
    setAppealSaving(true)
    setAppealError('')
    const at = new Date().toISOString()
    const photos = appeal.photos
    const base = { fault_appeal: text, fault_appeal_at: at, fault_appeal_by: emp?.nickname || emp?.name || code }
    let { error: err } = await supabase.from('claims').update({ ...base, fault_appeal_photos: photos }).eq('id', appeal.claim.id)
    // ยังไม่ได้รัน sql/add_claim_appeal_photos.sql → บันทึกข้อความไปก่อน แล้วบอกให้ไปรัน (รูปยังอยู่บน R2 แนบใหม่ได้)
    let photoWarn = false
    if (err && /fault_appeal_photos/.test(err.message)) {
      photoWarn = true
      ;({ error: err } = await supabase.from('claims').update(base).eq('id', appeal.claim.id))
    }
    setAppealSaving(false)
    if (err) {
      setAppealError(/fault_appeal/.test(err.message) ? 'ยังไม่ได้รัน sql/add_claim_fault_appeal.sql — บอกแอดมินให้รันก่อน' : `ส่งไม่สำเร็จ: ${err.message}`)
      return
    }
    setClaims(prev => prev.map(c => c.id === appeal.claim.id ? { ...c, fault_appeal: text, fault_appeal_at: at, fault_appeal_photos: photoWarn ? c.fault_appeal_photos : photos } : c))
    setAppeal(null)
    if (photoWarn && photos.length) alert('ส่งข้อความอุทธรณ์แล้ว แต่รูปยังไม่ถูกบันทึก — บอกแอดมินให้รัน sql/add_claim_appeal_photos.sql ก่อน')
  }

  // แนบรูปในอุทธรณ์ — ย่อรูปแล้วอัพขึ้น R2 ทันทีที่เลือก (เก็บแค่ลิงก์ลงฐานตอนกดส่ง)
  const addAppealPhotos = async (files: FileList | null) => {
    if (!files?.length || !appeal) return
    setAppealUploading(true)
    setAppealError('')
    const urls: string[] = []
    try {
      for (const file of Array.from(files)) {
        const small = await compressImage(file)
        const key = `claims/appeal/${appeal.claim.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        urls.push(await uploadPackingFile(small, key))
      }
    } catch (e) {
      setAppealError(e instanceof Error ? e.message : String(e))
    }
    if (urls.length) setAppeal(a => a ? { ...a, photos: [...a.photos, ...urls] } : null)
    setAppealUploading(false)
  }

  // ── ส่งใบลาของตัวเอง ──────────────────────────────────────────
  // ยื่นแล้วขึ้นสถานะ "รออนุมัติ" เฉยๆ ยังไม่ตัดสิทธิวันลา — ผู้จัดการกดอนุมัติที่ปฏิทินพนักงานถึงจะหัก
  const sendLeave = async () => {
    if (!leaveForm || !emp) return
    const f = leaveForm
    const days = rangeDays(f.leave_date, f.leave_end_date || f.leave_date)
    if (!f.leave_date) { setLeaveError('เลือกวันที่เริ่มลาก่อน'); return }
    if (!f.leave_type) { setLeaveError('เลือกประเภทของการลาก่อน'); return }
    if (!days) { setLeaveError('วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มลา'); return }
    if (f.leave_type === 'ลาพักร้อน') {
      if (!vacMax) { setLeaveError('ยังไม่มีสิทธิลาพักร้อน (อายุงานไม่ครบ 1 ปี)'); return }
      if (days > vacMax) { setLeaveError(`ลาพักร้อนต่อเนื่องได้ไม่เกิน ${vacMax} วัน/ครั้ง`); return }
    }
    setLeaveSaving(true)
    setLeaveError('')
    let certUrl: string | null = null
    if (certFile) {
      const ext = (certFile.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${emp.code}/${Date.now()}.${ext}`
      const up = await supabase.storage.from('medical-certs').upload(path, certFile, { upsert: true })
      if (up.error) { setLeaveSaving(false); setLeaveError(`แนบใบรับรองแพทย์ไม่สำเร็จ: ${up.error.message}`); return }
      certUrl = supabase.storage.from('medical-certs').getPublicUrl(path).data.publicUrl
    }
    const { error: err } = await supabase.from('leave_requests').insert({
      employee_code: emp.code,
      employee_name: emp.name,
      employee_nickname: emp.nickname,
      department: emp.division,
      leave_date: f.leave_date,
      leave_end_date: f.leave_end_date || f.leave_date,
      leave_time: f.leave_time,
      leave_type: f.leave_type,
      reason: f.reason,
      leave_status: 'รออนุมัติ',
      supervisor_approval: 'รออนุมัติ',
      hr_approval: 'รออนุมัติ',
      medical_cert_url: certUrl,
      quota_applied: false,   // ยังไม่หักสิทธิ — หักตอนอนุมัติที่ปฏิทินพนักงาน
    })
    setLeaveSaving(false)
    if (err) {
      setLeaveError(/quota_applied/.test(err.message)
        ? 'ยังไม่ได้รัน sql/add_leave_quota_applied.sql — บอกแอดมินให้รันก่อน'
        : `ส่งไม่สำเร็จ: ${err.message}`)
      return
    }
    setLeaveForm(null)
    setCertFile(null)
    setLeaveDone('ส่งใบลาแล้ว รอหัวหน้า/HR อนุมัติ')
    setOpen(o => ({ ...o, leaves: true }))
    load()
  }

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
    cost: claims.reduce((sum, c) => sum + claimCost(c), 0),
    guiltyCost: claims.filter(c => c.fault_review === 'ตรวจสอบแล้วผิดจริง').reduce((sum, c) => sum + claimCost(c), 0),
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

            {/* แจ้งลาเอง — กดแล้วเด้งป๊อปอัปขึ้นมาจากล่างจอ (ตัวฟอร์มอยู่ท้ายไฟล์) */}
            {leaveDone && !leaveForm && (
              <div style={{ ...card, marginTop: 10, background: '#34c75915', borderColor: 'var(--green)', color: 'var(--green)', fontSize: 12.5, fontWeight: 600 }}>
                {leaveDone}
              </div>
            )}
            <button onClick={() => { setLeaveForm(EMPTY_FORM); setLeaveError(''); setLeaveDone('') }}
              style={{ ...leaveBtn, marginTop: 10, background: 'var(--blue)', color: '#fff', border: 'none' }}>
              + แจ้งลา
            </button>
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
                {claimStat.cost > 0 && (
                  <div style={{ ...card, marginTop: 8, padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>มูลค่าที่ทำผิดรวม</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                      {baht(claimStat.cost)}
                      {claimStat.guiltyCost > 0 && (
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--red)', marginLeft: 6 }}>ผิดจริง {baht(claimStat.guiltyCost)}</span>
                      )}
                    </span>
                  </div>
                )}
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
                    const customer = c.customer_username || ''
                    // หัวแถว — มีชื่อลูกค้าถึงจะกดเข้าโฟลเดอร์ออเดอร์ได้ (โฟลเดอร์ค้นด้วยชื่อลูกค้า) เหมือนรายการงานที่สแกน
                    const head = (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmtDate(c.claim_date)}{customer ? ` · ${customer}` : ''}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
                            {[c.original_order_number, c.claim_type].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: CLAIM_REVIEW_COLOR[cur] ?? 'var(--ink-3)' }}>{cur}</span>
                        {customer && (
                          <svg width="15" height="15" fill="none" stroke="var(--ink-4)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        )}
                      </>
                    )
                    const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 13px' }
                    return (
                      <div key={c.id} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                        {customer ? (
                          <button className="m-card-tap"
                            onClick={() => router.push(`/m/customers?name=${encodeURIComponent(customer)}${c.original_order_number ? `&order=${encodeURIComponent(c.original_order_number)}` : ''}`)}
                            style={{ ...rowStyle, border: 'none', background: 'transparent', cursor: 'pointer', font: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
                            {head}
                          </button>
                        ) : (
                          <div style={rowStyle}>{head}</div>
                        )}
                        <div style={{ padding: '0 13px 11px' }}>
                          {(c.fault || c.fix_method) && (
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                              {c.fault ? `สาเหตุ: ${c.fault}` : ''}{c.fault && c.fix_method ? ' · ' : ''}{c.fix_method ? `วิธีแก้ไข: ${c.fix_method}` : ''}
                            </div>
                          )}
                          {/* มูลค่าที่ทำผิด = ค่าส่งกลับ + ค่าส่งคืน + ราคาประเมิน (ตัวเลขชุดเดียวกับที่ผู้จัดการเห็น) */}
                          {claimCost(c) > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>มูลค่าที่ทำผิด</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{baht(claimCost(c))}</span>
                              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                                {([['ค่าส่งกลับ', c.ship_back_cost], ['ค่าส่งคืน', c.ship_return_cost], ['ราคาประเมิน', c.estimated_price]] as [string, number | null][])
                                  .filter(([, v]) => v).map(([k, v]) => `${k} ${baht(v ?? 0)}`).join(' · ')}
                              </span>
                            </div>
                          )}
                          {/* ยื่นอุทธรณ์ให้ผู้จัดการตรวจซ้ำ — ยื่นแล้วยังกดแก้ข้อความได้
                              ‼️ ฟอร์มกางในแถวเลย ไม่ใช้กล่องลอย (fixed) เพราะคีย์บอร์ดมือถือเด้งแล้วกล่องลอยหลุดขอบจอ */}
                          {c.fault_appeal && appeal?.claim.id !== c.id && (
                            <div style={{ marginTop: 8, background: 'var(--blue-bg)', borderRadius: 10, padding: '8px 10px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>
                                ยื่นอุทธรณ์แล้ว{c.fault_appeal_at ? ` · ${fmtDate(c.fault_appeal_at)}` : ''} · รอผู้จัดการตรวจ
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 3, lineHeight: 1.55 }}>{c.fault_appeal}</div>
                              {(c.fault_appeal_photos ?? []).length > 0 && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                                  {(c.fault_appeal_photos ?? []).map(u => (
                                    <a key={u} href={u} target="_blank" rel="noreferrer">
                                      <img src={u} alt="" style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                                    </a>
                                  ))}
                                </div>
                              )}
                              <button onClick={() => { setAppealError(''); setAppeal({ claim: c, text: c.fault_appeal ?? '', photos: c.fault_appeal_photos ?? [] }) }}
                                style={{ marginTop: 6, border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 12, fontWeight: 600, padding: 0, cursor: 'pointer' }}>
                                แก้ข้อความ
                              </button>
                            </div>
                          )}
                          {!c.fault_appeal && appeal?.claim.id !== c.id && (
                            <button onClick={() => { setAppealError(''); setAppeal({ claim: c, text: '', photos: [] }) }}
                              style={{ marginTop: 9, minHeight: 36, border: '1px solid var(--blue)', background: 'transparent', color: 'var(--blue)', borderRadius: 10, padding: '0 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                              ยื่นอุทธรณ์
                            </button>
                          )}
                          {appeal?.claim.id === c.id && (
                            <div style={{ marginTop: 9 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>ยื่นอุทธรณ์</div>
                              <textarea value={appeal.text} onChange={e => setAppeal(a => a ? { ...a, text: e.target.value } : null)} rows={4}
                                style={{ width: '100%', marginTop: 6, border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', color: 'var(--ink)', resize: 'none', font: 'inherit' }} />
                              {/* แนบรูปประกอบ — เลือกจากคลังหรือถ่ายใหม่ได้ อัพขึ้นทันทีที่เลือก */}
                              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                {appeal.photos.map(u => (
                                  <div key={u} style={{ position: 'relative' }}>
                                    <img src={u} alt="" style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                                    <button onClick={() => setAppeal(a => a ? { ...a, photos: a.photos.filter(x => x !== u) } : null)}
                                      style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'var(--red)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                                  </div>
                                ))}
                                <label style={{ width: 62, height: 62, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', color: 'var(--ink-4)', fontSize: 10.5, textAlign: 'center' }}>
                                  <span style={{ fontSize: 18, lineHeight: 1 }}>{appealUploading ? '…' : '+'}</span>
                                  {appealUploading ? 'กำลังอัพ' : 'แนบรูป'}
                                  <input type="file" accept="image/*" multiple disabled={appealUploading}
                                    onChange={e => { void addAppealPhotos(e.target.files); e.target.value = '' }}
                                    style={{ display: 'none' }} />
                                </label>
                              </div>
                              {appealError && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6, lineHeight: 1.55 }}>{appealError}</div>}
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button onClick={() => { setAppeal(null); setAppealError('') }} disabled={appealSaving}
                                  style={{ flex: 1, minHeight: 40, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-3)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                  ยกเลิก
                                </button>
                                <button onClick={sendAppeal} disabled={appealSaving || appealUploading}
                                  style={{ flex: 1.4, minHeight: 40, border: 'none', background: 'var(--blue)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (appealSaving || appealUploading) ? 0.6 : 1 }}>
                                  {appealSaving ? 'กำลังส่ง…' : appealUploading ? 'รอรูปอัพเสร็จ…' : 'ส่งให้ผู้จัดการ'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
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


      {/* ป๊อปอัปแจ้งลา — เกาะพื้นที่จอจริง (visualViewport) คีย์บอร์ดเด้งขึ้นมาแล้วกล่องหดตาม ไม่หลุดขอบจอ
          เนื้อในเลื่อนได้ในตัวเอง · ช่องกรอกเป็น 16px กัน iOS ซูมเข้าเองตอนโฟกัส */}
      {leaveForm && (
        <div onClick={closeLeave}
          style={{ position: 'fixed', left: 0, right: 0, top: vv ? vv.top : 0, height: vv ? vv.h : '100dvh',
            background: 'rgba(15,23,42,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            onFocusCapture={e => { const el = e.target as HTMLElement; setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250) }}
            style={{ width: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column',
              background: 'var(--surface)', borderRadius: '18px 18px 0 0', boxShadow: '0 -8px 30px rgba(0,0,0,0.18)' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>แจ้งลา</span>
              <button onClick={closeLeave} aria-label="ปิด"
                style={{ minWidth: 32, minHeight: 32, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: 20, lineHeight: 1, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
              padding: '14px 16px calc(env(safe-area-inset-bottom) + 16px)', boxSizing: 'border-box', width: '100%' }}>

              <label style={fieldLabel}>วันที่เริ่มลา</label>
              <input type="date" value={leaveForm.leave_date} style={fieldInput}
                onChange={e => { const v = e.target.value; setLeaveForm(f => f && ({ ...f, leave_date: v, leave_end_date: (!f.leave_end_date || f.leave_end_date < v) ? v : f.leave_end_date })) }} />

              <label style={{ ...fieldLabel, marginTop: 10 }}>วันที่สิ้นสุด</label>
              <input type="date" value={leaveForm.leave_end_date} min={leaveForm.leave_date} style={fieldInput}
                onChange={e => setLeaveForm(f => f && ({ ...f, leave_end_date: e.target.value }))} />

              <label style={{ ...fieldLabel, marginTop: 10 }}>เวลา</label>
              <input type="time" value={leaveForm.leave_time} style={fieldInput}
                onChange={e => setLeaveForm(f => f && ({ ...f, leave_time: e.target.value }))} />

              {rangeDays(leaveForm.leave_date, leaveForm.leave_end_date) > 1 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
                  รวม <strong style={{ color: 'var(--ink)' }}>{rangeDays(leaveForm.leave_date, leaveForm.leave_end_date)} วัน</strong>
                </div>
              )}

              <label style={{ ...fieldLabel, marginTop: 10 }}>ประเภทของการลา</label>
              <select value={leaveForm.leave_type} style={{ ...fieldInput, WebkitAppearance: 'menulist', appearance: 'menulist' }}
                onChange={e => setLeaveForm(f => f && ({ ...f, leave_type: e.target.value }))}>
                <option value="">— เลือก —</option>
                {LEAVE_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
              {leaveForm.leave_type === 'ลาพักร้อน' && (
                <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: vacMax ? 'var(--green)' : 'var(--red)' }}>
                  {vacMax ? `ลาต่อเนื่องได้ไม่เกิน ${vacMax} วัน/ครั้ง` : 'ยังไม่มีสิทธิลาพักร้อน (อายุงานไม่ครบ 1 ปี)'}
                </div>
              )}

              <label style={{ ...fieldLabel, marginTop: 10 }}>เหตุผล</label>
              <textarea value={leaveForm.reason} rows={2} style={{ ...fieldInput, resize: 'none', lineHeight: 1.5 }}
                onChange={e => setLeaveForm(f => f && ({ ...f, reason: e.target.value }))} />

              <label style={{ ...fieldLabel, marginTop: 10 }}>ใบรับรองแพทย์ (ไม่บังคับ)</label>
              <input type="file" accept="image/*,application/pdf" style={{ ...fieldInput, padding: 8, WebkitAppearance: 'textfield', appearance: 'auto' }}
                onChange={e => setCertFile(e.target.files?.[0] ?? null)} />

              {leaveError && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{leaveError}</div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={closeLeave} disabled={leaveSaving}
                  style={{ ...leaveBtn, flex: 1, background: 'var(--surface)', color: 'var(--ink-3)' }}>ยกเลิก</button>
                <button onClick={sendLeave} disabled={leaveSaving}
                  style={{ ...leaveBtn, flex: 2, background: 'var(--blue)', color: '#fff', border: 'none', opacity: leaveSaving ? 0.6 : 1 }}>
                  {leaveSaving ? 'กำลังส่ง…' : 'ส่งใบลา'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8, lineHeight: 1.5 }}>
                ส่งแล้วขึ้นสถานะ &quot;รออนุมัติ&quot; · วันลาคงเหลือจะหักหลังหัวหน้า/HR อนุมัติ
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
