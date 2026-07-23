import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AUTH_COOKIE, authToken } from '@/lib/auth'
import { STAFF_COOKIE, buildStaffCookie, normalizePass, normalizeStaffCode, staffPassVariants } from '@/lib/staffAuth'

const COOKIE_BASE = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 วัน
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { mode, user, pass, code } = body as { mode?: string; user?: string; pass?: string; code?: string }

  if (mode === 'staff') return staffLogin(String(code || ''), String(pass || ''))

  const expectedUser = process.env.SITE_USER || 'donna'
  const expectedPass = process.env.SITE_PASS

  // ยังไม่ตั้งรหัส = ปิด auth → ถือว่าผ่าน (dev)
  if (!expectedPass) {
    return NextResponse.json({ ok: true })
  }

  if (user === expectedUser && pass === expectedPass) {
    const token = await authToken()
    const res = NextResponse.json({ ok: true })
    res.cookies.set(AUTH_COOKIE, token!, { ...COOKIE_BASE, httpOnly: true })
    // เข้าด้วยรหัสรวมของร้าน = ไม่ผูกกับพนักงานคนไหน → ล้างตัวตนเดิมทิ้ง (กันแดชบอร์ดโชว์ของคนก่อนหน้า)
    res.cookies.set(STAFF_COOKIE, '', { path: '/', maxAge: 0 })
    return res
  }

  return NextResponse.json({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
}

// ── โหมดพนักงาน: ID = รหัสพนักงาน (DN015), รหัสผ่าน = วันและเดือนที่เริ่มงาน (313) ──
// ล็อกอินผ่าน = ได้สิทธิ์เท่าคนที่ใช้รหัสรวมของร้าน + ได้คุกกี้ตัวตนไว้เปิดแดชบอร์ดของตัวเองที่ /m/me
async function staffLogin(rawCode: string, rawPass: string) {
  const code = normalizeStaffCode(rawCode)
  const pass = normalizePass(rawPass)
  const bad = () => NextResponse.json({ ok: false, error: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  if (!code || !pass) return bad()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ ok: false, error: 'ยังไม่ได้ตั้งค่าฐานข้อมูล' }, { status: 500 })

  const db = createClient(url, key)
  const { data, error } = await db.from('staff').select('code, nickname, active, start_date').eq('code', code).maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' }, { status: 500 })
  if (!data) return bad()
  if (data.active === false) return NextResponse.json({ ok: false, error: 'รหัสพนักงานนี้ไม่ได้ทำงานแล้ว' }, { status: 401 })
  // คนที่ยังไม่มีวันเริ่มงานใน DB คำนวณรหัสผ่านไม่ได้ — บอกตรงๆ ดีกว่าปล่อยให้งงว่าพิมพ์ผิด
  if (!data.start_date) {
    return NextResponse.json({ ok: false, error: 'ยังไม่มีวันเริ่มงานในระบบ แจ้ง HR กรอกที่หน้าพนักงานก่อน' }, { status: 401 })
  }
  if (!staffPassVariants(data.start_date).includes(pass)) return bad()

  const token = await authToken()
  const res = NextResponse.json({ ok: true, code: data.code, nickname: data.nickname })
  if (token) res.cookies.set(AUTH_COOKIE, token, { ...COOKIE_BASE, httpOnly: true })
  res.cookies.set(STAFF_COOKIE, await buildStaffCookie(data.code, data.nickname), COOKIE_BASE)
  return res
}
