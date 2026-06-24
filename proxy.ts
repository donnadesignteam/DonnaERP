import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ──────────────────────────────────────────────────────────────
// Basic Auth gate สำหรับ DonnaERP (Next.js 16 = proxy.ts ไม่ใช่ middleware.ts)
// กันทั้งหน้าแอดมิน + API parse-* + หน้า /scan ด้วยรหัสรวมตัวเดียว
//
// ตั้งค่าใน Vercel → Project → Settings → Environment Variables:
//   SITE_USER  (ออปชัน, default = "donna")
//   SITE_PASS  (รหัสผ่าน — ถ้าไม่ตั้ง = ปิด auth ปล่อยผ่าน เพื่อไม่ให้ dev/เผลอ misconfig ล็อกตัวเอง)
// แล้ว redeploy
// ──────────────────────────────────────────────────────────────

export function proxy(request: NextRequest) {
  const expectedPass = process.env.SITE_PASS
  // ยังไม่ตั้งรหัส → ไม่กัน (กันล็อกตัวเองตอน dev / env ยังไม่พร้อม)
  if (!expectedPass) return NextResponse.next()

  const expectedUser = process.env.SITE_USER || 'donna'

  const header = request.headers.get('authorization')
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6)) // "user:pass"
      const idx = decoded.indexOf(':')
      const user = decoded.slice(0, idx)
      const pass = decoded.slice(idx + 1)
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next()
      }
    } catch {
      // base64 เพี้ยน → ตกไปขอรหัสใหม่
    }
  }

  return new NextResponse('ต้องเข้าสู่ระบบ', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="DonnaERP", charset="UTF-8"' },
  })
}

export const config = {
  // กันทุก path ยกเว้น static ของ Next + ไฟล์ PWA (manifest/logo เบราว์เซอร์โหลดแบบไม่มี credential)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|scan-app.webmanifest|donna-logo).*)',
  ],
}
