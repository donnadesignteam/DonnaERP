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

  const prompt = `แปลงข้อความสั่งซื้อของ (สั่งผ้า/ของจาก supplier) ที่แอดมิน copy มาจากแชทไลน์เป็น JSON object เดียวเท่านั้น ห้ามมี markdown ห้ามมีข้อความอื่น

schema:
{
  "customer_name": "ชื่อลูกค้า/username ที่สั่งของชิ้นนี้ (ถ้ามี) ถ้าไม่มีใส่ null",
  "order_number": "เลขออเดอร์/เลขคำสั่งซื้อที่อ้างถึง ถ้าไม่มีใส่ null",
  "supplier": "ชื่อร้าน/แบรนด์/ผู้ขายที่จะสั่งของ เช่น Richy, ผ้าม่านโชคชัย ถ้าไม่มีใส่ null",
  "items": "รายการของที่สั่ง สรุปเป็นข้อความอ่านง่าย ถ้ามีหลายรายการแยกแต่ละบรรทัด รวมรหัสสี/ลาย/ขนาด/จำนวนที่ระบุ ถ้าไม่มีใส่ null",
  "notes": "หมายเหตุที่ระบุชัดเจน เช่น เร่งด่วน, นัดรับ ถ้าไม่มีใส่ null"
}

กฎ:
- เก็บรหัสสี/ลาย/ขนาด/จำนวน/หน่วย (เมตร/หลา/ม้วน) ไว้ในข้อความ items ตามที่ระบุ
- ถ้าข้อมูลไหนไม่มีในข้อความ ใส่ null ห้ามแต่งเติม

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
    const po = JSON.parse(jsonMatch[0])
    return NextResponse.json({ po })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
