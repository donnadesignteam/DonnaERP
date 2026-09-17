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

  // ธีมแบรนด์: ฉากหลังน้ำตาลอุ่น การ์ดมุมมน 24 ช่องกรอก/ปุ่มใช้ชุด .sc-modal เหมือนป๊อปอัปปฏิทิน
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="sc-modal" style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', maxHeight: '80vh', overflowY: 'visible', padding: '26px 28px' }}>
        <h3 className="sc-mtitle" style={{ marginBottom: 16 }}>ชื่อลูกค้า</h3>
        <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="ชื่อลูกค้า / เบอร์โทร / เลขคำสั่งซื้อ…"
          style={{ width: '100%', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginBottom: 7 }}>
          {typed ? `ลูกค้าเดิมที่ตรงกับที่ค้น ${matches.length} คน` : 'ลูกค้าล่าสุด'}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 12, border: '1px solid var(--border-2)', borderRadius: 16, background: 'var(--cream-2)', overflowX: 'hidden' }}>
          {matches.length === 0 ? (
            <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
              ไม่เจอลูกค้าชื่อนี้ — กดปุ่มข้างล่างเพื่อเพิ่มเป็นลูกค้าใหม่
            </div>
          ) : matches.map((c, i) => (
            <button key={c.name} type="button" onClick={() => onPick(c.name, c.phone)}
              style={{ display: 'block', width: '100%', padding: '11px 14px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {c.name}
            </button>
          ))}
        </div>

        <button type="button" disabled={!typed} onClick={() => onPick(typed, '')}
          className={typed ? 'sc-msave' : undefined}
          style={{ width: '100%', padding: '12px', borderRadius: 999, border: 'none', background: typed ? 'var(--brand)' : 'var(--border)', color: typed ? '#FFF8F0' : 'var(--ink-4)', fontSize: 13.5, fontWeight: 600, cursor: typed ? 'pointer' : 'default', fontFamily: 'inherit' }}>
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
              className="sc-btn-ghost" style={{ width: '100%', padding: '11px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              {altLabel}
            </button>
          </>
        )}
        <button type="button" onClick={onBack ?? onClose}
          className="sc-mcancel" style={{ marginTop: 9, width: '100%', cursor: 'pointer', fontSize: 13, border: 'none' }}>
          {onBack ? '← ย้อนกลับ' : 'ยกเลิก'}
        </button>
      </div>
    </div>
  )
}
