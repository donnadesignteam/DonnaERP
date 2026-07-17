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

// ลิงก์หน้าเช็คสถานะพัสดุของแต่ละเจ้า — ใช้ร่วมกัน (หน้าออเดอร์ / โฟลเดอร์ลูกค้า / หน้ามือถือ)
const CARRIER_TRACK_URL: Record<string, (no: string) => string> = {
  'Flash Express': no => `https://www.flashexpress.com/fle/tracking?se=${no}`,
  'SPX Express': no => `https://spx.co.th/track?${no}`,
  'ไปรษณีย์ไทย': no => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  'J&T Express': no => `https://www.jtexpress.co.th/service/track?bills=${no}`,
  'Kerry Express': no => `https://th.kerryexpress.com/th/track/?track=${no}`,
  'Ninja Van': no => `https://www.ninjavan.co/th-th/tracking?id=${no}`,
}

export const carrierTrackUrl = (sh: { no: string; carrier: string }) =>
  CARRIER_TRACK_URL[sh.carrier]?.(sh.no) || `https://www.google.com/search?q=${encodeURIComponent(sh.no + ' เช็คพัสดุ')}`
