'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EMPLOYEES, STAGES, stageByKey } from '@/lib/staff'
import { fetchEmployeeOptions } from '@/lib/staffDb'
import { detectCarrier, CARRIER_OPTIONS } from '@/lib/carriers'
import { uploadPackingFile, deletePackingFile, compressImage } from '@/lib/packingPhotos'
import { cutMeters, round2 } from '@/lib/fabricUsage'
import HubButton from '@/components/HubButton'

const LS_KEY = 'donna-scan-tech'
type Tech = { code: string; name: string; stageKey: string }

// งานพิเศษ (ไม่ใช่สายผลิตปกติ) — แพ็คราง = ติ๊ก rail_packed, จัดส่งแล้ว = ตั้ง order_status+shipped_at
type SpecialKind = 'rail' | 'shipped'
const SPECIAL_STAGES: { key: string; label: string; status: string; special: SpecialKind }[] = [
  { key: 'rail_pack', label: 'แพ็คราง', status: 'แพ็คราง', special: 'rail' },
  { key: 'shipped', label: 'จัดส่งแล้ว', status: 'จัดส่งแล้ว', special: 'shipped' },
]
const resolveStage = (key: string): any => stageByKey(key) || SPECIAL_STAGES.find(s => s.key === key)
type Phase = 'scanning' | 'working' | 'done' | 'already' | 'noorder' | 'error' | 'barcode' | 'undone' | 'joined'

// กรอบสแกนจัตุรัสอันเดียว — ใช้ทั้ง QR ใบออเดอร์และ QR เลขพัสดุบนใบปะหน้า
// (เดิมเลขพัสดุอ่านจากบาร์โค้ด 1D กรอบแนวนอน ซึ่งจับยากมากบนมือถือ user เลยสั่งให้เปลี่ยนมาสแกน QR แทน)
const QR_BOX = { width: 250, height: 250 }

// เลขพัสดุ: ตัวอักษร/ตัวเลขล้วน ไม่ใช่ URL/QR ใบออเดอร์
const isTrackingNo = (s: string) => /^[A-Z0-9-]{8,25}$/i.test(s) && !/^HTTP/i.test(s) && !s.includes('=')

// ดึงเลขพัสดุจาก QR บนใบปะหน้า — บางเจ้าใส่เลขตรงๆ บางเจ้าใส่เป็นลิงก์เช็คสถานะ/ข้อความยาว
// เลือกคำที่ "หน้าตาเป็นเลขพัสดุ" และเดาเจ้าขนส่งออก ถ้าเดาไม่ออกเอาคำที่ยาวสุด · '' = ไม่เจอ
function trackingFromQr(raw: string): string {
  const s = String(raw).trim().toUpperCase()
  if (isTrackingNo(s)) return s
  const tokens = s.split(/[^A-Z0-9-]+/).filter(t => isTrackingNo(t))
  return tokens.find(t => detectCarrier(t)) || tokens.sort((a, b) => b.length - a.length)[0] || ''
}

// รูปที่แต่ละแผนกอัพโหลดได้หลังสแกน → เก็บลง order_entries.packing_photos (โชว์ในโฟลเดอร์ลูกค้า)
const UPLOAD_SLOTS: Record<string, { tag: string; label: string }[]> = {
  pack: [{ tag: 'rail', label: 'ภาพรางม่าน' }, { tag: 'packed', label: 'ภาพแพ็คแล้ว' }],
  rail_pack: [{ tag: 'rail', label: 'ภาพรางม่าน' }, { tag: 'packed', label: 'ภาพแพ็คแล้ว' }],
  iron: [{ tag: 'ironed', label: 'ภาพม่านที่รีด' }],
}

// ── แผนกตัด: เมตรผ้าที่ตัดในออเดอร์ที่เพิ่งสแกน (sql/fabric_meters.sql) ──
// กติกา (user สั่ง 4 ส.ค. 69): ไม่ถามว่าใครตัดรายการไหนแล้ว —
// คิดเมตรทั้งใบตามสูตร (เช่นม่านจีบ ×2.2) แล้ว "หารเท่ากัน" ตามจำนวนคนที่ลงชื่อขั้นตัดของออเดอร์นั้น
// คนที่ 2 ขึ้นไปเข้ามาด้วยคำถามเดิม "ลงชื่อเป็นผู้ร่วมทำออเดอร์ไหม" แล้วระบบเฉลี่ยใหม่ให้ทุกคนเอง

function loadTech(): Tech | null {
  try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null } catch { return null }
}

// ดึงเลขออเดอร์จาก QR (รองรับทั้ง URL .../scan?o=XXX และข้อความเลขเปล่า)
// ถ้าเป็น URL แต่ไม่มี ?o= → คืนค่าว่าง (ห้ามคืนทั้ง URL มาใช้เป็นเลขออเดอร์ — เคยทำให้ order_number ในฐานข้อมูลเป็น URL)
function extractOrder(text: string): string {
  const t = String(text).trim()
  const m = t.match(/[?&]o=([^&\s]+)/); if (m) return decodeURIComponent(m[1])
  if (/^https?:\/\//i.test(t)) return ''
  return t
}

// ดึง id ของ "งานเคลม" จาก QR ใบเคลม (ฝัง ?c=<uuid>) — คนละตารางกับออเดอร์ (claims)
function extractClaimId(text: string): string {
  const m = String(text).match(/[?&]c=([0-9a-f-]{36})/i)
  return m ? m[1] : ''
}

// ดึง id ของแถวจาก QR (QR ใหม่ฝัง ?id=NNN — แม่นยำกว่า order_number)
function extractId(text: string): string {
  try { const u = new URL(text); const id = u.searchParams.get('id'); if (id) return id } catch {}
  const m = String(text).match(/[?&]id=([^&\s]+)/); if (m) return decodeURIComponent(m[1])
  return ''
}

const wrap: React.CSSProperties = { minHeight: '100dvh', background: '#0b1220', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0, fontFamily: 'Sarabun, -apple-system, "Segoe UI", sans-serif', textAlign: 'center' }
const centerWrap: React.CSSProperties = { ...wrap, justifyContent: 'center', padding: 24 }
const card: React.CSSProperties = { background: '#fff', color: '#1a1a1a', borderRadius: 18, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }

function ScanContent() {
  const sp = useSearchParams()
  const urlOrder = (sp.get('o') || '').trim()
  const urlId = (sp.get('id') || '').trim()
  const urlClaim = (sp.get('c') || '').trim()   // เปิดจาก QR ใบเคลม

  const [tech, setTech] = useState<Tech | null>(null)
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<Phase>('scanning')
  const [order, setOrder] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [camState, setCamState] = useState<'idle' | 'starting' | 'on' | 'error'>('idle')
  const [camErr, setCamErr] = useState('')

  // อัพโหลดรูปหลังสแกน (แผนกรีด/แพ็ค/แพ็คราง)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadedCnt, setUploadedCnt] = useState<Record<string, number>>({})
  const [uploadErr, setUploadErr] = useState('')
  const [preview, setPreview] = useState<{ file: File; tag: string; url: string; label: string } | null>(null) // เช็ครูปก่อนยืนยันอัพโหลด
  const [photos, setPhotos] = useState<string[]>([])       // รูปที่อัพแล้วของออเดอร์ที่เพิ่งสแกน (ลบได้)
  const [delBusy, setDelBusy] = useState<string | null>(null)

  // login form
  const [q, setQ] = useState('')
  const [pickCode, setPickCode] = useState('')
  const [pickStage, setPickStage] = useState('')
  // รายชื่อพนักงานดึงจากตาราง staff (active) — อัปเดตเองเมื่อมีคนเข้า/ออก, fallback รายชื่อในโค้ด
  const [employees, setEmployees] = useState<typeof EMPLOYEES>(EMPLOYEES)
  const [undoing, setUndoing] = useState(false)

  // ช่วยกันทำขั้นเดียวกันหลายคน — สแกนซ้ำแล้วถามว่าจะลงชื่อเพิ่มไหม (sql/scan_helpers.sql)
  const [joinInfo, setJoinInfo] = useState<{ stage: string; people: string[]; mine: boolean } | null>(null)
  const [joining, setJoining] = useState(false)

  const scannerRef = useRef<any>(null)
  const resumeTimerRef = useRef<any>(null)  // timer auto-กลับไปสแกนต่อ (undo ต้องยกเลิกก่อน ไม่งั้นเด้งทับหน้า "ยกเลิกแล้ว")
  const busyRef = useRef(false)
  const startedRef = useRef(false)
  const askJoinRef = useRef(false)  // กำลังถาม "ลงชื่อช่วยไหม" — ห้าม timer เด้งกลับไปสแกนต่อทับคำถาม

  // โหมดสแกนบาร์โค้ดเลขพัสดุ (ต่อจากสแกนจัดส่งแล้ว) — ใช้ ref คู่ state เพราะ callback ของกล้องเป็น closure เก่า
  const modeRef = useRef<'order' | 'barcode'>('order')
  const shipRef = useRef<{ id: string; orderNumber: string; courier: string; existing: any[] } | null>(null)
  const shipNosRef = useRef<{ no: string; carrier: string }[]>([])
  const [shipNos, setShipNos] = useState<{ no: string; carrier: string }[]>([])
  const [shipMsg, setShipMsg] = useState('')
  const [shipTyped, setShipTyped] = useState('')   // ช่องพิมพ์เลขพัสดุเอง (ใบที่ไม่มี QR)
  const [shipSaving, setShipSaving] = useState(false)
  const [shipToast, setShipToast] = useState('')

  useEffect(() => { setTech(loadTech()); setReady(true) }, [])
  useEffect(() => { fetchEmployeeOptions().then(list => { if (list.length) setEmployees(list) }).catch(() => {}) }, [])

  // พื้นหลังหน้า /scan เป็นสีเข้ม (กัน iOS bounce โชว์ขอบขาว) + กัน overscroll — คืนค่าเดิมตอนออกจากหน้า
  useEffect(() => {
    const html = document.documentElement, body = document.body
    const prev = { htmlBg: html.style.background, bodyBg: body.style.background, htmlOver: html.style.overscrollBehavior, bodyOver: body.style.overscrollBehavior }
    html.style.background = '#0b1220'
    body.style.background = '#0b1220'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    return () => {
      html.style.background = prev.htmlBg; body.style.background = prev.bodyBg
      html.style.overscrollBehavior = prev.htmlOver; body.style.overscrollBehavior = prev.bodyOver
    }
  }, [])

  // กรณีเปิดจากลิงก์ที่มี id/เลขออเดอร์ (เช่นสแกนด้วยแอปกล้องของเครื่อง) → อัปเดตครั้งเดียว
  useEffect(() => {
    if (!ready || !tech || (!urlOrder && !urlId && !urlClaim)) return
    if (urlClaim) runClaimScan(tech, urlClaim)
    else runScan(tech, urlId, urlOrder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tech, urlOrder, urlId, urlClaim])

  // handler สแกน — เก็บใน ref ให้ callback ของกล้องเรียกตัวล่าสุดเสมอ (เปลี่ยนโหมด/state แล้วไม่ค้าง closure เก่า)
  const decodeRef = useRef<(decoded: string) => void>(() => {})
  decodeRef.current = async (decoded: string) => {
    const html5 = scannerRef.current
    if (busyRef.current || !html5 || !tech) return
    busyRef.current = true
    try { await html5.pause(true) } catch {}

    // ---- โหมดสแกน QR เลขพัสดุ ----
    if (modeRef.current === 'barcode') {
      // กันสแกนโดน QR ใบออเดอร์/ใบเคลมของร้านเอง (ตอนนี้สแกน QR ทั้งคู่ จ่อผิดใบได้ง่าย)
      if (extractId(decoded) || extractClaimId(decoded) || /[?&]o=/.test(decoded)) {
        setShipMsg('อันนี้คือ QR ใบออเดอร์ — ให้จ่อ QR บนใบปะหน้าพัสดุ')
        setTimeout(() => setShipMsg(''), 2200)
        setTimeout(() => { try { html5.resume() } catch {}; busyRef.current = false }, 1100)
        return
      }
      if (addShipNo(decoded)) { try { navigator.vibrate?.(120) } catch {} }
      setTimeout(() => { try { html5.resume() } catch {}; busyRef.current = false }, 1100)
      return
    }

    // ---- QR ใบเคลม (?c=) → เดินสถานะงานเคลม ----
    const claimId = extractClaimId(decoded)
    if (claimId) {
      await runClaimScan(tech, claimId)
      if (!askJoinRef.current) {
        resumeTimerRef.current = setTimeout(() => { try { html5.resume() } catch {}; busyRef.current = false; setPhase('scanning') }, 4000)
      }
      return
    }

    // ---- โหมดปกติ: สแกน QR ใบออเดอร์ ----
    const res = await runScan(tech, extractId(decoded), extractOrder(decoded))
    // แผนกจัดส่งแล้ว: ติ๊กเสร็จ → ต่อด้วยสแกนบาร์โค้ดเลขพัสดุทันที
    if (tech.stageKey === 'shipped' && res?.id && !res.isClaim) {
      shipRef.current = { id: res.id, orderNumber: res.order_number || '', courier: res.courier || '', existing: Array.isArray(res.shipments) ? res.shipments : [] }
      shipNosRef.current = []; setShipNos([]); setShipMsg('')
      modeRef.current = 'barcode'
      setPhase('barcode')
      // กรอบเดียวกับ QR ใบออเดอร์ → ไม่ต้องเปิดกล้องใหม่ แค่สแกนต่อได้เลย
      try { html5.resume() } catch {}
      busyRef.current = false
      return
    }
    // แผนกที่อัพโหลดรูปได้ → ค้างหน้าผลไว้ให้อัพรูปก่อน กด "สแกนต่อ" เอง
    // แผนกที่ไม่มีรูป → ค้างหน้าผล 4 วิ (ให้ทันเช็ก+กดยกเลิกถ้าสแกนผิด) แล้วกลับไปสแกนต่ออัตโนมัติ
    if ((UPLOAD_SLOTS[tech.stageKey] ?? []).length === 0 && !askJoinRef.current) {
      resumeTimerRef.current = setTimeout(() => { try { html5.resume() } catch {}; busyRef.current = false; setPhase('scanning') }, 4000)
    }
  }

  // โหมดสแกนในแอป: เปิดกล้องสแกนต่อเนื่อง (เมื่อ login แล้ว และไม่ได้มาจากลิงก์)
  async function startCamera() {
    if (startedRef.current || !tech) return
    startedRef.current = true
    setCamState('starting'); setCamErr('')
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
      // อ่านเฉพาะ QR — ไม่ต้องเสียเวลาไล่ถอดบาร์โค้ด 1D ทุกเฟรม จับ QR ได้ไวขึ้น
      const html5 = new Html5Qrcode('qr-reader', { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] } as any)
      scannerRef.current = html5
      await html5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: QR_BOX },
        (decoded: string) => decodeRef.current(decoded),
        () => {} // ละเว้น error รายเฟรม
      )
      setCamState('on')
    } catch (e: any) {
      startedRef.current = false
      setCamState('error'); setCamErr(e?.message || String(e))
    }
  }

  // เพิ่มเลขพัสดุ 1 เลข (มาจาก QR ที่สแกน หรือพิมพ์เองในช่องด้านล่าง) — true = เพิ่มสำเร็จ
  function addShipNo(raw: string): boolean {
    const text = trackingFromQr(raw)
    if (!text) {
      setShipMsg('อ่านเลขพัสดุไม่ได้ — พิมพ์เลขเองในช่องด้านล่างได้')
      setTimeout(() => setShipMsg(''), 2200)
      return false
    }
    const known = [...shipNosRef.current.map(x => x.no), ...(shipRef.current?.existing || []).map((s: any) => s.no)]
    if (known.includes(text)) {
      setShipMsg('เลขนี้สแกนไปแล้ว')
      setTimeout(() => setShipMsg(''), 1800)
      return false
    }
    shipNosRef.current = [...shipNosRef.current, { no: text, carrier: detectCarrier(text, shipRef.current?.courier) || 'อื่นๆ' }]
    setShipNos(shipNosRef.current)
    setShipMsg('')
    return true
  }

  // ลบเลขที่เพิ่งเพิ่ม (สแกนผิดใบ/พิมพ์ผิด) — ลบได้เฉพาะเลขที่ยังไม่บันทึก
  function removeShipNo(no: string) {
    shipNosRef.current = shipNosRef.current.filter(x => x.no !== no)
    setShipNos(shipNosRef.current)
  }

  // เปลี่ยนเจ้าขนส่งของเลขที่สแกนแล้ว (บางออเดอร์ส่งคนละเจ้า ระบบเดาให้ก่อน แก้ได้ต่อเลข)
  function setShipCarrier(no: string, carrier: string) {
    shipNosRef.current = shipNosRef.current.map(x => x.no === no ? { ...x, carrier } : x)
    setShipNos(shipNosRef.current)
  }

  // จบโหมดบาร์โค้ด: บันทึกเลขที่สแกนได้ (ถ้ามี) แล้วกลับไปสแกน QR ออเดอร์ถัดไป
  async function finishBarcode(save: boolean) {
    const info = shipRef.current
    let savedCnt = 0
    if (save && info && shipNosRef.current.length > 0) {
      setShipSaving(true)
      const now = new Date().toISOString()
      const list = [
        ...info.existing,
        ...shipNosRef.current.map(x => ({ no: x.no, carrier: x.carrier, status: '', events: null, checked_at: null })),
      ]
      const { error } = await supabase.from('order_entries').update({ shipments: list, updated_at: now }).eq('id', info.id)
      setShipSaving(false)
      if (error) { setShipMsg(`บันทึกไม่สำเร็จ: ${error.message}`); return }
      savedCnt = shipNosRef.current.length
    }
    modeRef.current = 'order'
    shipRef.current = null
    shipNosRef.current = []; setShipNos([]); setShipMsg(''); setShipTyped('')
    setPhase('scanning')
    if (savedCnt > 0) { setShipToast(`✓ บันทึก ${savedCnt} เลขพัสดุแล้ว`); setTimeout(() => setShipToast(''), 3000) }
    try { scannerRef.current?.resume() } catch {}
    busyRef.current = false
  }

  useEffect(() => {
    if (!ready || !tech || urlOrder || urlId || urlClaim) return
    startCamera()
    return () => {
      const s = scannerRef.current
      if (s) { try { s.stop().then(() => s.clear()).catch(() => {}) } catch {} ; scannerRef.current = null; startedRef.current = false }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tech, urlOrder, urlId, urlClaim])

  // ค้นออเดอร์: id ก่อน (แม่นสุด) → order_number แบบไม่สนตัวพิมพ์ → contains (เผื่อช่องว่าง/QR เก่า)
  async function findOrder(id: string, ord: string) {
    const cols = 'id, order_number, customer_name, order_status, courier, shipments, packing_photos, items'
    if (id) {
      const { data } = await supabase.from('order_entries').select(cols).eq('id', id).limit(1)
      if (data && data[0]) return data[0]
    }
    const term = ord.trim()
    if (term) {
      const exact = await supabase.from('order_entries').select(cols).ilike('order_number', term).order('id', { ascending: false }).limit(1)
      if (exact.data && exact.data[0]) return exact.data[0]
      const like = await supabase.from('order_entries').select(cols).ilike('order_number', `%${term}%`).order('id', { ascending: false }).limit(1)
      if (like.data && like.data[0]) return like.data[0]
    }
    return null
  }

  // ── แผนกตัด: บันทึกว่าใครตัดผ้าไปกี่เมตร ────────────────────────────────
  // เมตรทั้งใบคิดตามสูตร (lib/fabricUsage.ts) แล้วหารเท่ากันตามจำนวนคนที่ลงชื่อขั้นตัดของออเดอร์นี้
  // เขียนเมตรของ "ทุกคน" ใหม่ทั้งชุดทุกครั้ง (RPC set_cut_meters) → ไม่มีทางนับซ้ำ/นับขาด
  // ทำเงียบๆ เบื้องหลัง ไม่ขึ้นอะไรบนหน้าสแกน (user สั่ง: ดูยอดที่เว็บ พนักงาน → ยอดตัดผ้า)
  async function splitCut(scanNo: string, items: unknown, isClaim: boolean) {
    try {
      const c = cutMeters(items, { isClaim })
      const { data } = await supabase.from('production_scans')
        .select('tech_code').eq('order_number', scanNo).eq('stage', 'ตัด')
      const codes = [...new Set((data ?? []).map((r: any) => r.tech_code).filter(Boolean))] as string[]
      if (!codes.length) return
      const share = round2(c.total / codes.length)
      const rows = codes.map(code => ({
        tech_code: code,
        meters: share,
        calc: { total: c.total, people: codes.length, share, lines: c.lines, warns: c.warns },
      }))
      const { error } = await supabase.rpc('set_cut_meters', { p_scan_no: scanNo, p_rows: rows })
      if (error) throw new Error(error.message)
    } catch {
      // เก็บเมตรไม่สำเร็จไม่ควรไปขวางงานสแกน (สถานะออเดอร์บันทึกไปแล้ว) — เงียบไว้
    }
  }

  // เลขที่ใช้อ้างแถวสแกนของออเดอร์/ใบเคลมนี้ (ตรงกับที่ RPC เขียนลง production_scans)
  const scanNoOf = (o: any, fallbackTerm = '') =>
    o?.isClaim ? `claim:${o.id}` : ((o?.order_number || '').trim() || fallbackTerm.trim() || `id:${o?.id}`)

  // กลับไปสแกนต่อ (ปุ่มกดเองของแผนกที่อัพโหลดรูปได้)
  function resumeScan() {
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
    setUploadedCnt({}); setUploadErr(''); setJoinInfo(null)
    askJoinRef.current = false
    setPhase('scanning')
    busyRef.current = false
    try { scannerRef.current?.resume() } catch {}
  }

  // เลือกรูปแล้วยังไม่อัพ — ย่อรูปก่อน (ประหยัดพื้นที่ R2) แล้วเปิดหน้าเช็ครูป กดยืนยันค่อยอัพโหลดจริง
  async function pickPhoto(file: File, tag: string) {
    const label = (UPLOAD_SLOTS[tech?.stageKey || ''] ?? []).find(s => s.tag === tag)?.label || 'รูปที่เลือก'
    const small = await compressImage(file)
    setPreview({ file: small, tag, url: URL.createObjectURL(small), label })
  }
  function cancelPreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }
  async function confirmPreview() {
    if (!preview) return
    const p = preview
    setPreview(null)
    URL.revokeObjectURL(p.url)
    await uploadPhoto(p.file, p.tag)
  }

  // อัพโหลดรูปเข้า Cloudflare R2 แล้ว append URL เข้า order_entries.packing_photos
  async function uploadPhoto(file: File, tag: string) {
    if (!order?.id) return
    setUploading(tag); setUploadErr('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const key = `${order.id}/${tag}-${Date.now()}.${ext}`
      const publicUrl = await uploadPackingFile(file, key)
      const { data: row } = await supabase.from('order_entries').select('packing_photos').eq('id', order.id).single()
      const cur = Array.isArray(row?.packing_photos) ? row.packing_photos : []
      const { error: err } = await supabase.from('order_entries')
        .update({ packing_photos: [...cur, publicUrl], updated_at: new Date().toISOString() }).eq('id', order.id)
      if (err) throw err
      setUploadedCnt(c => ({ ...c, [tag]: (c[tag] || 0) + 1 }))
      setPhotos(p => [...p, publicUrl])
    } catch (e: any) {
      setUploadErr(e?.message || String(e))
    }
    setUploading(null)
  }

  // ลบรูปออกจากโฟลเดอร์ออเดอร์: ลบไฟล์ (R2/Supabase ตามที่มา) + เอา URL ออกจาก packing_photos
  async function deletePhoto(url: string) {
    if (!order?.id || !window.confirm('ลบรูปนี้ออกจากออเดอร์?')) return
    setDelBusy(url); setUploadErr('')
    try {
      await deletePackingFile(url)
      const { data: row } = await supabase.from('order_entries').select('packing_photos').eq('id', order.id).single()
      const cur = Array.isArray(row?.packing_photos) ? row.packing_photos : []
      const { error: err } = await supabase.from('order_entries')
        .update({ packing_photos: cur.filter((u: string) => u !== url), updated_at: new Date().toISOString() }).eq('id', order.id)
      if (err) throw err
      setPhotos(p => p.filter(u => u !== url))
    } catch (e: any) {
      setUploadErr(e?.message || String(e))
    }
    setDelBusy(null)
  }

  // คืนค่า order ที่อัปเดตแล้วเมื่อสำเร็จ (แผนกจัดส่งแล้วใช้ต่อเป็นโหมดสแกนบาร์โค้ด) / null เมื่อไม่สำเร็จ
  // การบันทึกทั้งหมด (สถานะ + กันข้ามขั้น + sync กระดานงาน + log สแกน + ประวัติ) ทำใน RPC ตัวเดียว
  // ===== สแกน QR ใบเคลม → เดินสถานะงานเคลม (ตาราง claims ผ่าน RPC claim_scan_advance) =====
  // ‼️ ต้องรัน sql/claim_scan.sql ใน Supabase ก่อน ไม่งั้น RPC ไม่มีจริง
  async function runClaimScan(t: Tech, claimId: string): Promise<any> {
    const stage = resolveStage(t.stageKey)
    if (!stage) { setPhase('error'); setMsg('ไม่พบแผนกของผู้ใช้ กรุณาตั้งค่าใหม่'); return null }
    setUploadedCnt({}); setUploadErr(''); setPhotos([]); setJoinInfo(null); askJoinRef.current = false
    setPhase('working')

    const { data: c } = await supabase.from('claims')
      .select('id, claim_date, channel, customer_username, original_order_number, status, items')
      .eq('id', claimId).limit(1)
    const cl = c && c[0]
    if (!cl) { setOrder({ order_number: 'ใบเคลม (ไม่พบในระบบ)', isClaim: true }); setPhase('noorder'); return null }

    // ใช้โครงเดียวกับออเดอร์เพื่อให้หน้าจอผลลัพธ์ใช้ร่วมกันได้ (order_number = ป้ายที่โชว์)
    const base = {
      id: cl.id, isClaim: true, items: cl.items,
      order_number: 'เคลม ' + [cl.channel, cl.customer_username].filter(Boolean).join(': '),
      customer_name: cl.original_order_number ? 'ออเดอร์เดิม ' + cl.original_order_number : '',
      order_status: cl.status,
    }
    setOrder(base)

    const { data, error } = await supabase.rpc('claim_scan_advance', {
      p_claim_id: cl.id,
      p_stage_key: t.stageKey,
      p_tech_code: t.code,
      p_tech_name: t.name,
    })
    if (error) { setPhase('error'); setMsg(error.message); return null }
    if (!data?.ok) {
      if (data?.result === 'already') {
        setJoinInfo({ stage: data.stage || stage.label, people: Array.isArray(data.people) ? data.people : [], mine: !!data.mine })
        askJoinRef.current = true
        setPhase('already'); setMsg(`สถานะปัจจุบัน: ${data.current_status || 'รอของคืน'}`); return null
      }
      if (data?.result === 'bad_stage') { setPhase('error'); setMsg('งานเคลมไม่มีขั้นนี้ (เช่น แพ็คราง) — เปลี่ยนแผนกก่อนสแกน'); return null }
      if (data?.result === 'not_found') { setPhase('noorder'); return null }
      setPhase('error'); setMsg(String(data?.result || 'อัปเดตไม่สำเร็จ')); return null
    }
    const done = { ...base, order_status: data.status }
    setOrder(done)
    setPhase('done')
    // งานเคลม = งานแก้ → ทุกชนิดคิดเมตร ×1 (กติกาในชีท)
    if (t.stageKey === 'cut') splitCut(`claim:${cl.id}`, cl.items, true)
    return done
  }

  // แบบ all-or-nothing (sql/scan_advance_rpc.sql) — สำเร็จคือครบทุกตาราง พังคือไม่บันทึกอะไรเลย
  async function runScan(t: Tech, id: string, ord: string): Promise<any> {
    const stage = resolveStage(t.stageKey)
    if (!stage) { setPhase('error'); setMsg('ไม่พบแผนกของผู้ใช้ กรุณาตั้งค่าใหม่'); return null }
    if (!id && !ord) { setPhase('noorder'); setMsg(''); return null }
    setUploadedCnt({}); setUploadErr(''); setPhotos([]); setJoinInfo(null); askJoinRef.current = false
    setPhase('working')
    const o = await findOrder(id, ord)
    if (!o) { setOrder({ order_number: ord || `id:${id}` }); setPhase('noorder'); return null }
    setOrder(o)
    setPhotos(Array.isArray(o.packing_photos) ? o.packing_photos : [])

    const { data, error } = await supabase.rpc('scan_advance', {
      p_order_id: o.id,
      p_stage_key: t.stageKey,
      p_tech_code: t.code,
      p_tech_name: t.name,
      p_scanned_term: ord || '',
    })
    if (error) { setPhase('error'); setMsg(error.message); return null }
    if (!data?.ok) {
      if (data?.result === 'already') {
        // ขั้นนี้มีคนสแกนไปแล้ว → ถามว่าเป็นการช่วยกันทำหรือเปล่า (ยืนยันแล้วค่อยเรียก scan_join)
        setJoinInfo({ stage: data.stage || stage.label, people: Array.isArray(data.people) ? data.people : [], mine: !!data.mine })
        askJoinRef.current = true   // ค้างหน้าถามไว้ ห้าม auto-กลับไปสแกนต่อทับคำถาม
        setPhase('already'); setMsg(`สถานะปัจจุบัน: ${data.current_status || 'รอดำเนินการ'}`); return null
      }
      if (data?.result === 'not_found') { setPhase('noorder'); return null }
      setPhase('error'); setMsg(String(data?.result || 'อัปเดตไม่สำเร็จ')); return null
    }

    // แพ็คราง = ติ๊ก flag อย่างเดียว ไม่เปลี่ยนสถานะหลักของออเดอร์
    const special: SpecialKind | undefined = stage.special
    const done = special === 'rail' ? o : { ...o, order_status: data.status }
    setOrder(done)
    setPhase('done')
    if (t.stageKey === 'cut') splitCut(scanNoOf(o, ord), o.items, false)
    return done
  }

  // ยืนยัน "ช่วยกันทำขั้นนี้" — บันทึกชื่อเพิ่มลง production_scans (is_helper) ไม่เดินสถานะออเดอร์
  async function joinScan() {
    if (!order?.id || !tech || joining) return
    setJoining(true)
    try {
      const { data, error } = order.isClaim
        ? await supabase.rpc('claim_scan_join', {
            p_claim_id: order.id, p_stage_key: tech.stageKey, p_tech_code: tech.code, p_tech_name: tech.name,
          })
        : await supabase.rpc('scan_join', {
            p_order_id: order.id,
            p_stage_key: tech.stageKey,
            p_tech_code: tech.code,
            p_tech_name: tech.name,
            p_scanned_term: order.order_number || '',
          })
      if (error) { setMsg(error.message); setPhase('error') }
      else if (!data?.ok) {
        // คนเดิมสแกนซ้ำเอง — ไม่บันทึกซ้ำ กันนับผลงานเกินจริง
        if (data?.result === 'dup_self') { setMsg('คุณลงชื่อขั้นนี้ไปแล้ว ไม่ต้องลงซ้ำ'); setPhase('error') }
        else { setMsg(String(data?.result || 'บันทึกไม่สำเร็จ')); setPhase('error') }
      } else {
        setJoinInfo({ stage: data.stage, people: Array.isArray(data.people) ? data.people : [], mine: true })
        setPhase('joined')
        // ช่วยกันตัด → เฉลี่ยเมตรทั้งใบใหม่ตามจำนวนคนที่ลงชื่อ (ไม่ถามว่าใครตัดรายการไหนแล้ว)
        if (tech.stageKey === 'cut') splitCut(scanNoOf(order), order.items, !!order.isClaim)
      }
    } catch (e: any) {
      setMsg(e?.message || String(e)); setPhase('error')
    }
    askJoinRef.current = false
    setJoining(false)
  }

  // ยกเลิกการสแกนล่าสุด (สแกนผิด) — เรียก RPC scan_undo (all-or-nothing) ถอยสถานะ+ลบ log
  async function undoScan() {
    if (!order?.id || undoing) return
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }  // กันเด้งกลับไปสแกนทับหน้า "ยกเลิกแล้ว"
    setUndoing(true)
    try {
      const { data, error } = await supabase.rpc('scan_undo', {
        p_order_id: order.id,
        p_scanned_term: order.order_number || '',
      })
      if (error) { setMsg(error.message); setPhase('error') }
      else if (!data?.ok) { setMsg(data?.result === 'no_scan' ? 'ไม่พบรายการสแกนให้ยกเลิก' : String(data?.result || 'ยกเลิกไม่สำเร็จ')); setPhase('error') }
      else {
        setOrder((o: any) => o ? { ...o, order_status: data.status } : o); setPhase('undone')
        // ยกเลิกคนที่ตัด → เฉลี่ยเมตรใหม่ให้คนที่เหลือ (ไม่งั้นยอดรวมของออเดอร์นี้จะขาดไปส่วนหนึ่ง)
        if (tech?.stageKey === 'cut') splitCut(scanNoOf(order), order.items, !!order.isClaim)
      }
    } catch (e: any) {
      setMsg(e?.message || String(e)); setPhase('error')
    }
    setUndoing(false)
  }

  function saveLogin() {
    const emp = employees.find(e => e.code === pickCode)
    if (!emp || !pickStage) return
    localStorage.setItem(LS_KEY, JSON.stringify({ code: emp.code, name: `${emp.nickname} (${emp.code})`, stageKey: pickStage }))
    setTech(loadTech())
  }

  // กด "เปลี่ยน" — จำชื่อพนักงานที่ตั้งไว้ ให้เลือกแผนกใหม่ได้เลย (ไม่ต้องกรอกชื่อซ้ำ)
  // อยากเปลี่ยนชื่อด้วยก็กด × ที่ชิปชื่อในหน้าตั้งค่าได้
  function logout() {
    const s = scannerRef.current
    if (s) { try { s.stop().catch(() => {}) } catch {} }
    const cur = loadTech()
    setTech(null); startedRef.current = false; setCamState('idle'); setQ('')
    setPickCode(cur?.code ?? ''); setPickStage('')
  }

  if (!ready) return <div style={centerWrap}><div style={{ opacity: 0.6 }}>กำลังโหลด…</div></div>

  // ---------- ตั้งค่าครั้งแรก ----------
  if (!tech) {
    const matches = q.trim() ? employees.filter(e => e.nickname.includes(q) || e.realName.includes(q) || e.code.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
    const picked = employees.find(e => e.code === pickCode)
    return (
      <div style={centerWrap}>
        <div style={card}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{picked ? 'เปลี่ยนแผนก' : 'ตั้งค่าเครื่องสแกน'}</h1>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>{picked ? 'เลือกแผนกใหม่ได้เลย — อยากเปลี่ยนชื่อกด × ที่ชื่อ' : 'ทำครั้งเดียวต่อมือถือ — เลือกชื่อและแผนกของคุณ'}</p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, textAlign: 'left', marginBottom: 6 }}>1. ชื่อพนักงาน</label>
          {picked ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #2563eb', background: '#eff6ff', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
              <span style={{ fontWeight: 700 }}>{picked.nickname} · {picked.realName} <span style={{ color: '#2563eb' }}>({picked.code})</span></span>
              <button onClick={() => { setPickCode(''); setQ('') }} style={{ border: 'none', background: 'transparent', color: '#666', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์ชื่อเล่น / ชื่อจริง / รหัส"
                style={{ width: '100%', border: '1px solid #ccc', borderRadius: 10, padding: '11px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              {matches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 10, marginTop: 4, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', zIndex: 10, overflow: 'hidden', textAlign: 'left' }}>
                  {matches.map(e => (
                    <div key={e.code} onClick={() => { setPickCode(e.code); setQ('') }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0f0f0' }}>
                      <b>{e.nickname}</b> · {e.realName} <span style={{ color: '#2563eb' }}>{e.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, textAlign: 'left', marginBottom: 6 }}>2. แผนกของคุณ</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
            {[...STAGES, ...SPECIAL_STAGES].map(s => (
              <button key={s.key} onClick={() => setPickStage(s.key)}
                style={{ padding: 14, borderRadius: 12, border: pickStage === s.key ? '2px solid #2563eb' : '1px solid #ccc', background: pickStage === s.key ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                {s.label}<div style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>→ {s.status}</div>
              </button>
            ))}
          </div>
          <button onClick={saveLogin} disabled={!pickCode || !pickStage}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: (!pickCode || !pickStage) ? '#c7c7c7' : '#2563eb', color: '#fff', fontSize: 16, fontWeight: 700, cursor: (!pickCode || !pickStage) ? 'not-allowed' : 'pointer' }}>บันทึก</button>
        </div>
      </div>
    )
  }

  const stage = resolveStage(tech.stageKey)
  const stageColor = '#2563eb'
  // งานเคลมยังไม่มีที่เก็บรูป (packing_photos อยู่ที่ตารางออเดอร์) → ไม่โชว์ปุ่มอัพรูป
  const slots = order?.isClaim ? [] : (UPLOAD_SLOTS[tech.stageKey] ?? [])
  // อัพรูปได้เมื่อเจอออเดอร์แล้ว (done หรือ already — เผื่อสแกนซ้ำเพื่อเพิ่มรูป)
  const canUpload = slots.length > 0 && (phase === 'done' || phase === 'already' || phase === 'joined') && order?.id

  // ---------- โหมดลิงก์ (มาจากแอปกล้องของเครื่อง) ----------
  if (urlOrder || urlId) {
    return (
      <div style={centerWrap}>
        <div style={card}>
          <Identity tech={tech} stageLabel={stage?.label} onLogout={logout} />
          <Result phase={phase} order={order} msg={msg} stage={stage} onUndo={order?.isClaim ? undefined : undoScan} undoing={undoing} />
          {canUpload && <PhotoUpload slots={slots} uploading={uploading} counts={uploadedCnt} err={uploadErr} onPick={pickPhoto} photos={photos} delBusy={delBusy} onDelete={deletePhoto} />}
          <a href="/scan" style={{ display: 'inline-block', marginTop: 18, color: stageColor, fontSize: 14, fontWeight: 600 }}>เปิดกล้องสแกนต่อ →</a>
        </div>
        {preview && <PhotoPreview preview={preview} onCancel={cancelPreview} onConfirm={confirmPreview} />}
      </div>
    )
  }

  // ---------- โหมดสแกนในแอป ----------
  const showOverlay = phase !== 'scanning' && phase !== 'barcode'
  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 480, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ textAlign: 'left', fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>{tech.name}</div>
          <div style={{ color: '#7dd3fc' }}>แผนก {stage?.label} → {stage?.status}</div>
        </div>
        <button onClick={logout} style={{ border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>เปลี่ยน</button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, flex: 1 }}>
        <div id="qr-reader" style={{ width: '100%' }} />

        {camState !== 'on' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {camState === 'error' ? (
              <>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📷</div>
                <p style={{ fontSize: 14, color: '#fca5a5', marginBottom: 14 }}>เปิดกล้องไม่ได้ — โปรดอนุญาตให้เว็บใช้กล้อง<br /><span style={{ fontSize: 12, color: '#94a3b8' }}>{camErr}</span></p>
                <button onClick={() => { startedRef.current = false; startCamera() }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>ลองอีกครั้ง</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📷</div>
                <button onClick={() => { startedRef.current = false; startCamera() }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                  {camState === 'starting' ? 'กำลังเปิดกล้อง…' : 'แตะเพื่อเปิดกล้อง'}
                </button>
              </>
            )}
          </div>
        )}

        {camState === 'on' && !showOverlay && phase !== 'barcode' && (
          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 15, color: '#fff', textShadow: '0 1px 4px #000' }}>
            จ่อ QR บนใบออเดอร์ให้อยู่ในกรอบ
          </div>
        )}

        {shipToast && phase === 'scanning' && (
          <div style={{ position: 'absolute', top: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: '#16a34a', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>{shipToast}</div>
          </div>
        )}

        {/* โหมดสแกนบาร์โค้ดเลขพัสดุ — กล้องยังเปิดอยู่ แผงคุมอยู่ด้านล่าง */}
        {phase === 'barcode' && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(11,18,32,0.95)', borderTop: '1px solid rgba(255,255,255,0.15)', padding: '14px 16px 18px', textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#7dd3fc', marginBottom: 2 }}>
              📦 สแกน QR เลขพัสดุ
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              ออเดอร์ <b style={{ color: '#fff' }}>{shipRef.current?.orderNumber || order?.customer_name || ''}</b> — จ่อ QR บนใบปะหน้าทีละกล่อง มีหลายกล่องสแกนต่อได้เลย
            </div>
            {shipNos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {shipNos.map(x => (
                  <span key={x.no} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#16a34a', color: '#fff', borderRadius: 8, padding: '4px 6px 4px 10px', fontSize: 12, fontWeight: 700 }}>
                    ✓ {x.no}
                    <select value={x.carrier} onChange={e => setShipCarrier(x.no, e.target.value)}
                      style={{ border: 'none', borderRadius: 6, background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 4px', outline: 'none', cursor: 'pointer' }}>
                      {CARRIER_OPTIONS.map(c => <option key={c} value={c} style={{ color: '#111' }}>{c}</option>)}
                    </select>
                    <button onClick={() => removeShipNo(x.no)} aria-label={`เอา ${x.no} ออก`}
                      style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 14, lineHeight: 1, padding: '0 4px', cursor: 'pointer' }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            {shipMsg && <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>{shipMsg}</div>}

            {/* ใบไหนไม่มี QR / QR เลอะอ่านไม่ออก → พิมพ์เลขเองได้ ไม่ต้องกลับไปทำที่เว็บคอม */}
            <form onSubmit={e => { e.preventDefault(); if (addShipNo(shipTyped)) setShipTyped('') }}
              style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={shipTyped} onChange={e => setShipTyped(e.target.value)} placeholder="พิมพ์เลขพัสดุเอง"
                autoComplete="off" autoCapitalize="characters" spellCheck={false}
                style={{ flex: 1, minWidth: 0, borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '10px 12px', fontSize: 14, outline: 'none' }} />
              <button type="submit" disabled={!shipTyped.trim()}
                style={{ borderRadius: 10, border: 'none', background: shipTyped.trim() ? '#2563eb' : '#475569', color: '#fff', padding: '0 16px', fontSize: 14, fontWeight: 700, cursor: shipTyped.trim() ? 'pointer' : 'not-allowed' }}>เพิ่ม</button>
            </form>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => finishBarcode(false)} disabled={shipSaving}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#cbd5e1', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                ข้าม
              </button>
              <button onClick={() => finishBarcode(true)} disabled={shipSaving || shipNos.length === 0}
                style={{ flex: 2, padding: 12, borderRadius: 12, border: 'none', background: shipNos.length === 0 ? '#475569' : '#16a34a', color: '#fff', fontSize: 15, fontWeight: 800, cursor: shipNos.length === 0 ? 'not-allowed' : 'pointer' }}>
                {shipSaving ? 'กำลังบันทึก…' : shipNos.length > 0 ? `บันทึก ${shipNos.length} เลข ✓` : 'ยังไม่มีเลขพัสดุ'}
              </button>
            </div>
          </div>
        )}

        {showOverlay && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,18,32,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
            <div style={{ ...card, maxWidth: 380 }}>
              <Result phase={phase} order={order} msg={msg} stage={stage} onUndo={order?.isClaim ? undefined : undoScan} undoing={undoing}
                joinInfo={joinInfo} onJoin={joinScan} onSkipJoin={resumeScan} joining={joining} />
              {canUpload && <PhotoUpload slots={slots} uploading={uploading} counts={uploadedCnt} err={uploadErr} onPick={pickPhoto} photos={photos} delBusy={delBusy} onDelete={deletePhoto} />}
              {/* หน้า 'already' ที่ยังรอตอบ "ลงชื่อช่วยไหม" ไม่ต้องมีปุ่มสแกนต่อ — ปุ่ม "ไม่ใช่" ทำหน้าที่นั้นแทน */}
              {['done', 'already', 'undone', 'error', 'joined'].includes(phase) && !(phase === 'already' && joinInfo && !joinInfo.mine) && (
                <button onClick={resumeScan} disabled={uploading !== null}
                  style={{ width: '100%', marginTop: 16, padding: 13, borderRadius: 12, border: 'none', background: uploading ? '#c7c7c7' : '#2563eb', color: '#fff', fontSize: 15, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                  สแกนต่อ →
                </button>
              )}
            </div>
          </div>
        )}

        {preview && <PhotoPreview preview={preview} onCancel={cancelPreview} onConfirm={confirmPreview} />}
      </div>
    </div>
  )
}

// หน้าเช็ครูปก่อนยืนยันอัพโหลด — เต็มจอ กดยืนยันค่อยอัพจริง / ไม่ใช่รูปนี้กดเลือกใหม่
function PhotoPreview({ preview, onCancel, onConfirm }: {
  preview: { url: string; label: string }
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,18,32,0.96)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#7dd3fc', marginBottom: 4 }}>เช็ครูปก่อนอัพโหลด</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>{preview.label} — รูปถูกต้องไหม?</div>
      <img src={preview.url} alt="" style={{ maxWidth: '100%', maxHeight: '58dvh', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 18, width: '100%', maxWidth: 400 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: 13, borderRadius: 12, border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#cbd5e1', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ✕ เลือกใหม่
        </button>
        <button onClick={onConfirm}
          style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: '#16a34a', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          ✓ ยืนยันอัพโหลด
        </button>
      </div>
    </div>
  )
}

// ปุ่มถ่าย/เลือกรูปอัพโหลด — อัพซ้ำได้หลายรูปต่อช่อง + รูปที่อัพแล้วของออเดอร์ (ลบได้)
function PhotoUpload({ slots, uploading, counts, err, onPick, photos, delBusy, onDelete }: {
  slots: { tag: string; label: string }[]
  uploading: string | null
  counts: Record<string, number>
  err: string
  onPick: (file: File, tag: string) => void
  photos: string[]
  delBusy: string | null
  onDelete: (url: string) => void
}) {
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #eee', textAlign: 'left' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>📷 อัพโหลดรูป</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {slots.map(s => {
          const done = counts[s.tag] || 0
          const busy = uploading === s.tag
          return (
            <label key={s.tag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: done ? '1.5px solid #16a34a' : '1.5px dashed #94a3b8', background: done ? '#f0fdf4' : '#f8fafc', borderRadius: 12, padding: '12px 14px', cursor: busy ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
              {/* ไม่ใส่ capture → มือถือให้เลือกได้ทั้งถ่ายใหม่และรูปในเครื่อง */}
              <input type="file" accept="image/*" disabled={busy} style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f, s.tag); e.target.value = '' }} />
              <span>{busy ? '⏳ กำลังอัพโหลด…' : s.label}</span>
              <span style={{ fontSize: 12, color: done ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                {done > 0 ? `✓ ${done} รูป · เพิ่มอีก` : 'ถ่าย/เลือกรูป'}
              </span>
            </label>
          )
        })}
      </div>
      {photos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>รูปในออเดอร์นี้ ({photos.length}) — กด ✕ เพื่อลบ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {photos.map(u => (
              <div key={u} style={{ position: 'relative' }}>
                <img src={u} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10, display: 'block', opacity: delBusy === u ? 0.4 : 1 }} />
                <button onClick={() => onDelete(u)} disabled={delBusy !== null}
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.92)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {delBusy === u ? '…' : '✕'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {err && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>ไม่สำเร็จ: {err}</p>}
    </div>
  )
}

function Identity({ tech, stageLabel, onLogout }: { tech: Tech; stageLabel?: string; onLogout: () => void }) {
  return (
    <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
      {tech.name} · แผนก <b style={{ color: '#1a1a1a' }}>{stageLabel}</b>
      <button onClick={onLogout} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>เปลี่ยน</button>
    </div>
  )
}

function Result({ phase, order, msg, stage, onUndo, undoing, joinInfo, onJoin, onSkipJoin, joining }: {
  phase: Phase; order: any; msg: string; stage: any; onUndo?: () => void; undoing?: boolean
  joinInfo?: { stage: string; people: string[]; mine: boolean } | null
  onJoin?: () => void; onSkipJoin?: () => void; joining?: boolean
}) {
  if (phase === 'working') return <div style={{ fontSize: 16, padding: '24px 0' }}>⏳ กำลังอัปเดต…</div>
  if (phase === 'done') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>✅</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: '#16a34a' }}>{order?.isClaim ? (order?.order_status || stage?.status) : stage?.status}</h1>
      <p style={{ fontSize: 15 }}>{order?.isClaim ? '' : 'ออเดอร์ '}<b>{order?.order_number}</b></p>
      <p style={{ fontSize: 14, color: '#666' }}>{order?.customer_name}</p>
      {onUndo && (
        <button onClick={onUndo} disabled={undoing}
          style={{ marginTop: 16, border: '1px solid #dc2626', background: undoing ? '#fca5a5' : '#fff', color: '#dc2626', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: undoing ? 'default' : 'pointer' }}>
          {undoing ? 'กำลังยกเลิก…' : 'ยกเลิก'}
        </button>
      )}
    </>
  )
  if (phase === 'undone') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>↩️</div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: '#dc2626' }}>ยกเลิกการสแกนแล้ว</h1>
      <p style={{ fontSize: 15 }}>{order?.isClaim ? '' : 'ออเดอร์ '}<b>{order?.order_number}</b></p>
      <p style={{ fontSize: 14, color: '#666' }}>สถานะกลับเป็น: <b>{order?.order_status || 'รอดำเนินการ'}</b></p>
    </>
  )
  // สแกนซ้ำ = ส่วนใหญ่คือแบ่งงานกันทำหลายคนใน 1 ออเดอร์ → ถามก่อนว่าจะลงชื่อช่วยไหม (ไม่เดินสถานะให้เอง)
  if (phase === 'already') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>ℹ️</div>
      <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#d97706' }}>ออเดอร์นี้สแกนไปแล้ว</h1>
      <p style={{ fontSize: 15 }}>{order?.isClaim ? '' : 'ออเดอร์ '}<b>{order?.order_number}</b></p>
      <p style={{ fontSize: 14, color: '#666' }}>{msg}</p>
      {joinInfo && joinInfo.people.length > 0 && (
        <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
          ขั้น <b style={{ color: '#1a1a1a' }}>{joinInfo.stage}</b> สแกนโดย: {joinInfo.people.join(', ')}
        </p>
      )}
      {joinInfo?.mine ? (
        <p style={{ fontSize: 13, color: '#d97706', marginTop: 12, fontWeight: 700 }}>คุณลงชื่อขั้นนี้ไปแล้ว ไม่ต้องลงซ้ำ</p>
      ) : onJoin && (
        <>
          <p style={{ fontSize: 14, color: '#1a1a1a', marginTop: 14, fontWeight: 700 }}>
            คุณช่วยทำขั้น{joinInfo?.stage ? ` "${joinInfo.stage}" ` : ''}ของออเดอร์นี้ด้วยใช่ไหม?
          </p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>ยืนยันแล้วจะบันทึกชื่อคุณเพิ่ม (สถานะออเดอร์ไม่เปลี่ยน)</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={onSkipJoin} disabled={joining}
              style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #ccc', background: '#fff', color: '#555', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ไม่ใช่
            </button>
            <button onClick={onJoin} disabled={joining}
              style={{ flex: 2, padding: 12, borderRadius: 12, border: 'none', background: joining ? '#c7c7c7' : '#16a34a', color: '#fff', fontSize: 15, fontWeight: 800, cursor: joining ? 'default' : 'pointer' }}>
              {joining ? 'กำลังบันทึก…' : 'ยืนยัน ลงชื่อเพิ่ม'}
            </button>
          </div>
        </>
      )}
    </>
  )
  if (phase === 'joined') return (
    <>
      {/* ไม่มีอีโมจิหน้านี้ (ผู้ใช้สั่งเอาออก) — เว้นระยะบนแทนให้การ์ดไม่ดูชิดขอบ */}
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '10px 0 6px', color: '#16a34a' }}>บันทึกว่าช่วยทำแล้ว</h1>
      <p style={{ fontSize: 15 }}>{order?.isClaim ? '' : 'ออเดอร์ '}<b>{order?.order_number}</b></p>
      <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
        ขั้น <b style={{ color: '#1a1a1a' }}>{joinInfo?.stage}</b> — {(joinInfo?.people ?? []).join(', ')}
      </p>
      {onUndo && (
        <button onClick={onUndo} disabled={undoing}
          style={{ marginTop: 16, border: '1px solid #dc2626', background: undoing ? '#fca5a5' : '#fff', color: '#dc2626', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: undoing ? 'default' : 'pointer' }}>
          {undoing ? 'กำลังยกเลิก…' : 'ยกเลิก'}
        </button>
      )}
    </>
  )
  if (phase === 'noorder') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>❓</div>
      <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#dc2626' }}>ไม่พบออเดอร์</h1>
      <p style={{ fontSize: 14, color: '#666' }}>{order?.order_number || 'QR ไม่ถูกต้อง'}</p>
    </>
  )
  if (phase === 'error') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>⚠️</div>
      <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#dc2626' }}>เกิดข้อผิดพลาด</h1>
      <p style={{ fontSize: 13, color: '#666' }}>{msg}</p>
    </>
  )
  return null
}

export default function ScanPage() {
  return (
    <>
      <Suspense fallback={<div style={centerWrap}><div style={{ opacity: 0.6 }}>กำลังโหลด…</div></div>}>
        <ScanContent />
      </Suspense>
      <HubButton dark />
    </>
  )
}
