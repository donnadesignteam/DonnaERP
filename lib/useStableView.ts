'use client'
import { useCallback, useMemo, useState } from 'react'

// "แถวไม่เด้งหนี" — จำค่าแถวตอนโหลดหน้าไว้ (snapshot) แล้วใช้ค่าชุดนั้นตอนกรอง/เรียงลำดับเท่านั้น
// ‼️ กติกา: filter/sort ใช้ stable(r) · แสดงผลบนจอใช้ live(r)
// ผลคือติ๊กงานเสร็จ/ติ๊กจัดส่งแล้ว/เปลี่ยนสถานะ → ค่าบนจอเปลี่ยนทันที แต่แถวยังอยู่ที่เดิมให้ตรวจทานได้
// แถวจะย้าย/หายจริงตอนรีเฟรชหรือเข้าหน้าใหม่ เพราะ snapshot ถูกตั้งใหม่ใน load()
// แถวที่เพิ่งเพิ่มหลังโหลด (ไม่มีใน snapshot) จะ fallback เป็นค่าสด → โผล่ในตารางทันทีตามปกติ
export function useStableView<T extends { id: string | number }>(rows: T[]) {
  const [base, setBase] = useState<Map<string | number, T>>(new Map())

  // เรียกใน load() ทุกครั้งหลัง setRows — ตั้งจุดอ้างอิงใหม่ให้แถวที่ค้างรอย้ายไปเข้าที่
  const snapshot = useCallback((rs: T[]) => setBase(new Map(rs.map(r => [r.id, r]))), [])

  const liveMap = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows])

  const stable = useCallback((r: T) => (base.get(r.id) ?? r), [base])
  const live = useCallback((r: T) => (liveMap.get(r.id) ?? r), [liveMap])

  return { snapshot, stable, live }
}
