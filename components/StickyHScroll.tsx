'use client'

import { useEffect, useRef, useState } from 'react'

// ตัวเลื่อนแนวนอนลอยติดขอบล่างจอ — ตารางที่กว้างเกินจอ ไม่ต้องเลื่อนลงไปสุดรายการก่อนถึงจะลากไปขวาได้
// หาตัวที่เลื่อนแนวนอนได้ซึ่งขอบล่างเลยจอไป แล้วโชว์แถบเลื่อนแทนที่ขอบล่างจอ (ซิงค์กันสองทาง)
const CANDIDATES = 'main .overflow-x-auto, main .overflow-auto, main .overflow-x-scroll, main [style*="overflow"]'

// ขอบล่างที่มองเห็นได้ของ el — ไล่กล่องแม่ที่เลื่อนแนวตั้งได้ (overflow-y auto/scroll) เอาขอบล่างที่ต่ำสุดที่ไม่ล้นจอ
function clipBottom(el: HTMLElement, vh: number): number {
  let bottom = vh
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) bottom = Math.min(bottom, p.getBoundingClientRect().bottom)
  }
  return bottom
}

type Box = { left: number; width: number; inner: number; top: number }

export default function StickyHScroll() {
  const barRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  // เวลาที่ลากแถบล่าสุด — ช่วงที่กำลังลากห้ามซิงค์กลับจากตาราง ไม่งั้นสองฝั่งแย่งกันตั้งค่า = ลากติดๆขัดๆ
  const barAt = useRef(0)
  const [box, setBox] = useState<Box | null>(null)

  useEffect(() => {
    let raf = 0

    const onTargetScroll = () => {
      const bar = barRef.current, t = targetRef.current
      if (performance.now() - barAt.current < 200) return
      if (bar && t && Math.abs(bar.scrollLeft - t.scrollLeft) > 1) bar.scrollLeft = t.scrollLeft
    }

    const setTarget = (el: HTMLElement | null) => {
      if (targetRef.current === el) return
      targetRef.current?.removeEventListener('scroll', onTargetScroll)
      targetRef.current = el
      el?.addEventListener('scroll', onTargetScroll, { passive: true })
    }

    const measure = () => {
      raf = 0
      const vh = window.innerHeight
      let best: HTMLElement | null = null, bestArea = 0, bestBottom = vh
      document.querySelectorAll<HTMLElement>(CANDIDATES).forEach(el => {
        if (el.scrollWidth <= el.clientWidth + 1) return
        const ox = getComputedStyle(el).overflowX
        if (ox !== 'auto' && ox !== 'scroll') return
        const r = el.getBoundingClientRect()
        // ขอบล่างที่มองเห็น = ขอบจอ หรือขอบกล่องที่เลื่อนแนวตั้งได้ซึ่งครอบตารางอยู่ (เช่นป๊อปอัปรายการสินค้า) แล้วแต่อันไหนสูงกว่า
        const bottom = clipBottom(el, vh)
        // ต้องเห็นส่วนบนของตารางอยู่ แต่ขอบล่าง (ที่มีตัวเลื่อนเดิม) ยังไม่โผล่
        if (r.top >= bottom - 40 || r.bottom <= bottom || r.width < 50) return
        // ตารางที่ถูกป๊อปอัปบังอยู่ (หน้าหลังฉากมืด) ไม่นับ — เช็กว่าจุดกลางส่วนที่เห็นเป็นของตารางนี้จริง
        const hit = document.elementFromPoint(r.left + r.width / 2, (Math.max(r.top, 0) + bottom) / 2)
        if (!hit || !el.contains(hit)) return
        const area = r.width * (Math.min(r.bottom, bottom) - Math.max(r.top, 0))
        if (area > bestArea) { bestArea = area; best = el; bestBottom = bottom }
      })
      setTarget(best)
      if (!best) { setBox(null); return }
      const el = best as HTMLElement
      const r = el.getBoundingClientRect()
      const next = { left: r.left, width: el.clientWidth, inner: el.scrollWidth, top: bestBottom - 16 }
      setBox(prev => prev && prev.left === next.left && prev.width === next.width && prev.inner === next.inner && prev.top === next.top ? prev : next)
      const bar = barRef.current
      if (bar && performance.now() - barAt.current > 200 && Math.abs(bar.scrollLeft - el.scrollLeft) > 1) bar.scrollLeft = el.scrollLeft
    }

    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    const timer = window.setInterval(schedule, 700) // ข้อมูลโหลดเสร็จ/เปลี่ยนแท็บ → ขนาดตารางเปลี่ยน
    schedule()
    return () => {
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      clearInterval(timer)
      if (raf) cancelAnimationFrame(raf)
      setTarget(null)
    }
  }, [])

  const onBarScroll = () => {
    const bar = barRef.current, t = targetRef.current
    if (!bar || !t) return
    if (Math.abs(t.scrollLeft - bar.scrollLeft) <= 1) return
    barAt.current = performance.now()
    t.scrollLeft = bar.scrollLeft
  }

  return (
    <div
      ref={barRef}
      onScroll={onBarScroll}
      className="dn-sticky-hscroll"
      style={{
        position: 'fixed', top: box?.top ?? 0, zIndex: 1100,   // เหนือป๊อปอัป (zIndex 1000)
        left: box?.left ?? 0, width: box?.width ?? 0,
        overflowX: 'auto', overflowY: 'hidden', height: 16,
        display: box ? 'block' : 'none',
      }}
    >
      <div style={{ width: box?.inner ?? 0, height: 1 }} />
    </div>
  )
}
