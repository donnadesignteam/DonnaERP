'use client'

import { useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'

// เมนูลอย (position: fixed) ที่เกาะกับปุ่มที่กด — เช่นเมนู ··· ท้ายแถวในตาราง
// ‼️ ปัญหาเดิม: วางไว้ใต้ปุ่มตายตัว (top = rect.bottom) แถวล่างสุดของจอเลยโดนขอบล่างบัง
//    ตัวนี้วัดความสูงจริงหลัง render แล้วพลิกขึ้นด้านบนปุ่มให้เองถ้าข้างล่างไม่พอ
//    ถ้าไม่พอทั้งบนและล่าง = เลือกฝั่งที่กว้างกว่าแล้วใส่ maxHeight + เลื่อนดูในเมนูได้
const GAP = 2
const EDGE = 8   // เว้นขอบจอ

export default function AnchoredMenu({ rect, children, minWidth = 130, style }: {
  rect: DOMRect
  children: ReactNode
  minWidth?: number
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; maxHeight?: number }>({ top: rect.bottom + GAP })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const h = el.scrollHeight
    const below = window.innerHeight - rect.bottom - GAP - EDGE
    const above = rect.top - GAP - EDGE
    if (h <= below) setPos({ top: rect.bottom + GAP })
    else if (h <= above) setPos({ top: rect.top - GAP - h })
    else if (above > below) setPos({ top: EDGE, maxHeight: above })
    else setPos({ top: rect.bottom + GAP, maxHeight: below })
  }, [rect])

  return (
    <div ref={ref}
      style={{
        position: 'fixed', top: pos.top, right: Math.max(EDGE, window.innerWidth - rect.right),
        maxHeight: pos.maxHeight, overflowY: pos.maxHeight ? 'auto' : undefined,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: 'var(--shadow-md)', zIndex: 9999, minWidth, padding: '4px 0', ...style,
      }}>
      {children}
    </div>
  )
}
