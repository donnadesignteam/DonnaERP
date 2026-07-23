// เข้าสู่ระบบด้วย "รหัสพนักงาน + วันเดือนที่เริ่มงาน" (โหมดพนักงานในหน้า /login)
//
// ‼️ คุกกี้นี้ = "ใครล็อกอินอยู่" เท่านั้น ไม่ใช่ประตูสิทธิ์
//    ประตูจริงยังเป็น donna_auth (lib/auth.ts) เหมือนเดิม — พนักงานที่ล็อกอินสำเร็จ
//    จะได้ donna_auth ไปด้วย เห็นทุกหน้าเท่ากับคนที่ใช้รหัสรวมของร้าน (ตามที่ user เลือกไว้)
//    เก็บแบบอ่านได้จากฝั่งเบราว์เซอร์ (ไม่ httpOnly) เพราะหน้า hub/แดชบอร์ดต้องรู้ว่าเป็นใคร
//    ค่าที่เก็บมีลายเซ็นกำกับ แก้ชื่อ/รหัสในคุกกี้เองแล้วลายเซ็นไม่ตรง = ถือว่ายังไม่ล็อกอิน

export const STAFF_COOKIE = 'donna_staff'

// รหัสผ่าน = วันและเดือนที่เริ่มงาน เช่น 31/3/2024 → "313", 8/6/2026 → "86"
// รับหลายรูปแบบกันพิมพ์ไม่เหมือนกัน (313 / 3103 / 31-3 / 31/03 ก็ผ่านหมด — ตัดอักขระที่ไม่ใช่ตัวเลขทิ้งก่อน)
export function staffPassVariants(startDate: string): string[] {
  const m = String(startDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return []
  const [, , mm, dd] = m
  const d = String(Number(dd)), mo = String(Number(mm))
  return [...new Set([`${d}${mo}`, `${dd}${mm}`, `${d}${mm}`, `${dd}${mo}`])]
}

export const normalizePass = (input: string) => String(input || '').replace(/\D/g, '')

// รับได้ทั้ง DN015 / dn015 / dn15 / 15 → คืน "DN015" เสมอ
export function normalizeStaffCode(input: string): string {
  const s = String(input || '').trim().toUpperCase().replace(/\s+/g, '')
  const m = s.match(/^(?:DN?)?(\d{1,4})$/)
  return m ? 'DN' + m[1].padStart(3, '0') : s
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ลายเซ็นผูกกับรหัสพนักงาน + SITE_PASS (ปลอมไม่ได้ถ้าไม่รู้ env) — ใช้ทั้งตอนออกคุกกี้และตอนตรวจ
export const staffSig = (code: string) =>
  sha256(`${code}:${process.env.SITE_PASS || 'no-pass'}:donna-staff-v1`)

export async function buildStaffCookie(code: string, nickname: string | null): Promise<string> {
  return `${code}|${encodeURIComponent(nickname || '')}|${await staffSig(code)}`
}
