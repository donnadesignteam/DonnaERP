'use client'

// กล่องแก้ "รายการสินค้า" แบบตาราง (JSON array ชุดเดียวกับออเดอร์/งานเคลม)
// วางข้อความ → แปลง (/api/parse-items) หรือพิมพ์แก้ทีละช่อง · แก้รหัสสี/ชื่อสีแล้วเติมอีกช่องให้จากแคตตาล็อก
// ใช้ที่หน้าพัสดุส่งกลับ — หน้าตาเหมือนกล่องรายการของงานเคลม (ClaimsWorkspace)

import { useState } from 'react'
import { emptyItem, type RawItem } from '@/lib/itemFormat'
import { fillFabricOnEdit } from '@/lib/fabrics'

const FIELDS: [keyof RawItem, string, 'text' | 'number', number][] = [
  ['type', 'ประเภท', 'text', 110], ['floors', 'ชั้น', 'number', 44], ['rail_head', 'หัวราง/จีบ', 'text', 64],
  ['hook_type', 'ตะขอ', 'text', 70], ['color_code', 'รหัสสี', 'text', 60], ['color_name', 'ชื่อสี', 'text', 90],
  ['width', 'กว้าง (ม.)', 'number', 56], ['height', 'สูง (ม.)', 'number', 56], ['quantity', 'จำนวน', 'number', 50],
  ['unit', 'หน่วย', 'text', 46], ['note', 'หมายเหตุ', 'text', 110],
]

export default function ItemsModal({ items: initial, onSave, onClose }: {
  items: RawItem[]
  onSave: (items: RawItem[]) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<RawItem[]>(() => initial.map(it => ({ ...it })))
  const [paste, setPaste] = useState('')
  const [parsing, setParsing] = useState(false)
  const [err, setErr] = useState('')

  const parse = async () => {
    if (!paste.trim()) return
    setParsing(true); setErr('')
    try {
      const res = await fetch('/api/parse-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: paste }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'แปลงไม่สำเร็จ')
      setItems(data.items as RawItem[])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setParsing(false)
    }
  }

  const off = parsing || !paste.trim()
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1700, padding: 24 }}>
      <div className="sc-fields" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, boxShadow: '0 24px 60px rgba(61,43,31,0.22)', width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: '26px 30px' }}>
        <h3 className="sc-mtitle" style={{ marginBottom: 14 }}>รายการสินค้า</h3>

        <div style={{ background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 18, padding: '14px 16px', marginBottom: 16 }}>
          <textarea value={paste} onChange={e => { setPaste(e.target.value); setErr('') }} rows={4}
            placeholder="วางข้อความรายการ แล้วกดแปลง"
            style={{ width: '100%', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{err}</div>}
          <button onClick={parse} disabled={off}
            style={{ marginTop: 10, padding: '8px 20px', borderRadius: 999, border: 'none', background: off ? 'var(--border)' : 'var(--brand)', color: off ? 'var(--ink-3)' : '#FFF8F0', fontSize: 13, fontWeight: 600, cursor: off ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: off ? 'none' : '0 5px 14px rgba(158,106,73,0.25)' }}>
            {parsing ? 'กำลังแปลง…' : '✦ แปลงรายการ'}
          </button>
        </div>

        <div style={{ border: '1px solid var(--border-2)', borderRadius: 16, overflow: 'auto', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
                {['#', ...FIELDS.map(f => f[1])].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#8A6142', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                <th style={{ padding: '10px 12px', position: 'sticky', right: 0, background: 'var(--cream)', zIndex: 1 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', color: 'var(--ink-4)', fontWeight: 500, width: 28 }}>{idx + 1}</td>
                  {FIELDS.map(([key, , type, w]) => (
                    <td key={key} style={{ padding: '4px 6px' }}>
                      <input type={type} step={type === 'number' ? '0.01' : undefined} value={item[key] == null ? '' : String(item[key])}
                        onChange={e => {
                          const val = key === 'floors' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value
                          setItems(cur => cur.map((it, i) => i === idx ? fillFabricOnEdit(it, key as string, val) : it))
                        }}
                        style={{ width: w, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </td>
                  ))}
                  <td style={{ padding: '4px 8px', position: 'sticky', right: 0, background: 'var(--surface)', boxShadow: '-2px 0 4px rgba(0,0,0,0.04)' }}>
                    <button onClick={() => setItems(cur => cur.filter((_, i) => i !== idx))}
                      style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', whiteSpace: 'nowrap' }}>ลบ</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={FIELDS.length + 2} style={{ padding: 20, textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>ยังไม่มีรายการ — วางข้อความด้านบนแล้วกดแปลง หรือกดเพิ่มแถว</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <button onClick={() => setItems(cur => [...cur, emptyItem()])}
          style={{ fontSize: 12, padding: '6px 16px', border: '1px solid var(--border-2)', borderRadius: 999, color: 'var(--brand)', background: 'var(--cream-2)', cursor: 'pointer', marginBottom: 16, fontWeight: 600, fontFamily: 'inherit' }}>
          + เพิ่มแถว
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="sc-mcancel" style={{ flex: 1, cursor: 'pointer', fontSize: 14, border: 'none' }}>ยกเลิก</button>
          <button onClick={() => onSave(items)} className="sc-msave" style={{ flex: 2, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>บันทึก</button>
        </div>
      </div>
    </div>
  )
}
