'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type StockItem = {
  id: string
  fabric_code: string
  color_name: string
  shop_code: string
  roll_count: number
  updated_at: string
}

const empty = (): Omit<StockItem, 'id' | 'updated_at'> => ({
  fabric_code: '', color_name: '', shop_code: '', roll_count: 0,
})

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 13px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  background: 'var(--surface)',
  fontFamily: "inherit",
  transition: 'border 0.15s, box-shadow 0.15s',
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<StockItem> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('stock').select('*').order('fabric_code')
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    setItems((data ?? []) as StockItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const { fabric_code, color_name, shop_code, roll_count } = modal.data
    const payload = { fabric_code, color_name, shop_code, roll_count: Number(roll_count), updated_at: new Date().toISOString() }
    let err
    if (modal.mode === 'add') {
      const res = await supabase.from('stock').insert(payload)
      err = res.error
    } else {
      const res = await supabase.from('stock').update(payload).eq('id', modal.data.id)
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
    await supabase.from('stock').delete().eq('id', id)
    load()
  }

  const filtered = items.filter(i =>
    i.fabric_code?.toLowerCase().includes(search.toLowerCase()) ||
    i.color_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.shop_code?.toLowerCase().includes(search.toLowerCase())
  )

  const set = (k: string, v: string | number) =>
    setModal(m => m ? { ...m, data: { ...m.data, [k]: v } } : null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', fontFamily: "inherit" }}>สต็อก</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{items.length} รายการ</p>
        </div>
        <button onClick={() => setModal({ mode: 'add', data: empty() })}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3), 0 4px 14px rgba(0,122,255,0.2)', fontFamily: "inherit" }}>
          + เพิ่มรายการ
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}>✕</button>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา รหัสผ้า / ชื่อสี / รหัสร้าน…"
        style={{ ...inputStyle, marginBottom: 16 }} />

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧵</div>
            ไม่มีข้อมูลสต็อก
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {['รหัสผ้า', 'ชื่อสี', 'รหัสผ้าของร้าน', 'จำนวนม้วน', 'อัพเดทล่าสุด', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '13px 18px', color: 'var(--ink-3)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '13px 18px', fontWeight: 600, color: 'var(--ink)' }}>{item.fabric_code}</td>
                  <td style={{ padding: '13px 18px', color: 'var(--ink)' }}>{item.color_name || '-'}</td>
                  <td style={{ padding: '13px 18px', color: 'var(--ink-3)' }}>{item.shop_code || '-'}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ fontWeight: 700, color: item.roll_count <= 2 ? 'var(--red)' : 'var(--ink)' }}>
                      {item.roll_count}
                    </span>
                    <span style={{ color: 'var(--ink-3)', marginLeft: 4 }}>ม้วน</span>
                  </td>
                  <td style={{ padding: '13px 18px', color: 'var(--ink-3)' }}>
                    {item.updated_at ? new Date(item.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                  </td>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModal({ mode: 'edit', data: { ...item } })}
                        style={{ padding: '5px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12, fontFamily: "inherit" }}>
                        แก้ไข
                      </button>
                      <button onClick={() => del(item.id)}
                        style={{ padding: '5px 13px', borderRadius: 9, border: 'none', background: 'rgba(220,38,38,0.07)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontFamily: "inherit" }}>
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, padding: 32, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, fontFamily: "inherit", color: 'var(--ink)' }}>
              {modal.mode === 'add' ? '+ เพิ่มรายการสต็อก' : 'แก้ไขสต็อก'}
            </h2>
            {[
              { key: 'fabric_code', label: 'รหัสผ้า', type: 'text' },
              { key: 'color_name', label: 'ชื่อสี', type: 'text' },
              { key: 'shop_code', label: 'รหัสผ้าของร้าน', type: 'text' },
              { key: 'roll_count', label: 'จำนวนม้วน', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input type={f.type} value={String(modal.data[f.key as keyof typeof modal.data] ?? '')}
                  onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                  style={inputStyle} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(142,142,147,0.08)', cursor: 'pointer', fontSize: 14, fontFamily: "inherit" }}>
                ยกเลิก
              </button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', borderRadius: 12, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,122,255,0.3)', fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
