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

  const prompt = `แปลงรายการสินค้าต่อไปนี้เป็น JSON array เท่านั้น ห้ามมี markdown

schema แต่ละ item:
{
  "type": "ประเภท เช่น ม่านพับมินิมอล, รางม่านลอนเทป, ผ้าม่านตาไก่, ผ้าโปร่ง, มู่ลี่ไม้ ฯลฯ",
  "floors": null หรือตัวเลขจำนวนชั้น (สำหรับราง),
  "rail_head": "หัวราง/หัวม่าน — สำหรับราง เช่น กระดูม วงแหวน; สำหรับผ้าม่านให้เก็บแบบหัวม่านครบถ้วน เช่น '2จีบ ตะขอยาว', 'ตะขอสั้น', 'ตะขอเพดาน' ถ้าไม่มีใส่ว่าง",
  "eyelet_color": "สีของห่วงตาไก่ (เฉพาะม่านตาไก่/ผ้าม่านตาไก่) เช่น สีขาว สีสัก สีดำ — มักเขียนต่อหลังคำว่า 'ม่านตาไก่' ถ้าไม่ใช่ม่านตาไก่หรือไม่ระบุใส่ว่าง",
  "fabric_type": "ชนิดผ้า: ผ้าโปร่ง | ผ้า Dimout | ผ้าทึบ — ใส่เฉพาะที่ระบุชัดในข้อความ ห้ามเดาจากรหัสสี สำหรับรางหรือไม่ใช่ผ้าม่านใส่ว่าง (ระบบจะเติมให้เองจากรหัสสี)",
  "color_code": "รหัสสีผ้า = โค้ดสั้นตัวอักษรผสมตัวเลข เช่น S05, M20, SHB98, DS09, H22-9, A11 เท่านั้น (ห้ามเอาชื่อแบรนด์/ลาย เช่น Richy มาใส่) ถ้าไม่มีใส่ว่าง",
  "color_name": "ชื่อลาย/สไตล์/แบรนด์ เช่น Richy, ตาไก่สีโอ๊ค ครีมมินิมอล ลายฝนขาวสว่าง — และสำหรับรางคือสีราง ถ้าไม่มีใส่ว่าง",
  "color_desc": "คำอธิบายสีจริง เช่น เบจน้ำตาลเข้ม ขาวครีม เทาอ่อน ถ้าไม่มีหรือเป็นรางใส่ว่าง",
  "width": ตัวเลขกว้างเป็นเมตร — ยกเว้นรางต่อโค้ง/เข้ามุมที่ระบุขนาดแบบ "a+b" (เช่น 1.69+0.49) ให้เก็บเป็นสตริง "1.69+0.49" ตามต้นฉบับ ห้ามบวกรวมหรือตัดค่าใดทิ้ง,
  "height": ตัวเลขสูงเป็นเมตร ถ้าไม่มีใส่ 0,
  "quantity": จำนวน,
  "unit": "ชุด หรือ ผืน",
  "hooks": "จำนวนกระดูม/วงแหวน/ตะขอ รูปแบบ เช่น (16+16), (32), (20+20) ถ้าไม่มีใส่ว่าง",
  "note": "เฉพาะคำอธิบายเชิงตำแหน่ง เช่น ซ้าย ขวา แยกกลาง เท่านั้น"
}

กฎสำคัญ:
1. ราง = type ขึ้นต้นด้วย "ราง", floors=จำนวนชั้น, rail_head=หัวราง, color_name=สีราง, color_code="", fabric_type=""
1ข. แยกรหัสสีกับแบรนด์/ลาย: รหัสสีคือโค้ดสั้น เช่น S05, M20, SHB98 → color_code ส่วนชื่อแบรนด์หรือลาย เช่น Richy → color_name (ห้ามสลับกัน)
1ก. ม่านตาไก่/ผ้าม่านตาไก่: สีที่เขียนต่อจาก "ม่านตาไก่" คือสีห่วงตาไก่ ใส่ใน eyelet_color (เช่น "ผ้าม่านตาไก่ สีขาว" → eyelet_color="สีขาว") ห้ามปนกับสีผ้า
2. ผ้าม่าน/ม่านผ้า = ให้ระบุ fabric_type จากบริบท เช่น "ผ้าโปร่ง" "ผ้าทึบ" "ผ้ากึ่งทึบ" ถ้าไม่ชัดเจนใส่ว่าง
3. จำนวนชั้นและหัวรางให้ใส่ใน floors และ rail_head ห้ามใส่ใน note
3.1 ผ้าม่านจีบ: เก็บจำนวนจีบ (1จีบ/2จีบ/3จีบ) + ชนิดตะขอ (ตะขอสั้น/ตะขอยาว/ตะขอเพดาน) ลงใน rail_head เช่น "2จีบ ตะขอยาว" ห้ามตัดคำว่า ยาว/สั้น/เพดาน หรือจำนวนจีบทิ้ง
3.2 ผ้าม่านลอน (แบบตะขอ): เก็บชนิดตะขอ (ตะขอสั้น/ตะขอยาว/ตะขอเพดาน) ลงใน rail_head ให้ครบ
3.3 ผ้าม่านลอนเทป: ใช้เทป ไม่มีตะขอให้เลือก ไม่ต้องใส่ชนิดตะขอใน rail_head
4. ถ้ามีหลายขนาดในรายการเดียวกัน ให้แยกเป็นหลาย item
5. (สั่งตัด) ให้ตัดออก ไม่ต้องใส่ใน type
6. 📍 ที่นำหน้ารายการให้ตัดออก ไม่ต้องใส่ที่ไหน
7. จำนวนกระดูม/วงแหวน/ตะขอ รูปแบบ (N+N) หรือ (N) เช่น (16+16) (32) ให้เก็บใน hooks ทั้งวงเล็บ เช่น "(16+16)", "(32)"
8. "ส" ย่อมาจาก "สูง" เช่น ก1.10*ส2.08 = width 1.10, height 2.08
8.1 ขนาดที่เขียนเป็น "a+b" (เช่น 1.69+0.49) = รางต่อโค้ง/เข้ามุม ให้ width = "1.69+0.49" เก็บทั้งสองค่า ห้ามตัด 0.49 ทิ้ง และยังนับเป็น item เดียว
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

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'แปลงข้อมูลไม่สำเร็จ', raw }, { status: 500 })
  }

  try {
    const items = JSON.parse(jsonMatch[0])
    // เติม/แก้ fabric_type จากแคตตาล็อกรหัสผ้า (เฉพาะรายการผ้า ไม่ใช่ราง)
    const normalized = Array.isArray(items)
      ? items.map((it: { type?: string; color_code?: string; fabric_type?: string }) => {
          if (typeof it?.type === 'string' && it.type.startsWith('ราง')) return it
          const ft = fabricTypeFromCode(it?.color_code)
          return ft ? { ...it, fabric_type: ft } : it
        })
      : items
    return NextResponse.json({ items: normalized })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
