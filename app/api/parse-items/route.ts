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

  const prompt = `แปลงรายการสินค้าต่อไปนี้เป็น JSON array เท่านั้น ห้ามมี markdown

schema แต่ละ item:
{
  "type": "ประเภท เช่น ม่านพับมินิมอล, รางม่านลอนเทป, ผ้าม่านตาไก่, ผ้าโปร่ง, มู่ลี่ไม้ ฯลฯ",
  "floors": null หรือตัวเลขจำนวนชั้น (สำหรับราง),
  "rail_head": "หัวราง เช่น กระดูม วงแหวน ถ้าไม่มีใส่ว่าง",
  "fabric_type": "ประเภทผ้า เช่น ผ้าโปร่ง ผ้าทึบ ผ้ากึ่งทึบ สำหรับรางหรือไม่ใช่ผ้าม่านใส่ว่าง",
  "color_code": "แบรนด์หรือรหัสสี เช่น Richy, Berjaya, H22-9, A11 ถ้าไม่มีใส่ว่าง",
  "color_name": "ชื่อลาย/สไตล์ เช่น ตาไก่สีโอ๊ค ครีมมินิมอล ลายฝนขาวสว่าง ถ้าไม่มีใส่ว่าง",
  "color_desc": "คำอธิบายสีจริง เช่น เบจน้ำตาลเข้ม ขาวครีม เทาอ่อน ถ้าไม่มีหรือเป็นรางใส่ว่าง",
  "width": ตัวเลขกว้างเป็นเมตร,
  "height": ตัวเลขสูงเป็นเมตร ถ้าไม่มีใส่ 0,
  "quantity": จำนวน,
  "unit": "ชุด หรือ ผืน",
  "hooks": "จำนวนกระดูม/วงแหวน/ตะขอ รูปแบบ เช่น (16+16), (32), (20+20) ถ้าไม่มีใส่ว่าง",
  "note": "เฉพาะคำอธิบายเชิงตำแหน่ง เช่น ซ้าย ขวา แยกกลาง เท่านั้น"
}

กฎสำคัญ:
1. ราง = type ขึ้นต้นด้วย "ราง", floors=จำนวนชั้น, rail_head=หัวราง, color_name=สีราง, fabric_type=""
2. ผ้าม่าน/ม่านผ้า = ให้ระบุ fabric_type จากบริบท เช่น "ผ้าโปร่ง" "ผ้าทึบ" "ผ้ากึ่งทึบ" ถ้าไม่ชัดเจนใส่ว่าง
3. จำนวนชั้นและหัวรางให้ใส่ใน floors และ rail_head ห้ามใส่ใน note
4. ถ้ามีหลายขนาดในรายการเดียวกัน ให้แยกเป็นหลาย item
5. (สั่งตัด) ให้ตัดออก ไม่ต้องใส่ใน type
6. 📍 ที่นำหน้ารายการให้ตัดออก ไม่ต้องใส่ที่ไหน
7. จำนวนกระดูม/วงแหวน/ตะขอ รูปแบบ (N+N) หรือ (N) เช่น (16+16) (32) ให้เก็บใน hooks ทั้งวงเล็บ เช่น "(16+16)", "(32)"
8. "ส" ย่อมาจาก "สูง" เช่น ก1.10*ส2.08 = width 1.10, height 2.08
9. บรรทัดที่ขึ้นต้นด้วย · เป็นข้อมูลสี/แบรนด์หรือขนาดของรายการก่อนหน้า ตีความรวมกับบรรทัดนั้น
10. note ใส่ได้เฉพาะ: ซ้าย, ขวา, แยกกลาง, บน, ล่าง หรือคำอธิบายตำแหน่งเท่านั้น ห้ามใส่ข้อมูลอื่น
11. หัวรางที่พบบ่อย: กระดูม, ไม้อ่อน, วงแหวน, ตะขอ, ซิลเวอร์ — ถ้าบรรทัดหลังรางขึ้นต้นด้วยชื่อหัวราง ให้ถือว่าเป็นข้อมูลของรางนั้น ไม่ใช่ item ใหม่ ให้เก็บเป็น rail_head และนำขนาด/จำนวนจากบรรทัดนั้นมาใส่ใน item รางด้วย

รายการ:
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

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'แปลงข้อมูลไม่สำเร็จ', raw }, { status: 500 })
  }

  try {
    const items = JSON.parse(jsonMatch[0])
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
