// คำนวณ token สำหรับ cookie auth จาก env (SITE_USER/SITE_PASS)
// cookie ไม่เก็บรหัสตรงๆ — เก็บ hash ที่ปลอมไม่ได้ถ้าไม่รู้ env
// proxy + /api/login เรียกตัวเดียวกัน → ค่าต้องตรงกัน

export const AUTH_COOKIE = 'donna_auth'

// คืน token (hex sha-256) ถ้าตั้ง SITE_PASS แล้ว, คืน null ถ้ายังไม่ตั้ง (= ปิด auth)
export async function authToken(): Promise<string | null> {
  const pass = process.env.SITE_PASS
  if (!pass) return null
  const user = process.env.SITE_USER || 'donna'
  const data = new TextEncoder().encode(`${user}:${pass}:donna-erp-v1`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
