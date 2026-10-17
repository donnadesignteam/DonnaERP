import { NextRequest, NextResponse } from 'next/server'
import { itemSectionLines, type PrintableOrder } from '@/lib/orderPrint'

// รายการสินค้าแบบเดียวกับปุ่มคัดลอกในหมวดออเดอร์ — ให้บอท LINE (DonnaBot) โชว์รายการหน้าตาเดียวกับเว็บ
// รับ { orders: [{ items, platform, is_installation, outsource_at }] } → { texts: string[] } (ทีละใบ ตามลำดับ)
// ‼️ บอทเรียกด้วย header x-bot-key (proxy.ts) · ไม่แตะฐานข้อมูล
export async function POST(req: NextRequest) {
  const { orders } = await req.json().catch(() => ({ orders: null }))
  if (!Array.isArray(orders)) return NextResponse.json({ error: 'ไม่มีข้อมูล' }, { status: 400 })
  const texts = orders.slice(0, 50).map((o: PrintableOrder) =>
    itemSectionLines({ ...o, items: Array.isArray(o?.items) ? o.items : [] }).map(l => l.t).join('\n').trim())
  return NextResponse.json({ texts })
}
