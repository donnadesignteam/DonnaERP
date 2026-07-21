// cache ข้อมูลหน้าไว้ทั้งใน RAM และ localStorage (stale-while-revalidate + ออฟไลน์)
// เปลี่ยนหน้าแล้วกลับมา → โชว์ข้อมูลเดิมทันที ไม่ต้องรอจอโหลด แล้วดึงของใหม่เบื้องหลังมาแทน
// ปิดแอป/เน็ตหลุดแล้วเปิดใหม่ → ยังเห็นข้อมูลล่าสุดที่โหลดไว้ (อ่านจาก localStorage)
// RAM = เร็วสุด ไม่ต้อง parse ซ้ำ · localStorage = รอดข้ามการปิดแอป (เขียนแบบ try/catch กัน quota เต็ม)

const mem = new Map<string, unknown>()
const LS_PREFIX = 'donna_pc:'

export function getPageCache<T>(key: string): T | undefined {
  if (mem.has(key)) return mem.get(key) as T
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key)
    if (raw == null) return undefined
    const val = JSON.parse(raw) as T
    mem.set(key, val)   // เลื่อนขึ้น RAM ไว้ครั้งถัดไปไม่ต้อง parse ซ้ำ
    return val
  } catch {
    return undefined
  }
}

export function setPageCache<T>(key: string, data: T): void {
  mem.set(key, data)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(data))
  } catch {
    // localStorage เต็ม (quota) หรือ serialize ไม่ได้ → ข้าม ยังมีใน RAM ใช้ได้ในเซสชันนี้
  }
}
