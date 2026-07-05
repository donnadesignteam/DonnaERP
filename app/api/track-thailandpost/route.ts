import { NextRequest, NextResponse } from 'next/server'

// Track & Trace API ทางการของไปรษณีย์ไทย (ฟรี แต่ต้องสมัคร):
// 1. สมัคร/login ที่ https://track.thailandpost.co.th → เมนู Developer → ขอ API token
// 2. เอา token ใส่ .env.local และ Vercel: THAILANDPOST_API_TOKEN=...
// token ยาวจากเว็บใช้แลก token สั้น (อายุ ~1 เดือน) อีกที — cache ไว้ใน module

let cachedToken: { token: string; expire: number } | null = null

async function getToken(apiKey: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expire) return cachedToken.token
  const res = await fetch('https://trackapi.thailandpost.co.th/post/api/v1/authenticate/token', {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}` },
  })
  if (!res.ok) throw new Error(`ขอ token ไม่ผ่าน (${res.status}) — เช็คค่า THAILANDPOST_API_TOKEN`)
  const data = await res.json()
  cachedToken = { token: data.token, expire: Date.now() + 1000 * 60 * 60 * 12 }
  return data.token
}

export async function POST(req: NextRequest) {
  const { nos } = await req.json()
  const apiKey = process.env.THAILANDPOST_API_TOKEN
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ยังไม่ได้ตั้งค่า THAILANDPOST_API_TOKEN — สมัครฟรีที่ track.thailandpost.co.th (เมนู Developer) แล้วใส่ใน .env.local' },
      { status: 501 },
    )
  }
  if (!Array.isArray(nos) || nos.length === 0) return NextResponse.json({ results: [] })
  try {
    const token = await getToken(apiKey)
    const res = await fetch('https://trackapi.thailandpost.co.th/post/api/v1/track', {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'all', language: 'TH', barcode: nos }),
    })
    if (!res.ok) throw new Error(`track ${res.status}`)
    const data = await res.json()
    const items = data?.response?.items || {}
    const results = (nos as string[]).map((no) => {
      const evs: { status_date?: string; status_description?: string; location?: string }[] =
        Array.isArray(items[no]) ? items[no] : []
      // API คืนเรียงเก่า→ใหม่ — กลับด้านให้ล่าสุดขึ้นก่อน (ให้เหมือนฝั่ง extension)
      const events = evs
        .map((e) => ({ time: e.status_date || '', desc: [e.status_description, e.location].filter(Boolean).join(' · ') }))
        .filter((e) => e.desc)
        .reverse()
      return { no, ok: events.length > 0, status: events[0]?.desc || '', events }
    })
    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
