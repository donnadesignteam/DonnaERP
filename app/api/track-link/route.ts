import { NextResponse } from 'next/server'
import { trackToken, shortTrackCode } from '@/lib/trackLink'

// ออกลิงก์เช็คสถานะให้ลูกค้า (ต้อง login — proxy.ts กันไว้) · GET /api/track-link?id=<order_entries.id>
export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id') || ''
  const long = await trackToken(id)
  if (!long) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  // ลิงก์ลูกค้าใช้โดเมนสั้นของร้าน (29ต.ค.69 user ขอไม่ให้มีคำ donna-erp) — localhost ใช้ origin เดิม · เปลี่ยนโดเมนได้ด้วย env TRACK_BASE_URL
  const base = process.env.TRACK_BASE_URL || (url.hostname.endsWith('.vercel.app') ? 'https://donna-design.vercel.app' : url.origin)
  const token = (await shortTrackCode(id.toLowerCase())) || long
  return NextResponse.json({ url: `${base}/t/${token}` })
}
