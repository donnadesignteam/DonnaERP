// เดาเจ้าขนส่งจากรูปแบบเลขพัสดุ + ช่องขนส่งของออเดอร์ช่วยตัดสิน — ใช้ร่วมหน้าออเดอร์ (OrderWorkspace) และหน้าสแกน (/scan)
// ⚠️ Flash กับ LEX ขึ้นต้น TH+ตัวอักษรปนตัวเลขเหมือนกัน แยกจากเลขอย่างเดียวไม่ได้ —
//    ถ้าออเดอร์ระบุ LEX ถึงตอบ LEX, นอกนั้นถือเป็น Flash (ร้านใช้ Flash เป็นหลัก) และแก้เองได้ใน popup

export function detectCarrier(no: string, courierHint?: string | null): string {
  const s = no.trim().toUpperCase()
  if (!s) return ''
  if (/^SPXTH\w+$/.test(s)) return 'SPX Express'
  if (/^JTTH\w+$/.test(s)) return 'J&T Express'
  if (/^[A-Z]{2}\d{9}TH$/.test(s)) return 'ไปรษณีย์ไทย'
  if (/^NV/.test(s)) return 'Ninja Van'
  if (/^(KEX|KERDO|SHP)/.test(s)) return 'Kerry Express'
  if (/^TH[A-Z0-9]{10,}$/.test(s)) return /lex|lazada/i.test(courierHint || '') ? 'LEX TH' : 'Flash Express'
  if (/^\d{10,15}$/.test(s)) return 'J&T Express'
  return ''
}

export const CARRIER_OPTIONS = ['Flash Express', 'SPX Express', 'J&T Express', 'LEX TH', 'ไปรษณีย์ไทย', 'Kerry Express', 'Ninja Van', 'อื่นๆ']
