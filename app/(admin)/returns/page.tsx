'use client'

// หมวด "พัสดุส่งกลับ" — พัสดุที่ลูกค้าส่งคืนเข้าร้าน
// ทุกช่องกดแล้วพิมพ์ได้ในตารางเลย (ออกจากช่อง/กด Enter = บันทึก · Esc = ยกเลิก) · ย้อนได้ด้วย Ctrl+Z เหมือนหน้าอื่น
// วิดีโอตอนแกะ + รูป อัพตรงเข้า R2 (โฟลเดอร์ returns/<id>/) แล้วบันทึก URL ลงแถวทันที
// ช่อง "จากออเดอร์" = ผูกกับงานเคลม (claims) — กดแล้วพิมพ์ค้นเหมือนช่องอื่น (เลขออเดอร์เดิม/ชื่อลูกค้า/เลขพัสดุส่งคืน/เบอร์)
// ตาราง: sql/create_return_parcels.sql + sql/add_return_parcels_claim.sql (คอลัมน์ claim_id)
import { useState, useEffect, useRef, useMemo } from 'react'
import AnchoredMenu from '@/components/AnchoredMenu'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { tUpdate, tInsert, tDelete, prevOf } from '@/lib/trackedDb'
import { CARRIER_OPTIONS, detectCarrier } from '@/lib/carriers'
import { compressImage } from '@/lib/packingPhotos'
import { compressVideo } from '@/lib/videoCompress'
import { useConfirm } from '@/components/ConfirmDialog'
import { nextSerial } from '@/lib/serialNo'
import { buildCustomerBook, type CustomerEntry } from '@/lib/customerBook'
import CustomerPickStep from '@/components/CustomerPickStep'
import CreamSelect from '@/components/CreamSelect'
import { CourierIcon } from '@/components/BrandMark'
import { useStableView } from '@/lib/useStableView'
import { TH_MONTHS } from '@/lib/shopCalendar'

type Media = { url: string; name?: string; caption?: string }
type Parcel = {
  id: string
  serial_no?: string | null    // เลขที่ใบพัสดุตีกลับ BP0001 — ออกตอนสร้าง ไม่เปลี่ยนอีก (ดู lib/serialNo.ts)
  sender_name: string | null
  items: string | null
  carrier: string | null
  tracking_no: string | null
  orig_carrier: string | null
  orig_tracking_no: string | null
  orig_order_number: string | null
  address: string | null
  phone: string | null
  videos: Media[] | null
  photos: Media[] | null
  claim_id: string | null
  created_at: string
  updated_at: string
}
type ClaimLite = { id: string; original_order_number: string | null; customer_username: string | null; channel: string | null; claim_date: string | null; return_tracking: string | null; status: string | null }
const CLAIM_COLS = 'id, original_order_number, customer_username, channel, claim_date, return_tracking, status'

type TextKey = 'sender_name' | 'items' | 'carrier' | 'tracking_no' | 'orig_carrier' | 'orig_tracking_no' | 'orig_order_number' | 'address' | 'phone'
const COLS: { key: TextKey; label: string; w: number; multiline?: boolean; carrier?: boolean }[] = [
  { key: 'sender_name', label: 'ชื่อผู้ส่ง', w: 140 },
  { key: 'items', label: 'รายการ', w: 200, multiline: true },
  { key: 'carrier', label: 'บริษัทขนส่ง', w: 120, carrier: true },
  { key: 'tracking_no', label: 'เลขพัสดุ', w: 150 },
  { key: 'orig_carrier', label: 'บ.ขนส่งเดิม', w: 120, carrier: true },
  { key: 'orig_tracking_no', label: 'เลขพัสดุเดิม', w: 150 },
  { key: 'orig_order_number', label: 'เลขออเดอร์เดิม', w: 150 },
  { key: 'address', label: 'ที่อยู่', w: 220, multiline: true },
  { key: 'phone', label: 'เบอร์โทร', w: 110 },
]

// ── ตัวกรอง/เรียงที่หัวคอลัมน์ + ซ่อน/โชว์คอลัมน์ (แบบเดียวกับหน้างานเคลม/ออเดอร์) ──
// date = เรียง + ช่วงวันที่ · pick = เรียง + ติ๊กเลือกค่า · text = เรียง · bool = มี/ไม่มี
type ColKind = 'date' | 'pick' | 'text' | 'bool'
type ColId = 'created' | 'serial' | TextKey | 'videos' | 'photos' | 'claim'
const NONE = '(ไม่ระบุ)'
const FILTER_DEFS: { id: ColId; kind: ColKind; get: (r: Parcel) => string | number | null | undefined; yes?: string; no?: string }[] = [
  { id: 'created', kind: 'date', get: r => r.created_at },
  { id: 'serial', kind: 'text', get: r => r.serial_no },
  { id: 'sender_name', kind: 'text', get: r => r.sender_name },
  { id: 'carrier', kind: 'pick', get: r => r.carrier },
  { id: 'tracking_no', kind: 'text', get: r => r.tracking_no },
  { id: 'orig_carrier', kind: 'pick', get: r => r.orig_carrier },
  { id: 'orig_tracking_no', kind: 'text', get: r => r.orig_tracking_no },
  { id: 'orig_order_number', kind: 'text', get: r => r.orig_order_number },
  { id: 'videos', kind: 'bool', get: r => (r.videos?.length ?? 0) || null, yes: 'มีวิดีโอ', no: 'ยังไม่มีวิดีโอ' },
  { id: 'photos', kind: 'bool', get: r => (r.photos?.length ?? 0) || null, yes: 'มีรูป', no: 'ยังไม่มีรูป' },
  { id: 'claim', kind: 'bool', get: r => r.claim_id, yes: 'ผูกงานเคลมแล้ว', no: 'ยังไม่ผูกงานเคลม' },
]
const SORT_LABELS: Record<ColKind, [string, string]> = {
  date: ['เก่าสุด → ใหม่สุด', 'ใหม่สุด → เก่าสุด'], pick: ['ก → ฮ', 'ฮ → ก'], text: ['ก → ฮ', 'ฮ → ก'], bool: ['', ''],
}
const ALL_COLS: { id: ColId; label: string }[] = [
  { id: 'created', label: 'วันที่ลง' }, { id: 'serial', label: 'Serial' },
  ...COLS.map(c => ({ id: c.key as ColId, label: c.label })),
  { id: 'videos', label: 'วิดีโอตอนแกะ' }, { id: 'photos', label: 'รูป' }, { id: 'claim', label: 'จากออเดอร์' },
]
const colLabel = (id: ColId) => ALL_COLS.find(c => c.id === id)!.label

const TABLE = 'return_parcels'
const SQL_FILE = 'sql/create_return_parcels.sql'
const noTableMsg = (m: string) => /return_parcels/.test(m) && /(does not exist|schema cache|not find)/i.test(m)
  ? `ยังไม่มีตาราง return_parcels ในฐานข้อมูล — รันไฟล์ ${SQL_FILE} ใน Supabase ก่อน`
  : m

// อัพไฟล์เข้า R2 ผ่าน presigned URL (เหมือน lib/packingPhotos) แต่ใช้ XHR เพื่อโชว์ % — วิดีโอไฟล์ใหญ่รอนาน
async function uploadWithProgress(file: File, key: string, onProgress: (pct: number) => void): Promise<string> {
  const ct = file.type || 'application/octet-stream'
  const res = await fetch('/api/r2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sign', key, contentType: ct }) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.uploadUrl) throw new Error(j.error || 'ขอลิงก์อัพโหลดไม่สำเร็จ')
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', j.uploadUrl)
    xhr.setRequestHeader('Content-Type', ct)
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`อัพโหลดไม่สำเร็จ (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('อัพโหลดไม่สำเร็จ — เน็ตหลุด?'))
    xhr.send(file)
  })
  return j.publicUrl as string
}

const errMsg = (e: unknown) => noTableMsg(e instanceof Error ? e.message : (e as { message?: string })?.message || String(e))
const mediaKey = (id: string, ext: string) => `returns/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

// ตัดอักขระที่ทำให้ตัวกรอง or() ของ Supabase พัง
const clean = (s: string) => s.replace(/[,()%*\\]/g, ' ').trim()
const claimLabel = (c: ClaimLite) => c.original_order_number || c.customer_username || '(เคลมไม่มีเลขออเดอร์)'

export default function ReturnParcelsPage() {
  // ‼️ ไม่อ่านแคชตอนสร้าง state — แคชอยู่ข้ามการรีเฟรช ฝั่งเซิร์ฟเวอร์ไม่มี → เลขไม่ตรงกัน (hydration error)
  //    อ่านใน effect แทน (โชว์ของเดิมทันทีหลังหน้าขึ้น แล้ว load() ดึงของใหม่ตามมา)
  const [rows, setRows] = useState<Parcel[]>([])
  const rowsRef = useRef(rows)   // ค่าล่าสุดของแถว — อัพวิดีโอนานหลายนาที ระหว่างนั้นอาจแก้ช่องอื่นไปแล้ว
  useEffect(() => { rowsRef.current = rows }, [rows])
  const [claims, setClaims] = useState<Record<string, ClaimLite>>({})   // งานเคลมที่ผูกอยู่ (ไว้โชว์เลขออเดอร์/ชื่อ)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)          // `${id}:${key}` ช่องที่กำลังพิมพ์
  const [uploading, setUploading] = useState<Record<string, string>>({}) // `${id}:videos` → "45%"
  const [actionMenu, setActionMenu] = useState<{ id: string; rect: DOMRect } | null>(null)   // rect ของปุ่ม ··· (AnchoredMenu พลิกขึ้นเองถ้าชิดขอบล่าง)
  // แถวไม่กระโดดหนีตอนแก้ช่องที่กำลังเรียง/กรองอยู่ — กรอง+เรียงด้วย stable() แสดงผลด้วย live()
  const { snapshot, stable, live } = useStableView<Parcel>(rows)
  const [colSort, setColSort] = useState<{ key: ColId; dir: 'asc' | 'desc' } | null>(null)
  const [colPick, setColPick] = useState<Partial<Record<ColId, string[]>>>({})
  const [colRange, setColRange] = useState<Partial<Record<ColId, { from: string; to: string }>>>({})
  const [colBool, setColBool] = useState<Partial<Record<ColId, boolean | null>>>({})
  const [colMenu, setColMenu] = useState<{ key: ColId; rect: DOMRect } | null>(null)
  const [hiddenCols, setHiddenCols] = useState<ColId[]>([])
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem('returns_hidden_cols') || '[]'); if (Array.isArray(v)) setHiddenCols(v) } catch {} }, [])
  const saveHidden = (next: ColId[]) => { setHiddenCols(next); try { localStorage.setItem('returns_hidden_cols', JSON.stringify(next)) } catch {} }
  const showCol = (id: ColId) => !hiddenCols.includes(id)
  const [openColPicker, setOpenColPicker] = useState(false)
  const [month, setMonth] = useState('all')   // 'all' | 'YYYY-MM' (เดือนที่ลงพัสดุ)
  const { ask, confirmDialog } = useConfirm()

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Parcel>(() =>
      supabase.from(TABLE).select('*').order('created_at', { ascending: false }).order('id', { ascending: true }))
    if (err) { setError(`โหลดข้อมูลไม่ได้: ${noTableMsg(err.message)}`); setLoading(false); return }
    setPageCache(TABLE, data)
    setRows(data)
    snapshot(data)
    setLoading(false)
    const ids = [...new Set(data.map(r => r.claim_id).filter(Boolean))] as string[]
    if (ids.length) {
      const map: Record<string, ClaimLite> = {}
      for (let i = 0; i < ids.length; i += 100) {
        const { data: cs } = await supabase.from('claims').select(CLAIM_COLS).in('id', ids.slice(i, i + 100))
        for (const c of (cs ?? []) as ClaimLite[]) map[c.id] = c
      }
      setClaims(map)
    }
  }
  useEffect(() => {
    const cached = getPageCache<Parcel[]>(TABLE)
    if (cached) { setRows(cached); snapshot(cached); setLoading(false) }
    load()
  }, [])

  const label = (r: Parcel) => r.sender_name || r.tracking_no || 'ไม่มีชื่อ'

  // บันทึกช่องเดียว — เปลี่ยนบนจอทันที แล้วค่อยเขียนฐาน · พลาด = คืนค่าเดิม + บอกเหตุผล
  const saveField = async (r: Parcel, patch: Partial<Parcel>, what: string) => {
    const now = new Date().toISOString()
    const full = { ...patch, updated_at: now }
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...full } : x))
    try {
      await tUpdate(TABLE, r.id, full, prevOf(r, full), `แก้${what} พัสดุส่งกลับ ${label(r)}`, load)
    } catch (e) {
      setRows(prev => prev.map(x => x.id === r.id ? r : x))
      setError(`บันทึกไม่สำเร็จ: ${errMsg(e)}`)
    }
  }

  // ===== เพิ่มพัสดุส่งกลับ: ถามชื่อผู้ส่ง (ลูกค้า) ก่อนเป็นอย่างแรก =====
  // ‼️ กันลงชื่อลูกค้าคนเดียวกันคนละแบบจนโฟลเดอร์ลูกค้าแตก — ค้นจากชื่อที่เคยลงไว้ในใบออเดอร์
  //    ดึงรายชื่อตอนกดเพิ่มครั้งแรกครั้งเดียว และดึงแค่ 4 ช่อง (ประหยัด Egress ของ Supabase)
  const [custStep, setCustStep] = useState(false)
  const [orderNames, setOrderNames] = useState<{ name: string | null; phone: string | null; order_number: string | null; date: string | null }[] | null>(null)

  const customerBook: CustomerEntry[] = useMemo(() => buildCustomerBook([
    ...(orderNames ?? []),
    ...rows.map(r => ({ name: r.sender_name, phone: r.phone, order_number: r.orig_order_number, date: r.created_at })),
  ]), [orderNames, rows])

  const openAdd = async () => {
    setCustStep(true)
    if (orderNames === null) {
      const { data } = await supabase.from('order_entries').select('customer_name, phone, order_number, entry_date')
      setOrderNames((data ?? []).map(r => {
        const o = r as { customer_name: string | null; phone: string | null; order_number: string | null; entry_date: string | null }
        return { name: o.customer_name, phone: o.phone, order_number: o.order_number, date: o.entry_date }
      }))
    }
  }

  const addRow = async (senderName = '', senderPhone = '') => {
    setCustStep(false)
    setError('')
    try {
      // เลขที่ใบ BP0001 — ถามเลขล่าสุดจากฐานตอนกดเพิ่ม (แอดมินหลายคนเปิดค้างพร้อมกัน)
      const { data: usedSerials, error: serErr } = await supabase.from(TABLE).select('serial_no').not('serial_no', 'is', null)
      // ยังไม่ได้รัน sql/add_serial_no.sql (ไม่มีคอลัมน์) → ข้ามไป เพิ่มแถวได้ตามปกติ ไม่พัง
      const serialPatch = serErr ? {} : { serial_no: nextSerial('return', (usedSerials ?? []).map(x => (x as { serial_no: string | null }).serial_no)) }
      const saved = await tInsert(TABLE, {
        videos: [], photos: [], ...serialPatch,
        ...(senderName ? { sender_name: senderName } : {}),
        ...(senderPhone ? { phone: senderPhone } : {}),
      }, 'เพิ่มพัสดุส่งกลับ', load) as Parcel
      setRows(prev => [saved, ...prev])
      setSearch('')
      setEditing(`${saved.id}:${senderName ? 'items' : 'sender_name'}`)   // ได้ชื่อแล้วเปิดช่องถัดไปให้พิมพ์ต่อ
    } catch (e) {
      setError(`เพิ่มแถวไม่สำเร็จ: ${errMsg(e)}`)
    }
  }

  const delRow = async (r: Parcel) => {
    if (!(await ask(`ลบพัสดุส่งกลับของ "${label(r)}" ?`, { okText: 'ลบ', danger: true }))) return
    try {
      await tDelete(TABLE, r, `ลบพัสดุส่งกลับ ${label(r)}`, load)
      setRows(prev => prev.filter(x => x.id !== r.id))
    } catch (e) {
      setError(`ลบไม่สำเร็จ: ${errMsg(e)}`)
    }
  }

  // เลือกงานเคลมในช่อง "จากออเดอร์" → เติมช่องที่ยังว่างให้เอง (ไม่ทับที่พิมพ์ไว้แล้ว) บันทึกพร้อมกันเป็น 1 ขั้นย้อนกลับ
  //   เลขออเดอร์เดิม ← เคลม · เลขพัสดุเดิม/บ.ขนส่งเดิม ← พัสดุที่ร้านส่งออกไปของออเดอร์ต้นทาง
  //   เลขพัสดุ/บริษัทขนส่ง ← เลขพัสดุที่ลูกค้าส่งคืนในเคลม · ชื่อ/ที่อยู่/เบอร์ ← เคลม ถ้าไม่มีใช้ออเดอร์ต้นทาง
  const pickClaim = async (r: Parcel, c: ClaimLite | null) => {
    if (!c) { if (r.claim_id) await saveField(r, { claim_id: null }, 'จากออเดอร์'); return }
    setClaims(m => ({ ...m, [c.id]: c }))
    const [{ data: cl }, { data: oe }] = await Promise.all([
      supabase.from('claims').select('return_tracking, ship_name, ship_address, ship_phone').eq('id', c.id).maybeSingle(),
      c.original_order_number
        ? supabase.from('order_entries').select('customer_name, courier, shipments, address, phone')
            .eq('order_number', c.original_order_number).order('created_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const claim = (cl ?? {}) as { return_tracking?: string | null; ship_name?: string | null; ship_address?: string | null; ship_phone?: string | null }
    const order = (oe ?? {}) as { customer_name?: string | null; courier?: string | null; shipments?: { no?: string; carrier?: string }[] | null; address?: string | null; phone?: string | null }
    const ship = (order.shipments ?? []).find(s => s?.no)
    const ret = (claim.return_tracking ?? '').trim()
    const fill: Partial<Parcel> = {
      orig_order_number: c.original_order_number,
      orig_tracking_no: ship?.no ?? null,
      orig_carrier: ship ? (ship.carrier || detectCarrier(ship.no ?? '', order.courier)) || null : null,
      tracking_no: ret || null,
      carrier: ret ? detectCarrier(ret) || null : null,
      sender_name: claim.ship_name || order.customer_name || c.customer_username,
      address: claim.ship_address || order.address || null,
      phone: (claim.ship_phone || order.phone || '').replace(/[^\d+]/g, '') || null,
    }
    const cur = rowsRef.current.find(x => x.id === r.id) ?? r
    const patch: Partial<Parcel> = { claim_id: c.id }
    for (const [k, v] of Object.entries(fill) as [TextKey, string | null][]) {
      if (v && !(cur[k] ?? '').trim()) patch[k] = v
    }
    await saveField(cur, patch, 'จากออเดอร์')
  }

  // เพิ่มวิดีโอ/รูป — อัพทีละไฟล์ เสร็จแล้วต่อท้ายรายการเดิมแล้วบันทึกลงแถว
  const addMedia = async (r: Parcel, kind: 'videos' | 'photos', files: FileList | null) => {
    if (!files?.length) return
    const tag = `${r.id}:${kind}`
    const added: Media[] = []
    try {
      const list = Array.from(files)
      for (let i = 0; i < list.length; i++) {
        const prefix0 = list.length > 1 ? `${i + 1}/${list.length} · ` : ''
        // ย่อไฟล์ก่อนอัพ — รูปย่อทันที · คลิปใหญ่ต้องเล่นแล้วอัดใหม่ เลยมีแถบบอกความคืบหน้าแยก
        const f = kind === 'photos'
          ? await compressImage(list[i])
          : await compressVideo(list[i], pct => setUploading(u => ({ ...u, [tag]: `${prefix0}ย่อคลิป ${pct}%` })))
        const ext = (f.name.split('.').pop() || (kind === 'photos' ? 'jpg' : 'mp4')).toLowerCase()
        const key = mediaKey(r.id, ext)
        const prefix = list.length > 1 ? `${i + 1}/${list.length} · ` : ''
        const url = await uploadWithProgress(f, key, pct => setUploading(u => ({ ...u, [tag]: `${prefix}${pct}%` })))
        added.push(kind === 'videos' ? { url, name: list[i].name } : { url, caption: '' })
      }
    } catch (e) {
      setError(`อัพโหลด${kind === 'videos' ? 'วิดีโอ' : 'รูป'}ไม่สำเร็จ: ${errMsg(e)}`)
    }
    setUploading(u => { const n = { ...u }; delete n[tag]; return n })
    if (!added.length) return
    const cur = rowsRef.current.find(x => x.id === r.id) ?? r
    await saveField(cur, { [kind]: [...(cur[kind] ?? []), ...added] }, kind === 'videos' ? 'วิดีโอ' : 'รูป')
  }

  const removeMedia = async (r: Parcel, kind: 'videos' | 'photos', idx: number) => {
    const list = r[kind] ?? []
    if (!(await ask(`เอา${kind === 'videos' ? 'วิดีโอ' : 'รูป'}นี้ออก?`, { okText: 'เอาออก', danger: true }))) return
    // ไม่ลบไฟล์บน R2 ทันที เผื่อกด Ctrl+Z ย้อนกลับ
    await saveField(r, { [kind]: list.filter((_, i) => i !== idx) }, kind === 'videos' ? 'วิดีโอ' : 'รูป')
  }

  const q = search.trim().toLowerCase()
  // ตัวเลือกเดือน (ยึดวันที่ลงพัสดุ)
  const monthKey = (r: Parcel) => r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA').slice(0, 7) : ''
  const monthOptions = useMemo(() => Array.from(new Set(rows.map(monthKey).filter(Boolean))).sort().reverse(), [rows])
  const monthLabel = (k: string) => { const [y, m] = k.split('-'); return `${TH_MONTHS[Number(m) - 1]} ${Number(y) + 543}` }
  const monthRows = rows.map(stable).filter(r => month === 'all' || monthKey(r) === month)
  const stableRows = monthRows
  const filtered = stableRows.filter(r => {
    const c = r.claim_id ? claims[r.claim_id] : null
    const matchSearch = !q || [r.sender_name, r.items, r.carrier, r.tracking_no, r.orig_carrier, r.orig_tracking_no, r.orig_order_number, r.address, r.phone, c?.original_order_number, c?.customer_username]
      .some(v => (v ?? '').toLowerCase().includes(q))
    // ตัวกรองหัวคอลัมน์
    const matchCols = FILTER_DEFS.every(d => {
      const v = d.get(r)
      if (d.kind === 'pick') { const p = colPick[d.id]; return !p?.length || p.includes(String(v ?? '') || NONE) }
      if (d.kind === 'date') {
        const rg = colRange[d.id]; if (!rg?.from && !rg?.to) return true
        const ymd = v ? new Date(String(v)).toLocaleDateString('en-CA') : ''; if (!ymd) return false
        return (!rg.from || ymd >= rg.from) && (!rg.to || ymd <= rg.to)
      }
      if (d.kind === 'bool') { const b = colBool[d.id]; return b == null || !!v === b }
      return true
    })
    return matchSearch && matchCols
  })
  if (colSort) {
    const def = FILTER_DEFS.find(d => d.id === colSort.key)!
    const dir = colSort.dir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      const va = def.get(a), vb = def.get(b)
      const ea = va == null || va === '', eb = vb == null || vb === ''
      if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1   // ค่าว่างไปท้ายเสมอ
      return String(va).localeCompare(String(vb), 'th', { numeric: true }) * dir
    })
  }
  const displayed = filtered.map(live)
  const anyColFilter = FILTER_DEFS.some(d => (colPick[d.id]?.length ?? 0) > 0 || !!(colRange[d.id]?.from || colRange[d.id]?.to) || colBool[d.id] != null)
  const clearColFilters = () => { setColPick({}); setColRange({}); setColBool({}) }
  const colActive = (id: ColId) => colSort?.key === id || (colPick[id]?.length ?? 0) > 0 || !!(colRange[id]?.from || colRange[id]?.to) || colBool[id] != null
  const colValues = (id: ColId): string[] => {
    const get = FILTER_DEFS.find(d => d.id === id)?.get
    if (!get) return []
    const vals = Array.from(new Set(stableRows.map(r => String(get(r) ?? '') || NONE)))
    return vals.filter(v => v !== NONE).sort((a, b) => a.localeCompare(b, 'th')).concat(vals.includes(NONE) ? [NONE] : [])
  }

  // ปริ้นตารางตามที่กรอง/เรียง/โชว์คอลัมน์อยู่บนจอ (วิดีโอ/รูป = จำนวน)
  const printList = () => {
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]!))
    const cell = (r: Parcel, id: ColId): string => {
      if (id === 'created') return esc(new Date(r.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }))
      if (id === 'serial') return esc(r.serial_no || '-')
      if (id === 'videos') return r.videos?.length ? `${r.videos.length} คลิป` : '-'
      if (id === 'photos') return r.photos?.length ? `${r.photos.length} รูป` : '-'
      if (id === 'claim') { const c = r.claim_id ? claims[r.claim_id] : null; return c ? esc(claimLabel(c)) : '-' }
      return esc(r[id] || '-').replace(/\n/g, '<br>')
    }
    const cols = ALL_COLS.filter(c => showCol(c.id))
    const title = `พัสดุส่งกลับ ${displayed.length} รายการ${month !== 'all' ? ` · ${monthLabel(month)}` : ''}`
    const win = window.open('', '_blank', 'width=1200,height=750')
    if (!win) { setError('เบราว์เซอร์บล็อก popup — โปรดอนุญาต popup เพื่อปริ้น'); return }
    win.document.open()
    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 12px; color: #000; margin: 0; padding: 16px; }
  h2 { font-size: 14px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #aaa; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 700; white-space: nowrap; }
  tr { break-inside: avoid; }
  @page { margin: 0; }
  @media print { body { padding: 14mm; } .toolbar { display: none !important; } }
  .toolbar { position: fixed; top: 10px; right: 10px; background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 8px 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
  .toolbar button { padding: 8px 20px; border-radius: 8px; border: none; background: #1a1a1a; color: #fff; cursor: pointer; font-size: 14px; font-weight: 700; font-family: inherit; }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨 ปริ้น</button></div>
<h2>${esc(title)}</h2>
<table><thead><tr><th>#</th>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
<tbody>${displayed.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(c => `<td>${cell(r, c.id)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`)
    win.document.close(); win.focus()
  }

  // หัวคอลัมน์ — คอลัมน์ที่กรอง/เรียงได้เป็นปุ่มมี ▼
  const headCell = (id: ColId, style: React.CSSProperties) => {
    const def = FILTER_DEFS.find(d => d.id === id)
    const text = colLabel(id)
    if (!def) return <th key={id} style={style}>{text}</th>
    const n = colPick[id]?.length ?? 0
    return (
      <th key={id} style={style}>
        <button onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setColMenu(m => m?.key === id ? null : { key: id, rect }) }}
          style={{ border: 'none', background: 'transparent', fontSize: 'inherit', fontWeight: 500, color: colActive(id) ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'inherit' }}>
          {text}{n > 0 && ` (${n})`}
          {colSort?.key === id && <span style={{ fontSize: 10 }}>{colSort.dir === 'asc' ? '↑' : '↓'}</span>}
          <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
        </button>
      </th>
    )
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '11px 12px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#FAFAFA', zIndex: 1, borderBottom: '1px solid var(--border)' }

  return (
    <div>
      {/* หัวหน้า — ชุดเดียวกับหน้าออเดอร์/งานเคลม: ชื่อหมวด + จำนวนรายการ · ปุ่มปริ้น / เพิ่มรายการ มุมขวา */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#4A3122', letterSpacing: '-0.5px' }}>พัสดุส่งกลับ</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {month === 'all' ? `${rows.length} รายการ` : `${monthRows.length} รายการ · ${monthLabel(month)} (ทั้งหมด ${rows.length})`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={printList} disabled={displayed.length === 0}
            style={{ background: 'var(--surface)', color: 'var(--brand)', border: '1px solid var(--border)', borderRadius: 999, height: 46, padding: '0 20px', fontSize: 14, fontWeight: 600, cursor: displayed.length ? 'pointer' : 'not-allowed', boxShadow: 'var(--shadow)' }}>
            🖨️ ปริ้น
          </button>
          <button onClick={openAdd}
            style={{ background: 'var(--brand)', color: '#FFF8F0', border: 'none', borderRadius: 999, height: 46, padding: '0 26px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 10px rgba(158,106,73,0.35)' }}>
            ＋ เพิ่มรายการ
          </button>
        </div>
      </div>

      {custStep && (
        <CustomerPickStep book={customerBook}
          onPick={(name, phone) => addRow(name, phone)}
          onClose={() => setCustStep(false)} />
      )}

      {error && (
        <div style={{ background: '#ff375f11', border: '1px solid #ff375f44', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          {error}
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
          <svg width="18" height="18" fill="none" stroke="#8B7460" strokeWidth="1.8" viewBox="0 0 24 24" style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อผู้ส่ง / เลขพัสดุ / เลขออเดอร์ / เบอร์…" className="ow-field"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 999, height: 46, padding: '0 16px 0 46px', paddingRight: search ? 40 : 16, fontSize: 13.5, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow)' }} />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'var(--border)', color: 'var(--ink-3)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
              ✕
            </button>
          )}
        </div>
        <CreamSelect value={month} onChange={setMonth} title="เดือนที่ลงพัสดุ" className="ow-select" style={month !== 'all' ? { borderColor: 'var(--brand)' } : undefined}
          options={[{ value: 'all', label: 'ทุกเดือน' }, ...monthOptions.map(k => ({ value: k, label: monthLabel(k) }))]}
          renderValue={o => <>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path strokeLinecap="round" d="M3.5 10h17M8 3v4M16 3v4" /></svg>
            <span className="cs-value">{o?.label}</span>
            <svg className="cs-chev" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
          </>} />
        {/* เรียงลำดับ — ใช้ state เดียวกับการเรียงที่หัวคอลัมน์ */}
        <CreamSelect value={colSort ? `${colSort.key}:${colSort.dir}` : ''} title="เรียงลำดับ"
          onChange={v => { if (!v) setColSort(null); else { const [key, dir] = v.split(':'); setColSort({ key: key as ColId, dir: dir as 'asc' | 'desc' }) } }}
          className="ow-select" style={colSort ? { borderColor: 'var(--brand)' } : undefined} menuMinWidth={250} align="right"
          options={[
            { value: '', label: 'เรียงตามค่าเริ่มต้น' },
            { value: 'created:desc', label: 'วันที่ลง: ใหม่สุด → เก่าสุด' },
            { value: 'created:asc', label: 'วันที่ลง: เก่าสุด → ใหม่สุด' },
            { value: 'sender_name:asc', label: 'ชื่อผู้ส่ง: ก → ฮ' },
            { value: 'serial:desc', label: 'Serial: มากไปน้อย' },
            ...(colSort && !['created:desc', 'created:asc', 'sender_name:asc', 'serial:desc'].includes(`${colSort.key}:${colSort.dir}`)
              ? [{ value: `${colSort.key}:${colSort.dir}`, label: `${colLabel(colSort.key)}: ${SORT_LABELS[FILTER_DEFS.find(d => d.id === colSort.key)!.kind][colSort.dir === 'asc' ? 0 : 1]}` }]
              : []),
          ]}
          renderValue={o => <>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M3.5 16.5L7 20l3.5-3.5M14 6h7M14 11h5M14 16h3" /></svg>
            <span className="cs-value">{o?.label}</span>
            <svg className="cs-chev" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
          </>} />
      </div>

      {/* แถวที่ 2 — ปุ่มคอลัมน์ชิดขวา ตำแหน่งเดียวกับแถวแท็บของหน้าออเดอร์ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* แท็บ ทั้งหมด — แบบเดียวกับหมวดออเดอร์ · กดแล้วล้างตัวกรองคอลัมน์ (จำนวน = ตามเดือน/คำค้น/ตัวกรองที่ใช้อยู่) */}
        <button onClick={clearColFilters} className="ow-tab" data-active title={anyColFilter ? 'กดเพื่อล้างตัวกรองคอลัมน์' : undefined}>
          ทั้งหมด
          <span className="ow-tab-n">{displayed.length.toLocaleString()}</span>
        </button>
        {/* เลือกคอลัมน์ที่จะโชว์ — ติ๊กออก = ซ่อน */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button onClick={() => setOpenColPicker(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 20, border: hiddenCols.length ? 'none' : '1px solid var(--border)', background: hiddenCols.length ? 'var(--blue)' : 'var(--surface)', color: hiddenCols.length ? '#fff' : 'var(--ink-3)', fontSize: 13, fontWeight: hiddenCols.length ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            คอลัมน์{hiddenCols.length > 0 && ` (ซ่อน ${hiddenCols.length})`} <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
          </button>
          {openColPicker && (
            <>
              <div onClick={() => setOpenColPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
              <div className="ow-drop" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 200, maxHeight: 360, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>ติ๊กออก = ซ่อน</span>
                  {hiddenCols.length > 0 && (
                    <button onClick={() => saveHidden([])} style={{ border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 11, cursor: 'pointer', padding: 0 }}>โชว์ทั้งหมด</button>
                  )}
                </div>
                {ALL_COLS.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)' }}>
                    <input type="checkbox" checked={showCol(c.id)} onChange={() => saveHidden(showCol(c.id) ? [...hiddenCols, c.id] : hiddenCols.filter(x => x !== c.id))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* คอลัมน์เยอะเกินจอ → เลื่อนทั้งหน้าแนวนอนเหมือนหมวดออเดอร์ (ไม่มีกล่องเลื่อนแยก หัวตารางค้างบนจอตอนเลื่อนลง) */}
      <div className="dn-list-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', width: 'max-content', minWidth: '100%' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 && anyColFilter ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            ไม่มีพัสดุที่ตรงกับตัวกรองคอลัมน์
            <div><button onClick={clearColFilters} style={{ marginTop: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--brand)', borderRadius: 999, padding: '6px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>ล้างตัวกรองคอลัมน์</button></div>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
            {q ? <>ไม่เจอ &quot;{search}&quot; — <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 14, padding: 0 }}>ล้างคำค้น</button></>
               : <>ยังไม่มีพัสดุส่งกลับ — กด &quot;＋ เพิ่มรายการ&quot; ด้านบนเพื่อเริ่มลงรายการแรก</>}
          </div>
        ) : (
          <table className="dn-list dn-rows" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                {ALL_COLS.filter(c => showCol(c.id)).map(c => headCell(c.id, th))}
                <th style={{ ...th, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => {
                const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
                return (
                  <tr key={r.id}>
                    {showCol('created') && (
                    <td style={{ ...td, padding: '12px', whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 12 }}>
                      {new Date(r.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    )}
                    {showCol('serial') && (
                    <td style={{ ...td, padding: '12px', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--ink)', fontSize: 12 }}>
                      {r.serial_no || <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>—</span>}
                    </td>
                    )}
                    {COLS.filter(c => showCol(c.key)).map(c => (
                      <td key={c.key} style={{ ...td, minWidth: c.w, maxWidth: c.w + 80 }}>
                        <EditCell value={r[c.key] ?? ''} multiline={c.multiline} carrier={c.carrier} label={c.label}
                          customerLink={c.key === 'sender_name'}
                          editing={editing === `${r.id}:${c.key}`}
                          onStart={() => setEditing(`${r.id}:${c.key}`)}
                          onDone={v => {
                            setEditing(null)
                            const next = c.key === 'phone' ? v.replace(/[^\d+]/g, '') : v.trim()
                            if (next !== (r[c.key] ?? '')) void saveField(r, { [c.key]: next || null }, c.label)
                          }} />
                      </td>
                    ))}
                    {/* วิดีโอตอนแกะ */}
                    {showCol('videos') && (
                    <td style={{ ...td, minWidth: 130 }}>
                      <MediaCell kind="videos" list={r.videos ?? []} busy={uploading[`${r.id}:videos`]}
                        onAdd={f => addMedia(r, 'videos', f)} onRemove={i => removeMedia(r, 'videos', i)} />
                    </td>
                    )}
                    {/* รูป */}
                    {showCol('photos') && (
                    <td style={{ ...td, minWidth: 150 }}>
                      <MediaCell kind="photos" list={r.photos ?? []} busy={uploading[`${r.id}:photos`]}
                        onAdd={f => addMedia(r, 'photos', f)} onRemove={i => removeMedia(r, 'photos', i)} />
                    </td>
                    )}
                    {/* จากออเดอร์ = งานเคลมที่ผูก — กดแล้วพิมพ์ค้นเหมือนช่องอื่น */}
                    {showCol('claim') && (
                    <td style={{ ...td, minWidth: 170, maxWidth: 240 }}>
                      <ClaimCell claim={r.claim_id ? claims[r.claim_id] ?? null : null} linked={!!r.claim_id}
                        editing={editing === `${r.id}:claim`}
                        onStart={() => setEditing(`${r.id}:claim`)}
                        onCancel={() => setEditing(null)}
                        onPick={c => {
                          setEditing(null)
                          if ((c?.id ?? null) !== r.claim_id) void pickClaim(r, c)
                        }} />
                    </td>
                    )}
                    <td style={{ ...td, padding: '8px' }}>
                      <button onClick={e => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                        setActionMenu(actionMenu?.id === r.id ? null : { id: r.id, rect: rect })
                      }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'var(--ink-3)' }}>⋯</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* เมนูหัวคอลัมน์ — เรียง/กรอง */}
      {colMenu && (() => {
        const def = FILTER_DEFS.find(d => d.id === colMenu.key)!
        const k = def.id
        const close = () => setColMenu(null)
        const opt = (text: string, active: boolean, onClick: () => void) => (
          <div key={text} onClick={onClick}
            style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--blue)' : 'var(--ink)', background: active ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
            {text}
          </div>
        )
        const left = Math.max(8, Math.min(colMenu.rect.left, window.innerWidth - 240))
        const picked = colPick[k] ?? []
        const range = colRange[k] ?? { from: '', to: '' }
        return (
          <>
            <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
            <div className="ow-drop" style={{ position: 'fixed', top: colMenu.rect.bottom + 4, left, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 180, maxHeight: '60vh', overflowY: 'auto' }}>
              {def.kind === 'bool' ? (
                ([['ทั้งหมด', null], [def.yes!, true], [def.no!, false]] as [string, boolean | null][]).map(([text, val]) =>
                  opt(text, (colBool[k] ?? null) === val, () => { setColBool(p => ({ ...p, [k]: val })); close() }))
              ) : (
                <>
                  {([['asc', SORT_LABELS[def.kind][0]], ['desc', SORT_LABELS[def.kind][1]]] as ['asc' | 'desc', string][]).map(([dir, text]) =>
                    opt(text, colSort?.key === k && colSort.dir === dir, () => { setColSort({ key: k, dir }); close() }))}
                  {colSort?.key === k && opt('ไม่เรียง', false, () => { setColSort(null); close() })}
                </>
              )}
              {def.kind === 'date' && (
                <div style={{ padding: '10px 14px 6px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  {([['from', 'ตั้งแต่'], ['to', 'ถึงวันที่']] as ['from' | 'to', string][]).map(([f, text]) => (
                    <div key={f} style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{text}</label>
                      <input type="date" lang="en-GB" value={range[f]} onChange={e => setColRange(p => ({ ...p, [k]: { ...range, [f]: e.target.value } }))}
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  {(range.from || range.to) && (
                    <button onClick={() => setColRange(p => ({ ...p, [k]: { from: '', to: '' } }))} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>ล้างช่วงวันที่</button>
                  )}
                </div>
              )}
              {def.kind === 'pick' && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                  {colValues(k).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: picked.includes(v) ? 'var(--blue-bg)' : 'transparent' }}>
                      <input type="checkbox" checked={picked.includes(v)} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }}
                        onChange={() => setColPick(p => ({ ...p, [k]: picked.includes(v) ? picked.filter(x => x !== v) : [...picked, v] }))} />
                      <span style={{ color: v === NONE ? 'var(--ink-4)' : 'var(--ink)' }}>{v}</span>
                    </label>
                  ))}
                  {picked.length > 0 && (
                    <button onClick={() => setColPick(p => ({ ...p, [k]: [] }))} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: '6px 12px 2px' }}>ล้างที่เลือก</button>
                  )}
                </div>
              )}
            </div>
          </>
        )
      })()}

      {actionMenu && (() => {
        const r = rows.find(x => x.id === actionMenu.id)
        if (!r) return null
        return (
          <>
            <div onMouseDown={() => setActionMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1500 }} />
            {/* ‼️ เดิมวางใต้ปุ่มตายตัว แถวล่างสุดของจอเมนูตกขอบ เห็นตัวเลือกไม่ครบ → AnchoredMenu พลิกขึ้นด้านบนให้เอง */}
            <AnchoredMenu rect={actionMenu.rect} minWidth={120} style={{ width: 120, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 0, overflow: 'hidden' }}>
              <button onClick={() => { setActionMenu(null); void delRow(r) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--red)' }}>ลบแถวนี้</button>
            </AnchoredMenu>
          </>
        )
      })()}

      {/* ชี้เมาส์ที่ช่อง = ขึ้นกรอบจางๆ บอกว่ากดแก้ได้ */}

      {/* กล่องยืนยัน — ต้องอยู่ท้ายสุดเพื่อทับทุกหน้าต่าง */}
      {confirmDialog}
    </div>
  )
}

// ── ช่องข้อความที่กดแล้วพิมพ์ได้ในตาราง ──
function EditCell({ value, editing, onStart, onDone, multiline, carrier, label, customerLink }: {
  value: string; editing: boolean; onStart: () => void; onDone: (v: string) => void; multiline?: boolean; carrier?: boolean; label: string
  customerLink?: boolean   // ชื่อลูกค้า: โชว์เป็นลิงก์เข้าโฟลเดอร์ออเดอร์เหมือนหมวดออเดอร์ (แก้ชื่อ = ดับเบิลคลิก)
}) {
  if (editing) return <CellEditor value={value} onDone={onDone} multiline={multiline} carrier={carrier} />
  if (customerLink && value) return (
    <div onDoubleClick={onStart} style={{ minHeight: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <Link href={`/customers?name=${encodeURIComponent(value)}`} title="เปิดโฟลเดอร์ออเดอร์ของลูกค้า (ดับเบิลคลิกที่ช่องเพื่อแก้ชื่อ)"
        style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{value}</Link>
    </div>
  )
  return (
    <div onClick={onStart} title={value || `กดเพื่อแก้${label}`} className="rp-cell"
      style={{ cursor: 'text', minHeight: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: value ? 'var(--ink)' : 'var(--ink-4)' }}>
      {carrier && value
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CourierIcon name={value} size={18} />{value}</span>
        : value || '—'}
    </div>
  )
}

// ช่องพิมพ์ — สร้างใหม่ทุกครั้งที่เริ่มแก้ ค่าตั้งต้นเลยตรงกับค่าล่าสุดเสมอ
function CellEditor({ value, onDone, multiline, carrier }: { value: string; onDone: (v: string) => void; multiline?: boolean; carrier?: boolean }) {
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)

  // สไตล์เดียวกับช่องแก้ข้อความในตารางหมวดออเดอร์ (textCell ใน OrderWorkspace) — เส้นใต้สีน้ำเงิน พื้นโปร่ง ไม่ดันความสูงแถว
  const box: React.CSSProperties = { width: '100%', border: 'none', borderBottom: '1px solid var(--blue)', borderRadius: 0, padding: '2px 0', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'transparent', fontFamily: 'inherit', color: 'var(--ink)' }
  const finish = () => { if (cancelled.current) { cancelled.current = false; onDone(value); return } onDone(draft) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { cancelled.current = true; (e.target as HTMLElement).blur() }
    if (e.key === 'Enter' && !(multiline && e.shiftKey)) { e.preventDefault(); (e.target as HTMLElement).blur() }
  }

  return (
    <>
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={finish} onKeyDown={onKey}
        list={carrier ? 'return-carriers' : undefined} style={box} />
      {carrier && <datalist id="return-carriers">{CARRIER_OPTIONS.map(c => <option key={c} value={c} />)}</datalist>}
    </>
  )
}

// ── ช่องวิดีโอ/รูป: ลิงก์เปิดดู + ปุ่มเพิ่ม + เอาออก ──
function MediaCell({ kind, list, busy, onAdd, onRemove }: {
  kind: 'videos' | 'photos'; list: Media[]; busy?: string; onAdd: (f: FileList | null) => void; onRemove: (i: number) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const isVideo = kind === 'videos'
  return (
    // ‼️ แถวตารางสูงคงที่ (.dn-rows) — เรียงแถวเดียว มีหลายรูป/คลิปเลื่อนซ้ายขวาดู ไม่ขึ้นบรรทัดใหม่
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {list.length > 0 && (
        <div className="dn-hscroll" style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, overflowX: 'auto', maxWidth: 190, padding: '6px 6px 0 0' }}>
          {list.map((m, i) => (
            <div key={m.url} style={{ position: 'relative', flexShrink: 0 }}>
              <a href={m.url} target="_blank" rel="noreferrer" title={isVideo ? `เปิดวิดีโอ ${m.name ?? ''}` : 'เปิดรูปขนาดเต็ม'}
                style={isVideo
                  ? { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--blue)', textDecoration: 'none', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 22px 4px 8px' }
                  : { display: 'block' }}>
                {isVideo ? <>▶ คลิป {i + 1}</> : <img src={m.url} alt="รูปพัสดุ" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />}
              </a>
              <button onClick={() => onRemove(i)} title="เอาออก"
                style={{ position: 'absolute', top: isVideo ? 3 : -6, right: isVideo ? 3 : -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.65)', color: '#fff', fontSize: 10, lineHeight: 1, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy}
        style={{ flexShrink: 0, border: '1px dashed #ccc', background: 'transparent', color: busy ? 'var(--ink-3)' : 'var(--blue)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
        {busy ? `กำลังอัพ ${busy}` : isVideo ? '+ วิดีโอ' : '+ รูป'}
      </button>
      <input ref={input} type="file" accept={isVideo ? 'video/*' : 'image/*'} multiple style={{ display: 'none' }}
        onChange={e => { onAdd(e.target.files); e.target.value = '' }} />
    </div>
  )
}

// ── ช่อง "จากออเดอร์": กดแล้วพิมพ์ค้นงานเคลม (เหมือนช่องอื่น ไม่มีหน้าต่างแยก) ──
// ค้น: เลขออเดอร์เดิม / ชื่อลูกค้า / เลขพัสดุที่ลูกค้าส่งคืน / ชื่อ-เบอร์ผู้รับ · Enter = เลือกอันแรก · Esc = ยกเลิก
function ClaimCell({ claim, linked, editing, onStart, onCancel, onPick }: {
  claim: ClaimLite | null; linked: boolean; editing: boolean
  onStart: () => void; onCancel: () => void; onPick: (c: ClaimLite | null) => void
}) {
  if (editing) return <ClaimSearch linked={linked} onCancel={onCancel} onPick={onPick} />
  return (
    <div onClick={onStart} title="กดเพื่อค้นงานเคลม" className="rp-cell"
      style={{ padding: '6px 8px', borderRadius: 6, cursor: 'text', minHeight: 20, overflow: 'hidden' }}>
      {!linked ? <span style={{ color: 'var(--ink-4)' }}>—</span>
        : !claim ? <span style={{ color: 'var(--ink-4)' }}>กำลังโหลด…</span>
        : <>
            <div style={{ color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{claimLabel(claim)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[claim.original_order_number ? claim.customer_username : null, claim.channel, claim.status].filter(Boolean).join(' · ') || 'งานเคลม'}
            </div>
          </>}
    </div>
  )
}

function ClaimSearch({ linked, onCancel, onPick }: { linked: boolean; onCancel: () => void; onPick: (c: ClaimLite | null) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ClaimLite[] | null>(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  // รายการผลค้นวางแบบ fixed ตามตำแหน่งช่องพิมพ์ — ถ้าวาง absolute จะโดนกล่องตาราง (overflow) ตัดตอนมีแถวน้อย
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    const place = () => { const r = inputRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: r.left }) }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [])

  // พิมพ์หยุด 250ms แล้วค่อยค้น (ไม่ยิงทุกตัวอักษร)
  useEffect(() => {
    const s = clean(q)
    if (s.length < 2) return
    const my = ++seq.current
    const t = setTimeout(async () => {
      setBusy(true)
      const { data } = await supabase.from('claims').select(CLAIM_COLS)
        .or(`original_order_number.ilike.%${s}%,customer_username.ilike.%${s}%,return_tracking.ilike.%${s}%,ship_name.ilike.%${s}%,ship_phone.ilike.%${s}%`)
        .order('created_at', { ascending: false }).limit(10)
      if (my !== seq.current) return   // มีคำค้นใหม่กว่าแล้ว ทิ้งผลเก่า
      setHits((data ?? []) as ClaimLite[])
      setBusy(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const short = clean(q).length < 2
  const list = short ? null : hits
  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} autoFocus value={q} onChange={e => setQ(e.target.value)}
        onBlur={onCancel}
        onKeyDown={e => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter' && list?.[0]) { e.preventDefault(); onPick(list[0]) }
        }}
        placeholder="พิมพ์เลขออเดอร์ / ชื่อลูกค้า"
        style={{ width: '100%', border: '1px solid var(--blue)', borderRadius: 6, padding: '6px 8px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit' }} />
      {/* onMouseDown + preventDefault: กดเลือกได้ก่อนช่องพิมพ์เสียโฟกัส (ไม่งั้น onBlur ปิดรายการก่อนคลิกติด) */}
      {pos && <div onMouseDown={e => e.preventDefault()}
        style={{ position: 'fixed', top: pos.top, left: pos.left, width: 300, maxHeight: 300, overflowY: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 1700 }}>
        {short ? <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-4)' }}>พิมพ์อย่างน้อย 2 ตัวเพื่อค้นงานเคลม</div>
          : busy && !list ? <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)' }}>กำลังค้น…</div>
          : list && list.length === 0 ? <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-4)' }}>ไม่เจองานเคลมที่ตรงกับ &quot;{q}&quot;</div>
          : (list ?? []).map(c => (
            <button key={c.id} onClick={() => onPick(c)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{claimLabel(c)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {[c.original_order_number ? c.customer_username : null, c.channel,
                  c.claim_date ? new Date(c.claim_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null, c.status].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        {linked && (
          <button onClick={() => onPick(null)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 12.5, color: 'var(--red)' }}>
            เอางานเคลมที่ผูกออก
          </button>
        )}
      </div>}
    </div>
  )
}