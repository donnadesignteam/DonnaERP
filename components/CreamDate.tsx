'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

// ช่องเลือกวันที่แบบครีม (แทน <input type="date"> ที่ปฏิทินเป็นของเบราว์เซอร์ แต่งสีไม่ได้เลย)
// กดแล้วปฏิทินคลี่ลงมา (.cs-menu ใน globals.css ชุดเดียวกับ CreamSelect) · วางแบบ fixed ผ่าน portal
// ‼️ ค่าเข้า-ออกเป็น 'YYYY-MM-DD' เหมือน input[type=date] เดิม โค้ดที่เรียกใช้ไม่ต้องแก้ตรรกะ

const EDGE = 8
const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)) : null)
// โชว์เป็น วว/ดด/ปปปป (ค.ศ.) เหมือนที่ฟอร์มเดิมโชว์
const label = (v: string) => (parse(v) ? v.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1') : '')

export default function CreamDate({ value, onChange, placeholder = 'เลือกวันที่', style, className, clearable = true }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: CSSProperties
  className?: string
  clearable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => parse(value) ?? new Date())
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const h = popRef.current?.offsetHeight ?? 320
    const below = window.innerHeight - r.bottom - 6 - EDGE
    const up = h > below && r.top - 6 - EDGE > below
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - 268 - EDGE), up })
  }

  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place)
    }
  }, [open])

  const pick = (d: Date) => { onChange(toKey(d)); setOpen(false); btnRef.current?.focus() }

  // ช่องของตารางเดือนนี้ — เริ่มวันจันทร์
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ]
  const todayKey = toKey(new Date())
  const selKey = parse(value) ? value : ''

  return (
    <>
      <button ref={btnRef} type="button" className={className} style={style}
        data-open={open || undefined}
        onClick={() => { if (!open) setView(parse(value) ?? new Date()); setOpen(o => !o) }}>
        <span style={{ flex: 1, textAlign: 'left', color: selKey ? 'var(--ink)' : 'var(--ink-4)' }}>
          {selKey ? label(value) : placeholder}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.7" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} className={`cs-menu${pos?.up ? ' is-up' : ''}`}
          style={{
            position: 'fixed', left: pos?.left ?? -9999, width: 268, padding: 12,
            ...(pos?.up ? { bottom: window.innerHeight - (pos?.top ?? 0) } : { top: pos?.top ?? -9999 }),
            visibility: pos ? 'visible' : 'hidden',
          }}>
          {/* หัวปฏิทิน: เดือน–ปี + ปุ่มเลื่อนเดือน */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} style={navBtn}>‹</button>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
              {view.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} style={navBtn}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
            {DOW.map(d => <span key={d} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--ink-4)', padding: '2px 0' }}>{d}</span>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const key = toKey(d)
              const isSel = key === selKey
              const isToday = key === todayKey
              return (
                <button key={i} type="button" onClick={() => pick(d)}
                  style={{
                    height: 32, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
                    border: isToday && !isSel ? '1.5px solid var(--brand-soft)' : '1px solid transparent',
                    background: isSel ? 'var(--brand)' : 'transparent',
                    color: isSel ? '#FFF8F0' : 'var(--ink-2)', fontWeight: isSel || isToday ? 700 : 400,
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--cream-2)' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => pick(new Date())} style={footBtn}>วันนี้</button>
            {clearable && (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }} style={{ ...footBtn, color: 'var(--ink-3)' }}>ล้าง</button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

const navBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: 999, border: '1px solid var(--border-2)', background: 'var(--cream-2)',
  color: 'var(--ink-2)', cursor: 'pointer', fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
}
const footBtn: CSSProperties = {
  flex: 1, padding: '7px 0', borderRadius: 999, border: '1px solid var(--border-2)', background: 'var(--cream-2)',
  color: 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
