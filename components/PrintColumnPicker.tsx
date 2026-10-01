'use client'
import { useCallback, useState } from 'react'

/* เลือกคอลัมน์ที่จะเอาลงใบปริ้นแบบตาราง — ใช้ร่วมกันทุกหน้าที่มีปุ่มปริ้นตาราง
   ตัวเลือกคือคอลัมน์ชุดเดียวกับที่โชว์บนหน้าจอของหมวด/แท็บนั้น (off: true = ไม่ติ๊กมาให้ตั้งแต่แรก)
   จำค่าที่เลือกไว้ใน localStorage คีย์ 'printCols' (ก้อนเดียว แยกตามหมวด/แท็บ) */

type ColLike = { key: string; off?: boolean }

export type PrintCol<T> = ColLike & {
  label: string
  cell: (r: T, i: number) => string   // คืนเป็น HTML (ผู้เรียก escape เองแล้ว)
  cls?: (r: T) => string
}

export type PrintColsState = {
  isOn: (col: ColLike) => boolean
  toggle: (col: ColLike, cols: ColLike[]) => void
  setAll: (cols: ColLike[], on: boolean) => void
  pick: <T>(cols: PrintCol<T>[]) => PrintCol<T>[]
}

export function usePrintColumns(storageKey: string): PrintColsState {
  const [store, setStore] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const v = JSON.parse(window.localStorage.getItem('printCols') || '{}')
      return v && typeof v === 'object' ? v as Record<string, string[]> : {}
    } catch { return {} }   /* อ่านไม่ได้ = ใช้ค่าตั้งต้นของแต่ละคอลัมน์ */
  })
  const saved = store[storageKey]   // undefined = ผู้ใช้ยังไม่เคยแตะ → ใช้ค่าตั้งต้น

  const save = useCallback((next: string[]) => {
    setStore(prev => {
      const obj = { ...prev, [storageKey]: next }
      try { window.localStorage.setItem('printCols', JSON.stringify(obj)) } catch { /* โหมดส่วนตัวเขียนไม่ได้ ก็ปล่อย */ }
      return obj
    })
  }, [storageKey])

  const isOn = useCallback((col: ColLike) => saved ? !saved.includes(col.key) : !col.off, [saved])
  const hiddenOf = useCallback((cols: ColLike[]) => saved ?? cols.filter(c => c.off).map(c => c.key), [saved])

  const toggle = useCallback((col: ColLike, cols: ColLike[]) => {
    const hidden = hiddenOf(cols)
    save(hidden.includes(col.key) ? hidden.filter(k => k !== col.key) : [...hidden, col.key])
  }, [hiddenOf, save])

  const setAll = useCallback((cols: ColLike[], on: boolean) => {
    save(on ? [] : cols.map(c => c.key))
  }, [save])

  const pick = useCallback(<T,>(cols: PrintCol<T>[]) => {
    const hidden = saved ?? cols.filter(c => c.off).map(c => c.key)
    return cols.filter(c => !hidden.includes(c.key))
  }, [saved])

  return { isOn, toggle, setAll, pick }
}

/* สร้าง HTML ตาราง (คอลัมน์ # ให้เสมอ) */
export function printTableHtml<T>(rows: T[], cols: PrintCol<T>[]): string {
  const head = `<tr><th>#</th>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr>`
  const body = rows.map((r, i) => {
    const tds = cols.map(c => {
      const cls = c.cls?.(r)
      return `<td${cls ? ` class="${cls}"` : ''}>${c.cell(r, i)}</td>`
    }).join('')
    return `<tr><td>${i + 1}</td>${tds}</tr>`
  }).join('\n')
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}

export function PrintColumnPicker({ cols, state }: { cols: { key: string; label: string; off?: boolean }[]; state: PrintColsState }) {
  const onCount = cols.filter(c => state.isOn(c)).length
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>คอลัมน์ในตาราง ({onCount}/{cols.length})</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => state.setAll(cols, true)}
            style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '3px 9px', fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer' }}>ทั้งหมด</button>
          <button type="button" onClick={() => state.setAll(cols, false)}
            style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '3px 9px', fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer' }}>ล้าง</button>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {cols.map(c => {
          const on = state.isOn(c)
          return (
            <button key={c.key} type="button" onClick={() => state.toggle(c, cols)}
              style={{ borderRadius: 20, padding: '4px 11px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                border: on ? 'none' : '1px solid var(--border)',
                background: on ? 'var(--blue)' : 'var(--surface)',
                color: on ? '#fff' : 'var(--ink-3)',
                fontWeight: on ? 600 : 400 }}>
              {on ? '✓ ' : ''}{c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ตัวเลือก "ปริ้นอะไร" — ตารางที่เห็นอยู่ / เฉพาะงานที่ใกล้ถึงกำหนดส่ง (เหลือน้อยกว่า N วัน)
   ‼️ ชุดเดียวใช้ร่วม: หมวดออเดอร์ · งานเคลม · ปฏิทินงานติดตั้ง — แก้หน้าตาที่นี่ที่เดียว */
export function PrintScopePicker({ scope, setScope, maxDays, setMaxDays, tabTitle, tabSub, daysCount }: {
  scope: 'tab' | 'days'; setScope: (s: 'tab' | 'days') => void
  maxDays: number; setMaxDays: (n: number) => void
  tabTitle: string; tabSub: string; daysCount: number
}) {
  // การ์ดตัวเลือก: ที่เลือกอยู่ = พื้นครีม + ขอบสีแบรนด์
  const card = (on: boolean): React.CSSProperties => ({
    display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
    border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-2)'}`, borderRadius: 16, padding: '12px 14px',
    background: on ? 'var(--cream)' : 'var(--cream-2)', transition: 'background .15s, border-color .15s',
  })
  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
      <label style={card(scope === 'tab')}>
        <input type="radio" checked={scope === 'tab'} onChange={() => setScope('tab')} style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
        <span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{tabTitle}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{tabSub}</span>
        </span>
      </label>
      <label style={card(scope === 'days')}>
        <input type="radio" checked={scope === 'days'} onChange={() => setScope('days')} style={{ marginTop: 2, accentColor: 'var(--brand)' }} />
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>เฉพาะงานที่ใกล้ถึงกำหนดส่ง</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>เหลือน้อยกว่า</span>
            <input type="number" min={0} max={99} value={maxDays}
              onClick={e => { e.stopPropagation(); setScope('days') }}
              onChange={e => setMaxDays(Number(e.target.value))}
              style={{ width: 66, fontSize: 15, fontWeight: 700, outline: 'none', textAlign: 'center' }} />
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>วัน · {daysCount} รายการ</span>
          </span>
        </span>
      </label>
    </div>
  )
}
