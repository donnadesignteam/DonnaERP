// ดึงข้อมูลใหม่เมื่อ "อาจพลาดการอัปเดตสด" — กันหน้าที่เปิดค้างไว้ถือข้อมูลเก่า
// ‼️ 11ต.ค.69 เครื่องที่เปิดหมวดออเดอร์ค้างข้ามคืน (คอมพัก/เน็ตหลุด) realtime หลุดแล้วต่อใหม่ได้ แต่ event ที่พลาดไม่ถูกส่งซ้ำ
//    → ไม่เห็นออเดอร์ที่คนอื่นลงตอนดึก → เช้านำเข้าไฟล์ Shopee แล้วบันทึกซ้ำ 5 ใบ
// โหลดใหม่เมื่อ: กลับมาที่แท็บหลังซ่อนไว้นาน · เน็ตกลับมา · ช่อง realtime ต่อใหม่หลังหลุด
// load() ของหน้าที่ใช้ lib/rowCache ดึงแค่แถวที่เปลี่ยน → เรียกบ่อยก็ไม่กินโควตา
import { useCallback, useEffect, useRef } from 'react'

const MIN_HIDDEN_MS = 5 * 60 * 1000   // สลับแท็บไปมาสั้นๆ ไม่ต้องโหลด (หน้างานติดตั้งยังดึงทั้งตาราง)

// คืนฟังก์ชันเรียก reload ตัวล่าสุด (อ้างอิงคงที่) ไว้ส่งให้ resyncOnReconnect ในช่อง realtime
export function useResync(reload: () => unknown): () => void {
  const ref = useRef(reload)
  useEffect(() => { ref.current = reload })
  const stable = useCallback(() => { void ref.current() }, [])
  useEffect(() => {
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0
    const run = () => { void ref.current() }
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
      if (hiddenAt && Date.now() - hiddenAt >= MIN_HIDDEN_MS) run()
      hiddenAt = 0
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', run)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', run) }
  }, [])
  return stable
}

// ใส่ใน .subscribe(...) ของช่อง realtime — หลุดแล้วต่อกลับได้ = โหลดใหม่ (event ช่วงที่หลุดหายไปแล้ว)
export function resyncOnReconnect(reload: () => unknown) {
  let dropped = false
  return (status: string) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') dropped = true
    else if (status === 'SUBSCRIBED' && dropped) { dropped = false; void reload() }
  }
}
