'use client'

// หมวดสต็อก — แท็บ ภาพรวม / สต็อกผ้า / อุปกรณ์ราง / อุปกรณ์สำนักงาน / งานนอก / งานยกเลิก-ตีกลับ
// สต็อกผ้าใช้ตาราง stock เดิม · หมวดอื่นเก็บในตาราง stock_items แยกด้วย category (sql/create_stock_items.sql)

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/components/ConfirmDialog'

export type StockTab = 'overview' | 'fabric' | 'rail' | 'office' | 'outsource' | 'returned'
type Cat = Exclude<StockTab, 'overview' | 'fabric'>

export const STOCK_TABS: { id: StockTab; label: string }[] = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'fabric', label: 'สต็อกผ้า' },
  { id: 'rail', label: 'อุปกรณ์ราง' },
  { id: 'office', label: 'อุปกรณ์สำนักงาน' },
  { id: 'outsource', label: 'งานนอก' },
  { id: 'returned', label: 'งานยกเลิก-ตีกลับ' },
]

type Item = {
  id: string; category: Cat; code: string | null; name: string; qty: number; unit: string | null
  min_qty: number | null; vendor: string | null; sent_at: string | null; due_at: string | null
  received_at: string | null; ref: string | null; source: string | null; notes: string | null
  po_id?: string | null; order_id?: string | null
  created_at: string; updated_at: string
}

const PILL_INK = '#6B4326'
const PILL_BG: Record<string, string> = {
  'ของหมด': '#F0C0B7', 'ควรสั่ง': '#F9E0C3', 'ปกติ': '#E3F3E0',
  'เลยนัด': '#F0C0B7', 'กำลังทำ': '#F9E0C3', 'รับกลับแล้ว': '#E3F3E0', 'รอของ': '#F9E0C3', 'ของเข้าแล้ว': '#E3F3E0',
  'ยกเลิก': '#F0C0B7', 'ตีกลับ': '#F9E0C3', 'พัสดุส่งกลับ': '#FBEEDC',
}
const today = () => new Date().toLocaleDateString('sv-SE')
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const itemStatus = (it: Item): string => {
  if (it.category === 'returned') return it.source || 'ยกเลิก'
  return it.qty <= 0 ? 'ของหมด' : it.min_qty != null && it.qty <= it.min_qty ? 'ควรสั่ง' : 'ปกติ'
}

const Pill = ({ s }: { s: string }) => (
  <span className="dn-pill" style={{ color: PILL_INK, background: PILL_BG[s] ?? '#EFE3D4' }}>{s}</span>
)

// ช่องในฟอร์มของแต่ละหมวด
type Field = { k: keyof Item; label: string; type?: 'number' | 'date' | 'select'; options?: string[]; wide?: boolean }
const FIELDS: Record<Cat, Field[]> = {
  rail: [
    { k: 'code', label: 'รหัส' }, { k: 'name', label: 'ชื่ออุปกรณ์', wide: true },
    { k: 'qty', label: 'คงเหลือ', type: 'number' }, { k: 'unit', label: 'หน่วย' },
    { k: 'min_qty', label: 'จุดสั่งซื้อ (เหลือเท่านี้ = ควรสั่ง)', type: 'number' }, { k: 'notes', label: 'หมายเหตุ', wide: true },
  ],
  office: [
    { k: 'code', label: 'รหัส' }, { k: 'name', label: 'ชื่ออุปกรณ์', wide: true },
    { k: 'qty', label: 'คงเหลือ', type: 'number' }, { k: 'unit', label: 'หน่วย' },
    { k: 'min_qty', label: 'จุดสั่งซื้อ (เหลือเท่านี้ = ควรสั่ง)', type: 'number' }, { k: 'notes', label: 'หมายเหตุ', wide: true },
  ],
  // งานนอก = ของที่ร้านไม่ได้ทำเอง สั่งข้างนอก (มู่ลี่ ฯลฯ) ที่ของมาถึงร้านแล้ว — ตอนเพิ่มค้นจากรายการสั่งซื้อได้
  outsource: [
    { k: 'name', label: 'รายการ', wide: true }, { k: 'qty', label: 'จำนวน', type: 'number' }, { k: 'unit', label: 'หน่วย' },
    { k: 'vendor', label: 'สั่งจาก (ร้าน)' }, { k: 'ref', label: 'เลขออเดอร์/ลูกค้า' },
    { k: 'received_at', label: 'วันที่ของเข้า', type: 'date' }, { k: 'notes', label: 'หมายเหตุ', wide: true },
  ],
  returned: [
    { k: 'source', label: 'ประเภท', type: 'select', options: ['ยกเลิก', 'ตีกลับ', 'พัสดุส่งกลับ'] },
    { k: 'ref', label: 'เลขออเดอร์/Serial' }, { k: 'name', label: 'รายการ (ม่าน/ราง/ขนาด/สี)', wide: true },
    { k: 'qty', label: 'จำนวน', type: 'number' }, { k: 'unit', label: 'หน่วย' }, { k: 'notes', label: 'หมายเหตุ (เก็บไว้ที่ไหน/สภาพ)', wide: true },
  ],
}

// คอลัมน์ในตาราง
const COLS: Record<Cat, { label: string; get: (it: Item) => React.ReactNode }[]> = {
  rail: [
    { label: 'รหัส', get: it => it.code || '—' }, { label: 'ชื่ออุปกรณ์', get: it => <b>{it.name}</b> },
    { label: 'คงเหลือ', get: it => `${it.qty} ${it.unit ?? ''}` }, { label: 'จุดสั่งซื้อ', get: it => it.min_qty ?? '—' },
    { label: 'สถานะ', get: it => <Pill s={itemStatus(it)} /> }, { label: 'หมายเหตุ', get: it => it.notes || '—' },
  ],
  office: [],
  outsource: [
    { label: 'ของเข้า', get: it => fmtDate(it.received_at) }, { label: 'รายการ', get: it => <b>{it.name}</b> },
    { label: 'จำนวน', get: it => `${it.qty} ${it.unit ?? ''}` }, { label: 'สั่งจาก', get: it => it.vendor || '—' },
    { label: 'ออเดอร์/ลูกค้า', get: it => it.ref || '—' }, { label: 'หมายเหตุ', get: it => it.notes || '—' },
  ],
  returned: [
    { label: 'วันที่ลง', get: it => fmtDate(it.created_at) }, { label: 'ประเภท', get: it => <Pill s={itemStatus(it)} /> },
    { label: 'ออเดอร์', get: it => it.ref || '—' }, { label: 'รายการ', get: it => <b>{it.name}</b> },
    { label: 'จำนวน', get: it => `${it.qty} ${it.unit ?? ''}` }, { label: 'หมายเหตุ', get: it => it.notes || '—' },
  ],
}
COLS.office = COLS.rail

const ADD_LABEL: Record<Cat, string> = { rail: 'อุปกรณ์ราง', office: 'อุปกรณ์สำนักงาน', outsource: 'งานนอก', returned: 'งานยกเลิก/ตีกลับ' }

const btn: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 14, background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit' }

export function StockTabBar({ tab, onChange }: { tab: StockTab; onChange: (t: StockTab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
      {STOCK_TABS.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ border: '1px solid ' + (tab === t.id ? 'var(--brand)' : 'var(--border)'), background: tab === t.id ? 'var(--brand)' : 'var(--surface)',
                   color: tab === t.id ? '#FFF8F0' : 'var(--ink-2)', borderRadius: 999, padding: '8px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

function useStockItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async () => {
    const { data, error: err } = await supabase.from('stock_items').select('*').order('created_at', { ascending: false })
    if (err) setError(err.message.includes('stock_items') ? 'ยังไม่ได้สร้างตาราง — รัน sql/create_stock_items.sql ก่อน' : err.message)
    else { setError(''); setItems((data ?? []) as Item[]) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  return { items, loading, error, load, setError }
}

export function StockItemsTab({ category }: { category: Cat }) {
  const { items: all, loading, error, load, setError } = useStockItems()
  const { ask, confirmDialog } = useConfirm()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Item> | null>(null)
  const [saving, setSaving] = useState(false)
  // งานนอก: ค้นรายการสั่งซื้อ (purchase_orders) มาเติมฟอร์มตอนเพิ่ม
  const [pos, setPos] = useState<{ id: string; customer_name: string; order_number: string; items: string; supplier: string; status: string; source_order_id: string | null }[] | null>(null)
  const [poQ, setPoQ] = useState('')
  useEffect(() => {
    if (category !== 'outsource' || !edit || edit.id || pos) return
    supabase.from('purchase_orders').select('id, customer_name, order_number, items, supplier, status, source_order_id').eq('status', 'รอของ').order('created_at', { ascending: false })
      .then(({ data }) => setPos((data ?? []) as NonNullable<typeof pos>))
  }, [category, edit, pos])
  const poHits = (pos ?? []).filter(p => poQ.trim() && [p.customer_name, p.order_number, p.items, p.supplier].some(v => (v ?? '').toLowerCase().includes(poQ.trim().toLowerCase()))).slice(0, 8)

  // งานนอก: ออเดอร์ต้นทางจัดส่งแล้ว (หรือรายการสั่งซื้อเป็นจัดส่งแล้ว) → ย้ายไปช่อง "จัดส่งแล้ว"
  const [shipped, setShipped] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'ของเข้าแล้ว' | 'จัดส่งแล้ว'>('ของเข้าแล้ว')
  useEffect(() => {
    if (category !== 'outsource') return
    const mine = all.filter(it => it.category === 'outsource')
    const oids = [...new Set(mine.map(it => it.order_id).filter(Boolean))] as string[]
    const pids = [...new Set(mine.map(it => it.po_id).filter(Boolean))] as string[]
    ;(async () => {
      const done = new Set<string>()
      if (oids.length) {
        const { data } = await supabase.from('order_entries').select('id').in('id', oids).eq('order_status', 'จัดส่งแล้ว')
        const ok = new Set((data ?? []).map(r => r.id as string))
        mine.forEach(it => { if (it.order_id && ok.has(it.order_id)) done.add(it.id) })
      }
      if (pids.length) {
        const { data } = await supabase.from('purchase_orders').select('id').in('id', pids).eq('status', 'จัดส่งแล้ว')
        const ok = new Set((data ?? []).map(r => r.id as string))
        mine.forEach(it => { if (it.po_id && ok.has(it.po_id)) done.add(it.id) })
      }
      setShipped(done)
    })()
  }, [all, category])

  const rows = useMemo(() => all.filter(it => it.category === category)
    .filter(it => category !== 'outsource' || (shipped.has(it.id) ? 'จัดส่งแล้ว' : 'ของเข้าแล้ว') === view)
    .filter(it => !q || [it.code, it.name, it.vendor, it.ref, it.notes].some(v => (v ?? '').toLowerCase().includes(q.toLowerCase()))),
  [all, category, q, shipped, view])

  const save = async () => {
    if (!edit) return
    if (!String(edit.name ?? '').trim()) { setError('ใส่ชื่อ/รายการก่อน'); return }
    // ตัวเลขต้องถูกต้องและไม่ติดลบ — กันบันทึกค่าเพี้ยนลงสต็อก
    for (const f of FIELDS[category]) {
      const v = edit[f.k]
      if (f.type === 'number' && v !== '' && v != null && !(Number(v) >= 0)) { setError(`${f.label}: ใส่ตัวเลขตั้งแต่ 0 ขึ้นไป`); return }
    }
    setSaving(true)
    const payload: Record<string, unknown> = { category, updated_at: new Date().toISOString() }
    for (const f of FIELDS[category]) {
      const v = edit[f.k]
      payload[f.k] = f.type === 'number' ? (v === '' || v == null ? (f.k === 'qty' ? 0 : null) : Number(v)) : (v === '' ? null : v ?? null)
    }
    if (category === 'outsource' && !edit.id) { payload.po_id = edit.po_id ?? null; payload.order_id = edit.order_id ?? null }
    const { error: err } = edit.id
      ? await supabase.from('stock_items').update(payload).eq('id', edit.id)
      : await supabase.from('stock_items').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    // ดึงมาจากรายการสั่งซื้อ → รายการนั้นเป็น "ของเข้าแล้ว" อัตโนมัติ
    if (!edit.id && edit.po_id) {
      const { error: poErr } = await supabase.from('purchase_orders').update({ status: 'ของเข้าแล้ว', updated_at: new Date().toISOString() }).eq('id', edit.po_id).eq('status', 'รอของ')
      setPos(null)
      if (poErr) setError(`บันทึกงานนอกแล้ว แต่เปลี่ยนสถานะในหน้าสั่งซื้อเป็น "ของเข้าแล้ว" ไม่สำเร็จ: ${poErr.message}`)
    }
    setEdit(null); load()
  }

  const remove = async (it: Item) => {
    if (!(await ask(`ลบ "${it.name}" ?`, { danger: true, okText: 'ลบ' }))) return
    const { error: err } = await supabase.from('stock_items').delete().eq('id', it.id)
    if (err) { setError(err.message); return }
    // ลบงานนอกที่ดึงมาจากรายการสั่งซื้อ → รายการนั้นกลับเป็น "รอของ" (ค้นเจออีกครั้ง) · ถ้าจัดส่งแล้วไม่แตะ
    if (it.category === 'outsource' && it.po_id) {
      const { error: poErr } = await supabase.from('purchase_orders').update({ status: 'รอของ', updated_at: new Date().toISOString() }).eq('id', it.po_id).eq('status', 'ของเข้าแล้ว')
      setPos(null)
      if (poErr) setError(`ลบแล้ว แต่เปลี่ยนสถานะในหน้าสั่งซื้อกลับเป็น "รอของ" ไม่สำเร็จ: ${poErr.message}`)
    }
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา…" style={{ ...inputStyle, maxWidth: 280 }} />
        {category === 'outsource' && (['ของเข้าแล้ว', 'จัดส่งแล้ว'] as const).map(v => {
          const n = all.filter(it => it.category === 'outsource' && (shipped.has(it.id) ? 'จัดส่งแล้ว' : 'ของเข้าแล้ว') === v).length
          return (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                       border: view === v ? 'none' : '1px solid var(--border-2)', background: view === v ? 'var(--brand)' : 'var(--surface)', color: view === v ? '#FFF8F0' : 'var(--ink-2)' }}>
              {v} {n}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{rows.length} รายการ</span>
        <button onClick={() => setEdit({ qty: 0, ...(category === 'outsource' ? { received_at: today() } : {}), ...(category === 'returned' ? { source: 'ยกเลิก' } : {}) })}
          style={{ ...btn, background: 'var(--blue)', color: '#fff' }}>+ เพิ่ม{ADD_LABEL[category]}</button>
      </div>
      {error && <div style={{ background: '#FDECEA', color: '#B3261E', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div className="dn-list-card" style={{ overflowX: 'auto' }}>
        <table className="dn-list dn-rows" style={{ width: '100%' }}>
          <thead><tr>{COLS[category].map(c => <th key={c.label} style={{ textAlign: 'left' }}>{c.label}</th>)}<th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 28 }}>ยังไม่มีรายการ — กด &quot;+ เพิ่ม{ADD_LABEL[category]}&quot;</td></tr>
              : rows.map(it => (
                <tr key={it.id}>
                  {COLS[category].map(c => <td key={c.label}>{c.get(it)}</td>)}
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button onClick={() => setEdit(it)} style={{ ...btn, padding: '6px 12px', fontSize: 12.5, background: 'var(--cream)', color: PILL_INK, marginRight: 6 }}>แก้ไข</button>
                    <button onClick={() => remove(it)} style={{ ...btn, padding: '6px 12px', fontSize: 12.5, background: 'transparent', color: '#B3261E' }}>ลบ</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div onClick={() => !saving && setEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(40,28,20,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="sc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>{edit.id ? 'แก้ไข' : 'เพิ่ม'}{ADD_LABEL[category]}</h3>
            {category === 'outsource' && !edit.id && (
              <div style={{ marginBottom: 14 }}>
                <input value={poQ} onChange={e => setPoQ(e.target.value)} placeholder="ค้นรายการสั่งซื้อที่รอของ — ชื่อลูกค้า / เลขออเดอร์ / รายการ / ร้าน (ไม่มีก็กรอกเองด้านล่าง)" style={inputStyle} />
                {poQ.trim() && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {pos === null ? <div style={{ padding: 10, fontSize: 13, color: 'var(--ink-3)' }}>กำลังโหลด…</div>
                      : poHits.length === 0 ? <div style={{ padding: 10, fontSize: 13, color: 'var(--ink-3)' }}>ไม่เจอในรายการสั่งซื้อที่รอของ — กรอกเองด้านล่างได้เลย</div>
                      : poHits.map(p => (
                        <div key={p.id} onClick={() => { setEdit({ ...edit, name: p.items, vendor: p.supplier || null, ref: [p.order_number, p.customer_name].filter(Boolean).join(' · '), po_id: p.id, order_id: p.source_order_id }); setPoQ('') }}
                          style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderTop: '1px solid var(--hairline)' }}>
                          <b>{p.order_number || '—'}</b> · {p.customer_name} <span style={{ color: 'var(--ink-3)' }}>· {p.supplier || 'ไม่ระบุร้าน'} · {p.status}</span>
                          <div style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.items}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {FIELDS[category].map(f => (
                <label key={f.k} style={{ gridColumn: f.wide ? '1 / -1' : undefined, fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>
                  {f.label}
                  {f.type === 'select'
                    ? <select value={String(edit[f.k] ?? '')} onChange={e => setEdit({ ...edit, [f.k]: e.target.value })} style={{ ...inputStyle, marginTop: 4 }}>
                        {f.options!.map(o => <option key={o}>{o}</option>)}
                      </select>
                    : <input type={f.type ?? 'text'} value={String(edit[f.k] ?? '')} onChange={e => setEdit({ ...edit, [f.k]: e.target.value })} style={{ ...inputStyle, marginTop: 4 }} />}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEdit(null)} disabled={saving} style={{ ...btn, background: 'var(--cream)', color: PILL_INK }}>ยกเลิก</button>
              <button onClick={save} disabled={saving} style={{ ...btn, background: 'var(--blue)', color: '#fff' }}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  )
}

export function StockOverview({ onOpen }: { onOpen: (t: StockTab) => void }) {
  const { items, loading, error } = useStockItems()
  const [fabric, setFabric] = useState<{ status: string }[]>([])
  useEffect(() => { supabase.from('stock').select('status').then(({ data }) => setFabric((data ?? []) as { status: string }[])) }, [])

  const count = (rows: { status: string }[], s: string) => rows.filter(r => r.status === s).length
  const withStatus = (c: Cat) => items.filter(i => i.category === c).map(i => ({ status: itemStatus(i) }))
  const cards: { tab: StockTab; title: string; total: number; stats: [string, number][] }[] = [
    { tab: 'fabric', title: 'สต็อกผ้า', total: fabric.length, stats: [['ของหมด', count(fabric, 'ของหมด')], ['ควรสั่ง', count(fabric, 'ควรสั่ง')], ['ของเหลือน้อย', count(fabric, 'ของเหลือน้อย')]] },
    ...(['rail', 'office'] as const).map(c => { const r = withStatus(c); return { tab: c, title: ADD_LABEL[c], total: r.length, stats: [['ของหมด', count(r, 'ของหมด')], ['ควรสั่ง', count(r, 'ควรสั่ง')]] as [string, number][] } }),
    { tab: 'outsource', title: 'งานนอก', total: withStatus('outsource').length, stats: [] },
    (() => { const r = withStatus('returned'); return { tab: 'returned' as const, title: 'งานยกเลิก-ตีกลับ', total: r.length, stats: [['ยกเลิก', count(r, 'ยกเลิก')], ['ตีกลับ', count(r, 'ตีกลับ')], ['พัสดุส่งกลับ', count(r, 'พัสดุส่งกลับ')]] as [string, number][] } })(),
  ]

  return (
    <div>
      {error && <div style={{ background: '#FDECEA', color: '#B3261E', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {cards.map(c => (
          <button key={c.tab} onClick={() => onOpen(c.tab)} className="dn-panel"
            style={{ textAlign: 'left', padding: '20px 22px', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>{c.title}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', margin: '4px 0 12px' }}>
              {loading && c.tab !== 'fabric' ? '…' : c.total}
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', marginLeft: 6 }}>รายการ</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {c.stats.map(([s, n]) => <span key={s} className="dn-pill" style={{ color: PILL_INK, background: n ? (PILL_BG[s] ?? '#FBEEDC') : 'var(--cream-2)', minWidth: 0, padding: '4px 10px' }}>{s} {n}</span>)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
