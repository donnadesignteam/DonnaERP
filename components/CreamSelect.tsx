'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// ช่องเลือกแบบครีม (แทน <select> ของเบราว์เซอร์ที่แต่งสี/ใส่อนิเมชั่นไม่ได้)
// กดแล้วรายการเลื่อนลงมา (.cs-menu ใน globals.css) · วางแบบ fixed ผ่าน portal → ไม่โดนกล่องตาราง (overflow) ตัด
// ข้างล่างไม่พอ = พลิกขึ้นด้านบนปุ่ม · Esc / กดที่อื่น = ปิด · ลูกศรขึ้นลง + Enter เลือกได้
export type CreamOption = { value: string; label: string; color?: string }

const EDGE = 8

export default function CreamSelect({ value, options, onChange, className, style, title, renderValue, menuMinWidth, align = 'left' }: {
  value: string
  options: CreamOption[]
  onChange: (v: string) => void
  className?: string
  style?: CSSProperties
  title?: string
  renderValue?: (o: CreamOption | undefined) => ReactNode   // หน้าตาในปุ่ม (ไม่ใส่ = ข้อความของตัวที่เลือก)
  menuMinWidth?: number
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean; maxHeight?: number } | null>(null)
  const cur = options.find(o => o.value === value)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const h = Math.min(menuRef.current?.scrollHeight ?? 320, 320)
    const below = window.innerHeight - r.bottom - 6 - EDGE
    const above = r.top - 6 - EDGE
    const up = h > below && above > below
    const width = Math.max(r.width, menuMinWidth ?? 0)
    const left = align === 'right' ? Math.max(EDGE, r.right - width) : Math.min(r.left, window.innerWidth - width - EDGE)
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left, width, up, maxHeight: Math.min(320, up ? above : below) })
  }

  useLayoutEffect(() => { if (open) place() }, [open])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    setHi(Math.max(0, options.findIndex(o => o.value === value)))
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = (e: Event) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place) }
  }, [open])   // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (v: string) => { setOpen(false); if (v !== value) onChange(v); btnRef.current?.focus() }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } return }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(options.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[hi]) pick(options[hi].value) }
  }

  return (
    <>
      <button ref={btnRef} type="button" title={title} className={className} style={style}
        aria-haspopup="listbox" aria-expanded={open} data-open={open || undefined}
        onClick={() => setOpen(o => !o)} onKeyDown={onKey}>
        {renderValue ? renderValue(cur) : <span className="cs-value">{cur?.label ?? '—'}</span>}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} role="listbox" className={`cs-menu${pos?.up ? ' is-up' : ''}`}
          style={{
            position: 'fixed', left: pos?.left ?? -9999, minWidth: pos?.width,
            ...(pos?.up ? { bottom: window.innerHeight - (pos?.top ?? 0) } : { top: pos?.top ?? -9999 }),
            maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden',
          }}>
          {options.map((o, i) => (
            <div key={o.value} role="option" aria-selected={o.value === value}
              className="cs-item" data-selected={o.value === value || undefined} data-hi={i === hi || undefined}
              style={{ animationDelay: `${Math.min(i, 10) * 22}ms` }}
              onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)}>
              {o.color && <span className="cs-dot" style={{ background: o.color }} />}
              <span style={{ flex: 1, color: o.color }}>{o.label}</span>
              {o.value === value && (
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" style={{ color: 'var(--brand)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
