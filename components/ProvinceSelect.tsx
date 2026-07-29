'use client'

// ช่องเลือกจังหวัดแบบพิมพ์ค้นหาได้ — ใช้ในคอลัมน์จังหวัด (หมวดงานติดตั้ง)
// รายการลอยแบบ fixed (คำนวณตำแหน่งจากช่องพิมพ์) เพื่อไม่โดนกรอบตารางที่เลื่อนได้ตัดหาย
import { useEffect, useRef, useState } from 'react'
import { TOP_PROVINCES, searchProvinces } from '@/lib/provinces'

export default function ProvinceSelect({ value, onPick, onCancel }: {
  value: string
  onPick: (v: string) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const [act, setAct] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const boxRef = useRef<HTMLInputElement>(null)
  const list = searchProvinces(q)

  useEffect(() => {
    const r = boxRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, left: r.left })
  }, [])

  return (
    <>
      <input ref={boxRef} autoFocus value={q} placeholder={value || 'พิมพ์ค้นหาจังหวัด…'}
        onChange={e => { setQ(e.target.value); setAct(0) }}
        onBlur={() => setTimeout(onCancel, 160)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setAct(a => Math.min(a + 1, list.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(a => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); if (list[act]) onPick(list[act]) }
          else if (e.key === 'Escape') onCancel()
        }}
        style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', minWidth: 90, outline: 'none', padding: '2px 0' }} />
      {pos && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 2000, minWidth: 170, maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', padding: 4 }}>
          {value && (
            <div onMouseDown={e => { e.preventDefault(); onPick('') }}
              style={{ padding: '6px 10px', fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              — ล้างค่า —
            </div>
          )}
          {list.map((p, i) => (
            <div key={p} onMouseDown={e => { e.preventDefault(); onPick(p) }} onMouseEnter={() => setAct(i)}
              style={{
                padding: '6px 10px', fontSize: 12.5, cursor: 'pointer', borderRadius: 6,
                background: i === act ? 'var(--blue-bg)' : 'transparent',
                color: p === value ? 'var(--blue)' : 'var(--ink)',
                fontWeight: p === value || TOP_PROVINCES.includes(p) ? 600 : 400,
                // เส้นคั่นใต้ 3 จังหวัดหลัก (เฉพาะตอนยังไม่ได้พิมพ์ค้นหา)
                borderBottom: !q && i === TOP_PROVINCES.length - 1 ? '1px solid var(--border)' : undefined,
                marginBottom: !q && i === TOP_PROVINCES.length - 1 ? 4 : undefined,
              }}>
              {p}
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--ink-4)' }}>ไม่พบจังหวัดนี้</div>
          )}
        </div>
      )}
    </>
  )
}
