'use client'

import { useEffect, useRef, useState } from 'react'

// จัดโลโก้/ตัวย่อในวงกลมให้อยู่กึ่งกลางพอดีตามรูปร่างจริง (ไม่ใช่ตามกรอบ)
// เส้นโลโก้หลายตัววาดเยื้องในกรอบ 24×24 (เช่น รถบรรทุกเอียงลงล่าง) · ตัวอักษรฟอนต์ Prompt นั่งต่ำกว่ากลางกล่องบรรทัด
// → วัดขอบเขตจริงหลังแสดงผลแล้วเลื่อนให้จุดกลางตรงกับกลางวง (จำผลไว้ ไม่วัดซ้ำ)

const boxCache = new Map<string, string>()
const textCache = new Map<string, { x: number; y: number }>()

export function CenteredPath({ d, box = '0 0 24 24', size, fill, stroke, strokeWidth, x, y }: {
  d: string; box?: string; size: number; fill?: string; stroke?: string; strokeWidth?: number; x?: number; y?: number
}) {
  const ref = useRef<SVGPathElement>(null)
  const key = box + '|' + d
  const [vb, setVb] = useState(() => boxCache.get(key) ?? box)

  useEffect(() => {
    const cached = boxCache.get(key)
    if (cached) { setVb(cached); return }
    const el = ref.current
    if (!el) return
    try {
      const bb = el.getBBox()
      if (!bb.width || !bb.height) return
      const [, , w, h] = box.split(/[\s,]+/).map(Number)
      const next = `${+(bb.x + bb.width / 2 - w / 2).toFixed(3)} ${+(bb.y + bb.height / 2 - h / 2).toFixed(3)} ${w} ${h}`
      boxCache.set(key, next)
      setVb(next)
    } catch { /* ยังไม่ได้แสดงผล — ใช้กรอบเดิม */ }
  }, [key, box])

  return (
    <svg x={x} y={y} width={size} height={size} viewBox={vb} overflow="visible" fill={fill} stroke={stroke} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path ref={ref} d={d} />
    </svg>
  )
}

export function CenteredText({ text, size, fontSize, color }: { text: string; size: number; fontSize: number; color: string }) {
  const ref = useRef<SVGTextElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let alive = true
    const measure = () => {
      const el = ref.current
      if (!el || !alive) return
      const family = getComputedStyle(el).fontFamily
      const key = `${text}|${fontSize}|${family}`
      let hit = textCache.get(key)
      if (!hit) {
        const ctx = document.createElement('canvas').getContext('2d')
        if (!ctx) return
        ctx.font = `700 ${fontSize}px ${family}`
        const m = ctx.measureText(text)
        if (!m.actualBoundingBoxAscent && !m.actualBoundingBoxDescent) return
        // x/y = จุดเริ่มเส้นฐานตัวอักษร ที่ทำให้กลางรูปตัวอักษรจริงตรงกลางวง
        hit = {
          x: size / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
          y: size / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
        }
        if (document.fonts?.status !== 'loading') textCache.set(key, hit)
      }
      setPos(hit)
    }
    measure()
    document.fonts?.ready.then(measure)
    return () => { alive = false }
  }, [text, size, fontSize])

  return (
    <>
      <text ref={ref} fill={color} fontWeight={700} fontSize={fontSize}
            {...(pos
              ? { x: pos.x, y: pos.y }
              : { x: size / 2, y: size / 2, textAnchor: 'middle', dominantBaseline: 'central' })}>
        {text}
      </text>
    </>
  )
}
