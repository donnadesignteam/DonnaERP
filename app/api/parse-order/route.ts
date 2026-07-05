import { NextRequest, NextResponse } from 'next/server'
import { fabricTypeFromCode } from '@/lib/fabrics'

type ContentBlock = { type: string; text?: string }
type AnthropicResponse = { content: ContentBlock[]; stop_reason?: string }

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
  "eyelet_color": "สีของห่วงตาไก่ (เฉพาะม่านตาไก่/ผ้าม่านตาไก่) เช่น สีขาว สีสัก สีดำ — มักเขียนต่อหลังคำว่า 'ม่านตาไก่' เช่น 'ม่านตาไก่ สีขาว' ถ้าไม่ใช่ม่านตาไก่หรือไม่ระบุใส่ว่าง",
  "fabric_type": "ชนิดผ้า: ผ้าโปร่ง | ผ้า Dimout | ผ้าทึบ — ใส่เฉพาะที่ระบุชัดในข้อความเท่านั้น ห้ามเดาจากรหัสสี ถ้าไม่ได้ระบุชนิดผ้าชัดเจนให้ใส่ว่าง (ระบบจะเติมให้เองจากรหัสสี)",
  "color_code": "รหัสสีผ้า = โค้ดสั้นตัวอักษรผสมตัวเลข เช่น S05, M20, SHB98, DS09, HB85, W17 เท่านั้น (ห้ามเอาชื่อแบรนด์/ลาย เช่น Richy มาใส่) ถ้าไม่มีใส่ว่าง",
  "color_name": "ชื่อลาย/สไตล์/แบรนด์ เช่น Richy, Linen, ครีมมินิมอล — และสำหรับรางให้ใส่สีราง (เช่น ดำ ขาว ครีม) ถ้าไม่มีใส่ว่าง",
  "color_desc": "สีจริงเป็นคำบรรยายสี เช่น เทาเบจ เบจน้ำตาลเข้ม ขาวครีม ถ้าไม่มีหรือเป็นรางใส่ว่าง",
  "width": ตัวเลขกว้างเมตร — ยกเว้นรางต่อโค้ง/เข้ามุมที่ระบุขนาดแบบ "a+b" (เช่น 1.69+0.49) ให้เก็บเป็นสตริง "1.69+0.49" ตามต้นฉบับ ห้ามบวกรวมหรือตัดค่าใดทิ้ง,
  "height": ตัวเลขสูงเมตร — ยกเว้นสูงซ้าย-ขวาไม่เท่ากัน (เช่น "0.90*ซ2.845*ข3.345") ให้เก็บเป็นสตริง "ซ2.845*ข3.345" ตามต้นฉบับ ห้ามเลือกค่าเดียวหรือเฉลี่ย ถ้าไม่มีใส่ 0,
  "quantity": จำนวน,
  "unit": "หน่วยตามต้นฉบับ: ชุด/ผืน/ชิ้น/ตัว/เส้น/อัน",
  "hooks": "จำนวนกระดุม/ตะขอ รูปแบบ (16+16),(32) ถ้าไม่มีใส่ว่าง",
  "orientation": "การวางผ้า/ตัดเย็บพิเศษ: ขวางผ้า หรือ ต่อผ้า — มักเขียนในวงเล็บ (ขวางผ้า)/(ต่อผ้า) ให้เก็บคำข้างใน ถ้าไม่มีใส่ว่าง",
  "note": "ตำแหน่งหรือเงื่อนไขสั้นๆ เช่น ซ้าย, ขวา, แยกกลาง, ดึงซ้าย, ดึงขวา, ดึงซ้าย1 ขวา1, ไม่โซ่, ถ่วงโซ่, ไม่ถ่วงโซ่, พร้อมส่ง, มีตำหนิ, ตัดครึ่งพร้อมตัวต่อ — ห้ามใส่ข้อมูลสี/ขนาด ถ้าไม่มีใส่ว่าง"
}

กฎ:
- "ส" = สูง เช่น ก1.10*ส2.08 → width 1.10 height 2.08
- "ซ" = สูงฝั่งซ้าย, "ข" = สูงฝั่งขวา (หน้าต่างสูงไม่เท่ากัน) เช่น 0.90*ซ2.845*ข3.345 → width 0.90, height "ซ2.845*ข3.345" เก็บทั้งสองค่าตามต้นฉบับ
- "(ขวางผ้า)" / "(ต่อผ้า)" = การวางผ้า/ตัดเย็บพิเศษ ให้เก็บใน orientation (ไม่ใช่ note) ห้ามตัดทิ้ง
- "(ไม่โซ่)" / "(ถ่วงโซ่)" / "ไม่ถ่วงโซ่" ที่ต่อท้ายบรรทัดขนาดหรือชื่อชนิด → เก็บใน note ของ item นั้น ห้ามตัดทิ้ง
- อุปกรณ์เสริม เช่น ตัวต่อราง, ฝาปิดราง, ลูกล้อ, ห่วงติ่ง, โซ่ถ่วง, สายสลิง, ตะขอ = item แยกต่างหาก type=ชื่ออุปกรณ์ตามต้นฉบับ unit ตามที่เขียน (ชิ้น/ตัว/เส้น) — ถ้ามีขนาด เช่น "โซ่ถ่วง ขนาด1.30" ให้ width=1.30 (ไม่ใช่ note)
- รางต่อโค้ง/หักโค้ง/เข้ามุม เขียนได้หลายแบบ: "1.69+0.49", "0.40-3.30", "0.82หักโค้ง3.32" → ทุกแบบให้ width = "a+b" (เช่น "0.40+3.30") เก็บทั้งสองค่า ห้ามตัดค่าใดทิ้ง และยังนับเป็น item เดียว
- ถ้ามีหลายขนาด แยกเป็นหลาย item
- ม่านตาไก่/ผ้าม่านตาไก่: สีที่เขียนต่อจากคำว่า "ม่านตาไก่" คือสีห่วงตาไก่ ให้ใส่ใน eyelet_color (เช่น "ผ้าม่านตาไก่ สีขาว" → eyelet_color="สีขาว") ห้ามเอาไปปนกับสีผ้า (color_name/color_desc) ซึ่งเป็นคนละสี
- ราง = type ขึ้นต้นด้วย "ราง", floors=จำนวนชั้น, color_name=สีราง (เช่น ดำ ขาว), color_code=ว่าง
- แยกรหัสสีกับแบรนด์/ลาย: รหัสสีคือโค้ดสั้น เช่น S05, M20, SHB98 → color_code ส่วนชื่อแบรนด์หรือลาย เช่น Richy → color_name (ห้ามสลับกัน)
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
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: `Anthropic API error: ${err}` }, { status: 500 })
  }

  const data: AnthropicResponse = await response.json()
  const raw = (Array.isArray(data.content) ? data.content : []).find(c => c.type === 'text')?.text ?? ''

  if (data.stop_reason === 'max_tokens') {
    return NextResponse.json({ error: 'ออเดอร์ยาวเกินไป คำตอบถูกตัดกลางคัน ลองแบ่งเป็นหลายรอบ', raw }, { status: 500 })
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'แปลงข้อมูลไม่สำเร็จ', raw }, { status: 500 })
  }

  try {
    const order = JSON.parse(jsonMatch[0])
    // เติม/แก้ fabric_type ให้ถูกต้องจากแคตตาล็อกรหัสผ้า (แม่นกว่าให้ AI เดา)
    // เฉพาะรายการผ้า (ไม่ใช่ราง) ที่มีรหัสสีตรงกับแคตตาล็อก
    if (Array.isArray(order.items)) {
      order.items = order.items.map((it: { type?: string; color_code?: string; fabric_type?: string }) => {
        if (typeof it?.type === 'string' && it.type.startsWith('ราง')) return it
        const ft = fabricTypeFromCode(it?.color_code)
        return ft ? { ...it, fabric_type: ft } : it
      })
    }
    return NextResponse.json({ order })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
