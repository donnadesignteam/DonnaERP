// ลิงก์เช็คสถานะออเดอร์สำหรับส่งให้ลูกค้า (27ต.ค.69) — /t/<token> เปิดได้โดยไม่ต้อง login ดูได้อย่างเดียว
// token = id ออเดอร์ (uuid ไม่มีขีด 32 ตัว) + ลายเซ็น 16 ตัว → เดาลิงก์ของออเดอร์อื่นไม่ได้ ไม่ต้องเพิ่มคอลัมน์ในฐานข้อมูล
// ‼️ ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (ลายเซ็นผูกกับ env TRACK_SECRET หรือ SITE_PASS) — เปลี่ยนค่าพวกนี้ = ลิงก์เก่าที่ส่งไปแล้วใช้ไม่ได้ทั้งหมด
//    ออกลิงก์ผ่าน /api/track-link (ต้อง login) · หน้าแสดงผล app/t/[token]/page.tsx · proxy.ts ปล่อย /t/ ผ่าน

import { supabase } from '@/lib/supabase'

const secret = () => process.env.TRACK_SECRET || process.env.SITE_PASS || 'donna-dev-track'

async function sig(id: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`order-track:${id}`))
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export async function trackToken(id: string): Promise<string | null> {
  const hex = id.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return null
  return hex + await sig(id.toLowerCase())
}

// คืน id ออเดอร์ (uuid) ถ้าลายเซ็นถูก ไม่งั้น null
export async function verifyTrackToken(token: string): Promise<string | null> {
  const m = String(token || '').toLowerCase().match(/^([0-9a-f]{32})([0-9a-f]{16})$/)
  if (!m) return null
  const h = m[1]
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  return (await sig(id)) === m[2] ? id : null
}

// ===== ลิงก์สั้น (29ต.ค.69 user ขอให้สั้นลง) — /t/<รหัส 8 ตัว> เก็บใน order_entries.track_code (sql/add_track_code_20261029.sql)
// สุ่มจากตัวอักษรที่ไม่สับสนกัน (ไม่มี 0/O/1/l/I) 55^8 ≈ 8×10^13 แบบ → เดาลิงก์ออเดอร์อื่นไม่ได้ · ลิงก์ยาวแบบเดิมยังเปิดได้
const CODE_CHARS = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_RE = /^[2-9a-km-zA-HJ-NP-Z]{8}$/

function randomCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(b, x => CODE_CHARS[x % CODE_CHARS.length]).join('')
}

// รหัสสั้นของออเดอร์ (มีแล้วใช้ของเดิม ไม่มีสร้างใหม่) — คอลัมน์ยังไม่มี/บันทึกไม่ได้ = ใช้ลิงก์ยาวแทน
export async function shortTrackCode(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('order_entries').select('track_code').eq('id', id).maybeSingle()
  if (error || !data) return null
  if (data.track_code) return data.track_code as string
  for (let i = 0; i < 3; i++) {
    const code = randomCode()
    const { data: up } = await supabase.from('order_entries').update({ track_code: code }).eq('id', id).is('track_code', null).select('track_code').maybeSingle()
    if (up?.track_code) return up.track_code as string
    // ไม่ได้ = ชนรหัสซ้ำ หรือมีคนสร้างให้พร้อมกัน → อ่านซ้ำก่อนสุ่มใหม่
    const { data: again } = await supabase.from('order_entries').select('track_code').eq('id', id).maybeSingle()
    if (again?.track_code) return again.track_code as string
  }
  return null
}

// token จาก URL → id ออเดอร์ (รับทั้งรหัสสั้นและลิงก์ยาวแบบเดิม)
export async function resolveTrackToken(token: string): Promise<string | null> {
  const t = String(token || '')
  if (CODE_RE.test(t)) {
    const { data } = await supabase.from('order_entries').select('id').eq('track_code', t).maybeSingle()
    return (data?.id as string) ?? null
  }
  return verifyTrackToken(t)
}
