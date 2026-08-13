import { NextRequest, NextResponse } from 'next/server'
import { fabricTypeFromCode } from '@/lib/fabrics'
import { fillItemDefaults, autoTapeHooks, type RawItem } from '@/lib/itemFormat'
import { askClaude } from '@/lib/askClaude'
import { ITEM_SCHEMA, ITEM_RULES } from '@/lib/itemPrompt'

// เผื่อเวลาให้สะพาน Claude ที่เครื่องร้าน (ช้ากว่ายิง API ตรง)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'ไม่มีข้อความ' }, { status: 400 })
  }

  // ‼️ กติกาแปลงรายการใช้ชุดเดียวกับตอนวางข้อความไลน์ทั้งก้อน (parse-order) — แก้ที่ lib/itemPrompt.ts ที่เดียว
  const prompt = `แปลงรายการสินค้าต่อไปนี้เป็น JSON array เท่านั้น ห้ามมี markdown

schema แต่ละ item:
${ITEM_SCHEMA}

กฎ:
${ITEM_RULES}
- ข้อความที่วางมาอาจติดบรรทัดหัวออเดอร์มาด้วย (ชื่อร้าน/ช่องทาง เช่น shopee:, เลขออเดอร์, ที่อยู่, เบอร์โทร, วันส่ง เช่น "ส่งก่อน 19/8/2026", ชื่อบริษัทขนส่ง) — บรรทัดพวกนี้ไม่ใช่สินค้า ให้ข้ามไป แล้วแปลงเฉพาะรายการสินค้า ห้ามทำเป็น item

รายการ:
${text}`

  let raw: string
  try {
    raw = (await askClaude(prompt, 8192)).text
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'แปลงข้อมูลไม่สำเร็จ', raw }, { status: 500 })
  }

  try {
    const items = JSON.parse(jsonMatch[0])
    // เติมฟิลด์เสริมที่ AI ตัดทิ้งกลับให้ครบ แล้วเติม/แก้ fabric_type จากแคตตาล็อกรหัสผ้า (เฉพาะรายการผ้า ไม่ใช่ราง)
    const normalized = Array.isArray(items)
      ? items.map((raw: RawItem) => {
          const it = fillItemDefaults(raw)
          // ม่านลอนเทป/รางม่านลอนเทป ที่ไม่ได้ลงจำนวนกระดูม → คำนวณจากความกว้างให้เลย (โชว์ในตารางแปลง)
          if (!it.hooks) { const h = autoTapeHooks(it); if (h) it.hooks = h }
          if (typeof it.type === 'string' && it.type.startsWith('ราง')) return it
          const ft = fabricTypeFromCode(it.color_code)
          return ft ? { ...it, fabric_type: ft } : it
        })
      : items
    return NextResponse.json({ items: normalized })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
