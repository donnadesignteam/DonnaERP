'use client'

// หมวด "พัสดุส่งกลับ" — พัสดุที่ลูกค้าส่งคืนเข้าร้าน
// ทุกช่องกดแล้วพิมพ์ได้ในตารางเลย (ออกจากช่อง/กด Enter = บันทึก · Esc = ยกเลิก) · ย้อนได้ด้วย Ctrl+Z เหมือนหน้าอื่น
// วิดีโอตอนแกะ + รูป อัพตรงเข้า R2 (โฟลเดอร์ returns/<id>/) แล้วบันทึก URL ลงแถวทันที
// ช่อง "จากออเดอร์" = ผูกกับงานเคลม (claims) — กดแล้วพิมพ์ค้นเหมือนช่องอื่น (เลขออเดอร์เดิม/ชื่อลูกค้า/เลขพัสดุส่งคืน/เบอร์)
// ตาราง: sql/create_return_parcels.sql + sql/add_return_parcels_claim.sql (คอลัมน์ claim_id)
import { useState, useEffect, useRef, useMemo } from 'react'
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
  { key: 'sender_name', label: 'ชื่อ', w: 140 },
  { key: 'items', label: 'รายการ', w: 200, multiline: true },
  { key: 'carrier', label: 'บริษัทขนส่ง', w: 120, carrier: true },
  { key: 'tracking_no', label: 'เลขพัสดุ', w: 150 },
  { key: 'orig_carrier', label: 'บ.ขนส่งเดิม', w: 120, carrier: true },
  { key: 'orig_tracking_no', label: 'เลขพัสดุเดิม', w: 150 },
  { key: 'orig_order_number', label: 'เลขออเดอร์เดิม', w: 150 },
  { key: 'address', label: 'ที่อยู่', w: 220, multiline: true },
  { key: 'phone', label: 'เบอร์โทร', w: 110 },
]

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
const claimLabel = (c: ClaimLite) => c.customer_username || c.original_order_number || '(เคลมไม่มีชื่อลูกค้า)'

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
  const [actionMenu, setActionMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  const { ask, confirmDialog } = useConfirm()

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Parcel>(() =>
      supabase.from(TABLE).select('*').order('created_at', { ascending: false }).order('id', { ascending: true }))
    if (err) { setError(`โหลดข้อมูลไม่ได้: ${noTableMsg(err.message)}`); setLoading(false); return }
    setPageCache(TABLE, data)
    setRows(data)
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
    if (cached) { setRows(cached); setLoading(false) }
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

  // พิมพ์ช่องไหนแล้วตรงกับงานเคลมใบเดียว → ผูก "จากออเดอร์" ให้เอง (แล้ว pickClaim เติมช่องที่ยังว่าง)
  //   เลขพัสดุ = เลขพัสดุที่ลูกค้าส่งคืนในเคลม · เลขออเดอร์เดิม = เลขออเดอร์ในเคลม · เบอร์/ชื่อ = ผู้รับในเคลม
  //   เลขพัสดุเดิม = พัสดุที่ร้านส่งออกไปของออเดอร์ → หาเคลมจากเลขออเดอร์นั้น
  //   ‼️ ตรงหลายใบ (เช่นลูกค้าคนเดียวเคลมหลายครั้ง) = ไม่เดา ให้แอดมินกดเลือกเองในช่อง "จากออเดอร์"
  const autoLinkClaim = async (r: Parcel, key: TextKey, value: string) => {
    const cur = rowsRef.current.find(x => x.id === r.id) ?? r
    if (cur.claim_id) return
    const v = clean(value)
    let q
    if (key === 'tracking_no' && v.length >= 6) q = supabase.from('claims').select(CLAIM_COLS).ilike('return_tracking', v)
    else if (key === 'orig_order_number' && v.length >= 4) q = supabase.from('claims').select(CLAIM_COLS).ilike('original_order_number', v)
    else if (key === 'phone' && v.length >= 9) q = supabase.from('claims').select(CLAIM_COLS).ilike('ship_phone', `%${v}%`)
    else if (key === 'sender_name' && v.length >= 2) q = supabase.from('claims').select(CLAIM_COLS).or(`customer_username.ilike."${v}",ship_name.ilike."${v}"`)
    else if (key === 'orig_tracking_no' && v.length >= 6) {
      const { data: oe } = await supabase.from('order_entries').select('order_number').filter('shipments', 'cs', JSON.stringify([{ no: v }])).not('order_number', 'is', null).limit(5)
      const nos = [...new Set((oe ?? []).map(o => (o as { order_number: string }).order_number))]
      if (nos.length !== 1) return
      q = supabase.from('claims').select(CLAIM_COLS).eq('original_order_number', nos[0])
    }
    if (!q) return
    const { data } = await q.order('created_at', { ascending: false }).limit(2)
    const hits = (data ?? []) as ClaimLite[]
    if (hits.length !== 1) return
    const latest = rowsRef.current.find(x => x.id === r.id) ?? cur
    if (!latest.claim_id) await pickClaim(latest, hits[0])
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
  const displayed = !q ? rows : rows.filter(r => {
    const c = r.claim_id ? claims[r.claim_id] : null
    return [r.sender_name, r.items, r.carrier, r.tracking_no, r.orig_carrier, r.orig_tracking_no, r.orig_order_number, r.address, r.phone, c?.original_order_number, c?.customer_username]
      .some(v => (v ?? '').toLowerCase().includes(q))
  })

  const th: React.CSSProperties = { textAlign: 'left', padding: '11px 12px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#FAFAFA', zIndex: 1, borderBottom: '1px solid var(--border)' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>พัสดุส่งกลับ</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{rows.length} รายการ</p>
        </div>
        <button onClick={openAdd}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3)' }}>
          + เพิ่มพัสดุ
        </button>
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

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา ชื่อ / เลขพัสดุ / เลขออเดอร์ / เบอร์ / ที่อยู่ / รายการ"
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', paddingRight: search ? 36 : 14, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'var(--border)', color: 'var(--ink-3)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>
        )}
      </div>

      {/* คอลัมน์เยอะเกินจอ → เลื่อนทั้งหน้าแนวนอนเหมือนหมวดออเดอร์ (ไม่มีกล่องเลื่อนแยก หัวตารางค้างบนจอตอนเลื่อนลง) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', width: 'max-content', minWidth: '100%' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
            {q ? <>ไม่เจอ &quot;{search}&quot; — <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 14, padding: 0 }}>ล้างคำค้น</button></>
               : <>ยังไม่มีพัสดุส่งกลับ — กด &quot;+ เพิ่มพัสดุ&quot; ด้านบนเพื่อเริ่มลงรายการแรก</>}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>วันที่ลง</th>
                <th style={th}>Serial</th>
                {COLS.map(c => <th key={c.key} style={th}>{c.label}</th>)}
                <th style={th}>วิดีโอตอนแกะ</th>
                <th style={th}>รูป</th>
                <th style={th}>จากออเดอร์</th>
                <th style={{ ...th, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => {
                const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, padding: '12px', whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 12 }}>
                      {new Date(r.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td style={{ ...td, padding: '12px', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--ink)', fontSize: 12 }}>
                      {r.serial_no || <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>—</span>}
                    </td>
                    {COLS.map(c => (
                      <td key={c.key} style={{ ...td, minWidth: c.w, maxWidth: c.w + 80 }}>
                        <EditCell value={r[c.key] ?? ''} multiline={c.multiline} carrier={c.carrier} label={c.label}
                          customerLink={c.key === 'sender_name'}
                          editing={editing === `${r.id}:${c.key}`}
                          onStart={() => setEditing(`${r.id}:${c.key}`)}
                          onDone={v => {
                            setEditing(null)
                            const next = c.key === 'phone' ? v.replace(/[^\d+]/g, '') : v.trim()
                            if (next !== (r[c.key] ?? '')) void saveField(r, { [c.key]: next || null }, c.label)
                              .then(() => { if (next) void autoLinkClaim(r, c.key, next) })
                          }} />
                      </td>
                    ))}
                    {/* วิดีโอตอนแกะ */}
                    <td style={{ ...td, minWidth: 130 }}>
                      <MediaCell kind="videos" list={r.videos ?? []} busy={uploading[`${r.id}:videos`]}
                        onAdd={f => addMedia(r, 'videos', f)} onRemove={i => removeMedia(r, 'videos', i)} />
                    </td>
                    {/* รูป */}
                    <td style={{ ...td, minWidth: 150 }}>
                      <MediaCell kind="photos" list={r.photos ?? []} busy={uploading[`${r.id}:photos`]}
                        onAdd={f => addMedia(r, 'photos', f)} onRemove={i => removeMedia(r, 'photos', i)} />
                    </td>
                    {/* จากออเดอร์ = งานเคลมที่ผูก — กดแล้วพิมพ์ค้นเหมือนช่องอื่น */}
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
                    <td style={{ ...td, padding: '8px' }}>
                      <button onClick={e => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                        setActionMenu(actionMenu?.id === r.id ? null : { id: r.id, top: rect.bottom + 4, left: rect.right - 120 })
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

      {actionMenu && (() => {
        const r = rows.find(x => x.id === actionMenu.id)
        if (!r) return null
        return (
          <>
            <div onMouseDown={() => setActionMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1500 }} />
            <div style={{ position: 'fixed', top: actionMenu.top, left: actionMenu.left, width: 120, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 1600, overflow: 'hidden' }}>
              <button onClick={() => { setActionMenu(null); void delRow(r) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--red)' }}>ลบแถวนี้</button>
            </div>
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
      {value || '—'}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {list.map((m, i) => (
            <div key={m.url} style={{ position: 'relative' }}>
              <a href={m.url} target="_blank" rel="noreferrer" title={isVideo ? `เปิดวิดีโอ ${m.name ?? ''}` : 'เปิดรูปขนาดเต็ม'}
                style={isVideo
                  ? { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--blue)', textDecoration: 'none', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 22px 4px 8px' }
                  : { display: 'block' }}>
                {isVideo ? <>▶ คลิป {i + 1}</> : <img src={m.url} alt="รูปพัสดุ" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />}
              </a>
              <button onClick={() => onRemove(i)} title="เอาออก"
                style={{ position: 'absolute', top: isVideo ? 3 : -6, right: isVideo ? 3 : -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.65)', color: '#fff', fontSize: 10, lineHeight: 1, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy}
        style={{ alignSelf: 'flex-start', border: '1px dashed #ccc', background: 'transparent', color: busy ? 'var(--ink-3)' : 'var(--blue)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
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
            {/* กดชื่อ → ไปหน้างานเคลมแล้วกระพริบแถวใบนั้น (/claims?focus=<id>) · กดส่วนอื่นของช่อง = ค้นเปลี่ยนใบ */}
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Link href={`/claims?focus=${claim.id}`} onClick={e => e.stopPropagation()} title="เปิดงานเคลมใบนี้"
                style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>{claimLabel(claim)}</Link>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[claim.customer_username ? claim.original_order_number : null, claim.channel, claim.status].filter(Boolean).join(' · ') || 'งานเคลม'}
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
                {[c.customer_username ? c.original_order_number : null, c.channel,
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