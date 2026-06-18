'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Item = {
  type: string; floors: number | null; rail_head: string; fabric_type: string
  color_code: string; color_name: string; color_desc: string
  width: number | string; height: number | string; quantity: number | string
  unit: string; hooks: string; note: string
}

type Claim = {
  id: string
  claim_date: string | null
  channel: string | null
  customer_username: string | null
  original_order_number: string | null
  claim_type: string | null
  fault: string | null
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
  money_direction: string | null
  payment_target: string | null
  money_status: string | null
  status: string
  is_urgent: boolean
  notes: string | null
  raw_text: string | null
  created_at?: string
  updated_at?: string
}

const CHANNELS = ['Shopee', 'Lazada', 'Tiktok', 'Facebook', 'LineOA', 'หน้าร้าน']
const CLAIM_TYPES = ['ของขาด/ไม่ครบ', 'ส่งผิด/ขนาดไม่ตรง', 'เสียหายจากขนส่ง', 'ชำรุด/ตำหนิ', 'ลูกค้าแจ้งผิด(แก้ไข)', 'เปลี่ยนสินค้า', 'ส่งคืนไม่แจ้ง']
const FAULTS = ['ร้าน', 'ลูกค้า', 'ขนส่ง']
const RESOLUTIONS = ['ส่งใหม่/ส่งเพิ่ม', 'แก้ไข/ผลิตใหม่', 'คืนเงินเต็ม', 'คืนเงินบางส่วน', 'คืนค่าส่ง', 'เก็บค่าแก้+ส่ง', 'เปลี่ยนสินค้า']
const MONEY_DIR = ['คืนลูกค้า', 'เก็บลูกค้า']
const MONEY_STATUS = ['รอ', 'โอนแล้ว', 'ชำระแล้ว']
const COURIERS = ['Flash Express', 'J&T Express', 'Kerry', 'ไปรษณีย์ไทย', 'SPX Express']

// สถานะ workflow + สี
const WORKFLOW: { key: string; color: string }[] = [
  { key: 'รอของคืน', color: '#ff9f0a' },
  { key: 'ตัดผ้าแล้ว', color: '#ffcc00' },     // สายผลิต — DonnaBot อัปเดตอัตโนมัติจากรูปกลุ่มช่าง
  { key: 'เย็บแล้ว', color: '#ffcc00' },
  { key: 'รีดแล้ว', color: '#ffcc00' },
  { key: 'แพ็คแล้ว', color: '#ffcc00' },
  { key: 'ส่งแล้ว', color: '#34c759' },
]
const STATUS_COLOR = (s: string) => WORKFLOW.find(w => w.key === s)?.color ?? 'var(--ink-3)'

function emptyClaim(): Claim {
  return {
    id: '', claim_date: new Date().toISOString().slice(0, 10), channel: '', customer_username: '',
    original_order_number: '', claim_type: '', fault: '', cause: '', resolution: '', items: null,
    ship_name: '', ship_address: '', ship_phone: '', return_tracking: '', outbound_tracking: '',
    courier: '', refund_amount: null, money_direction: '', payment_target: '', money_status: '',
    status: 'รอของคืน', is_urgent: false, notes: '', raw_text: '',
  }
}

const emptyItem = (): Item => ({ type: '', floors: null, rail_head: '', fabric_type: '', color_code: '', color_name: '', color_desc: '', width: '', height: '', quantity: 1, unit: 'ชุด', hooks: '', note: '' })

function itemLine(it: Item): string {
  const head = [it.type, it.floors ? `${it.floors}ชั้น` : '', it.rail_head, it.color_code, it.color_name].filter(Boolean).join(' ')
  const w = Number(it.width), h = Number(it.height)
  const dim = w > 0 && h > 0 ? `ก${w}*ส${h}` : w > 0 ? `ก${w}` : ''
  const tail = [dim, it.quantity ? `= ${it.quantity} ${it.unit || ''}`.trim() : '', it.note].filter(Boolean).join(' ')
  return [head, tail].filter(Boolean).join('  ')
}

export default function ClaimsWorkspace() {
  const [rows, setRows] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<string>('all')
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

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('claims').select('*')
      .order('claim_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message} — รัน scripts/create_claims_table.sql ใน Supabase ก่อนนะคะ`)
    setRows((data ?? []) as Claim[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const set = (k: keyof Claim, v: string | boolean | number | null) =>
    setModal(m => m ? { ...m, data: { ...m.data, [k]: v } } : null)

  const openAdd = () => { setPasteText(''); setParseError(''); setItemsPaste(''); setItemsParseErr(''); setModal({ mode: 'add', data: emptyClaim() }) }
  const openEdit = (c: Claim) => { setPasteText(c.raw_text ?? ''); setParseError(''); setItemsPaste(''); setItemsParseErr(''); setModal({ mode: 'edit', data: { ...c } }) }

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

  const save = async () => {
    if (!modal) return
    setSaving(true); setError('')
    const d = modal.data
    const payload = {
      claim_date: d.claim_date || null, channel: d.channel || null, customer_username: d.customer_username || null,
      original_order_number: d.original_order_number || null, claim_type: d.claim_type || null, fault: d.fault || null,
      cause: d.cause || null, resolution: d.resolution || null, items: d.items && d.items.length ? d.items : null,
      ship_name: d.ship_name || null, ship_address: d.ship_address || null, ship_phone: d.ship_phone || null,
      return_tracking: d.return_tracking || null, outbound_tracking: d.outbound_tracking || null, courier: d.courier || null,
      refund_amount: d.refund_amount != null && String(d.refund_amount) !== '' ? Number(d.refund_amount) : null,
      money_direction: d.money_direction || null, payment_target: d.payment_target || null, money_status: d.money_status || null,
      status: d.status || 'รอของคืน', is_urgent: !!d.is_urgent, notes: d.notes || null, raw_text: d.raw_text || null,
      updated_at: new Date().toISOString(),
    }
    if (modal.mode === 'add') {
      const res = await supabase.from('claims').insert(payload).select().single()
      setSaving(false)
      if (res.error) { setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      setRows(prev => [res.data as Claim, ...prev])
    } else {
      const res = await supabase.from('claims').update(payload).eq('id', d.id).select().single()
      setSaving(false)
      if (res.error) { setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      setRows(prev => prev.map(r => r.id === d.id ? res.data as Claim : r))
    }
    setModal(null)
  }

  const updateStatus = async (id: string, status: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    await supabase.from('claims').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const del = async (id: string) => {
    if (!confirm('ลบเคสเคลมนี้?')) return
    const { error: err } = await supabase.from('claims').delete().eq('id', id)
    if (!err) setRows(prev => prev.filter(r => r.id !== id))
  }

  const counts: Record<string, number> = { all: rows.length }
  WORKFLOW.forEach(w => { counts[w.key] = rows.filter(r => r.status === w.key).length })

  const displayed = rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || (r.customer_username ?? '').toLowerCase().includes(q) ||
      (r.original_order_number ?? '').toLowerCase().includes(q) || (r.cause ?? '').toLowerCase().includes(q)
    const matchTab = tab === 'all' || r.status === tab
    return matchSearch && matchTab
  })

  // ── inline-edit ในตาราง (กดที่ช่องแล้วแก้ได้เลย เหมือนหมวดออเดอร์) ──
  const isEditing = (id: string, f: string) => editCell?.id === id && editCell.field === f
  const saveCell = async (id: string, field: keyof Claim, val: string, numeric = false) => {
    setEditCell(null)
    const value: string | number | null = val.trim() === '' ? null : (numeric ? Number(val) : val)
    const now = new Date().toISOString()
    setRows(prev => prev.map(r => r.id === id ? ({ ...r, [field]: value, updated_at: now } as Claim) : r))
    await supabase.from('claims').update({ [field]: value, updated_at: now }).eq('id', id)
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
    await supabase.from('claims').update({ items, updated_at: now }).eq('id', itemsModal.id)
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
            {([['ประเภท', 'type', 'text'], ['ชั้น', 'floors', 'number'], ['หัวราง', 'rail_head', 'text'], ['ประเภทผ้า', 'fabric_type', 'text'], ['แบรนด์', 'color_code', 'text'], ['ลาย/สไตล์', 'color_name', 'text'], ['สีจริง', 'color_desc', 'text']] as [string, keyof Item, string][]).map(([lbl, key, type]) => (
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>งานเคลม</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{rows.length} เคส</p>
        </div>
        <button onClick={openAdd}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(196,126,58,0.3)' }}>
          + เพิ่มเคลม
        </button>
      </div>

      {error && (
        <div style={{ background: '#ff375f11', border: '1px solid #ff375f44', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ลูกค้า / เลขออเดอร์ / สาเหตุ…"
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
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
                  {['วันที่', 'แพลตฟอร์ม', 'ลูกค้า', 'ประเภท', 'รายการ', 'ยอดชำระ', 'สถานะ', 'หมายเหตุ', 'แก้ไขล่าสุด', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>
                      {r.claim_date ? new Date(r.claim_date).toLocaleDateString('th-TH-u-ca-gregory', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{r.channel || '-'}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ color: 'var(--ink)' }}>{r.customer_username || '-'}</div>
                      {r.original_order_number && <div style={{ color: 'var(--ink-4)', fontSize: 11 }}>#{r.original_order_number}</div>}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      {selectInline(r, 'claim_type', CLAIM_TYPES)}
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
            <div style={{ position: 'fixed', top: actionRect.bottom + 2, right: window.innerWidth - actionRect.right, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 9999, minWidth: 120, padding: '4px 0' }}>
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
                    {['#', 'ประเภท', 'ชั้น', 'หัวราง', 'รหัสสี', 'ชื่อสี', 'กว้าง (ม.)', 'สูง (ม.)', 'จำนวน', 'หน่วย', 'กระดูม', 'หมายเหตุ'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ padding: '8px 10px', position: 'sticky', right: 0, background: '#FAFAFA', zIndex: 1 }} />
                  </tr>
                </thead>
                <tbody>
                  {itemsModal.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--ink-4)', fontWeight: 500, width: 28 }}>{idx + 1}</td>
                      {([['type', 'text', 100], ['floors', 'number', 44], ['rail_head', 'text', 64], ['color_code', 'text', 60], ['color_name', 'text', 90], ['width', 'number', 56], ['height', 'number', 56], ['quantity', 'number', 50], ['unit', 'text', 46], ['hooks', 'text', 60], ['note', 'text', 90]] as [keyof Item, string, number][]).map(([key, type, w]) => (
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
        <div onMouseDown={e => { if (e.target === e.currentTarget) setModal(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 24, overflowY: 'auto' }}>
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
              {field('พร้อมเพย์ / บัญชี', 'payment_target')}
              {field('สถานะเงิน', 'money_status', { options: MONEY_STATUS })}
              {field('สถานะเคลม', 'status', { options: WORKFLOW.map(w => w.key) })}
              {field('หมายเหตุ', 'notes', { full: true })}
            </div>

            <div style={{ marginTop: 6, marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 8 }}>รายการที่เคลม</label>
              {itemEditor(modal.data.items ?? [], setItems)}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
