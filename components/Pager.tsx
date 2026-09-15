'use client'

// แถบเลขหน้า — ปุ่ม .pg-btn ชุดเดียวกับตารางหมวดออเดอร์ (app/globals.css)
// โชว์หน้าแรก/สุดท้าย + รอบหน้าปัจจุบัน ที่เว้นใส่ … · หน้าเดียว = ไม่แสดงอะไร
import type { ReactNode } from 'react'

export default function Pager({ page, pageCount, onPage, label }: {
  page: number; pageCount: number; onPage: (n: number) => void; label?: ReactNode
}) {
  if (pageCount <= 1) return null
  const nums = [...new Set([1, page - 1, page, page + 1, pageCount])].filter(n => n >= 1 && n <= pageCount).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('…'); out.push(n) })
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" className="pg-btn" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="หน้าก่อน">‹</button>
        {out.map((n, i) => n === '…'
          ? <span key={`g${i}`} style={{ color: 'var(--ink-4)', padding: '0 2px' }}>…</span>
          : <button type="button" key={n} className="pg-btn" data-active={n === page || undefined} onClick={() => onPage(n)}>{n}</button>)}
        <button type="button" className="pg-btn" disabled={page === pageCount} onClick={() => onPage(page + 1)} aria-label="หน้าถัดไป">›</button>
      </div>
    </div>
  )
}
