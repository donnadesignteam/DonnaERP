import { NextRequest, NextResponse } from 'next/server'
import { askClaude } from '@/lib/askClaude'

// เผื่อเวลาให้สะพาน Claude ที่เครื่องร้าน (ช้ากว่ายิง API ตรง)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'ไม่มีข้อความ' }, { status: 400 })
  }

  const prompt = `แปลงข้อความนัดงานติดตั้ง/วัดพื้นที่/แก้งาน ที่แอดมิน copy มาจากแชทไลน์เป็น JSON object เดียวเท่านั้น ห้ามมี markdown ห้ามมีข้อความอื่น

schema:
{
  "work_type": "ลักษณะงาน เลือกหนึ่งใน: งานติดตั้ง | งานวัดหน้างาน | งานแก้ ถ้าไม่ชัดเจนใส่ null",
  "platform": "ช่องทางที่ลูกค้าติดต่อมา เช่น Shopee, Tiktok, Lazada, Facebook, LineOA, หน้าร้าน ถ้าไม่มีใส่ null",
  "customer_id": "ชื่อ ID/username ของลูกค้า (ที่ใช้ในแพลตฟอร์ม) ถ้าไม่มีใส่ null",
  "customer_real_name": "ชื่อจริงลูกค้า ถ้าไม่มีใส่ null",
  "province": "จังหวัด ถ้าไม่มีใส่ null",
  "phone": "เบอร์โทรลูกค้า ถ้าไม่มีใส่ null",
  "location_link": "ลิงค์โลเคชั่น/แผนที่ (URL) ถ้าไม่มีใส่ null",
  "appointment_date": "วันที่นัดในรูปแบบ YYYY-MM-DD ถ้าระบุชัดเจน (แปลง พ.ศ.→ค.ศ. โดยลบ 543) ถ้าไม่มีใส่ null",
  "appointment_time": "เวลานัดในรูปแบบ H:MM เช่น 9:00, 14:00 ถ้าไม่มีใส่ null",
  "work_details": "รายละเอียดงานที่ต้องทำ เช่น ติดตั้งม่าน 3 จุด, วัดพื้นที่ห้องนอน ถ้าไม่มีใส่ null",
  "notes": "หมายเหตุ/ข้อมูลที่ตั้งแบบบรรยาย เช่น ชื่อโครงการ ย่าน หมู่บ้าน ('โครงการแถวหัวฝาย เชียงราย'), เร่งด่วน, โทรก่อนไป ถ้าไม่มีใส่ null"
}

กฎ:
- ถ้าข้อมูลไหนไม่มีในข้อความ ใส่ null ห้ามแต่งเติม
- เบอร์โทรเก็บเฉพาะตัวเลข (ใส่ขีดได้)
- appointment_date ต้องเป็น ค.ศ. เท่านั้น ถ้าข้อความเป็น พ.ศ. ให้ลบ 543
- location_link เก็บเฉพาะ URL (เช่น https://maps.app.goo.gl/...) ส่วนข้อความบอกที่ตั้งแบบบรรยาย (ชื่อโครงการ/ย่าน) ให้ไปลงที่ notes ไม่ใช่ location_link

ข้อความ:
${text}`

  let raw: string
  try {
    raw = (await askClaude(prompt, 2048)).text
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'แปลงข้อมูลไม่สำเร็จ', raw }, { status: 500 })
  }

  try {
    const inst = JSON.parse(jsonMatch[0])
    return NextResponse.json({ inst })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
