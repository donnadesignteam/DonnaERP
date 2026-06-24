import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE, authToken } from './lib/auth'

// ──────────────────────────────────────────────────────────────
// Cookie auth gate สำหรับ DonnaERP (Next.js 16 = proxy.ts ไม่ใช่ middleware.ts)
// กันทุกหน้า + API + /scan → ไม่ผ่าน redirect ไปหน้า /login (custom)
//
// env (Vercel → Settings → Environments → Production):
//   SITE_USER  (ออปชัน, default = "donna")
//   SITE_PASS  (รหัสผ่าน — ถ้าไม่ตั้ง = ปิด auth ปล่อยผ่านหมด เพื่อไม่ให้ dev/misconfig ล็อกตัวเอง)
// ──────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const token = await authToken()
  if (!token) return NextResponse.next() // ยังไม่ตั้ง SITE_PASS → ไม่กัน

  const { pathname } = request.nextUrl

  // หน้า/route ที่เข้าได้โดยไม่ต้อง login
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/api/logout') {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value
  if (cookie === token) return NextResponse.next()

  // ไม่ผ่าน: API ตอบ 401, หน้าเว็บ redirect ไป /login
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const from = pathname + (request.nextUrl.search || '') // เก็บ query เดิม (เช่น /scan?o=XXX) ไว้ด้วย
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  url.searchParams.set('from', from)
  return NextResponse.redirect(url)
}

export const config = {
  // กันทุก path ยกเว้น static ของ Next + ไฟล์ PWA (manifest/logo เบราว์เซอร์โหลดแบบไม่มี cookie)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|scan-app.webmanifest|donna-logo|icon-).*)',
  ],
}
