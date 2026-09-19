'use client'

// ชุดเครื่องมือตารางรายการ แบบเดียวกับหมวดออเดอร์ / งานเคลม / พัสดุส่งกลับ
//   useColumnFilters — กดหัวคอลัมน์เพื่อเรียง/กรอง (date = เรียง+ช่วงวันที่ · pick = เรียง+ติ๊กเลือก · num/text = เรียง · bool = แล้ว/ยังไม่)
//   SearchPill · MonthSelect · SortSelect · ColumnPicker — แถบเครื่องมือเหนือตาราง
// ‼️ apply() ควรได้แถวค่า stable (lib/useStableView) แล้วค่อย map(live) ทีหลัง แถวจะไม่กระโดดตอนแก้ช่อง
import { useState, useEffect, type ReactNode } from 'react'
import CreamSelect from '@/components/CreamSelect'
import { TH_MONTHS } from '@/lib/shopCalendar'

export type FilterKind = 'date' | 'pick' | 'num' | 'text' | 'bool'
export type FilterDef<T> = {
  id: string
  label: string
  kind: FilterKind
  get: (r: T) => string | number | boolean | null | undefined
  yes?: string; no?: string          // ป้ายของ bool
  options?: string[]                 // ลำดับตัวเลือกของ pick (ไม่ใส่ = เรียง ก-ฮ)
}
type Dir = 'asc' | 'desc'

const NONE = '(ไม่ระบุ)'
export const SORT_LABELS: Record<FilterKind, [string, string]> = {
  date: ['เก่าสุด → ใหม่สุด', 'ใหม่สุด → เก่าสุด'],
  num: ['น้อยไปมาก', 'มากไปน้อย'],
  pick: ['ก → ฮ', 'ฮ → ก'],
  text: ['ก → ฮ', 'ฮ → ก'],
  bool: ['', ''],
}
const empty = (v: unknown) => v == null || v === '' || v === false
// วันที่ → YYYY-MM-DD ตามเวลาไทย (ค่า 'YYYY-MM-DD' ล้วนใช้ตามนั้นเลย ไม่เลื่อนวันจาก timezone)
export const toYmd = (v: unknown): string => {
  if (empty(v)) return ''
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA')
}
export const monthLabel = (k: string) => { const [y, m] = k.split('-'); return `${TH_MONTHS[Number(m) - 1]} ${Number(y) + 543}` }

export function useColumnFilters<T>(defs: FilterDef<T>[]) {
  const [sort, setSort] = useState<{ id: string; dir: Dir } | null>(null)
  const [pick, setPick] = useState<Record<string, string[]>>({})
  const [range, setRange] = useState<Record<string, { from: string; to: string }>>({})
  const [bool, setBool] = useState<Record<string, boolean | null>>({})
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null)

  const def = (id: string) => defs.find(d => d.id === id)
  const hasFilter = (id: string) => (pick[id]?.length ?? 0) > 0 || !!(range[id]?.from || range[id]?.to) || bool[id] != null
  const anyFilter = defs.some(d => hasFilter(d.id))
  const clearFilters = () => { setPick({}); setRange({}); setBool({}) }

  const match = (r: T) => defs.every(d => {
    const v = d.get(r)
    if (d.kind === 'pick') { const p = pick[d.id]; return !p?.length || p.includes(empty(v) ? NONE : String(v)) }
    if (d.kind === 'date') {
      const rg = range[d.id]; if (!rg?.from && !rg?.to) return true
      const ymd = toYmd(v); if (!ymd) return false
      return (!rg.from || ymd >= rg.from) && (!rg.to || ymd <= rg.to)
    }
    if (d.kind === 'bool') { const b = bool[d.id]; return b == null || !empty(v) === b }
    return true
  })

  // กรอง + เรียง (ไม่ได้เลือกเรียง = คงลำดับเดิมที่ส่งมา)
  const apply = (rows: T[]): T[] => {
    const out = rows.filter(match)
    const d = sort && def(sort.id)
    if (!d || !sort) return out
    const k = sort.dir === 'asc' ? 1 : -1
    return out.sort((a, b) => {
      const va = d.get(a), vb = d.get(b)
      const ea = empty(va), eb = empty(vb)
      if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1   // ค่าว่างไปท้ายเสมอ
      if (d.kind === 'num') return (Number(va) - Number(vb)) * k
      if (d.kind === 'date') return String(va).localeCompare(String(vb)) * k   // ISO เทียบเป็นข้อความได้เลย
      return String(va).localeCompare(String(vb), 'th', { numeric: true }) * k
    })
  }

  // ปุ่มหัวคอลัมน์ — คอลัมน์ที่ไม่มีตัวกรองคืน label เฉยๆ
  const head = (id: string, label?: string): ReactNode => {
    const d = def(id)
    const text = label ?? d?.label ?? id
    if (!d) return text
    const on = sort?.id === id || hasFilter(id)
    const n = pick[id]?.length ?? 0
    return (
      <button onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu(m => m?.id === id ? null : { id, rect }) }}
        style={{ border: 'none', background: 'transparent', fontSize: 'inherit', fontWeight: 500, color: on ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {text}{n > 0 && ` (${n})`}
        {sort?.id === id && <span style={{ fontSize: 10 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
        <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
      </button>
    )
  }

  // เมนูที่ลงมาจากหัวคอลัมน์ — วางไว้ที่ไหนก็ได้ในหน้า (position fixed) · rows = แถวที่ใช้ทำตัวเลือกของ pick
  const renderMenu = (rows: T[]): ReactNode => {
    if (!menu) return null
    const d = def(menu.id)
    if (!d) return null
    const k = d.id
    const close = () => setMenu(null)
    const opt = (text: string, active: boolean, onClick: () => void) => (
      <div key={text} onClick={onClick}
        style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--blue)' : 'var(--ink)', background: active ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
        {text}
      </div>
    )
    const left = Math.max(8, Math.min(menu.rect.left, window.innerWidth - 240))
    const picked = pick[k] ?? []
    const rg = range[k] ?? { from: '', to: '' }
    let values: string[] = []
    if (d.kind === 'pick') {
      const set = new Set(rows.map(r => { const v = d.get(r); return empty(v) ? NONE : String(v) }))
      const known = (d.options ?? []).filter(o => set.has(o))
      const rest = [...set].filter(v => v !== NONE && !known.includes(v)).sort((a, b) => a.localeCompare(b, 'th'))
      values = [...known, ...rest, ...(set.has(NONE) ? [NONE] : [])]
    }
    return (
      <>
        <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
        <div className="ow-drop" style={{ position: 'fixed', top: menu.rect.bottom + 4, left, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 180, maxHeight: '60vh', overflowY: 'auto' }}>
          {d.kind === 'bool' ? (
            ([['ทั้งหมด', null], [d.yes ?? 'มี', true], [d.no ?? 'ไม่มี', false]] as [string, boolean | null][]).map(([text, val]) =>
              opt(text, (bool[k] ?? null) === val, () => { setBool(p => ({ ...p, [k]: val })); close() }))
          ) : (
            <>
              {(['asc', 'desc'] as Dir[]).map((dir, i) =>
                opt(SORT_LABELS[d.kind][i], sort?.id === k && sort.dir === dir, () => { setSort({ id: k, dir }); close() }))}
              {sort?.id === k && opt('ไม่เรียง', false, () => { setSort(null); close() })}
            </>
          )}
          {d.kind === 'date' && (
            <div style={{ padding: '10px 14px 6px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
              {([['from', 'ตั้งแต่'], ['to', 'ถึงวันที่']] as ['from' | 'to', string][]).map(([f, text]) => (
                <div key={f} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{text}</label>
                  <input type="date" lang="en-GB" value={rg[f]} onChange={e => setRange(p => ({ ...p, [k]: { ...rg, [f]: e.target.value } }))}
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              {(rg.from || rg.to) && (
                <button onClick={() => setRange(p => ({ ...p, [k]: { from: '', to: '' } }))} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>ล้างช่วงวันที่</button>
              )}
            </div>
          )}
          {d.kind === 'pick' && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
              {values.map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: picked.includes(v) ? 'var(--blue-bg)' : 'transparent' }}>
                  <input type="checkbox" checked={picked.includes(v)} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }}
                    onChange={() => setPick(p => ({ ...p, [k]: picked.includes(v) ? picked.filter(x => x !== v) : [...picked, v] }))} />
                  <span style={{ color: v === NONE ? 'var(--ink-4)' : 'var(--ink)' }}>{v}</span>
                </label>
              ))}
              {picked.length > 0 && (
                <button onClick={() => setPick(p => ({ ...p, [k]: [] }))} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: '6px 12px 2px' }}>ล้างที่เลือก</button>
              )}
            </div>
          )}
        </div>
      </>
    )
  }

  return { sort, setSort, apply, head, renderMenu, anyFilter, clearFilters }
}

// ── แถบเครื่องมือ ──
const CHEV = <svg className="cs-chev" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>

export function SearchPill({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
      <svg width="18" height="18" fill="none" stroke="#8B7460" strokeWidth="1.8" viewBox="0 0 24 24" style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="ow-field"
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 999, height: 46, padding: '0 16px 0 46px', paddingRight: value ? 40 : 16, fontSize: 13.5, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow)' }} />
      {value && (
        <button onClick={() => onChange('')}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'var(--border)', color: 'var(--ink-3)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
          ✕
        </button>
      )}
    </div>
  )
}

// เลือกเดือน — months = ['YYYY-MM', ...] ใหม่ → เก่า
export function MonthSelect({ value, onChange, months, title }: { value: string; onChange: (v: string) => void; months: string[]; title?: string }) {
  return (
    <CreamSelect value={value} onChange={onChange} title={title} className="ow-select" style={value !== 'all' ? { borderColor: 'var(--brand)' } : undefined}
      options={[{ value: 'all', label: 'ทุกเดือน' }, ...months.map(k => ({ value: k, label: monthLabel(k) }))]}
      renderValue={o => <>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path strokeLinecap="round" d="M3.5 10h17M8 3v4M16 3v4" /></svg>
        <span className="cs-value">{o?.label}</span>
        {CHEV}
      </>} />
  )
}

// เรียงลำดับ — ใช้ state เดียวกับหัวคอลัมน์ · presets = ตัวเลือกประจำ [id, dir]
export function SortSelect<T>({ cf, defs, presets }: { cf: ReturnType<typeof useColumnFilters<T>>; defs: FilterDef<T>[]; presets: [string, Dir][] }) {
  const lab = (id: string, dir: Dir) => { const d = defs.find(x => x.id === id); return d ? `${d.label}: ${SORT_LABELS[d.kind][dir === 'asc' ? 0 : 1]}` : id }
  const cur = cf.sort ? `${cf.sort.id}:${cf.sort.dir}` : ''
  const keys = presets.map(([id, dir]) => `${id}:${dir}`)
  return (
    <CreamSelect value={cur} title="เรียงลำดับ"
      onChange={v => { if (!v) cf.setSort(null); else { const [id, dir] = v.split(':'); cf.setSort({ id, dir: dir as Dir }) } }}
      className="ow-select" style={cf.sort ? { borderColor: 'var(--brand)' } : undefined} menuMinWidth={250} align="right"
      options={[
        { value: '', label: 'เรียงตามค่าเริ่มต้น' },
        ...presets.map(([id, dir]) => ({ value: `${id}:${dir}`, label: lab(id, dir) })),
        ...(cf.sort && !keys.includes(cur) ? [{ value: cur, label: lab(cf.sort.id, cf.sort.dir) }] : []),
      ]}
      renderValue={o => <>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M3.5 16.5L7 20l3.5-3.5M14 6h7M14 11h5M14 16h3" /></svg>
        <span className="cs-value">{o?.label}</span>
        {CHEV}
      </>} />
  )
}

// ปุ่ม "คอลัมน์" — ติ๊กออก = ซ่อน (จำไว้ใน localStorage ด้วย storageKey)
export function useHiddenColumns(storageKey: string) {
  // ‼️ อ่าน localStorage ใน effect — อ่านตอนสร้าง state แล้วฝั่งเซิร์ฟเวอร์ไม่ตรง (hydration error)
  const [hidden, setHidden] = useState<string[]>([])
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(v)) setHidden(v) } catch {}
  }, [storageKey])
  const save = (next: string[]) => { setHidden(next); try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {} }
  return { hidden, show: (id: string) => !hidden.includes(id), toggle: (id: string) => save(hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id]), reset: () => save([]) }
}

export function ColumnPicker({ cols, hc }: { cols: { id: string; label: string }[]; hc: ReturnType<typeof useHiddenColumns> }) {
  const [open, setOpen] = useState(false)
  const n = hc.hidden.filter(id => cols.some(c => c.id === id)).length
  return (
    <div style={{ position: 'relative', marginLeft: 'auto' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ padding: '6px 14px', borderRadius: 20, border: n ? 'none' : '1px solid var(--border)', background: n ? 'var(--blue)' : 'var(--surface)', color: n ? '#fff' : 'var(--ink-3)', fontSize: 13, fontWeight: n ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
        คอลัมน์{n > 0 && ` (ซ่อน ${n})`} <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
          <div className="ow-drop" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 200, maxHeight: 360, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>ติ๊กออก = ซ่อน</span>
              {n > 0 && <button onClick={hc.reset} style={{ border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 11, cursor: 'pointer', padding: 0 }}>โชว์ทั้งหมด</button>}
            </div>
            {cols.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)' }}>
                <input type="checkbox" checked={hc.show(c.id)} onChange={() => hc.toggle(c.id)} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                {c.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// แท็บแคปซูลแบบหมวดออเดอร์
export function Tab({ active, count, onClick, children, title }: { active: boolean; count: number; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button onClick={onClick} className="ow-tab" data-active={active || undefined} title={title}>
      {children}
      <span className="ow-tab-n">{count.toLocaleString()}</span>
    </button>
  )
}
