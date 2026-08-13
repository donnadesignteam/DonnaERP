import { NextResponse } from 'next/server'

// เวอร์ชันของโค้ดที่ deploy อยู่ — ให้เว็บฝั่งผู้ใช้เอาไปเทียบว่ากำลังรันตัวเก่าอยู่หรือเปล่า
// บน Vercel ทุก deploy ได้ commit ใหม่ → ค่านี้เปลี่ยน · ตอน dev ใช้เวลาตอนเซิร์ฟเวอร์บูตแทน
export const dynamic = 'force-dynamic'

// (ตอน dev ค่าจะเปลี่ยนทุกครั้งที่เซิร์ฟเวอร์คอมไพล์ไฟล์นี้ใหม่ — ใช้ลองดูแถบแจ้งอัปเดตได้ กดบันทึกไฟล์นี้ซ้ำ = จำลอง deploy ใหม่)
const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  `dev-${Date.now()}`

export async function GET() {
  return NextResponse.json(
    { version: VERSION },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
