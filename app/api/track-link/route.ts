import { NextResponse } from 'next/server'
import { trackToken } from '@/lib/trackLink'

// ออกลิงก์เช็คสถานะให้ลูกค้า (ต้อง login — proxy.ts กันไว้) · GET /api/track-link?id=<order_entries.id>
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = await trackToken(url.searchParams.get('id') || '')
  if (!token) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  return NextResponse.json({ url: `${url.origin}/t/${token}` })
}
