import { NextRequest, NextResponse } from 'next/server'
import { extractEvents, extractStateText, fmtTime } from '@/lib/trackExtract'

// SPX Express: endpoint สาธารณะของหน้า spx.co.th/track — เรียกตรงได้ไม่ติด captcha ไม่ต้องใช้ extension
// โครง response: data.sls_tracking_info.records[] = { description(ไทย), buyer_description, actual_time(unix วินาที), ... }
const SPX_API = 'https://spx.co.th/shipment/order/open/order/get_order_info?language_code=th&spx_tn='
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

type SpxRecord = { description?: string; buyer_description?: string; tracking_name?: string; actual_time?: number }

export async function POST(req: NextRequest) {
  const { nos } = await req.json()
  if (!Array.isArray(nos) || nos.length === 0) return NextResponse.json({ results: [] })
  const results = await Promise.all(
    (nos as string[]).map(async (no) => {
      try {
        const res = await fetch(SPX_API + encodeURIComponent(no.trim()), {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        const records: SpxRecord[] = data?.data?.sls_tracking_info?.records
        let events: { time: string; desc: string }[]
        if (Array.isArray(records) && records.length > 0) {
          // API คืนใหม่→เก่าอยู่แล้ว
          events = records
            .map((r) => ({
              time: fmtTime(r.actual_time),
              desc: (r.description || r.buyer_description || r.tracking_name || '').replace(/\s+/g, ' ').trim(),
            }))
            .filter((e) => e.desc)
        } else {
          events = extractEvents(data) || []   // เผื่อ SPX เปลี่ยนโครง — เดาแบบกว้างเป็น fallback
        }
        return { no, ok: events.length > 0, status: events[0]?.desc || extractStateText(data) || '', events }
      } catch {
        return { no, ok: false, status: '', events: [] }
      }
    }),
  )
  return NextResponse.json({ results })
}
