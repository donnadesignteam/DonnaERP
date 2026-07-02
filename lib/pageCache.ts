// cache ข้อมูลหน้าไว้ในหน่วยความจำ (stale-while-revalidate)
// เปลี่ยนหน้าแล้วกลับมา → โชว์ข้อมูลเดิมทันที ไม่ต้องรอจอโหลด แล้วดึงของใหม่เบื้องหลังมาแทน
// cache หายเมื่อรีเฟรชเบราว์เซอร์ (hard reload) → โหลดปกติเหมือนเดิม

const cache = new Map<string, unknown>()

export function getPageCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setPageCache<T>(key: string, data: T): void {
  cache.set(key, data)
}
