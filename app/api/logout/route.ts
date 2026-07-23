import { NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth'
import { STAFF_COOKIE } from '@/lib/staffAuth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, '', { path: '/', maxAge: 0 })
  res.cookies.set(STAFF_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
