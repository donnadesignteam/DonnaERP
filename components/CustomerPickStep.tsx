'use client'

// ขั้น "ชื่อลูกค้า" ก่อนกรอกใบใหม่ — ใช้ร่วมกันทั้งหมวดออเดอร์และหน้างานเคลม
// ‼️ กันแอดมินลงชื่อลูกค้าคนเดียวกันคนละแบบ: ให้ค้นชื่อเดิมก่อน เจอแล้วกดเลือกจะได้ชื่อสะกดเดิมเป๊ะ
//    ไม่เจอค่อยกด "+ เพิ่มลูกค้าใหม่" · ตรรกะการค้นอยู่ที่ lib/customerBook.ts

import { useMemo, useState } from 'react'
import { matchCustomers, type CustomerEntry } from '@/lib/customerBook'

export default function CustomerPickStep({ book, onPick, onBack, onClose, altLabel, onAlt }: {
  book: CustomerEntry[]
  onPick: (name: string, phone: string) => void
  onBack?: () => void
  onClose: () => void
  altLabel?: string          // ทางเลือกแทนการพิมพ์ชื่อ (เช่น งานแพลตฟอร์ม = นำเข้าจากไฟล์ ซึ่งมีชื่อลูกค้าอยู่ในไฟล์แล้ว)
  onAlt?: () => void
}) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => matchCustomers(book, query), [book, query])
  const typed = query.trim()

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 460, padding: '26px 28px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>ชื่อลูกค้า</h3>
        <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="ชื่อลูกค้า / เบอร์โทร / เลขคำสั่งซื้อ…"
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginBottom: 7 }}>
          {typed ? `ลูกค้าเดิมที่ตรงกับที่ค้น ${matches.length} คน` : 'ลูกค้าล่าสุด'}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
          {matches.length === 0 ? (
            <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
              ไม่เจอลูกค้าชื่อนี้ — กดปุ่มข้างล่างเพื่อเพิ่มเป็นลูกค้าใหม่
            </div>
          ) : matches.map((c, i) => (
            <button key={c.name} type="button" onClick={() => onPick(c.name, c.phone)}
              style={{ display: 'block', width: '100%', padding: '9px 13px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {c.name}
            </button>
          ))}
        </div>

        <button type="button" disabled={!typed} onClick={() => onPick(typed, '')}
          style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: typed ? 'var(--blue)' : 'var(--border)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: typed ? 'pointer' : 'default' }}>
          {typed ? `+ เพิ่มลูกค้าใหม่ “${typed}”` : '+ เพิ่มลูกค้าใหม่ (พิมพ์ชื่อก่อน)'}
        </button>
        {altLabel && onAlt && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 10px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>หรือ</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button type="button" onClick={onAlt}
              style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              {altLabel}
            </button>
          </>
        )}
        <button type="button" onClick={onBack ?? onClose}
          style={{ marginTop: 9, width: '100%', padding: '9px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>
          {onBack ? '← ย้อนกลับ' : 'ยกเลิก'}
        </button>
      </div>
    </div>
  )
}
