// สถานะสต็อกผ้า — คิดจากความยาวคงเหลือ (เก็บเป็นเมตร แปลงเป็นหลาก่อนเทียบ) · user กำหนด 22ก.ย.69
//   0 = ของหมด · ≤ 210 หลา = ควรสั่ง · ≤ 400 หลา = ของเหลือน้อย · > 400 หลา = ปกติ
// ‼️ ใช้ร่วมกันหน้าสต็อกผ้า + การ์ดภาพรวม (components/StockSections.tsx)
export const YARD = 0.9144

export function fabricStatus(meters: number | null | undefined): string {
  const yd = (Number(meters) || 0) / YARD
  return yd <= 0 ? 'ของหมด' : yd <= 210 ? 'ควรสั่ง' : yd <= 400 ? 'ของเหลือน้อย' : 'ปกติ'
}
