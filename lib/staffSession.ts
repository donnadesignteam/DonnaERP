'use client'

// อ่าน "ใครล็อกอินอยู่" จากคุกกี้ donna_staff ฝั่งเบราว์เซอร์ (ดูเหตุผลใน lib/staffAuth.ts)
// ไม่ตรวจลายเซ็นตรงนี้ — ฝั่งเซิร์ฟเวอร์เป็นคนออกให้ ที่นี่แค่เอาไปโชว์ชื่อ/ดึงข้อมูลของคนนั้น
import { STAFF_COOKIE } from './staffAuth'

export type StaffSession = { code: string; nickname: string }

export function readStaffSession(): StaffSession | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find(c => c.startsWith(STAFF_COOKIE + '='))
  if (!raw) return null
  const [code, nick] = decodeURIComponent(raw.slice(STAFF_COOKIE.length + 1)).split('|')
  if (!code) return null
  return { code, nickname: nick ? decodeURIComponent(nick) : '' }
}
