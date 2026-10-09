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

// ก้อนใหญ่เกินนี้ไม่ลง localStorage (เก็บแค่ใน RAM) — localStorage ของโดเมนมีแค่ ~5MB และใช้ร่วมกับเว็บอุปกรณ์ราง (/rail)
// เดิม dashboard:order_entries ก้อนเดียว ~2.7MB + หน้าอื่นอีก → เต็ม → เว็บรางบันทึกบิลไม่ได้ ดึงรายการ/ปริ้นไม่ได้ (9ต.ค.69)
// ข้อมูลออเดอร์ทั้งตารางมีแคชใน IndexedDB (lib/rowCache) อยู่แล้ว ไม่ต้องซ้ำที่นี่
const LS_MAX_CHARS = 300_000

// เปิดหน้าไหนของ ERP ก็ได้ → ล้างก้อนใหญ่ที่เวอร์ชันก่อนเคยเก็บไว้ (ไม่ต้องรอเปิดหน้าภาพรวมก่อน เครื่องที่เต็มอยู่จะได้ที่คืนทันที)
if (typeof window !== 'undefined') {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(LS_PREFIX) && (window.localStorage.getItem(k)?.length ?? 0) > LS_MAX_CHARS) window.localStorage.removeItem(k)
    }
  } catch { /* เข้าถึง localStorage ไม่ได้ = ข้าม */ }
}

export function setPageCache<T>(key: string, data: T): void {
  mem.set(key, data)
  if (typeof window === 'undefined') return
  try {
    const raw = JSON.stringify(data)
    if (raw.length > LS_MAX_CHARS) { window.localStorage.removeItem(LS_PREFIX + key); return }   // ลบของเก่าที่เคยเก็บไว้ด้วย คืนที่ให้
    window.localStorage.setItem(LS_PREFIX + key, raw)
  } catch {
    // localStorage เต็ม (quota) หรือ serialize ไม่ได้ → ข้าม ยังมีใน RAM ใช้ได้ในเซสชันนี้
  }
}
