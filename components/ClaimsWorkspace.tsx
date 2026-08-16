'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { claimUpdate, claimInsert } from '@/lib/adminActor'
import { useConfirm } from '@/components/ConfirmDialog'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { recordAction } from '@/lib/history'
import { tUpdate, prevOf } from '@/lib/trackedDb'
import { itemBlockLines, railSplit, railLayers, railKind } from '@/lib/itemFormat'
import QRCode from 'qrcode'
import { railLink } from '@/lib/rail'
import { TECH_OPTIONS } from '@/lib/techs'
import { detectCarrier, CARRIER_OPTIONS } from '@/lib/carriers'
import { TH_MONTHS } from '@/lib/shopCalendar'
import { fetchEmployeeOptions } from '@/lib/staffDb'
import { useStableView } from '@/lib/useStableView'
import { useInstallPhotos, photoSaveError, type InstallPhoto } from '@/components/InstallPhotos'

type Item = {
  type: string; floors: number | null; rail_head: string; hook_type?: string; fabric_type: string
  color_code: string; color_name: string; color_desc: string
  width: number | string; height: number | string; quantity: number | string
  unit: string; hooks: string; note: string
}

type Shipment = { no: string; carrier: string }

type Claim = {
  id: string
  claim_date: string | null
  deadline: string | null      // กำหนดส่งงานเคลม — ใช้คิด "วันที่เหลือ" ในหมวดออเดอร์ด้วย
  channel: string | null
  customer_username: string | null
  original_order_number: string | null
  claim_type: string | null
  fault: string | null
  fault_by: string | null      // ผิดโดยใคร — พนักงานร้าน / ช่าง / บริษัทขนส่ง (ต้องรัน sql/add_claim_fault_by.sql ก่อน)
  fix_method: string | null    // วิธีแก้ไข — พิมพ์เองได้
  cause: string | null
  resolution: string | null
  items: Item[] | null
  ship_name: string | null
  ship_address: string | null
  ship_phone: string | null
  return_tracking: string | null
  outbound_tracking: string | null
  courier: string | null
  refund_amount: number | null
  ship_back_cost: number | null     // ค่าส่งกลับ
  ship_return_cost: number | null   // ค่าส่งคืน
  estimated_price: number | null    // ราคาประเมิน
  money_direction: string | null
  payment_target: string | null
  money_status: string | null
  shipments: Shipment[] | null      // เลขพัสดุที่ส่งออก (ติ๊กจัดส่งแล้ว → กรอกใน popup)
  shipped_at: string | null
  printed_at: string | null
  status: string
  is_urgent: boolean
  notes: string | null
  raw_text: string | null
  photos?: InstallPhoto[]     // รูปงานเคลม (ยังไม่ได้รัน migrations/add_claim_photos.sql = ไม่มีคอลัมน์นี้)
  admin_name: string | null   // แอดมินที่รับผิดชอบเคสนี้ — โชว์ใน dashboard พนักงานรายคนด้วย
  technician: string | null   // ช่างที่รับผิดชอบ (ต้องรัน scripts/add_claim_technician.sql ก่อน)
  closed_by: string | null    // ใครปิดงานเคสนี้ (เลือกชื่อ = ปิดงานแล้ว)
  closed_at: string | null
  created_at?: string
  updated_at?: string
}

const CHANNELS = ['Shopee', 'Lazada', 'Tiktok', 'Facebook', 'LineOA', 'หน้าร้าน']
// ชื่อสำรองระหว่างรอโหลดรายชื่อพนักงาน / ถ้าดึงจากตาราง staff ไม่สำเร็จ (ให้ตรงกับ ADMINS ในหมวดออเดอร์)
const ADMINS_FALLBACK = ['กาย', 'แพท', 'หนูนา', 'ยุน', 'ส้ม']
// แอดมินที่ทำงานเคลมประจำ — ปักไว้ 3 อันบนสุดของช่องแอดมิน จะได้ไม่ต้องเลื่อนหาในรายชื่อทั้งร้าน
const ADMINS_PINNED = ['หนูนา', 'กาย', 'แพท']
const CLAIM_TYPES = ['ของขาด/ไม่ครบ', 'ส่งผิด/ขนาดไม่ตรง', 'เสียหายจากขนส่ง', 'ชำรุด/ตำหนิ', 'ลูกค้าแจ้งผิด(แก้ไข)', 'เปลี่ยนสินค้า', 'ส่งคืนไม่แจ้ง']
const FAULTS = ['ร้าน', 'ลูกค้า', 'ขนส่ง']
const RESOLUTIONS = ['ส่งใหม่/ส่งเพิ่ม', 'แก้ไข/ผลิตใหม่', 'คืนเงินเต็ม', 'คืนเงินบางส่วน', 'คืนค่าส่ง', 'เก็บค่าแก้+ส่ง', 'เปลี่ยนสินค้า']
const MONEY_DIR = ['คืนลูกค้า', 'เก็บลูกค้า']
const MONEY_STATUS = ['รอ', 'โอนแล้ว', 'ชำระแล้ว']
// ช่างที่ใส่ในช่อง "ผิดโดย" ได้ (คนละชุดกับ TECH_OPTIONS ที่เป็นช่างผู้รับผิดชอบงาน)
const FAULT_BY_TECHS = ['ช่างพี่ฟอง', 'ช่างบัวบาน', 'ช่างกทม']
const COURIERS = ['Flash Express', 'J&T Express', 'Kerry', 'ไปรษณีย์ไทย', 'SPX Express']

// สถานะ workflow + สี
const WORKFLOW: { key: string; color: string }[] = [
  { key: 'รอของคืน', color: '#ff9f0a' },
  { key: 'ตัดผ้าแล้ว', color: '#30d158' },     // สายผลิต — DonnaBot อัปเดตอัตโนมัติจากรูปกลุ่มช่าง
  { key: 'เย็บแล้ว', color: '#5e9eff' },
  { key: 'ตรวจสอบแล้ว', color: '#6366f1' },   // ผู้ช่วยช่างสแกน (ก่อนรีด)
  { key: 'รีดแล้ว', color: '#bf5af2' },
  { key: 'แพ็คแล้ว', color: '#f43f5e' },
  { key: 'ส่งแล้ว', color: '#34c759' },
]
const STATUS_COLOR = (s: string) => WORKFLOW.find(w => w.key === s)?.color ?? 'var(--ink-3)'

// timestamp → YYYY-MM-DD ตามเวลาเครื่อง (ห้ามใช้ toISOString().slice(0,10) — UTC ทำให้วันเพี้ยนไป 1 วันตอนดึก)
const ymdLocal = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function emptyClaim(): Claim {
  return {
    id: '', claim_date: new Date().toISOString().slice(0, 10), deadline: null, channel: '', customer_username: '',
    original_order_number: '', claim_type: '', fault: '', fault_by: '', fix_method: '', cause: '', resolution: '', items: null,
    ship_name: '', ship_address: '', ship_phone: '', return_tracking: '', outbound_tracking: '',
    courier: '', refund_amount: null, ship_back_cost: null, ship_return_cost: null, estimated_price: null,
    money_direction: '', payment_target: '', money_status: '',
    shipments: null, shipped_at: null, printed_at: null,
    status: 'รอของคืน', is_urgent: false, notes: '', raw_text: '', admin_name: '', technician: '', closed_by: null, closed_at: null,
  }
}

const emptyItem = (): Item => ({ type: '', floors: null, rail_head: '', hook_type: '', fabric_type: '', color_code: '', color_name: '', color_desc: '', width: '', height: '', quantity: 1, unit: 'ชุด', hooks: '', note: '' })

function itemLine(it: Item): string {
  const head = [it.type, it.floors ? `${it.floors}ชั้น` : '', it.rail_head, it.hook_type, it.color_code, it.color_name].filter(Boolean).join(' ')
  const w = Number(it.width), h = Number(it.height)
  const dim = w > 0 && h > 0 ? `ก${w}*ส${h}` : w > 0 ? `ก${w}` : ''
  const tail = [dim, it.quantity ? `= ${it.quantity} ${it.unit || ''}`.trim() : '', it.note].filter(Boolean).join(' ')
  return [head, tail].filter(Boolean).join('  ')
}

// ── ช่องเลือกที่พิมพ์ค้นหาได้ (คอลัมน์ "ผิดโดย" มีทั้งพนักงานร้าน ช่าง และบริษัทขนส่ง รายชื่อยาวเกินกว่าจะเลื่อนหา) ──
// กล่องรายการวางแบบ fixed อิงตำแหน่งปุ่ม เพราะตารางเลื่อนแนวนอน (overflow) จะตัดกล่องที่วางแบบ absolute
function SearchSelect({ value, groups, onPick, placeholder = '—' }: {
  value: string
  groups: { label: string; items: string[] }[]
  onPick: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const kw = q.trim().toLowerCase()
  const filtered = groups
    .map(g => ({ ...g, items: g.items.filter(i => i.toLowerCase().includes(kw)) }))
    .filter(g => g.items.length > 0)
  const close = () => { setOpen(false); setQ('') }
  const pick = (v: string) => { close(); onPick(v) }
  return (
    <>
      <div onClick={e => { setRect((e.currentTarget as HTMLElement).getBoundingClientRect()); setOpen(true); setQ('') }}
        title={value || 'เลือก'}
        style={{ cursor: 'pointer', fontSize: 12, color: value ? 'var(--ink)' : 'var(--ink-4)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value || placeholder}
      </div>
      {open && rect && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: Math.max(8, Math.min(rect.bottom + 2, window.innerHeight - 320)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 250)), width: 230, maxHeight: 300, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 9999, padding: 6 }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์ค้นหา…"
              onKeyDown={e => {
                if (e.key === 'Escape') close()
                if (e.key === 'Enter' && filtered[0]) pick(filtered[0].items[0])
              }}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 4 }} />
            <button onClick={() => pick('')}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-4)' }}>— ไม่ระบุ —</button>
            {filtered.length === 0 && <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--ink-4)' }}>ไม่พบชื่อนี้</div>}
            {filtered.map(g => (
              <div key={g.label}>
                <div style={{ padding: '6px 8px 2px', fontSize: 10, color: 'var(--ink-4)', fontWeight: 700 }}>{g.label}</div>
                {g.items.map(o => (
                  <button key={o} onClick={() => pick(o)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', border: 'none', borderRadius: 5, background: o === value ? 'var(--blue-bg)' : 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: o === value ? 600 : 400 }}>{o}</button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default function ClaimsWorkspace() {
  // เปิดหน้าซ้ำ → โชว์ข้อมูลรอบก่อนทันที แล้ว load() ดึงของใหม่เบื้องหลัง (stale-while-revalidate)
  const cached = getPageCache<Claim[]>('claims')
  const [rows, setRows] = useState<Claim[]>(cached ?? [])
  // แถวไม่เด้งออกจากแท็บตอนเปลี่ยนสถานะ/ติ๊กจัดส่ง — กรองด้วย stable() แสดงผลด้วย live() (ดู lib/useStableView.ts)
  const { snapshot, stable, live } = useStableView<Claim>(rows)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  // กล่องยืนยันของเว็บเอง (ไม่ใช้ window.confirm — ดูเหตุผลใน components/ConfirmDialog.tsx)
  const { ask, confirmDialog } = useConfirm()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<string>('all')
  const [month, setMonth] = useState('all')   // 'all' | 'YYYY-MM' | 'none' (ไม่มีวันที่แจ้ง)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Claim } | null>(null)
  const [saving, setSaving] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [openAction, setOpenAction] = useState<string | null>(null)
  const [actionRect, setActionRect] = useState<DOMRect | null>(null)
  const [editCell, setEditCell] = useState<{ id: string; field: string; val: string } | null>(null)
  const [itemsModal, setItemsModal] = useState<{ id: string; items: Item[] } | null>(null)
  const [itemsPaste, setItemsPaste] = useState('')
  const [itemsParsing, setItemsParsing] = useState(false)
  const [itemsParseErr, setItemsParseErr] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [printAsk, setPrintAsk] = useState<Claim[] | null>(null)   // ปริ้นหลายใบ → ถามก่อนว่าตาราง/ฟอร์ม
  const [shipModal, setShipModal] = useState<{ id: string; parcels: { no: string; carrier: string; manual: boolean }[] } | null>(null)
  const [staffNames, setStaffNames] = useState<string[]>(ADMINS_FALLBACK)

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Claim>(() =>
      supabase.from('claims').select('*')
        .order('claim_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message} — รัน scripts/create_claims_table.sql ใน Supabase ก่อนนะคะ`)
    const claims = data
    setPageCache('claims', claims)
    setRows(claims)
    snapshot(claims)   // ตั้งจุดอ้างอิงใหม่ → เคลมที่เปลี่ยนสถานะค้างไว้ ย้ายเข้าแท็บใหม่ตอนนี้
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ช่องแอดมิน: ดึงชื่อพนักงานที่ยังทำงานอยู่ทุกคนจากตาราง staff — มีคนเข้า/ออกก็อัปเดตเองไม่ต้องแก้โค้ด
  useEffect(() => {
    fetchEmployeeOptions()
      .then(list => {
        const names = list.map(e => e.nickname || e.realName).filter(Boolean)
        if (names.length) setStaffNames(names)
      })
      .catch(() => {})   // ดึงไม่ได้ → คงชื่อสำรองไว้ ยังเลือกได้เหมือนเดิม
  }, [])

  // รายชื่อในช่องแอดมิน = 3 แอดมินเคลมบนสุด แล้วตามด้วยพนักงานที่เหลือทั้งร้าน
  // + ชื่อที่เคยบันทึกไว้ในเคสเก่าที่ไม่มีในลิสต์แล้ว (ถ้าไม่ใส่ไว้ dropdown จะโชว์ว่างเหมือนข้อมูลหาย)
  const adminOptions = useMemo(() => {
    const used = rows.map(r => r.admin_name).filter((n): n is string => !!n)
    const all = Array.from(new Set([...staffNames, ...used]))
    const pinned = ADMINS_PINNED.filter(n => all.includes(n))   // ปักเฉพาะคนที่ยังอยู่ในลิสต์จริง (ลาออกแล้วไม่ต้องขึ้น)
    return [...pinned, ...all.filter(n => !pinned.includes(n))]
  }, [staffNames, rows])

  // ตัวเลือกช่อง "ผิดโดย" — พนักงานร้านทุกคน + ช่าง + บริษัทขนส่ง (+ ชื่อเก่าที่เคยบันทึกไว้แต่ไม่มีในลิสต์แล้ว)
  const faultByGroups = useMemo(() => {
    const staff = Array.from(new Set(staffNames))
    const carriers = CARRIER_OPTIONS.filter(c => c !== 'อื่นๆ')
    const known = new Set([...staff, ...FAULT_BY_TECHS, ...carriers])
    const used = Array.from(new Set(rows.map(r => r.fault_by).filter((n): n is string => !!n && !known.has(n))))
    return [
      { label: 'พนักงานร้าน', items: staff },
      { label: 'ช่าง', items: FAULT_BY_TECHS },
      { label: 'ขนส่ง', items: carriers },
      ...(used.length ? [{ label: 'อื่นๆ', items: used }] : []),
    ]
  }, [staffNames, rows])
  const faultByFlat = useMemo(() => faultByGroups.flatMap(g => g.items), [faultByGroups])

  const set = (k: keyof Claim, v: string | boolean | number | null) =>
    setModal(m => m ? { ...m, data: { ...m.data, [k]: v } } : null)

  // รูปงานเคลม — ใช้คอมโพเนนต์กลางตัวเดียวกับรูปหน้างานของงานติดตั้ง (ไฟล์อยู่บน R2 โฟลเดอร์ claims/)
  const ph = useInstallPhotos({ prefix: 'claims', title: 'รูปงานเคลม' })

  const openAdd = () => { setPasteText(''); setParseError(''); setItemsPaste(''); setItemsParseErr(''); ph.begin([], null); setModal({ mode: 'add', data: emptyClaim() }) }
  const openEdit = (c: Claim) => { setPasteText(c.raw_text ?? ''); setParseError(''); setItemsPaste(''); setItemsParseErr(''); ph.begin(c.photos, c.id); setModal({ mode: 'edit', data: { ...c } }) }
  const closeModal = () => { setModal(null); ph.cancel() }

  // แก้ไขรายการที่เคลม (เก็บเป็น array ใน items jsonb)
  const setItems = (updater: (cur: Item[]) => Item[]) =>
    setModal(m => m ? { ...m, data: { ...m.data, items: updater(m.data.items ?? []) } } : null)

  const parseFromLine = async () => {
    if (!pasteText.trim()) return
    setParsing(true); setParseError('')
    try {
      const res = await fetch('/api/parse-claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      const j = await res.json()
      if (!res.ok || j.error) { setParseError(j.error || 'แตกข้อมูลไม่สำเร็จ'); setParsing(false); return }
      const c = j.claim || {}
      setModal(m => {
        if (!m) return null
        const d = { ...m.data }
        const apply = (k: keyof Claim, v: unknown) => { if (v !== undefined && v !== null && v !== '') (d as Record<string, unknown>)[k] = v }
        apply('channel', c.channel); apply('customer_username', c.customer_username)
        apply('original_order_number', c.original_order_number); apply('claim_type', c.claim_type)
        apply('fault', c.fault); apply('cause', c.cause)
        apply('ship_name', c.ship_name); apply('ship_address', c.ship_address); apply('ship_phone', c.ship_phone)
        apply('return_tracking', c.return_tracking); apply('payment_target', c.payment_target)
        apply('money_direction', c.money_direction)
        if (typeof c.refund_amount === 'number') d.refund_amount = c.refund_amount
        if (c.is_urgent === true) d.is_urgent = true
        if (Array.isArray(c.items) && c.items.length) d.items = c.items
        d.raw_text = pasteText
        return { ...m, data: d }
      })
    } catch (e) {
      setParseError('เชื่อมต่อไม่ได้: ' + (e as Error).message)
    }
    setParsing(false)
  }

  const num = (v: number | null) => v != null && String(v) !== '' ? Number(v) : null

  const save = async () => {
    if (!modal) return
    setSaving(true); setError('')
    const d = modal.data
    const payload: Partial<Claim> = {
      claim_date: d.claim_date || null, deadline: d.deadline || null, channel: d.channel || null, customer_username: d.customer_username || null,
      original_order_number: d.original_order_number || null, claim_type: d.claim_type || null, fault: d.fault || null,
      fault_by: d.fault_by || null, fix_method: d.fix_method || null,
      cause: d.cause || null, resolution: d.resolution || null, items: d.items && d.items.length ? d.items : null,
      ship_name: d.ship_name || null, ship_address: d.ship_address || null, ship_phone: d.ship_phone || null,
      return_tracking: d.return_tracking || null, outbound_tracking: d.outbound_tracking || null, courier: d.courier || null,
      refund_amount: d.refund_amount != null && String(d.refund_amount) !== '' ? Number(d.refund_amount) : null,
      ship_back_cost: num(d.ship_back_cost), ship_return_cost: num(d.ship_return_cost), estimated_price: num(d.estimated_price),
      money_direction: d.money_direction || null, payment_target: d.payment_target || null, money_status: d.money_status || null,
      status: d.status || 'รอของคืน', is_urgent: !!d.is_urgent, notes: d.notes || null, raw_text: d.raw_text || null,
      admin_name: d.admin_name || null, technician: d.technician || null,
      photos: ph.photos,
      updated_at: new Date().toISOString(),
    }
    // ยังไม่เคยใช้รูปกับเคสนี้ → ไม่ต้องส่งคอลัมน์ photos (เว็บทำงานได้ตามปกติแม้ยังไม่ได้รัน SQL เพิ่มคอลัมน์)
    const hadPhotos = !!rows.find(r => r.id === d.id)?.photos?.length
    if (!ph.photos.length && !hadPhotos) delete payload.photos
    const claimErr = (msg: string) => /photos/.test(msg) ? photoSaveError(msg, 'migrations/add_claim_photos.sql') : `บันทึกไม่สำเร็จ: ${msg}`
    const name = (d.customer_username || d.original_order_number || '').toString()
    if (modal.mode === 'add') {
      const res = await claimInsert(payload).select().single()
      setSaving(false)
      if (res.error) { setError(claimErr(res.error.message)); return }
      const saved = res.data as Claim
      setRows(prev => [saved, ...prev])
      recordAction({
        label: `เพิ่มเคลม ${name}`,
        undo: async () => { await supabase.from('claims').delete().eq('id', saved.id); await load() },
        redo: async () => { await claimInsert(saved); await load() },
      })
    } else {
      const old = rows.find(r => r.id === d.id)
      const res = await claimUpdate(payload).eq('id', d.id).select().single()
      setSaving(false)
      if (res.error) { setError(claimErr(res.error.message)); return }
      setRows(prev => prev.map(r => r.id === d.id ? res.data as Claim : r))
      const prev = prevOf(old ?? {}, payload)
      recordAction({
        label: `แก้เคลม ${name}`,
        undo: async () => { await claimUpdate(prev).eq('id', d.id); await load() },
        redo: async () => { await claimUpdate(payload).eq('id', d.id); await load() },
      })
    }
    ph.commit()   // บันทึกผ่านแล้วค่อยลบไฟล์ของรูปที่กดเอาออก (กดยกเลิกกลางทางรูปเดิมจะไม่หาย)
    setModal(null)
  }

  const updateStatus = async (id: string, status: string) => {
    const old = rows.find(r => r.id === id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    await tUpdate('claims', id, { status, updated_at: new Date().toISOString() }, { status: old?.status ?? null }, `แก้สถานะเคลม ${old?.customer_username || ''}`, load)
  }

  const del = async (id: string) => {
    if (!(await ask('ลบเคสเคลมนี้?', { okText: 'ลบ', danger: true }))) return
    const row = rows.find(r => r.id === id)
    setError('')
    try {
      const { error: err } = await supabase.from('claims').delete().eq('id', id)
      // ‼️ ลบไม่สำเร็จต้องฟ้องเสมอ ห้ามเงียบ (เดิมไม่มี else เลยดูเหมือนกดปุ่มไม่ติด)
      if (err) { setError(`ลบไม่สำเร็จ: ${err.message}`); return }
      setRows(prev => prev.filter(r => r.id !== id))
      if (row) recordAction({
        label: `ลบเคลม ${row.customer_username || row.original_order_number || ''}`,
        undo: async () => { await claimInsert(row); await load() },
        redo: async () => { await supabase.from('claims').delete().eq('id', id); await load() },
      })
    } catch (e) {
      setError(`ลบไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── ใบเคลมสำหรับปริ้น (โครงเดียวกับใบออเดอร์ในหมวดออเดอร์ — บรรทัดของราง = สีแดง) ──
  function formatClaimLines(r: Claim): { t: string; rail?: boolean }[] {
    const lines: { t: string; rail?: boolean }[] = []
    const push = (t: string, rail = false) => lines.push({ t, rail })

    if (r.claim_date) push(new Date(r.claim_date).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }))
    const head = [r.channel, r.customer_username].filter(Boolean).join(': ')
    if (head) push(head)
    if (r.original_order_number) push(`ออเดอร์เดิม ${r.original_order_number}`)

    push('')
    const claimHead = [r.claim_type, r.fault ? `ผิดที่${r.fault}` : ''].filter(Boolean).join(' · ')
    if (claimHead) push(`เคลม: ${claimHead}`)
    if (r.cause) push(r.cause)
    if (r.resolution) push(`วิธีจัดการ: ${r.resolution}`)

    if (r.items && r.items.length > 0) {
      r.items.forEach(item => {
        push('')
        for (const ln of itemBlockLines(item)) push(ln.t, ln.rail)
      })
    }

    push('')
    const recv = [r.ship_name, r.ship_phone].filter(Boolean).join('  ')
    if (recv) push(`ผู้รับ: ${recv}`)
    if (r.ship_address) push(`ที่อยู่: ${r.ship_address}`)
    if (r.courier) push(r.courier)
    if (r.notes) push(`หมายเหตุ: ${r.notes}`)

    return lines
  }

  function formatClaimHtml(r: Claim): string {
    const esc = (v: string) => v.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
    return formatClaimLines(r).map(l => l.rail ? `<span class="rail">${esc(l.t)}</span>` : esc(l.t)).join('\n')
  }

  // ปริ้น: หน้าต่างใหม่ + ปุ่มปริ้นในหน้านั้น (แก้ข้อความในใบก่อนปริ้นได้)
  // ใบแบบฟอร์มมี QR ให้ทีมผลิตสแกนเดินสถานะงานเคลม (/scan?c=<id> → RPC claim_scan_advance ใน sql/claim_scan.sql)
  async function openPrintWindow(toPrint: Claim[], title: string, mode: 'auto' | 'table' | 'form' = 'auto') {
    const escHtml = (v: unknown) => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
    const asForm = mode === 'form' || (mode === 'auto' && toPrint.length === 1)

    const win = window.open('', '_blank', 'width=1200,height=750')
    if (!win) { alert('เบราว์เซอร์บล็อก popup — โปรดอนุญาต popup เพื่อปริ้น'); return }

    // จำเวลาปริ้นล่าสุดต่อใบ → โชว์ข้างปุ่มปริ้นในเมนู ··· (ไม่แตะ updated_at เพราะไม่ใช่การแก้ข้อมูล)
    const printedNow = new Date().toISOString()
    const printedIds = toPrint.map(r => r.id)
    claimUpdate({ printed_at: printedNow }).in('id', printedIds)
      .then((res: { error: { message: string } | null }) => {
        if (!res.error) setRows(p => p.map(x => printedIds.includes(x.id) ? { ...x, printed_at: printedNow } : x))
      })

    // QR ต่อใบ — ชี้ไปหน้า /scan บนโดเมนเดียวกับที่เปิดอยู่ (สแกนแล้วเดินสถานะเคลมใบนั้น)
    let qrs: string[] = []
    if (asForm) {
      const origin = window.location.origin
      qrs = await Promise.all(toPrint.map(r =>
        QRCode.toDataURL(`${origin}/scan?c=${r.id}`, { margin: 1, width: 240 }).catch(() => '')
      ))
    }

    const body = asForm
      ? toPrint.map((r, i) => `<div class="order"><pre class="copy">${formatClaimHtml(r)}</pre>${qrs[i] ? `<div class="qr-box"><img class="qr" src="${qrs[i]}"/><div class="qr-cap">สแกนเดินสถานะงานเคลม</div></div>` : ''}</div>`).join('')
      : `<h2>${escHtml(title)} (${toPrint.length} รายการ)</h2>
<table>
<thead><tr>
  <th>#</th><th>วันที่</th><th>แพลตฟอร์ม</th><th>ลูกค้า</th><th>ออเดอร์เดิม</th><th>ประเภทเคลม</th><th>สาเหตุ</th><th>ชื่อผู้รับ</th><th>ที่อยู่จัดส่ง</th><th>ขนส่ง</th><th>สถานะ</th>
</tr></thead>
<tbody>
${toPrint.map((r, i) => `<tr><td>${i + 1}</td><td>${r.claim_date ? escHtml(new Date(r.claim_date).toLocaleDateString('th-TH-u-ca-gregory', { day: '2-digit', month: '2-digit', year: '2-digit' })) : '-'}</td><td>${escHtml(r.channel || '-')}</td><td>${escHtml(r.customer_username || '-')}</td><td>${escHtml(r.original_order_number || '-')}</td><td>${escHtml(r.claim_type || '-')}</td><td>${escHtml(r.cause || '-')}</td><td>${escHtml(r.ship_name || '-')}</td><td>${escHtml(r.ship_address || '-')}</td><td>${escHtml(r.courier || '-')}</td><td>${escHtml(r.status || '-')}</td></tr>`).join('\n')}
</tbody>
</table>`

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ปริ้นใบเคลม</title>
<style>
  * { box-sizing: border-box; }
  .qr-box { display: inline-block; text-align: center; margin-top: 12px; }
  .qr { width: 120px; height: 120px; display: block; }
  .qr-cap { font-size: 11px; color: #555; margin-top: 4px; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 12px; color: #000; margin: 0; padding: 16px; }
  h2 { font-size: 14px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #aaa; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 700; white-space: nowrap; }
  pre.copy { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 16px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; margin: 0; }
  pre.copy .rail { color: #c00; }
  /* ต้องเป็น block — break-inside: avoid ไม่ทำงานบน flex container (Chromium) ทำให้ใบโดนตัดข้ามหน้า */
  .order { display: block; break-inside: avoid; page-break-inside: avoid; padding-bottom: 28px; margin-bottom: 28px; border-bottom: 1px dashed #b0b0b0; }
  .order:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: none; }
  @page { margin: 0; }
  @media print { body { padding: 14mm; } .toolbar { display: none !important; } pre.copy { outline: none !important; background: transparent !important; } }
  pre.copy[contenteditable]:hover { outline: 1.5px dashed #c0c0c0; outline-offset: 4px; }
  pre.copy[contenteditable]:focus { outline: 1.5px solid #2563eb; outline-offset: 4px; background: #fafcff; }
  .toolbar { position: fixed; top: 10px; right: 10px; background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 8px 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); display: flex; gap: 10px; align-items: center; z-index: 99; }
  .toolbar .hint { font-size: 12px; color: #888; }
  .toolbar button.go { padding: 8px 20px; border-radius: 8px; border: none; background: #1a1a1a; color: #fff; cursor: pointer; font-size: 14px; font-weight: 700; font-family: inherit; }
</style>
</head>
<body>
<div class="toolbar">
  <span class="hint">แตะข้อความเพื่อแก้ไขได้ก่อนปริ้น</span>
  <button class="go">🖨 ปริ้น</button>
</div>
${body}
<script>
  document.querySelectorAll('pre.copy').forEach(function (p) { p.setAttribute('contenteditable', 'true'); p.setAttribute('spellcheck', 'false'); });
  document.querySelector('.toolbar .go').onclick = function () { window.print(); };
</script>
</body>
</html>`
    win.document.open(); win.document.write(html); win.document.close(); win.focus()
  }

  const printTitle = (list: Claim[]) => `ใบเคลม ${list.length} รายการ — ${new Date().toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const requestPrint = (list: Claim[]) => {
    if (list.length === 0) return
    if (list.length === 1) { void openPrintWindow(list, printTitle(list)); return }
    setPrintAsk(list)
  }

  // ===== เชื่อมกับเว็บคำนวณอุปกรณ์ราง (donna-rail) — เหมือนหมวดออเดอร์ =====
  const railItemsOf = (r: Claim) => (Array.isArray(r.items) ? r.items : []).filter(it => typeof it.type === 'string' && it.type.startsWith('ราง'))
  const hasRail = (r: Claim) => railItemsOf(r).length > 0
  const openRailCalc = (r: Claim) => {
    const courier = (r.courier || '').toLowerCase()
    const carrier = /spx|shopee/.test(courier) ? 'Spx'
      : /flash/.test(courier) ? 'Flash'
      : /j&t|jt/.test(courier) ? 'J&T'
      : 'อื่นๆ'
    const items = railItemsOf(r).map(it => ({
      // ชนิดที่เครื่องคำนวณไม่มีสูตร ส่งชื่อต้นฉบับไป (เว็บรางเปิดเป็นชนิด "อื่นๆ" ให้กรอกของเอง)
      // ห้าม fallback เป็นรางจีบ — ใบเคลมจะได้อุปกรณ์ผิดชนิดทั้งใบ
      type: railKind(it.type) || it.type,
      size: typeof it.width === 'string' && it.width.includes('+') ? it.width.trim() : (Number(it.width) || 0),
      qty: Number(it.quantity) || 1,
      layers: railLayers(it),   // ช่องชั้นว่าง → อ่านจากชื่อชนิด ("รางม่านจีบ 2 ชั้น")
      color: (it.color_name || '').replace(/^สี/, '') || undefined,
      // ออเดอร์ไม่ได้ลงว่าแยกกลาง/สไลด์เดี่ยว → ส่งค่าว่าง ไม่เดาให้ (donna-rail จะเว้นไว้ให้ช่างกดเลือกเอง)
      split: railSplit(it.note || ''),
      head: it.rail_head || undefined,
      carrier,
    }))
    // ไม่ส่ง id/scanBase — donna-rail จะได้ไม่ทำ QR (หน้า /scan อ่านจาก order_entries เคสเคลมสแกนไม่เจอ)
    const payload = { cust: r.customer_username || '', order: r.original_order_number || '', platform: r.channel || '', note: r.notes || '', items }
    window.open(railLink({ prefill: JSON.stringify(payload) }), '_blank')
  }

  // บันทึกเลขพัสดุจาก popup "จัดส่งแล้ว" → ติ๊กจัดส่งแล้ว + ตั้งสถานะเป็น "ส่งแล้ว"
  const saveShipments = async () => {
    if (!shipModal) return
    const row = rows.find(r => r.id === shipModal.id)
    const parcels: Shipment[] = shipModal.parcels.map(p => ({ no: p.no.trim(), carrier: p.carrier })).filter(p => p.no)
    const now = new Date().toISOString()
    const updates = {
      shipments: parcels.length ? parcels : null,
      outbound_tracking: parcels.map(p => p.no).join(', ') || null,   // คงช่องเดิมไว้ให้ตรงกัน
      status: 'ส่งแล้ว',
      shipped_at: row?.shipped_at || now,
      updated_at: now,
    }
    setRows(p => p.map(r => r.id === shipModal.id ? { ...r, ...updates } as Claim : r))
    setShipModal(null)
    const { error: err } = await claimUpdate(updates).eq('id', shipModal.id)
    if (err) { setError(`บันทึกเลขพัสดุไม่สำเร็จ: ${err.message}`); await load() }
  }

  // ติ๊กออกจากคอลัมน์จัดส่ง = ยังไม่ส่ง (ล้างวันที่ส่ง คงเลขพัสดุไว้ให้แก้ต่อได้)
  const unship = async (r: Claim) => {
    const now = new Date().toISOString()
    const updates = { shipped_at: null, status: 'แพ็คแล้ว', updated_at: now }
    setRows(p => p.map(x => x.id === r.id ? { ...x, ...updates } as Claim : x))
    await claimUpdate(updates).eq('id', r.id)
  }

  const openShipModal = (r: Claim) => {
    const existing = Array.isArray(r.shipments) ? r.shipments.map(s => ({ no: s.no, carrier: s.carrier, manual: true })) : []
    setShipModal({ id: r.id, parcels: [...existing, { no: '', carrier: '', manual: false }] })
  }

  // ── ตัวเลือกเดือน (ยึดวันที่แจ้งเคลม) ──
  const monthKey = (r: Claim) => (r.claim_date ?? '').slice(0, 7) || 'none'
  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(rows.map(monthKey)))
    const ym = keys.filter(k => k !== 'none').sort().reverse()
    return { ym, hasNone: keys.includes('none') }
  }, [rows])
  const monthLabel = (k: string) => {
    if (k === 'none') return 'ไม่ระบุวันที่แจ้ง'
    const [y, m] = k.split('-')
    return `${TH_MONTHS[Number(m) - 1]} ${Number(y) + 543}`
  }

  // นับ/กรองบนค่า "ตอนโหลดหน้า" (stable) แล้วคืนค่าสด (live) ก่อนวาด — แถวจึงค้างในแท็บเดิมให้ตรวจทานได้
  // กรองเดือนก่อนนับ → ตัวเลขบนแท็บสถานะตรงกับเดือนที่เลือก
  const stableRows = rows.map(stable).filter(r => month === 'all' || monthKey(r) === month)
  const counts: Record<string, number> = { all: stableRows.length }
  WORKFLOW.forEach(w => { counts[w.key] = stableRows.filter(r => r.status === w.key).length })

  const displayed = stableRows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || (r.customer_username ?? '').toLowerCase().includes(q) ||
      (r.original_order_number ?? '').toLowerCase().includes(q) || (r.cause ?? '').toLowerCase().includes(q) ||
      (r.fault_by ?? '').toLowerCase().includes(q) || (r.fix_method ?? '').toLowerCase().includes(q)
    const matchTab = tab === 'all' || r.status === tab
    return matchSearch && matchTab
  }).map(live)

  // ยอดรวมค่าส่งกลับ / ค่าส่งคืน / ราคาประเมิน — คิดจากเคสที่กรองอยู่ตอนนี้ (เดือน + แท็บสถานะ + คำค้น)
  const totals = useMemo(() => {
    const sum = (f: 'ship_back_cost' | 'ship_return_cost' | 'estimated_price') =>
      displayed.reduce((acc, r) => acc + (Number(r[f]) || 0), 0)
    const count = (f: 'ship_back_cost' | 'ship_return_cost' | 'estimated_price') =>
      displayed.filter(r => Number(r[f]) > 0).length
    return {
      back: sum('ship_back_cost'), backN: count('ship_back_cost'),
      ret: sum('ship_return_cost'), retN: count('ship_return_cost'),
      est: sum('estimated_price'), estN: count('estimated_price'),
    }
  }, [displayed])

  // ── inline-edit ในตาราง (กดที่ช่องแล้วแก้ได้เลย เหมือนหมวดออเดอร์) ──
  const isEditing = (id: string, f: string) => editCell?.id === id && editCell.field === f
  const saveCell = async (id: string, field: keyof Claim, val: string, numeric = false) => {
    setEditCell(null)
    const value: string | number | null = val.trim() === '' ? null : (numeric ? Number(val) : val)
    const now = new Date().toISOString()
    const old = rows.find(r => r.id === id)
    setRows(prev => prev.map(r => r.id === id ? ({ ...r, [field]: value, updated_at: now } as Claim) : r))
    await tUpdate('claims', id, { [field]: value, updated_at: now }, { [field]: old ? (old as any)[field] ?? null : null }, `แก้เคลม ${old?.customer_username || ''}`, load)
  }
  const textCell = (r: Claim, field: keyof Claim, opts?: { numeric?: boolean; placeholder?: string; align?: 'left' | 'right' }) => {
    const val = r[field] == null ? '' : String(r[field])
    return isEditing(r.id, field) ? (
      <input type={opts?.numeric ? 'number' : 'text'} autoFocus value={editCell!.val}
        onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
        onBlur={() => saveCell(r.id, field, editCell!.val, opts?.numeric)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', minWidth: 70, outline: 'none', padding: '2px 0', textAlign: opts?.align ?? 'left' }} />
    ) : (
      <div onClick={() => setEditCell({ id: r.id, field, val })}
        style={{ cursor: 'text', color: val ? 'var(--ink)' : 'var(--ink-4)', textAlign: opts?.align ?? 'left' }}>
        {opts?.numeric && val ? Number(val).toLocaleString('th-TH') : (val || (opts?.placeholder ?? '—'))}
      </div>
    )
  }
  // ปิดงาน: ติ๊ก = ปิดงาน+ประทับเวลา (เก็บชื่อแอดมินที่รับผิดชอบเป็นคนปิด), ติ๊กออก = เปิดงานกลับ
  const toggleClosed = async (r: Claim, checked: boolean) => {
    const now = new Date().toISOString()
    const updates = checked
      ? { closed_by: r.admin_name || 'ไม่ระบุ', closed_at: now, updated_at: now }
      : { closed_by: null, closed_at: null, updated_at: now }
    setRows(prev => prev.map(x => x.id === r.id ? ({ ...x, ...updates } as Claim) : x))
    await claimUpdate(updates).eq('id', r.id)
  }

  // แก้วันที่ปิดงาน — closed_at เป็น timestamptz เก็บเวลาเดิมของวันไว้ (แค่ย้ายวัน ไม่รีเซ็ตเป็นเที่ยงคืน)
  const setClosedDate = async (r: Claim, ymd: string) => {
    if (!ymd || !r.closed_at) return
    const old = new Date(r.closed_at)
    const [y, m, d] = ymd.split('-').map(Number)
    const next = new Date(old)
    next.setFullYear(y, m - 1, d)
    const updates = { closed_at: next.toISOString(), updated_at: new Date().toISOString() }
    setRows(prev => prev.map(x => x.id === r.id ? ({ ...x, ...updates } as Claim) : x))
    await claimUpdate(updates).eq('id', r.id)
  }

  const selectInline = (r: Claim, field: keyof Claim, options: string[]) => (
    <select value={String(r[field] ?? '')} onChange={e => saveCell(r.id, field, e.target.value)}
      style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', padding: 0, color: r[field] ? 'var(--ink)' : 'var(--ink-4)', maxWidth: 140 }}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  // popup แก้รายการ (กดที่ช่องรายการในตาราง) — เหมือนหมวดออเดอร์
  const updItemsModal = (updater: (cur: Item[]) => Item[]) => setItemsModal(m => m ? { ...m, items: updater(m.items) } : null)
  const saveItemsModal = async () => {
    if (!itemsModal) return
    const items = itemsModal.items.length ? itemsModal.items : null
    const now = new Date().toISOString()
    setRows(prev => prev.map(r => r.id === itemsModal.id ? ({ ...r, items, updated_at: now } as Claim) : r))
    setItemsModal(null)
    await claimUpdate({ items, updated_at: now }).eq('id', itemsModal.id)
  }

  // แปลงข้อความรายการ → items (เรียก AI เหมือนหมวดออเดอร์)
  const parseItemsText = async (upd: (u: (c: Item[]) => Item[]) => void) => {
    if (!itemsPaste.trim()) return
    setItemsParsing(true); setItemsParseErr('')
    try {
      const res = await fetch('/api/parse-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: itemsPaste }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'แปลงไม่สำเร็จ')
      upd(() => data.items as Item[])
    } catch (e) {
      setItemsParseErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setItemsParsing(false)
    }
  }

  // ตัวแก้รายการแบบการ์ด (ใช้ทั้งในฟอร์มและใน popup)
  const itemEditor = (items: Item[], upd: (u: (c: Item[]) => Item[]) => void) => (
    <div>
      <textarea value={itemsPaste} onChange={e => setItemsPaste(e.target.value)} rows={3}
        style={{ width: '100%', border: '1px dashed var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace', background: 'var(--bg)', color: 'var(--ink)', marginBottom: 6 }} />
      {itemsParseErr && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 6 }}>{itemsParseErr}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => parseItemsText(upd)} disabled={!itemsPaste.trim() || itemsParsing}
          style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: itemsParsing || !itemsPaste.trim() ? 'var(--border)' : 'var(--blue)', color: itemsParsing || !itemsPaste.trim() ? 'var(--ink-3)' : '#fff', fontSize: 12, fontWeight: 600, cursor: itemsParsing || !itemsPaste.trim() ? 'default' : 'pointer' }}>
          {itemsParsing ? 'กำลังแปลง…' : '✦ แปลงรายการ'}
        </button>
        <button onClick={() => upd(cur => [...cur, emptyItem()])}
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--blue)', cursor: 'pointer' }}>+ เพิ่มรายการ</button>
      </div>
      {items.length === 0 && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>ยังไม่มีรายการ — วางข้อความจากไลน์แล้วกดแปลงข้อมูล หรือกด “+ เพิ่มรายการ”</div>
      )}
      {items.map((item, idx) => (
        <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500 }}>รายการที่ {idx + 1}</span>
            <button onClick={() => upd(cur => cur.filter((_, i) => i !== idx))}
              style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: 0 }}>ลบ</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 2fr 2fr 2fr 2fr 2fr', gap: '6px 8px', marginBottom: 6 }}>
            {([['ประเภท', 'type', 'text'], ['ชั้น', 'floors', 'number'], ['หัวราง/จีบ', 'rail_head', 'text'], ['ตะขอ', 'hook_type', 'text'], ['ประเภทผ้า', 'fabric_type', 'text'], ['แบรนด์', 'color_code', 'text'], ['ลาย/สไตล์', 'color_name', 'text'], ['สีจริง', 'color_desc', 'text']] as [string, keyof Item, string][]).map(([lbl, key, type]) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--ink-4)', display: 'block', marginBottom: 2 }}>{lbl}</label>
                <input type={type} step={type === 'number' ? '1' : undefined} value={item[key] === null ? '' : String(item[key])}
                  onChange={e => { const val = key === 'floors' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value; upd(cur => cur.map((it, i) => i === idx ? { ...it, [key]: val } : it)) }}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 2fr', gap: '6px 8px' }}>
            {([['กว้าง (ม.)', 'width', 'number'], ['สูง (ม.)', 'height', 'number'], ['จำนวน', 'quantity', 'number'], ['หน่วย', 'unit', 'text'], ['กระดูม', 'hooks', 'text'], ['หมายเหตุ', 'note', 'text']] as [string, keyof Item, string][]).map(([lbl, key, type]) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--ink-4)', display: 'block', marginBottom: 2 }}>{lbl}</label>
                <input type={type} step={type === 'number' ? '0.01' : undefined} value={item[key] === null ? '' : String(item[key])}
                  onChange={e => upd(cur => cur.map((it, i) => i === idx ? { ...it, [key]: e.target.value } : it))}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  const inputStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
  const field = (label: string, k: keyof Claim, opts?: { type?: string; options?: string[]; full?: boolean }) => (
    <div style={{ marginBottom: 12, gridColumn: opts?.full ? '1 / -1' : undefined }}>
      <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>{label}</label>
      {opts?.options ? (
        <select value={String(modal?.data[k] ?? '')} onChange={e => set(k, e.target.value)} style={inputStyle}>
          <option value="">— เลือก —</option>
          {opts.options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={opts?.type || 'text'} value={String(modal?.data[k] ?? '')}
          onChange={e => set(k, opts?.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
          style={inputStyle} />
      )}
    </div>
  )

  return (
    <div style={{ marginTop: -16 }}>
      {error && (
        <div style={{ background: '#ff375f11', border: '1px solid #ff375f44', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* แดชบอร์ดยอดรวม (สไตล์เดียวกับการ์ดในหมวดพนักงาน) — คิดตามตัวกรองที่เปิดอยู่: เดือน/แท็บสถานะ/คำค้น */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'ค่าส่งกลับ (บาท)', value: totals.back.toLocaleString('th-TH', { maximumFractionDigits: 2 }), color: 'var(--ink)' },
            { label: 'ค่าส่งคืน (บาท)', value: totals.ret.toLocaleString('th-TH', { maximumFractionDigits: 2 }), color: 'var(--ink)' },
            { label: 'ราคาประเมิน (บาท)', value: totals.est.toLocaleString('th-TH', { maximumFractionDigits: 2 }), color: 'var(--ink)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ลูกค้า / เลขออเดอร์ / สาเหตุ…"
          style={{ flex: '1 1 260px', minWidth: 0, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        <select value={month} onChange={e => setMonth(e.target.value)} title="เดือนที่แจ้งเคลม"
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', background: month === 'all' ? 'var(--surface)' : 'var(--blue-bg)', color: 'var(--ink)', fontWeight: month === 'all' ? 400 : 600, cursor: 'pointer', flexShrink: 0 }}>
          <option value="all">ทุกเดือน</option>
          {monthOptions.ym.map(k => <option key={k} value={k}>{monthLabel(k)}</option>)}
          {monthOptions.hasNone && <option value="none">{monthLabel('none')}</option>}
        </select>
        <button onClick={() => requestPrint(selectedIds.size > 0 ? displayed.filter(r => selectedIds.has(r.id)) : displayed)}
          style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          🖨️ ปริ้น{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </button>
        <button onClick={openAdd}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(196,126,58,0.3)', flexShrink: 0 }}>
          + เพิ่มเคลม
        </button>
      </div>

      {/* Status tabs (workflow) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {([['all', 'ทั้งหมด', 'var(--ink-3)'], ...WORKFLOW.map(w => [w.key, w.key, w.color] as [string, string, string])] as [string, string, string][]).map(([key, label, color]) => {
          const active = tab === key
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '6px 14px', borderRadius: 20, border: active ? 'none' : '1px solid var(--border)', background: active ? color : 'var(--surface)', color: active ? '#fff' : 'var(--ink-3)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              {label}
              <span style={{ background: active ? 'rgba(255,255,255,0.3)' : color + '22', color: active ? '#fff' : color, borderRadius: 10, padding: '0px 6px', fontSize: 11, fontWeight: 700 }}>{counts[key] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>ยังไม่มีเคสเคลม — กด “+ เพิ่มเคลม” แล้ววางข้อความจากไลน์ได้เลย</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                  <th style={{ padding: '10px 8px 10px 14px', width: 32 }}>
                    <input type="checkbox" title="เลือกทั้งหมด"
                      checked={displayed.length > 0 && displayed.every(r => selectedIds.has(r.id))}
                      onChange={e => setSelectedIds(e.target.checked ? new Set(displayed.map(r => r.id)) : new Set())}
                      style={{ cursor: 'pointer', width: 15, height: 15 }} />
                  </th>
                  {['วันที่', 'กำหนดส่ง', 'แพลตฟอร์ม', 'ลูกค้า', 'ประเภท', 'ผิดโดย', 'วิธีแก้ไข', 'รายการ', 'ยอดชำระ', 'สถานะ', 'แอดมิน', 'ช่าง', 'ปิดงาน', 'ชื่อผู้รับ', 'ที่อยู่จัดส่ง', 'จัดส่ง', 'ค่าส่งกลับ', 'ค่าส่งคืน', 'ราคาประเมิน', 'หมายเหตุ', 'แก้ไขล่าสุด', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: ['ค่าส่งกลับ', 'ค่าส่งคืน', 'ราคาประเมิน'].includes(h) ? 'right' : 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : undefined }}>
                    <td style={{ padding: '8px 8px 8px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)}
                        onChange={e => setSelectedIds(prev => { const s = new Set(prev); if (e.target.checked) s.add(r.id); else s.delete(r.id); return s })}
                        style={{ cursor: 'pointer', width: 15, height: 15 }} />
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {/* วันที่แจ้งเคลม — แก้ได้ (บางเคสลงระบบย้อนหลัง วันที่ไม่ตรงกับวันที่ลูกค้าแจ้งจริง) */}
                      <input type="date" className="date-inline" value={r.claim_date ?? ''}
                        onClick={e => e.currentTarget.showPicker?.()}
                        onChange={e => saveCell(r.id, 'claim_date', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', padding: 0, color: r.claim_date ? 'var(--ink-3)' : 'var(--ink-4)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {/* กำหนดส่ง — หมวดออเดอร์เอาไปคิดคอลัมน์ "วันที่เหลือ" */}
                      <input type="date" className="date-inline" value={r.deadline ?? ''}
                        onClick={e => e.currentTarget.showPicker?.()}
                        onChange={e => saveCell(r.id, 'deadline', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', padding: 0, color: r.deadline ? 'var(--ink)' : 'var(--ink-4)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{r.channel || '-'}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <div>
                        {r.customer_username
                          ? <Link href={`/customers?name=${encodeURIComponent(r.customer_username)}`} title="เปิดโฟลเดอร์ออเดอร์" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{r.customer_username}</Link>
                          : '-'}
                      </div>
                      {r.original_order_number && <div style={{ color: 'var(--ink-4)', fontSize: 11 }}>#{r.original_order_number}</div>}
                      {r.photos && r.photos.length > 0 && (
                        <div title={`มีรูปงานเคลม ${r.photos.length} รูป`} style={{ fontSize: 11, color: 'var(--ink-3)' }}>📷 {r.photos.length}</div>
                      )}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      {selectInline(r, 'claim_type', CLAIM_TYPES)}
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', minWidth: 90 }}>
                      <SearchSelect value={r.fault_by ?? ''} groups={faultByGroups} onPick={v => saveCell(r.id, 'fault_by', v)} />
                    </td>
                    <td style={{ padding: '8px 14px', minWidth: 130, maxWidth: 220, whiteSpace: 'normal' }}>
                      {textCell(r, 'fix_method', { placeholder: '+ วิธีแก้ไข' })}
                    </td>
                    <td style={{ padding: '8px 14px', maxWidth: 320 }}>
                      <div style={{ marginBottom: 4 }}>{textCell(r, 'cause')}</div>
                      <button onClick={() => { setItemsPaste(''); setItemsParseErr(''); setItemsModal({ id: r.id, items: r.items ? r.items.map(it => ({ ...it })) : [] }) }}
                        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%', display: 'block' }}>
                        {r.items && r.items.length > 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                            {r.items.slice(0, 3).map((it, i) => <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>• {itemLine(it)}</div>)}
                            {r.items.length > 3 && <div>+ อีก {r.items.length - 3} รายการ</div>}
                          </div>
                        ) : <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>+ เพิ่มรายการ</span>}
                      </button>
                      {r.return_tracking && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>คืน: {r.return_tracking}</div>}
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {isEditing(r.id, 'refund_amount') ? (
                        <input type="number" autoFocus value={editCell!.val}
                          onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                          onBlur={() => saveCell(r.id, 'refund_amount', editCell!.val, true)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: 90, outline: 'none', padding: '2px 0' }} />
                      ) : (
                        <div onClick={() => setEditCell({ id: r.id, field: 'refund_amount', val: r.refund_amount != null ? String(r.refund_amount) : '' })} style={{ cursor: 'text' }}>
                          {r.refund_amount != null ? (
                            <span style={{ fontWeight: 600, color: r.money_direction === 'เก็บลูกค้า' ? '#34c759' : 'var(--red)' }}>
                              {r.money_direction === 'เก็บลูกค้า' ? '+' : '−'}{Number(r.refund_amount).toLocaleString()}
                            </span>
                          ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </div>
                      )}
                      {r.money_status && <div style={{ fontSize: 11, color: r.money_status === 'รอ' ? '#ff9f0a' : '#34c759' }}>{r.money_status}</div>}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none', padding: 0, color: STATUS_COLOR(r.status) }}>
                        {WORKFLOW.map(w => <option key={w.key} value={w.key}>{w.key}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {selectInline(r, 'admin_name', adminOptions)}
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {selectInline(r, 'technician', TECH_OPTIONS)}
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={!!r.closed_at} onChange={e => toggleClosed(r, e.target.checked)}
                        title={r.closed_at ? 'ปิดงานแล้ว' : 'ติ๊กเพื่อปิดงาน'}
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#34c759' }} />
                      {r.closed_at && (
                        /* วันที่ปิดงาน — แก้ได้ (ปิดงานย้อนหลังบ่อย) เก็บเวลาเดิมของวันไว้ เปลี่ยนแค่วัน */
                        <input type="date" className="date-inline" value={ymdLocal(r.closed_at)}
                          onClick={e => e.currentTarget.showPicker?.()}
                          onChange={e => setClosedDate(r, e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontSize: 11, outline: 'none', padding: 0, color: 'var(--ink-4)', cursor: 'pointer', width: 96 }} />
                      )}
                    </td>
                    <td style={{ padding: '8px 14px', minWidth: 110 }}>
                      <div>{textCell(r, 'ship_name')}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{textCell(r, 'ship_phone', { placeholder: '+ เบอร์โทร' })}</div>
                    </td>
                    <td style={{ padding: '8px 14px', minWidth: 180, maxWidth: 260, whiteSpace: 'normal' }}>{textCell(r, 'ship_address')}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={!!r.shipped_at}
                        onChange={e => e.target.checked ? openShipModal(r) : unship(r)}
                        title={r.shipped_at ? 'ส่งแล้ว — ติ๊กออกเพื่อยกเลิก' : 'ติ๊กเพื่อกรอกเลขพัสดุ'}
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#34c759' }} />
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', minWidth: 80 }}>{textCell(r, 'ship_back_cost', { numeric: true, align: 'right' })}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', minWidth: 80 }}>{textCell(r, 'ship_return_cost', { numeric: true, align: 'right' })}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', minWidth: 90 }}>{textCell(r, 'estimated_price', { numeric: true, align: 'right' })}</td>
                    <td style={{ padding: '8px 14px', minWidth: 120 }}>{textCell(r, 'notes')}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <button onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (openAction === r.id) { setOpenAction(null); setActionRect(null) } else { setOpenAction(r.id); setActionRect(rect) } }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openAction === r.id ? 'var(--bg)' : '#fff', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1 }}>
                        ···
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action menu (···) */}
      {openAction && actionRect && (() => {
        const r = rows.find(row => row.id === openAction)
        if (!r) return null
        return (
          <>
            <div onClick={() => { setOpenAction(null); setActionRect(null) }} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
            <div style={{ position: 'fixed', top: actionRect.bottom + 2, right: window.innerWidth - actionRect.right, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 9999, minWidth: 130, padding: '4px 0' }}>
              <button onClick={() => { setOpenAction(null); setActionRect(null); requestPrint(selectedIds.size > 1 ? displayed.filter(x => selectedIds.has(x.id)) : [r]) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/></svg>
                ปริ้น
                {r.printed_at && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#eab308', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {new Date(r.printed_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                    {new Date(r.printed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </button>
              {hasRail(r) && (
                <button onClick={() => { setOpenAction(null); setActionRect(null); openRailCalc(r) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18M7 4v3m5-3v3m5-3v3"/></svg>
                  ปริ้นอุปกรณ์ราง
                </button>
              )}
              <button onClick={() => { setOpenAction(null); setActionRect(null); openShipModal(r) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
                จัดส่งแล้ว
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button onClick={() => { setOpenAction(null); setActionRect(null); openEdit(r) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                แก้ไข
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <button onClick={() => { setOpenAction(null); setActionRect(null); del(r.id) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--red)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                ลบ
              </button>
            </div>
          </>
        )
      })()}

      {/* ปริ้นหลายใบ → ถามก่อนว่าตารางสรุปหรือฟอร์มรายใบ (เหมือนหมวดออเดอร์) */}
      {printAsk && (
        <div onClick={() => setPrintAsk(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 24, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>ปริ้น {printAsk.length} รายการ</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>เลือกรูปแบบเอกสาร</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { const l = printAsk; setPrintAsk(null); void openPrintWindow(l, printTitle(l), 'table') }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                ตารางสรุป
              </button>
              <button onClick={() => { const l = printAsk; setPrintAsk(null); void openPrintWindow(l, printTitle(l), 'form') }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                ฟอร์มรายใบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup จัดส่งแล้ว — กรอกเลขพัสดุ (เพิ่มได้หลายเลข) เหมือนหมวดออเดอร์ */}
      {shipModal && (
        <div onClick={() => setShipModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>จัดส่งแล้ว — กรอกเลขพัสดุ</h3>
              <button onClick={() => setShipModal(m => m ? { ...m, parcels: [...m.parcels, { no: '', carrier: '', manual: false }] } : m)} title="เพิ่มเลขพัสดุ"
                style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
            </div>
            {(() => {
              const claim = rows.find(row => row.id === shipModal.id)
              return shipModal.parcels.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input value={p.no} autoFocus={i === shipModal.parcels.length - 1} placeholder="เลขพัสดุ"
                    onChange={e => setShipModal(m => m ? { ...m, parcels: m.parcels.map((x, j) => j === i ? { ...x, no: e.target.value, carrier: x.manual ? x.carrier : detectCarrier(e.target.value, claim?.courier) } : x) } : m)}
                    style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                  <select value={p.carrier}
                    onChange={e => setShipModal(m => m ? { ...m, parcels: m.parcels.map((x, j) => j === i ? { ...x, carrier: e.target.value, manual: true } : x) } : m)}
                    style={{ width: 120, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 6px', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                    <option value="">— ขนส่ง —</option>
                    {CARRIER_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {shipModal.parcels.length > 1 && (
                    <button onClick={() => setShipModal(m => m ? { ...m, parcels: m.parcels.filter((_, j) => j !== i) } : m)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✕</button>
                  )}
                </div>
              ))
            })()}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setShipModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
              <button onClick={saveShipments}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>บันทึก — จัดส่งแล้ว</button>
            </div>
          </div>
        </div>
      )}

      {/* Items modal (กดที่ช่องรายการในตาราง) — ฟอร์มเดียวกับหมวดออเดอร์ */}
      {itemsModal && (
        <div onClick={() => { setItemsModal(null); setItemsParseErr('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>รายการสินค้า</h3>

            {/* AI Paste zone */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <textarea value={itemsPaste} onChange={e => { setItemsPaste(e.target.value); setItemsParseErr('') }} rows={4}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }} />
              {itemsParseErr && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{itemsParseErr}</div>}
              <button onClick={() => parseItemsText(updItemsModal)} disabled={!itemsPaste.trim() || itemsParsing}
                style={{ marginTop: 8, padding: '7px 18px', borderRadius: 7, border: 'none', background: itemsParsing || !itemsPaste.trim() ? 'var(--border)' : 'var(--blue)', color: itemsParsing || !itemsPaste.trim() ? 'var(--ink-3)' : '#fff', fontSize: 13, fontWeight: 600, cursor: itemsParsing || !itemsPaste.trim() ? 'default' : 'pointer' }}>
                {itemsParsing ? 'กำลังแปลง…' : '✦ แปลงรายการ'}
              </button>
            </div>

            {/* Editable table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border)' }}>
                    {['#', 'ประเภท', 'ชั้น', 'หัวราง/จีบ', 'ตะขอ', 'รหัสสี', 'ชื่อสี', 'กว้าง (ม.)', 'สูง (ม.)', 'จำนวน', 'หน่วย', 'กระดูม', 'หมายเหตุ'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ padding: '8px 10px', position: 'sticky', right: 0, background: '#FAFAFA', zIndex: 1 }} />
                  </tr>
                </thead>
                <tbody>
                  {itemsModal.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--ink-4)', fontWeight: 500, width: 28 }}>{idx + 1}</td>
                      {([['type', 'text', 100], ['floors', 'number', 44], ['rail_head', 'text', 64], ['hook_type', 'text', 70], ['color_code', 'text', 60], ['color_name', 'text', 90], ['width', 'number', 56], ['height', 'number', 56], ['quantity', 'number', 50], ['unit', 'text', 46], ['hooks', 'text', 60], ['note', 'text', 90]] as [keyof Item, string, number][]).map(([key, type, w]) => (
                        <td key={key} style={{ padding: '4px 6px' }}>
                          <input type={type} step={type === 'number' ? '0.01' : undefined} value={item[key] === null ? '' : String(item[key])}
                            onChange={e => { const val = key === 'floors' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value; updItemsModal(cur => cur.map((it, i) => i === idx ? { ...it, [key]: val } : it)) }}
                            style={{ width: w, border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                        </td>
                      ))}
                      <td style={{ padding: '4px 8px', position: 'sticky', right: 0, background: 'var(--surface)', boxShadow: '-2px 0 4px rgba(0,0,0,0.04)' }}>
                        <button onClick={() => updItemsModal(cur => cur.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', whiteSpace: 'nowrap' }}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                  {itemsModal.items.length === 0 && (
                    <tr><td colSpan={13} style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>ยังไม่มีรายการ — วางข้อความด้านบนแล้วกดแปลง หรือกดเพิ่มแถว</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={() => updItemsModal(cur => [...cur, emptyItem()])}
              style={{ fontSize: 12, padding: '4px 12px', border: '1px solid var(--blue)', borderRadius: 6, color: 'var(--blue)', background: 'var(--blue-bg)', cursor: 'pointer', marginBottom: 16 }}>
              + เพิ่มแถว
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setItemsModal(null); setItemsParseErr('') }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={saveItemsModal}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 16, zIndex: 1000, padding: 24, overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 720, padding: '24px 28px', margin: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>{modal.mode === 'add' ? 'เพิ่มเคลม' : 'แก้ไขเคลม'}</h3>

            {/* วางจากไลน์ */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 6 }}>วางข้อความจากไลน์</label>
              <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={4}
                placeholder={'เช่น\nลูกค้า Shopee : acumijanjira\nได้รับลูกล้อ รางม่านจีบไม่ครบ ขาดไป 6 ตัว\nที่อยู่ ...'}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <button onClick={parseFromLine} disabled={parsing || !pasteText.trim()}
                  style={{ background: parsing || !pasteText.trim() ? 'var(--border)' : 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: parsing ? 'default' : 'pointer' }}>
                  {parsing ? 'กำลังแปลงข้อมูล…' : '✨ แปลงข้อมูล'}
                </button>
                {parseError && <span style={{ color: 'var(--red)', fontSize: 12 }}>{parseError}</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {field('วันที่', 'claim_date', { type: 'date' })}
              {field('แพลตฟอร์ม', 'channel', { options: CHANNELS })}
              {field('ลูกค้า (username)', 'customer_username')}
              {field('เลขออเดอร์เดิม', 'original_order_number')}
              {field('ประเภทเคลม', 'claim_type', { options: CLAIM_TYPES })}
              {field('ผู้รับผิดชอบ', 'fault', { options: FAULTS })}
              {field('วิธีจัดการ', 'resolution', { options: RESOLUTIONS })}
              {field('สาเหตุ / รายละเอียด', 'cause', { full: true })}
              {field('ชื่อผู้รับ (ส่งใหม่)', 'ship_name')}
              {field('เบอร์โทร', 'ship_phone')}
              {field('ที่อยู่จัดส่ง', 'ship_address', { full: true })}
              {field('พัสดุลูกค้าส่งคืน', 'return_tracking')}
              {field('ขนส่งส่งออก', 'courier', { options: COURIERS })}
              {field('พัสดุร้านส่งออก', 'outbound_tracking')}
              {field('ยอดเงิน', 'refund_amount', { type: 'number' })}
              {field('ทิศทางเงิน', 'money_direction', { options: MONEY_DIR })}
              {field('ค่าส่งกลับ', 'ship_back_cost', { type: 'number' })}
              {field('ค่าส่งคืน', 'ship_return_cost', { type: 'number' })}
              {field('ราคาประเมิน', 'estimated_price', { type: 'number' })}
              {field('พร้อมเพย์ / บัญชี', 'payment_target')}
              {field('สถานะเงิน', 'money_status', { options: MONEY_STATUS })}
              {field('กำหนดส่ง', 'deadline', { type: 'date' })}
              {field('สถานะเคลม', 'status', { options: WORKFLOW.map(w => w.key) })}
              {field('แอดมินที่รับผิดชอบ', 'admin_name', { options: adminOptions })}
              {field('ช่างที่รับผิดชอบ', 'technician', { options: TECH_OPTIONS })}
              {field('ผิดโดย', 'fault_by', { options: faultByFlat })}
              {field('วิธีแก้ไข', 'fix_method', { full: true })}
              {field('หมายเหตุ', 'notes', { full: true })}
            </div>

            <div style={{ marginTop: 6, marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 8 }}>รายการที่เคลม</label>
              {itemEditor(modal.data.items ?? [], setItems)}
            </div>

            {ph.trigger()}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
          {ph.open && ph.panel()}
        </div>
      )}

      {/* กล่องยืนยัน (ลบเคส) — ต้องอยู่ท้ายสุดเพื่อทับทุกโมดัล */}
      {confirmDialog}
    </div>
  )
}
