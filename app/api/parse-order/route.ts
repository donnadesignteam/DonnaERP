import { NextRequest, NextResponse } from 'next/server'

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

  const prompt = `แปลงข้อความออเดอร์ที่แอดมิน copy มาจากแชทไลน์เป็น JSON object เดียวเท่านั้น ห้ามมี markdown ห้ามมีข้อความอื่น

schema:
{
  "customer_name": "ชื่อลูกค้า/username (มักอยู่หลังชื่อ platform เช่น 'Shopee: somchai' → somchai) ถ้าไม่มีใส่ null",
  "platform": "ช่องทาง เลือกที่ตรงที่สุด: Shopee | Tiktok | Lazada | Facebook | LineOA | หน้าร้าน | Lineส่วนตัวยุน | Lineส่วนตัวสู้ | Lineส่วนตัวเฟิร์น (ถ้าไม่มีใส่ null)",
  "order_number": "เลขออเดอร์ (Shopee 14 ตัวอักษรผสมเลข / Tiktok 18-19 หลัก / Lazada 16 หลัก ถ้าไม่มีใส่ null)",
  "deadline": "กำหนดส่งงาน รูปแบบ YYYY-MM-DD ถ้าระบุชัด ไม่งั้น null",
  "price": ยอดเงินสุดท้ายที่ลูกค้าต้องจ่าย เป็นตัวเลข (มักอยู่หลังเครื่องหมาย = เช่น "=1965บาท" → 1965 ซึ่งรวมค่าส่งแล้ว ถ้ามีแค่ราคาเดียวใช้ราคานั้น) ถ้าไม่มีใส่ null,
  "payment_status": "สถานะชำระ เลือก 1 ใน: ยังไม่ชำระ | มัดจำ | มัดจำ50% | ชำระครบ — ถ้าเห็นคำว่า 'ชำระครบ'/'จ่ายแล้ว'/'โอนแล้ว'/'จ่ายครบ' = ชำระครบ, 'มัดจำ50%' = มัดจำ50%, 'มัดจำ' = มัดจำ, ถ้าไม่ระบุใส่ null",
  "notes": "หมายเหตุที่ลูกค้าระบุชัดเจน ถ้าไม่มีใส่ null",
  "items": [ array ของรายการสินค้า schema ด้านล่าง ถ้าไม่มีใส่ [] ]
}

schema ของแต่ละ item:
{
  "type": "ประเภท เช่น ม่านตาไก่, รางม่านลอนเทป, ม่านพับ, ผ้าม่านตาไก่, ผ้าโปร่ง, มู่ลี่ไม้",
  "floors": null หรือจำนวนชั้น (สำหรับราง),
  "rail_head": "หัวราง/หัวม่าน — สำหรับราง เช่น กระดุม วงแหวน; สำหรับผ้าม่านให้เก็บแบบหัวม่านครบถ้วน เช่น '2จีบ ตะขอยาว', 'ตะขอสั้น', 'ตะขอเพดาน' ถ้าไม่มีใส่ว่าง",
  "fabric_type": "ผ้าโปร่ง/ผ้าทึบ/ผ้ากึ่งทึบ ถ้าไม่ใช่ผ้าใส่ว่าง",
  "color_code": "แบรนด์/รหัสสี เช่น Richy, M20, SHB98 ถ้าไม่มีใส่ว่าง",
  "color_name": "ชื่อลาย/สไตล์ ถ้าไม่มีใส่ว่าง",
  "color_desc": "สีจริง เช่น เบจน้ำตาลเข้ม ถ้าไม่มีหรือเป็นรางใส่ว่าง",
  "width": ตัวเลขกว้างเมตร — ยกเว้นรางต่อโค้ง/เข้ามุมที่ระบุขนาดแบบ "a+b" (เช่น 1.69+0.49) ให้เก็บเป็นสตริง "1.69+0.49" ตามต้นฉบับ ห้ามบวกรวมหรือตัดค่าใดทิ้ง,
  "height": ตัวเลขสูงเมตร ถ้าไม่มีใส่ 0,
  "quantity": จำนวน,
  "unit": "ชุด หรือ ผืน",
  "hooks": "จำนวนกระดุม/ตะขอ รูปแบบ (16+16),(32) ถ้าไม่มีใส่ว่าง",
  "note": "ตำแหน่ง เช่น ซ้าย ขวา แยกกลาง เท่านั้น"
}

กฎ:
- "ส" = สูง เช่น ก1.10*ส2.08 → width 1.10 height 2.08
- ขนาดที่เขียนเป็น "a+b" (เช่น 1.69+0.49) = รางต่อโค้ง/เข้ามุม ให้ width = "1.69+0.49" เก็บทั้งสองค่า ห้ามตัด 0.49 ทิ้ง และยังนับเป็น item เดียว
- ถ้ามีหลายขนาด แยกเป็นหลาย item
- ราง = type ขึ้นต้นด้วย "ราง", floors=จำนวนชั้น, color_name=สีราง
- ผ้าม่านจีบ: เก็บจำนวนจีบ (1จีบ/2จีบ/3จีบ) และชนิดตะขอ (ตะขอสั้น/ตะขอยาว/ตะขอเพดาน) ลงใน rail_head เช่น "2จีบ ตะขอยาว" — ห้ามตัดคำว่า ยาว/สั้น/เพดาน หรือจำนวนจีบทิ้ง
- ผ้าม่านลอน (แบบตะขอ): เก็บชนิดตะขอ (ตะขอสั้น/ตะขอยาว/ตะขอเพดาน) ลงใน rail_head ให้ครบ
- ผ้าม่านลอนเทป: ใช้เทป ไม่มีตะขอให้เลือก ไม่ต้องใส่ชนิดตะขอใน rail_head
- (สั่งตัด) และ 📍 นำหน้า ให้ตัดออก
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
    const order = JSON.parse(jsonMatch[0])
    return NextResponse.json({ order })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
