'use client'
import NotifyBell from '@/components/NotifyBell'
import CreamSelect from '@/components/CreamSelect'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { recordAction } from '@/lib/history'
import { opUpdate, opInsert, opDelete } from '@/lib/historyOps'
import { tUpdate, prevOf } from '@/lib/trackedDb'
import { useStableView } from '@/lib/useStableView'
import { oeUpdate } from '@/lib/adminActor'
import { markPOReceivedForOrders } from '@/lib/outsourceSync'
import { useConfirm } from '@/components/ConfirmDialog'


type PO = {
  id: string
  customer_name: string
  order_number: string
  items: string
  notes: string
  status: string
  supplier: string
  source_order_id?: string | null   // ผูกกับ order_entries ถ้าแถวนี้ sync มาจากสั่งนอกในหมวดออเดอร์
  created_at: string
  updated_at: string
}

// พื้นป้ายสถานะ — โทนพาสเทลชุดเดียวกับหน้าออเดอร์ (ตัวอักษรใช้ #6B4326 เหมือนกันหมด)
const PILL_BG: Record<string, string> = { 'รอของ': '#F9E0C3', 'ของเข้าแล้ว': '#E3F3E0' }
const STATUS_COLOR: Record<string, string> = {
  'รอของ': '#C79A4B',
  'ของเข้าแล้ว': '#6F8F6A',
}

const empty = (): Omit<PO, 'id' | 'created_at' | 'updated_at'> => ({
  customer_name: '', order_number: '', items: '', notes: '', status: 'รอของ', supplier: '',
})

export default function PurchaseOrdersPage() {
  // เปิดหน้าซ้ำ → โชว์ข้อมูลรอบก่อนทันที แล้ว load() ดึงของใหม่เบื้องหลัง (stale-while-revalidate)
  const cached = getPageCache<PO[]>('purchase_orders')
  const [rows, setRows] = useState<PO[]>(cached ?? [])
  // แถวไม่เด้งออกจากแท็บสถานะทันที — กรองด้วย stable() แสดงผลด้วย live() (ดู lib/useStableView.ts)
  const { snapshot, stable, live } = useStableView<PO>(rows)
  const [loading, setLoading] = useState(!cached)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<PO> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'รอของ' | 'ของเข้าแล้ว'>('all')
  const [error, setError] = useState('')
  // กล่องยืนยันของเว็บเอง (ไม่ใช้ window.confirm — ดูเหตุผลใน components/ConfirmDialog.tsx)
  const { ask, confirmDialog } = useConfirm()
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [actionMenu, setActionMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    const { data, error: err } = await fetchAllRows<PO>(() =>
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    let pos = data
    // ออเดอร์ที่จัดส่งแล้ว = ของเข้าครบแล้ว → ปิดรายการสั่งซื้อที่ผูกกันไว้ให้เป็น "ของเข้าแล้ว" อัตโนมัติ
    // (ตอนกดจัดส่งในหมวดออเดอร์เปลี่ยนให้ทันทีอยู่แล้ว — ตรงนี้ไล่เก็บใบเก่า/ใบที่เปลี่ยนสถานะจากที่อื่น)
    const waiting = pos.filter(p => p.source_order_id && p.status === 'รอของ')
    if (waiting.length) {
      const ids = waiting.map(p => p.source_order_id as string)
      const shipped: string[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const { data: os } = await supabase.from('order_entries').select('id')
          .in('id', ids.slice(i, i + 100)).eq('order_status', 'จัดส่งแล้ว')
        for (const o of os ?? []) shipped.push(o.id as string)
      }
      if (shipped.length) {
        const changed = await markPOReceivedForOrders(shipped)
        if (changed.length) {
          const done = new Set(changed)
          pos = pos.map(p => done.has(p.id) ? { ...p, status: 'ของเข้าแล้ว' } : p)
        }
      }
    }
    setPageCache('purchase_orders', pos)
    setRows(pos)
    snapshot(pos)   // ตั้งจุดอ้างอิงใหม่ → แถวที่เปลี่ยนสถานะค้างไว้ ย้ายเข้าแท็บใหม่ตอนนี้
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const { customer_name, order_number, items, notes, status, supplier } = modal.data
    const payload = { customer_name, order_number, items, notes, status, supplier, updated_at: new Date().toISOString() }
    const name = (customer_name || supplier || order_number || '').toString()
    let err
    if (modal.mode === 'add') {
      const res = await supabase.from('purchase_orders').insert(payload).select().single()
      err = res.error
      if (!err && res.data) {
        const saved = res.data
        recordAction({
          label: `เพิ่มรายการสั่งซื้อ ${name}`,
          undo: async () => { await supabase.from('purchase_orders').delete().eq('id', saved.id); await load() },
          redo: async () => { await supabase.from('purchase_orders').insert(saved); await load() },
          undoOps: [opDelete('purchase_orders', saved.id)],
          redoOps: [opInsert('purchase_orders', saved)],
        })
      }
    } else {
      const old = rows.find(r => r.id === modal.data.id)
      try { await tUpdate('purchase_orders', modal.data.id as string, payload, prevOf(old ?? {}, payload), `แก้รายการสั่งซื้อ ${name}`, load) }
      catch (e: any) { err = { message: e?.message || String(e) } }
    }
    setSaving(false)
    if (err) {
      setError(`บันทึกไม่สำเร็จ: ${err.message}`)
    } else {
      setModal(null)
      load()
    }
  }

  const del = async (id: string) => {
    if (!(await ask('ลบรายการนี้?', { okText: 'ลบ', danger: true }))) return
    const po = rows.find(r => r.id === id)
    setError('')
    // แถวที่ sync มาจากสั่งนอกในหมวดออเดอร์ → ล้างช่องสั่งนอกของออเดอร์ต้นทางด้วย (ทั้งคอลัมน์และในรายการสินค้า)
    const src = po?.source_order_id
    let srcPrev: Record<string, any> | null = null   // เก็บค่าสั่งนอกเดิมของออเดอร์ต้นทางไว้ย้อนกลับ
    if (src) {
      const { data: oe } = await supabase.from('order_entries').select('items, outsource, outsource_at').eq('id', src).single()
      const items = Array.isArray(oe?.items) ? oe.items : null
      srcPrev = { outsource: oe?.outsource ?? null, outsource_at: oe?.outsource_at ?? null, items }
      const clearItems = items && items.some((it: { outsource?: string }) => (it.outsource ?? '').trim())
        ? items.map((it: { outsource?: string }) => ({ ...it, outsource: '' }))
        : undefined
      await oeUpdate({
        outsource: null, outsource_at: null, updated_at: new Date().toISOString(),
        ...(clearItems ? { items: clearItems } : {}),
      }).eq('id', src)
    }
    // ‼️ ลบไม่สำเร็จต้องฟ้องเสมอ ห้ามเงียบ (ไม่งั้นดูเหมือนกดปุ่มไม่ติด)
    const { error: delErr } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (delErr) { setError(`ลบไม่สำเร็จ: ${delErr.message}`); return }
    if (po) recordAction({
      label: `ลบรายการสั่งซื้อ ${po.customer_name || po.supplier || ''}`,
      undo: async () => {
        await supabase.from('purchase_orders').insert(po)
        if (src && srcPrev) await oeUpdate({ outsource: srcPrev.outsource, outsource_at: srcPrev.outsource_at, items: srcPrev.items, updated_at: new Date().toISOString() }).eq('id', src)
        await load()
      },
      redo: async () => {
        if (src) await oeUpdate({ outsource: null, outsource_at: null, updated_at: new Date().toISOString() }).eq('id', src)
        await supabase.from('purchase_orders').delete().eq('id', id)
        await load()
      },
      undoOps: [
        opInsert('purchase_orders', po),
        ...(src && srcPrev ? [opUpdate('order_entries', src, { outsource: srcPrev.outsource, outsource_at: srcPrev.outsource_at, items: srcPrev.items })] : []),
      ],
      redoOps: [
        ...(src ? [opUpdate('order_entries', src, { outsource: null, outsource_at: null })] : []),
        opDelete('purchase_orders', id),
      ],
    })
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    const old = rows.find(r => r.id === id)
    const now = new Date().toISOString()
    await tUpdate('purchase_orders', id, { status, updated_at: now }, { status: old?.status ?? null }, `แก้สถานะสั่งซื้อ ${old?.customer_name || old?.supplier || ''}`, load)
    // อัปเดตแค่ state (ไม่ load ใหม่) — แถวจึงค้างในแท็บเดิมให้ตรวจทาน แล้วย้ายตอนรีเฟรช/เข้าหน้าใหม่
    setRows(prev => prev.map(r => r.id === id ? { ...r, status, updated_at: now } : r))
  }

  const set = (k: string, v: string) => setModal(m => m ? { ...m, data: { ...m.data, [k]: v } } : null)

  const parseFromLine = async () => {
    if (!pasteText.trim()) return
    setParsing(true); setParseError('')
    try {
      const res = await fetch('/api/parse-po', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: pasteText }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'แปลงไม่สำเร็จ')
      const p = data.po || {}
      setModal(m => m ? { ...m, data: { ...m.data,
        ...(p.customer_name ? { customer_name: String(p.customer_name) } : {}),
        ...(p.order_number ? { order_number: String(p.order_number) } : {}),
        ...(p.supplier ? { supplier: String(p.supplier) } : {}),
        ...(p.items ? { items: String(p.items) } : {}),
        ...(p.notes ? { notes: String(p.notes) } : {}),
      } } : m)
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setParsing(false)
    }
  }

  // กรองบนค่า "ตอนโหลดหน้า" (stable) แล้วคืนค่าสด (live) ก่อนวาด
  const stableRows = rows.map(stable)
  // ‼️ แท็บ "ทั้งหมด" = งานที่ยังไม่จบ — ของที่เข้าแล้วย้ายไปอยู่แท็บ "ของเข้าแล้ว" อย่างเดียว
  //    (กติกาเดียวกับหมวดออเดอร์ที่ใบจัดส่งแล้วไม่ขึ้นในแท็บทั้งหมด)
  const byStatus = filter === 'all'
    ? stableRows.filter(r => r.status !== 'ของเข้าแล้ว')
    : stableRows.filter(r => r.status === filter)
  const tabCount = (f: 'all' | 'รอของ' | 'ของเข้าแล้ว') =>
    f === 'all' ? stableRows.filter(r => r.status !== 'ของเข้าแล้ว').length : stableRows.filter(r => r.status === f).length
  const q = search.trim().toLowerCase()
  const displayed = (!q ? byStatus : byStatus.filter(r =>
    [r.customer_name, r.order_number, r.items, r.supplier, r.notes, r.status]
      .some(v => (v ?? '').toLowerCase().includes(q))
  )).map(live)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>สั่งซื้อ</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{rows.length} รายการ</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <NotifyBell />
          <button onClick={() => { setPasteText(''); setParseError(''); setModal({ mode: 'add', data: empty() }) }}
            style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3)' }}>
            + เพิ่มรายการ
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#ff375f11', border: '1px solid #ff375f44', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}>✕</button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา ชื่อลูกค้า / เลขคำสั่งซื้อ / รายการ / Supplier / หมายเหตุ"
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', paddingRight: search ? 36 : 14, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'var(--border)', color: 'var(--ink-3)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'รอของ', 'ของเข้าแล้ว'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, border: filter === f ? 'none' : '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? 'var(--brand)' : 'var(--cream-2)', color: filter === f ? '#FFF8F0' : 'var(--ink-2)', boxShadow: filter === f ? '0 3px 10px rgba(158,106,73,0.25)' : 'none' }}>
            {f === 'all' ? 'ทั้งหมด' : f}
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: filter === f ? 'rgba(255,248,240,0.22)' : 'var(--cream)', color: filter === f ? '#FFF8F0' : '#8A6142' }}>
              {tabCount(f).toLocaleString('th-TH')}
            </span>
          </button>
        ))}
      </div>

      <div className="dn-list-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛒</div>ไม่มีรายการสั่งซื้อ
          </div>
        ) : (
          <table className="dn-list dn-rows" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {['ชื่อลูกค้า', 'เลขคำสั่งซื้อ', 'รายการ', 'Supplier', 'สถานะ', 'แก้ไขล่าสุด', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '13px 16px', color: 'var(--ink-3)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '13px 16px' }}>
                    {r.customer_name
                      ? <Link href={`/customers?name=${encodeURIComponent(r.customer_name)}`} title="เปิดโฟลเดอร์ออเดอร์" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{r.customer_name}</Link>
                      : '-'}
                  </td>
                  <td style={{ padding: '13px 16px', color: 'var(--ink)', fontWeight: 500 }}>{r.order_number || '-'}</td>
                  <td style={{ padding: '13px 16px', color: 'var(--ink-3)', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.items || '-'}</div></td>
                  <td title={r.supplier || undefined} style={{ padding: '13px 16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{r.supplier || '-'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <CreamSelect value={r.status} onChange={v => updateStatus(r.id, v)} className="cs-inline" menuMinWidth={150}
                      style={{ border: 'none', background: PILL_BG[r.status] ?? '#EFE3D4', color: '#6B4326', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit', minWidth: 118, boxSizing: 'border-box' }}
                      options={[{ value: 'รอของ', label: 'รอของ', color: STATUS_COLOR['รอของ'] }, { value: 'ของเข้าแล้ว', label: 'ของเข้าแล้ว', color: STATUS_COLOR['ของเข้าแล้ว'] }]}
                      renderValue={o => (<>
                        <span className="cs-value" style={{ color: 'inherit', flex: 1, textAlign: 'center' }}>{o?.label ?? r.status}</span>
                        <svg className="cs-chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                      </>)} />
                  </td>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                    {r.updated_at ? (
                      <span>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <button onClick={e => {
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      setActionMenu(actionMenu?.id === r.id ? null : { id: r.id, top: rect.bottom + 4, left: rect.right - 120 })
                    }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'var(--ink-3)' }}>⋯</button>
                  </td>
                </tr>
              ))}
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
              <button onClick={() => { setModal({ mode: 'edit', data: { ...r } }); setActionMenu(null) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>แก้ไข</button>
              <button onClick={() => { setActionMenu(null); del(r.id) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', borderTop: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--red)' }}>ลบ</button>
            </div>
          </>
        )
      })()}

      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 32, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>{modal.mode === 'add' ? '+ เพิ่มรายการสั่งซื้อ' : 'แก้ไขรายการ'}</h2>
            {modal.mode === 'add' && (
              <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 6 }}>วางข้อความจากไลน์</label>
                <textarea value={pasteText} onChange={e => { setPasteText(e.target.value); setParseError('') }} rows={4}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 14, outline: 'none', background: 'var(--surface)', resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <button type="button" onClick={parseFromLine} disabled={parsing || !pasteText.trim()}
                    style={{ background: parsing || !pasteText.trim() ? 'var(--border)' : 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: parsing ? 'default' : 'pointer' }}>
                    {parsing ? 'กำลังแปลงข้อมูล…' : '✨ แปลงข้อมูล'}
                  </button>
                  {parseError && <span style={{ color: 'var(--red)', fontSize: 12 }}>{parseError}</span>}
                </div>
              </div>
            )}
            {[
              { key: 'customer_name', label: 'ชื่อลูกค้า', type: 'text' },
              { key: 'order_number', label: 'เลขคำสั่งซื้อ', type: 'text' },
              { key: 'supplier', label: 'Supplier', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input type={f.type} value={String(modal.data[f.key as keyof typeof modal.data] ?? '')}
                  onChange={e => set(f.key, e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 14, outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
              </div>
            ))}
            {['items', 'notes'].map(f => (
              <div key={f} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>{f === 'items' ? 'รายการ' : 'Note'}</label>
                <textarea value={String(modal.data[f as keyof typeof modal.data] ?? '')}
                  onChange={e => set(f, e.target.value)} rows={3}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 14, outline: 'none', background: 'var(--surface)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>สถานะ</label>
              <select value={modal.data.status ?? 'รอของ'} onChange={e => set('status', e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontSize: 14, outline: 'none', background: 'var(--surface)' }}>
                <option>รอของ</option>
                <option>ของเข้าแล้ว</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* กล่องยืนยัน (ลบรายการสั่งซื้อ) — ต้องอยู่ท้ายสุดเพื่อทับทุกโมดัล */}
      {confirmDialog}
    </div>
  )
}
