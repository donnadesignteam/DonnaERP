// ปิดป๊อปอัปเมื่อคลิกพื้นหลัง — แต่ไม่ปิดถ้ากดกับปล่อยคนละที่ (user เจอ 29ก.ย.69)
//   กดค้างข้างในแล้วลากไปปล่อยข้างนอก → ไม่ปิด · กดข้างนอกแล้วลากกลับมาปล่อยข้างใน → ไม่ปิด
// ‼️ ต้นเหตุ: เบราว์เซอร์ส่ง click ให้ "ตัวแม่ร่วม" ของจุดกดกับจุดปล่อย = พื้นหลัง → onClick ของพื้นหลังทำงาน ป๊อปอัปปิด ของที่พิมพ์หาย
//    แก้: จำ element ที่กดลง + ที่ปล่อย (capture — ข้างในจะ stopPropagation ก็ยังจับได้) ต้องเป็นตัวเดียวกันถึงนับเป็นคลิก
//    คลิกธรรมดาทำงานเหมือนเดิมทุกอย่าง (ตัวแปรระดับโมดูล — เมาส์กดได้ทีละจุด และไม่หายตอน re-render ระหว่างกดกับปล่อย)
//
// ใช้: <div {...backdropClose(() => setModal(null))} style={{ position: 'fixed', inset: 0, ... }}>
import type React from 'react'

let downTarget: EventTarget | null = null
let upTarget: EventTarget | null = null

export function isRealClick(e: React.MouseEvent): boolean {
  const ok = downTarget !== null && downTarget === upTarget && downTarget === e.target
  downTarget = upTarget = null
  return ok
}

export const rememberDown = (e: React.MouseEvent) => { downTarget = e.target; upTarget = null }
export const rememberUp = (e: React.MouseEvent) => { upTarget = e.target }

export function backdropClose(onClose: () => void) {
  return {
    onMouseDownCapture: rememberDown,
    onMouseUpCapture: rememberUp,
    onClick: (e: React.MouseEvent) => { if (isRealClick(e)) onClose() },
  }
}
