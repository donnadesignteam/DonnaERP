'use client'

// ช่องกรอกในรายการสินค้า (ฟอร์มเพิ่มรายการ + ตารางแก้รายการ) ที่เข้ากับธีม
//   ThemedSelect — แทน <select> ของระบบ (เมนูของ OS แต่งสีไม่ได้ + โหมดมืดเป็นกล่องขาว)
//   SuggestInput — พิมพ์แล้วขึ้นคำที่เคยลงไว้ในออเดอร์อื่น เช่น ช่องสีตาไก่ พิมพ์ "สัก" → สัก / สีสัก
// เมนูลอยเป็น position:fixed ผ่าน portal → ไม่โดนตัดในตารางที่เลื่อนแนวนอน/ในหน้าต่าง modal
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Pos = { top: number; left: number; width: number; up: boolean }

// ตำแหน่งเมนูใต้ช่อง (ชิดขอบล่างจอ → พลิกขึ้น) · เลื่อนหน้า/ย่อจอ → ปิดเมนู (กันเมนูลอยค้างผิดที่)
function usePopup(open: boolean, close: () => void) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [pos, setPos] = useState<Pos | null>(null)
  useEffect(() => {
    if (!open || !anchor) { setPos(null); return }   // eslint-disable-line react-hooks/set-state-in-effect
    const r = anchor.getBoundingClientRect()
    const up = window.innerHeight - r.bottom < 220 && r.top > 240
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, up })
    const onScroll = (e: Event) => { if (!(e.target instanceof Node && menuHas(e.target))) close() }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', close) }
  }, [open, close, anchor])
  return { setAnchor, pos }
}
const MENU_ATTR = 'data-item-menu'
const menuHas = (n: Node) => !!(n instanceof Element ? n : n.parentElement)?.closest(`[${MENU_ATTR}]`)

function Menu({ pos, children }: { pos: Pos; children: React.ReactNode }) {
  return createPortal(
    <div {...{ [MENU_ATTR]: '' }} onMouseDown={e => e.preventDefault()}
      style={{
        position: 'fixed', left: pos.left, minWidth: Math.max(pos.width, 120), maxWidth: 320, zIndex: 20000,
        ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
        maxHeight: 240, overflowY: 'auto', padding: 4, borderRadius: 8,
        background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.14)', fontSize: 12,
      }}>
      {children}
    </div>,
    document.body,
  )
}

function Option({ label, active, selected, onPick, onHover }: { label: string; active: boolean; selected?: boolean; onPick: () => void; onHover: () => void }) {
  return (
    <div onMouseDown={e => { e.preventDefault(); onPick() }} onMouseEnter={onHover}
      style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        background: active ? 'var(--bg)' : 'transparent', fontWeight: selected ? 700 : 400 }}>
      {label}
    </div>
  )
}

// ↑↓ เลือก · Enter/Tab กดเลือก · Esc ปิด — Enter ทำงานเฉพาะตอนมีตัวที่ไฮไลต์อยู่ (ไม่แย่ง Enter ปกติ)
function useKeys(count: number, open: boolean, setOpen: (v: boolean) => void, pick: (i: number) => void, start = -1) {
  const [active, setActive] = useState(start)
  useEffect(() => { setActive(start) }, [count, open, start])   // eslint-disable-line react-hooks/set-state-in-effect
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(count - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if ((e.key === 'Enter' || e.key === 'Tab') && active >= 0 && active < count) { if (e.key === 'Enter') e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
  }
  return { active, setActive, onKeyDown }
}

export function ThemedSelect({ value, options, onChange, style }: {
  value: string; options: string[]; onChange: (v: string) => void; style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { setAnchor, pos } = usePopup(open, close)
  const pick = (i: number) => { onChange(options[i]); setOpen(false) }
  const { active, setActive, onKeyDown } = useKeys(options.length, open, setOpen, pick, Math.max(0, options.indexOf(value)))
  return (
    <>
      <button type="button" data-themed-select="" ref={setAnchor} onClick={() => setOpen(o => !o)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, textAlign: 'left', cursor: 'pointer',
          border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, boxSizing: 'border-box', outline: 'none',
          background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', ...style }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.5, transform: open ? 'rotate(180deg)' : undefined }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && pos && (
        <Menu pos={pos}>
          {options.map((o, i) => <Option key={o} label={o} active={i === active} selected={o === value} onPick={() => pick(i)} onHover={() => setActive(i)} />)}
        </Menu>
      )}
    </>
  )
}

// คำแนะนำ = คำที่มีส่วนที่พิมพ์ (ไม่สนตัวพิมพ์เล็กใหญ่) เรียงจากที่ใช้บ่อยสุด · ช่องว่าง = โชว์คำที่ใช้บ่อยสุด
export function SuggestInput({ value, onChange, suggestions, type = 'text', step, style }: {
  value: string; onChange: (v: string) => void; suggestions?: string[]
  type?: string; step?: string; style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { setAnchor, pos } = usePopup(open, close)
  const q = value.trim().toLowerCase()
  const list = (suggestions ?? []).filter(s => s.toLowerCase() !== q && (!q || s.toLowerCase().includes(q))).slice(0, 8)
  const pick = (i: number) => { onChange(list[i]); setOpen(false) }
  const { active, setActive, onKeyDown } = useKeys(list.length, open, setOpen, pick)
  return (
    <>
      <input ref={setAnchor} type={type} step={step} value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
        style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)', ...style }} />
      {open && pos && list.length > 0 && (
        <Menu pos={pos}>
          {list.map((s, i) => <Option key={s} label={s} active={i === active} onPick={() => pick(i)} onHover={() => setActive(i)} />)}
        </Menu>
      )}
    </>
  )
}
