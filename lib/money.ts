// อ่านช่องยอดเงินที่แอดมินพิมพ์ → ตัวเลข
// ‼️ ช่องยอดเงินในตารางเป็น input type="text" (ไม่ใช่ number) เพราะ:
//    type="number" ถ้าพิมพ์ลูกน้ำแบบคนไทยเขียนเงิน (1,500) เบราว์เซอร์คืน value = '' เฉยๆ
//    พอ blur ก็บันทึกทับเป็น null เงียบๆ ยอดเงินหายทั้งช่องโดยไม่มีใครรู้
//
// คืนค่า:
//   null      = ช่องว่าง → ล้างค่าในฐานข้อมูล (ตั้งใจลบ)
//   number    = อ่านได้
//   undefined = อ่านไม่ออก → ผู้เรียก "ต้องไม่บันทึก" ปล่อยค่าเดิมไว้
export function parseMoney(val: string): number | null | undefined {
  const s = val.replace(/[,\s฿]|บาท/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
