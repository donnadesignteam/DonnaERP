'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type PO = {
  id: string
  customer_name: string
  order_number: string
  items: string
  notes: string
  status: string
  supplier: string
  created_at: string
  updated_at: string
}

const STATUS_COLOR: Record<string, string> = {
  'รอของ': '#ff9f0a',
  'ของเข้าแล้ว': '#34c759',
}

const empty = (): Omit<PO, 'id' | 'created_at' | 'updated_at'> => ({
  customer_name: '', order_number: '', items: '', notes: '', status: 'รอของ', supplier: '',
})

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<PO> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'รอของ' | 'ของเข้าแล้ว'>('all')
  const [error, setError] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [actionMenu, setActionMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    setRows((data ?? []) as PO[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const { customer_name, order_number, items, notes, status, supplier } = modal.data
    const payload = { customer_name, order_number, items, notes, status, supplier, updated_at: new Date().toISOString() }
    let err
    if (modal.mode === 'add') {
      const res = await supabase.from('purchase_orders').insert(payload)
      err = res.error
    } else {
      const res = await supabase.from('purchase_orders').update(payload).eq('id', modal.data.id)
      err = res.error
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
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('purchase_orders').delete().eq('id', id)
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('purchase_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    load()
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

  const byStatus = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const q = search.trim().toLowerCase()
  const displayed = !q ? byStatus : byStatus.filter(r =>
    [r.customer_name, r.order_number, r.items, r.supplier, r.notes, r.status]
      .some(v => (v ?? '').toLowerCase().includes(q))
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>สั่งซื้อ</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{rows.length} รายการ</p>
        </div>
        <button onClick={() => { setPasteText(''); setParseError(''); setModal({ mode: 'add', data: empty() }) }}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3)' }}>
          + เพิ่มรายการ
        </button>
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
            style={{ padding: '6px 16px', borderRadius: 980, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: filter === f ? 'var(--blue)' : 'rgba(0,0,0,0.10)', color: filter === f ? '#fff' : 'var(--ink)' }}>
            {f === 'all' ? 'ทั้งหมด' : f}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛒</div>ไม่มีรายการสั่งซื้อ
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                  <td style={{ padding: '13px 16px', fontWeight: 500 }}>{r.customer_name || '-'}</td>
                  <td style={{ padding: '13px 16px', color: 'var(--blue)', fontWeight: 500 }}>{r.order_number || '-'}</td>
                  <td style={{ padding: '13px 16px', color: 'var(--ink-3)', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.items || '-'}</div></td>
                  <td style={{ padding: '13px 16px' }}>{r.supplier || '-'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                      style={{ border: 'none', background: (STATUS_COLOR[r.status] ?? 'var(--ink-3)') + '22', color: STATUS_COLOR[r.status] ?? 'var(--ink-3)', borderRadius: 980, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                      <option>รอของ</option>
                      <option>ของเข้าแล้ว</option>
                    </select>
                  </td>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                    {r.updated_at ? (
                      <div>
                        <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                        <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
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
    </div>
  )
}
