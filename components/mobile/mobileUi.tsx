'use client'

import { useEffect, useRef, useState } from 'react'

// ── ของใช้ร่วมของหน้ามือถือ /m/* ──
// ‼️ ห้ามก๊อปตรรกะพวกนี้ไปเขียนซ้ำในแต่ละหน้า (แนวเดียวกับ lib/orderTabs.ts, lib/shopCalendar.ts)
//    ถ้าแก้พฤติกรรม pull-to-refresh / ปุ่ม back ปิด sheet ต้องแก้ที่นี่ที่เดียว

// ── จำค่าที่ผู้ใช้เลือกไว้ (แท็บ/เดือน/โซน) ข้ามการเปลี่ยนหน้า ──
// เดิมเป็น useState ล้วน → กดการ์ดเข้าโฟลเดอร์ลูกค้าแล้วกด back กลับมาที่แท็บ "ทั้งหมด" ทุกครั้ง
// ‼️ อ่าน sessionStorage ใน effect ไม่ใช่ตอน useState — อ่านตอน render แรกจะไม่ตรงกับที่ server เรนเดอร์มา (hydration mismatch)
export function useStickyState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const loaded = useRef(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`m:${key}`)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch { /* โหมดส่วนตัวของ Safari เขียน/อ่านไม่ได้ — ใช้ค่า default ไปเลย */ }
    loaded.current = true
  }, [key])
  useEffect(() => {
    if (!loaded.current) return   // อย่าเขียนทับค่าที่เก็บไว้ด้วยค่า default ตอน render แรก
    try { sessionStorage.setItem(`m:${key}`, JSON.stringify(value)) } catch { /* ไม่สำคัญพอจะให้หน้าพัง */ }
  }, [key, value])
  return [value, setValue] as const
}

// ── คืนตำแหน่งสโครลเดิมตอนกด back กลับมา ──
// ready = ข้อมูลขึ้นจอแล้ว (ถ้าเลื่อนตอนหน้ายังว่าง ความสูงไม่พอ เลื่อนไม่ไปไหน)
export function useScrollRestore(key: string, ready: boolean) {
  const restored = useRef(false)
  useEffect(() => {
    const save = () => { try { sessionStorage.setItem(`mscroll:${key}`, String(window.scrollY)) } catch { /* ไม่สำคัญ */ } }
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key])
  useEffect(() => {
    if (!ready || restored.current) return
    restored.current = true
    try {
      const y = parseInt(sessionStorage.getItem(`mscroll:${key}`) ?? '', 10)
      if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y))
    } catch { /* ไม่สำคัญ */ }
  }, [key, ready])
}

// ── ปุ่ม back ของ Android = ปิด bottom sheet (ไม่ใช่ออกจากหน้า) + ล็อกไม่ให้พื้นหลังเลื่อนตาม ──
// ‼️ onClose เก็บใน ref เพราะหน้าที่เรียกส่ง arrow function ใหม่ทุก render — ถ้าใส่ใน deps จะ pushState ซ้ำทุกครั้งที่ re-render
export function useSheetBack(open: boolean, onClose: () => void) {
  const cb = useRef(onClose)
  useEffect(() => { cb.current = onClose })   // อัปเดตนอก render (แก้ระหว่าง render ไม่ได้)
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.history.pushState({ mSheet: true }, '')
    const onPop = () => cb.current()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      document.body.style.overflow = prevOverflow
      // ปิดด้วยปุ่ม "ปิด"/แตะพื้นหลัง → ต้องถอย entry ที่ push ไว้ทิ้งด้วย
      // ไม่งั้นกด back ครั้งถัดไปจะเงียบ (เสีย 1 ครั้งไปกับ entry ค้าง)
      if ((window.history.state as { mSheet?: boolean } | null)?.mSheet) window.history.back()
    }
  }, [open])
}

// ── ลากลงเพื่อรีเฟรช ──
// เดิมทั้ง 5 หน้าโหลดครั้งเดียวตอนเปิด ข้อมูลค้างจนกว่าจะปิดแอปเปิดใหม่ ทั้งที่สถานะงานเปลี่ยนทั้งวัน
// ‼️ ต้องลาก "ตั้งใจ" ถึงจะติด — เดิมปัดนิดเดียวก็รีเฟรชโดนบ่อยระหว่างเลื่อนดูรายการ
export const PULL_DEADZONE = 40    // ลากช่วงแรกเท่านี้ไม่นับ (ปัดเบาๆ ตัวบ่งชี้ยังไม่โผล่ = ไม่กลายเป็นการรีเฟรช)
export const PULL_THRESHOLD = 80   // เกินเท่านี้ (หลังหักคูณหน่วง) ถึงจะยิงโหลดใหม่ — รวมแล้วนิ้วต้องลากจริงราว 200px

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const cb = useRef(onRefresh)
  useEffect(() => { cb.current = onRefresh })
  const startY = useRef<number | null>(null)
  const startX = useRef<number | null>(null)
  const pullRef = useRef(0)
  const busy = useRef(false)
  const runRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    const set = (v: number) => { pullRef.current = v; setPull(v) }

    const run = async () => {
      if (busy.current) return
      busy.current = true
      setRefreshing(true)
      set(0)
      try { await cb.current() } finally { busy.current = false; setRefreshing(false) }
    }
    runRef.current = run

    const onStart = (e: TouchEvent) => {
      // ลากได้เฉพาะตอนอยู่บนสุดของหน้า ไม่งั้นจะไปแย่งการเลื่อนปกติ
      const ok = window.scrollY <= 0 && !busy.current
      startY.current = ok ? e.touches[0].clientY : null
      startX.current = ok ? e.touches[0].clientX : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      const dx = Math.abs(e.touches[0].clientX - (startX.current ?? 0))
      if (dy <= 0 || window.scrollY > 0) { startY.current = null; set(0); return }
      // ปัดเฉียงไปข้าง (เช่นสลับแท็บ) ไม่นับเป็นการลากลง
      if (dx > dy) { startY.current = null; set(0); return }
      e.preventDefault()          // ต้อง passive:false ถึงจะกัน bounce ของ iOS ได้ (ต้องกันตั้งแต่ต้นนิ้ว ไม่งั้น iOS ยึด gesture ไปแล้วสั่งทีหลังไม่ทัน)
      // ช่วง deadzone แรกยังไม่ขยับตัวบ่งชี้ — ปัดเบาๆ จึงไม่กลายเป็นการรีเฟรช
      set(dy <= PULL_DEADZONE ? 0 : Math.min((dy - PULL_DEADZONE) * 0.5, 100))
    }
    const onEnd = () => {
      if (startY.current === null) return
      startY.current = null
      startX.current = null
      if (pullRef.current >= PULL_THRESHOLD) void run()
      else set(0)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return { pull, refreshing, refresh: () => runRef.current() }
}

export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (!pull && !refreshing) return null
  const ready = pull >= PULL_THRESHOLD
  return (
    <div style={{
      position: 'fixed', top: `calc(env(safe-area-inset-top) + ${refreshing ? 10 : Math.max(pull - 26, 0)}px)`,
      left: 0, right: 0, zIndex: 300, display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 999, padding: '6px 13px', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', boxShadow: 'var(--shadow-md)',
      }}>
        <span style={{
          display: 'inline-block', width: 13, height: 13, borderRadius: '50%',
          border: '2px solid var(--border-2)', borderTopColor: 'var(--blue)',
          animation: refreshing ? 'm-spin 0.7s linear infinite' : undefined,
          transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
        }} />
        {refreshing ? 'กำลังอัปเดต…' : ready ? 'ปล่อยเพื่ออัปเดต' : 'ลากลงเพื่ออัปเดต'}
      </span>
    </div>
  )
}

// ── แถวบอกว่าข้อมูลอัปเดตล่าสุดเมื่อไหร่ + ปุ่มกดรีเฟรชเอง ──
// จำเป็นเพราะหน้ามือถือใช้ cache ร่วมกับหน้าเดสก์ท็อป (lib/pageCache) — เปิดมาอาจเห็นข้อมูลเก่าโดยไม่รู้ตัว
export function UpdatedRow({ at, refreshing, onRefresh }: { at: number | null; refreshing: boolean; onRefresh: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 14px 8px' }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
        {refreshing ? 'กำลังอัปเดต…' : at ? `อัปเดต ${new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : 'ยังไม่ได้อัปเดต'}
      </span>
      <button onClick={onRefresh} disabled={refreshing} aria-label="อัปเดตข้อมูล"
        style={{
          display: 'flex', alignItems: 'center', gap: 5, minHeight: 32, padding: '5px 11px', borderRadius: 999,
          border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-3)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: refreshing ? 0.5 : 1, flexShrink: 0,
        }}>
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ animation: refreshing ? 'm-spin 0.7s linear infinite' : undefined }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7" />
        </svg>
        อัปเดต
      </button>
    </div>
  )
}

// ── โครงการ์ดตอนกำลังโหลด (แทนข้อความ "กำลังโหลด…" กลางจอเปล่า) ──
export function CardSkeleton({ n = 4 }: { n?: number }) {
  const bar = (w: string, h: number, mt = 0): React.CSSProperties => ({
    width: w, height: h, marginTop: mt, borderRadius: 5, background: 'var(--border)', animation: 'm-pulse 1.4s ease-in-out infinite',
  })
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 13px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={bar('42%', 13)} />
            <div style={bar('20%', 13)} />
          </div>
          <div style={bar('28%', 10, 8)} />
          <div style={bar('86%', 11, 12)} />
          <div style={bar('66%', 11, 6)} />
          <div style={bar('34%', 11, 14)} />
        </div>
      ))}
    </div>
  )
}

// ── สไตล์ร่วม ──
// ‼️ ปุ่มแท็บ/ปุ่มเดือน ต้องสูงอย่างน้อย 44px ตามมาตรฐาน touch target (ของเดิม ~30px กดพลาดบ่อย)
export const TAP_MIN = 44

export const pillBtn = (active: boolean, color = 'var(--blue)'): React.CSSProperties => ({
  flexShrink: 0, minHeight: TAP_MIN, padding: '0 15px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
  fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5,
  border: active ? 'none' : '1px solid var(--border)', background: active ? color : 'var(--surface)',
  color: active ? '#fff' : 'var(--ink-3)', fontWeight: active ? 700 : 500,
  WebkitTapHighlightColor: 'transparent',
})

// ‼️ fontSize ต้อง >= 16 ไม่งั้น Safari ซูมหน้าเข้าเองทุกครั้งที่แตะช่องค้นหา
export const searchInput: React.CSSProperties = {
  width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 16,
  outline: 'none', background: 'var(--surface)', color: 'var(--ink)', boxSizing: 'border-box',
}

export const monthNavBtn: React.CSSProperties = {
  width: TAP_MIN, height: TAP_MIN, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
  fontSize: 20, color: 'var(--ink-2)', cursor: 'pointer', lineHeight: 1, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
}

// การ์ดที่กดได้ — ต้องมี feedback ตอนแตะ ไม่งั้นผู้ใช้ไม่รู้ว่ากดติดหรือแอปค้าง (ใช้คู่กับ .m-card-tap ใน globals.css)
export const tapCard: React.CSSProperties = { WebkitTapHighlightColor: 'transparent' }

// ตัดข้อความยาวไม่ให้การ์ดเดียวยาวเต็มจอ (หมายเหตุ/สาเหตุบางเคสยาวมาก)
export const clamp = (lines: number): React.CSSProperties => ({
  display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, overflow: 'hidden',
})
