import { NextRequest, NextResponse } from 'next/server'
import { fabricTypeFromCode } from '@/lib/fabrics'

type ContentBlock = { type: string; text?: string }
type AnthropicResponse = { content: ContentBlock[] }

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'ไม่มีข้อความ' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your-api-key-here') {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน .env.local' }, { status: 500 })
  }

  const prompt = `คุณคือผู้ช่วยแยกข้อมูล "งานเคลม" ของร้านผ้าม่าน จากข้อความที่แอดมิน copy มาจากแชทไลน์
แปลงเป็น JSON object เดียวเท่านั้น ห้ามมี markdown ห้ามมีข้อความอื่น

schema:
{
  "channel": "ช่องทาง: Shopee | Lazada | Tiktok | Facebook | LineOA | หน้าร้าน (ดูจากคำว่า Shopee:, Line OA:, Tiktok: ฯลฯ ถ้าไม่มีใส่ null)",
  "customer_username": "username/ชื่อลูกค้าหลังช่องทาง เช่น acumijanjira, VW, this190 (ถ้าไม่มีใส่ null)",
  "original_order_number": "เลขออเดอร์เดิมที่เคลม เช่น 260404V5HJHPE2 (ถ้าไม่มีใส่ null)",
  "claim_type": "เลือก 1 ใน: ของขาด/ไม่ครบ | ส่งผิด/ขนาดไม่ตรง | เสียหายจากขนส่ง | ชำรุด/ตำหนิ | ลูกค้าแจ้งผิด(แก้ไข) | เปลี่ยนสินค้า | ส่งคืนไม่แจ้ง (ถ้าไม่ชัดใส่ null)",
  "fault": "ใครผิด: ร้าน | ลูกค้า | ขนส่ง (เดาจากบริบท: ของขาด/ส่งผิด=ร้าน, แจ้งขนาดผิดเอง=ลูกค้า, รางงอ/กล่องเสียหาย=ขนส่ง ถ้าไม่ชัดใส่ null)",
  "cause": "สรุปสาเหตุสั้นๆ 1 บรรทัด เช่น 'ได้รับม่านตาไก่ไม่ครบ ขาด 3 ชุด'",
  "ship_name": "ชื่อผู้รับสำหรับส่งใหม่ (ถ้ามีที่อยู่)",
  "ship_address": "ที่อยู่จัดส่งเต็ม (รวมตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ ถ้ามี)",
  "ship_phone": "เบอร์โทร (ถ้ามี)",
  "return_tracking": "เลขพัสดุที่ลูกค้าส่งคืน เช่น TH54018HR08P5A (ถ้ามีคำว่าลูกค้าส่ง/ส่งคืน/เลขพัสดุ ใส่ ถ้าไม่มี null)",
  "refund_amount": "ยอดเงินคืน/ค่าแก้ เป็นตัวเลข (ถ้ามี เช่น 913, 135 ถ้าไม่มี null)",
  "money_direction": "คืนลูกค้า | เก็บลูกค้า (คืนเงิน/โอนคืน=คืนลูกค้า, ค่าแก้/เก็บเงินเพิ่ม=เก็บลูกค้า ถ้าไม่มี null)",
  "payment_target": "พร้อมเพย์/เลขบัญชี ที่ลูกค้าให้มา (ถ้ามี)",
  "is_urgent": "true ถ้ามีคำว่า เคลมส่งด่วน/ด่วน/🔥/(fire) มิฉะนั้น false",
  "items": [ รายการสินค้าที่เคลม array — schema เดียวกับด้านล่าง ถ้าไม่มีรายการชัดเจนใส่ [] ]
}

schema ของแต่ละ item ใน items:
{
  "type": "ประเภท เช่น ม่านตาไก่, รางม่านจีบ, ม่านพับ, ผ้าม่านตาไก่, มู่ลี่ไม้",
  "floors": null หรือจำนวนชั้น (สำหรับราง),
  "rail_head": "หัวราง เช่น กระดุม วงแหวน ถ้าไม่มีใส่ว่าง",
  "eyelet_color": "สีของห่วงตาไก่ (เฉพาะม่านตาไก่/ผ้าม่านตาไก่) เช่น สีขาว สีสัก สีดำ — มักเขียนต่อหลังคำว่า 'ม่านตาไก่' ถ้าไม่ใช่ม่านตาไก่หรือไม่ระบุใส่ว่าง",
  "fabric_type": "ชนิดผ้า: ผ้าโปร่ง | ผ้า Dimout | ผ้าทึบ — ใส่เฉพาะที่ระบุชัดในข้อความ ห้ามเดาจากรหัสสี ถ้าไม่ใช่ผ้าใส่ว่าง (ระบบจะเติมให้เองจากรหัสสี)",
  "color_code": "แบรนด์/รหัสสี เช่น M20, SHB98, C77BO-3 ถ้าไม่มีใส่ว่าง",
  "color_name": "ชื่อลาย/สี เช่น เบจ, oatmeal, ขาว ถ้าไม่มีใส่ว่าง",
  "color_desc": "สีจริง ถ้าไม่มีใส่ว่าง",
  "width": ตัวเลขกว้างเมตร,
  "height": ตัวเลขสูงเมตร ถ้าไม่มีใส่ 0,
  "quantity": จำนวน,
  "unit": "ชุด หรือ ผืน หรือ ตัว หรือ เส้น",
  "hooks": "",
  "note": "ตำแหน่ง เช่น ซ้าย ขวา แยกกลาง หรือคำอธิบายของที่ขาด เช่น 'ขาด 6 ตัว'"
}

กฎ:
- "ส" = สูง เช่น ก1.30*ส1.30 → width 1.30 height 1.30
- ถ้ามีหลายขนาด แยกเป็นหลาย item
- อุปกรณ์ที่ขาด (ลูกล้อ/ตะขอ/หัวกระดุม/ตัวต่อราง/เทปลอน) ก็เป็น item ได้ ใส่ unit "ตัว" และจำนวนที่ขาดใน note
- ถ้าข้อมูลไหนไม่มีในข้อความ ใส่ null (หรือ "" ใน item, [] สำหรับ items) ห้ามแต่งเติม

ข้อความ:
${text}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: `Anthropic API error: ${err}` }, { status: 500 })
  }

  const data: AnthropicResponse = await response.json()
  const raw = (Array.isArray(data.content) ? data.content : []).find(c => c.type === 'text')?.text ?? ''

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'แปลงข้อมูลไม่สำเร็จ', raw }, { status: 500 })
  }

  try {
    const claim = JSON.parse(jsonMatch[0])
    // เติม/แก้ fabric_type จากแคตตาล็อกรหัสผ้า (เฉพาะรายการผ้า ไม่ใช่ราง)
    if (Array.isArray(claim?.items)) {
      claim.items = claim.items.map((it: { type?: string; color_code?: string; fabric_type?: string }) => {
        if (typeof it?.type === 'string' && it.type.startsWith('ราง')) return it
        const ft = fabricTypeFromCode(it?.color_code)
        return ft ? { ...it, fabric_type: ft } : it
      })
    }
    return NextResponse.json({ claim })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
