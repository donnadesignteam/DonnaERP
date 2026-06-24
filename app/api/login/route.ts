import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, authToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json().catch(() => ({}))

  const expectedUser = process.env.SITE_USER || 'donna'
  const expectedPass = process.env.SITE_PASS

  // ยังไม่ตั้งรหัส = ปิด auth → ถือว่าผ่าน (dev)
  if (!expectedPass) {
    return NextResponse.json({ ok: true })
  }

  if (user === expectedUser && pass === expectedPass) {
    const token = await authToken()
    const res = NextResponse.json({ ok: true })
    res.cookies.set(AUTH_COOKIE, token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 วัน
    })
    return res
  }

  return NextResponse.json({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
}
