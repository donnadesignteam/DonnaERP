// ลิงก์เช็คสถานะออเดอร์สำหรับส่งให้ลูกค้า (27ต.ค.69) — /t/<token> เปิดได้โดยไม่ต้อง login ดูได้อย่างเดียว
// token = id ออเดอร์ (uuid ไม่มีขีด 32 ตัว) + ลายเซ็น 16 ตัว → เดาลิงก์ของออเดอร์อื่นไม่ได้ ไม่ต้องเพิ่มคอลัมน์ในฐานข้อมูล
// ‼️ ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (ลายเซ็นผูกกับ env TRACK_SECRET หรือ SITE_PASS) — เปลี่ยนค่าพวกนี้ = ลิงก์เก่าที่ส่งไปแล้วใช้ไม่ได้ทั้งหมด
//    ออกลิงก์ผ่าน /api/track-link (ต้อง login) · หน้าแสดงผล app/t/[token]/page.tsx · proxy.ts ปล่อย /t/ ผ่าน

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
