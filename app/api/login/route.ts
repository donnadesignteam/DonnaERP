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

// ช่องกรอกมีแค่ "ชื่อผู้ใช้ + รหัสผ่าน" ชุดเดียว ไม่มีให้เลือกโหมด —
// ลองรหัสรวมของร้านก่อน ไม่ใช่ค่อยลองเป็นรหัสพนักงาน (ระบบเดาให้เองว่าใครเป็นใคร)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { user, pass } = body as { user?: string; pass?: string }

  const expectedUser = process.env.SITE_USER || 'donna'
  const expectedPass = process.env.SITE_PASS

  if (expectedPass && user === expectedUser && pass === expectedPass) {
    const token = await authToken()
    const res = NextResponse.json({ ok: true, staff: false })
    res.cookies.set(AUTH_COOKIE, token!, { ...COOKIE_BASE, httpOnly: true })
    // เข้าด้วยรหัสรวมของร้าน = ไม่ผูกกับพนักงานคนไหน → ล้างตัวตนเดิมทิ้ง (กันแดชบอร์ดโชว์ของคนก่อนหน้า)
    res.cookies.set(STAFF_COOKIE, '', { path: '/', maxAge: 0 })
    return res
  }

  const asStaff = await staffLogin(String(user || ''), String(pass || ''))
  if (asStaff) return asStaff

  // ยังไม่ตั้ง SITE_PASS = ปิด auth → ปล่อยผ่าน (dev) แต่ต้องลองรหัสพนักงานก่อน จะได้มีตัวตนไว้เปิด /m/me
  if (!expectedPass) return NextResponse.json({ ok: true, staff: false })

  return NextResponse.json({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
}

// ── ลองอ่านสิ่งที่กรอกเป็น "รหัสพนักงาน (DN015) + วันและเดือนที่เริ่มงาน (313)" ──
// ล็อกอินผ่าน = ได้สิทธิ์เท่าคนที่ใช้รหัสรวมของร้าน + ได้คุกกี้ตัวตนไว้เปิดแดชบอร์ดของตัวเองที่ /m/me
// คืน null = "ไม่ใช่รหัสพนักงาน/รหัสผ่านไม่ตรง" → ให้ผู้เรียกไปตอบข้อความ error รวมเอง
// (ไม่บอกว่ารหัสพนักงานมีจริงไหม แต่ถ้ามีจริงแล้วติดปัญหาอื่นจะบอกเหตุผลตรงๆ ให้แก้ถูกจุด)
async function staffLogin(rawCode: string, rawPass: string) {
  const code = normalizeStaffCode(rawCode)
  const pass = normalizePass(rawPass)
  if (!code || !pass) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const db = createClient(url, key)
  const { data, error } = await db.from('staff').select('code, nickname, active, start_date').eq('code', code).maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: 'เชื่อมต่อฐานข้อมูลไม่ได้' }, { status: 500 })
  if (!data) return null
  if (data.active === false) return NextResponse.json({ ok: false, error: 'รหัสพนักงานนี้ไม่ได้ทำงานแล้ว' }, { status: 401 })
  // คนที่ยังไม่มีวันเริ่มงานใน DB คำนวณรหัสผ่านไม่ได้ — บอกตรงๆ ดีกว่าปล่อยให้งงว่าพิมพ์ผิด
  if (!data.start_date) {
    return NextResponse.json({ ok: false, error: 'ยังไม่มีวันเริ่มงานในระบบ แจ้ง HR กรอกที่หน้าพนักงานก่อน' }, { status: 401 })
  }
  if (!staffPassVariants(data.start_date).includes(pass)) return null

  const token = await authToken()
  const res = NextResponse.json({ ok: true, staff: true, code: data.code, nickname: data.nickname })
  if (token) res.cookies.set(AUTH_COOKIE, token, { ...COOKIE_BASE, httpOnly: true })
  res.cookies.set(STAFF_COOKIE, await buildStaffCookie(data.code, data.nickname), COOKIE_BASE)
  return res
}
