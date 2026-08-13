import { NextRequest, NextResponse } from 'next/server'
import { fabricTypeFromCode } from '@/lib/fabrics'
import { fillItemDefaults, autoTapeHooks, type RawItem } from '@/lib/itemFormat'
import { askClaude } from '@/lib/askClaude'
import { normalizeThaiDate } from '@/lib/thaiDate'
import { ITEM_SCHEMA, ITEM_RULES } from '@/lib/itemPrompt'

// เผื่อเวลาให้สะพาน Claude ที่เครื่องร้าน (ช้ากว่ายิง API ตรง)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'ไม่มีข้อความ' }, { status: 400 })
  }

  const prompt = `แปลงข้อความออเดอร์ที่แอดมิน copy มาจากแชทไลน์เป็น JSON object เดียวเท่านั้น ห้ามมี markdown ห้ามมีข้อความอื่น

schema:
{
  "customer_name": "ชื่อลูกค้า/username (มักอยู่หลังชื่อ platform เช่น 'Shopee: somchai' → somchai) ถ้าไม่มีใส่ null",
  "platform": "ช่องทาง เลือกที่ตรงที่สุด: Shopee | Tiktok | Lazada | Facebook | LineOA | หน้าร้าน | Lineส่วนตัวยุน | Lineส่วนตัวสู้ | Lineส่วนตัวเฟิร์น | Lineส่วนตัวน็อต (ถ้าไม่มีใส่ null)",
  "order_number": "เลขออเดอร์ (Shopee 14 ตัวอักษรผสมเลข / Tiktok 18-19 หลัก / Lazada 16 หลัก ถ้าไม่มีใส่ null)",
  "deadline": "กำหนดส่งงาน รูปแบบ YYYY-MM-DD ถ้าระบุชัด ไม่งั้น null",
  "price": ยอดเงินสุดท้ายที่ลูกค้าต้องจ่าย เป็นตัวเลข (มักอยู่หลังเครื่องหมาย = เช่น "=1965บาท" → 1965 ซึ่งรวมค่าส่งแล้ว ถ้ามีแค่ราคาเดียวใช้ราคานั้น) ถ้าไม่มีใส่ null,
  "payment_status": "สถานะชำระ เลือก 1 ใน: ยังไม่ชำระ | มัดจำ | มัดจำ50% | ชำระครบ — ถ้าเห็นคำว่า 'ชำระครบ'/'จ่ายแล้ว'/'โอนแล้ว'/'จ่ายครบ' = ชำระครบ, 'มัดจำ50%' = มัดจำ50%, 'มัดจำ' = มัดจำ, ถ้าไม่ระบุใส่ null",
  "address": "ที่อยู่จัดส่งเต็มๆ บรรทัดเดียว (มักอยู่ท้ายข้อความหลังคำว่า 'ส่ง'/'ที่อยู่') — ‼️ ขึ้นต้นด้วยชื่อ-นามสกุลผู้รับตามต้นฉบับ แล้วตามด้วยที่อยู่ เช่น 'ธัญธิดา กีรัตยาธนฉัตร 88/196 หมู่3 ... จังหวัดเชียงใหม่ 50220' · เก็บบ้านเลขที่ หมู่ ซอย หมู่บ้าน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์ ให้ครบ ห้ามตัดทิ้ง · เบอร์โทรไม่ต้องใส่ (มีช่องของมันแล้ว) ถ้าไม่มีใส่ null",
  "phone": "เบอร์โทรผู้รับ เฉพาะตัวเลข เช่น 0934599966 ถ้าไม่มีใส่ null",
  "notes": "หมายเหตุที่ลูกค้าระบุชัดเจน ถ้าไม่มีใส่ null",
  "courier": "บริษัทจัดส่ง — มักเป็นบรรทัดท้ายสุดของออเดอร์แพลตฟอร์ม ต้องตอบเป็น 1 ใน 6 คำนี้เท่านั้น (คัดลอกมาทั้งบรรทัดตามที่เขียนไว้): 'J&T Express' | 'LEX TH' | 'Standard Delivery - ส่งธรรมดาในประเทศ-SPX Express' | 'Standard Delivery - ส่งธรรมดาในประเทศ-Flash Express' | 'Standard Delivery - ส่งธรรมดาในประเทศ' | 'Standard Delivery Bulky - ส่งสินค้าขนาดใหญ่-Flash Express Bulky' — ถ้าไม่มีบรรทัดขนส่งหรือเขียนเป็นชื่ออื่นใส่ null",
  "items": [ array ของรายการสินค้า schema ด้านล่าง ถ้าไม่มีใส่ [] ]
}

schema ของแต่ละ item:
${ITEM_SCHEMA}

กฎ:
${ITEM_RULES}
- ถ้าข้อมูลไหนไม่มีในข้อความ ใส่ null (หรือ "" ใน item, [] สำหรับ items) ห้ามแต่งเติม

‼️ ถ้าข้อความเป็น "ใบเสนอราคา" (มีคำว่า ใบเสนอราคา / เลขที่ QT...) ให้อ่านแบบนี้แทน:
- customer_name = ชื่อลูกค้าใต้หัวข้อ "ลูกค้า" (ตัดคำนำหน้า คุณ/นาย/นาง ออก) · ถ้าบรรทัด "ชื่องาน" บอกช่องทางไว้ เช่น "ลูกค้า facebook: Athitaya JN" → platform="Facebook"
- address = ที่อยู่ใต้ชื่อลูกค้า ขึ้นต้นด้วยชื่อ-นามสกุลลูกค้า · phone = เบอร์ของลูกค้า (ถ้ามี)
  ‼️ ที่อยู่/เบอร์/เลขผู้เสียภาษี ของ "บริษัท ดอนน่า ดีไซน์ จำกัด" (เชียงราย โทร.0903199861) = ที่อยู่ร้านเอง ห้ามเอามาเป็นของลูกค้าเด็ดขาด
- price = "จำนวนเงินรวมทั้งสิ้น" (ยอดสุดท้าย) · order_number = null (เลข QT ไม่ใช่เลขคำสั่งซื้อ ให้ใส่ไว้ใน notes แทน เช่น "ใบเสนอราคา QT2026080022")
- payment_status: มีเงื่อนไข "ชำระงวดที่ 1 จำนวน 50%" = ยังไม่ชำระ (เป็นแค่เงื่อนไข ไม่ใช่ว่าจ่ายแล้ว)
- แต่ละแถวเป็น "จุดติดตั้ง" เช่น ห้องครัว, โถงหน้าบ้าน, ห้องนอน 2 เก็บซ้าย → ชื่อจุดใส่ note ของทุก item ในแถวนั้น (ห้ามทำเป็น item)
- บรรทัด "รวม X บาท" ท้ายแถว และตัวเลขคอลัมน์ขวา (จำนวน/ราคาต่อหน่วย/ยอดรวม) = ยอดเงิน ไม่ใช่รายการสินค้า ข้ามไป
- ขนาดเขียนแบบ "1.72*3.245 = 2 ผืน" → width=1.72 height=3.245 quantity=2 unit="ผืน" · ราง "3.43 = 1 ชุด" → width=3.43 height=0 quantity=1 unit="ชุด"
- คำเรียกในใบเสนอราคา → คำมาตรฐาน: "รางsnake" = รางลอนเทป (เลข 1ชั้น/2ชั้น ต่อท้ายลง floors, "สีขาว" ลง rail_color)
  · "ม่านลอนเทป" = ม่านลอนเทป · "ผ้าโปร่งลอนเทป" = ม่านลอนเทป + fabric_type="ผ้าโปร่ง" · "มู่ลี่ไม้" คงชื่อเดิม
  · "Blackout" = ชนิดผ้า ให้ลง fabric_type="Blackout" (ไม่ใช่ชื่อสี) · "(ต่อผ้า)" ลง orientation
- รหัสสีในใบเสนอราคาอยู่บรรทัดของมันเอง (ใต้ชื่อสินค้า) เช่น "SHB98 Oatmeal" → color_code="SHB98" color_name="Oatmeal"
  ‼️ ทุกรายการที่มีบรรทัดรหัสต้องเก็บ color_code เสมอ รวมมู่ลี่/ม่านม้วน เช่น "มู่ลี่ไม้ / PDPS-F022 / 1.70*1.30 = 1 ชุด" → {"type":"มู่ลี่ไม้","color_code":"PDPS-F022",...} · "ผ้าโปร่งลอนเทป / AF19-23" → color_code="AF19-23" ห้ามทิ้ง
- ลด output ของ item: ฟิลด์ต่อไปนี้ถ้าค่าว่าง/null ให้ตัดทิ้ง ไม่ต้องใส่ใน JSON (ระบบเติมให้เอง) — floors, rail_head, eyelet_color, fabric_type, color_code, color_name, color_desc, hooks, orientation, fabric_split, chemical, weight_chain, pull_side, note — ใส่เฉพาะฟิลด์ที่มีค่าจริง · แต่ type, width, height, quantity, unit ต้องใส่ครบทุก item เสมอ (ฟิลด์ระดับออเดอร์ยังใส่ null ตามเดิม)

ข้อความ:
${text}`

  let raw: string
  let stopReason: string | undefined
  try {
    const r = await askClaude(prompt, 8192)
    raw = r.text
    stopReason = r.stopReason
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  if (stopReason === 'max_tokens') {
    return NextResponse.json({ error: 'ออเดอร์ยาวเกินไป คำตอบถูกตัดกลางคัน ลองแบ่งเป็นหลายรอบ', raw }, { status: 500 })
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'แปลงข้อมูลไม่สำเร็จ', raw }, { status: 500 })
  }

  try {
    const order = JSON.parse(jsonMatch[0])
    // ปีที่แปลงมาอาจเป็น พ.ศ. หรือโดนบวก 543 ซ้ำจนไปปี 3000 กว่า — แก้ให้เป็น ค.ศ. ปีที่เป็นไปได้ ถ้าเพี้ยนเกินไปทิ้งเป็นค่าว่าง
    if (order.deadline != null) order.deadline = normalizeThaiDate(order.deadline)
    // เติม/แก้ fabric_type ให้ถูกต้องจากแคตตาล็อกรหัสผ้า (แม่นกว่าให้ AI เดา)
    // เฉพาะรายการผ้า (ไม่ใช่ราง) ที่มีรหัสสีตรงกับแคตตาล็อก
    if (Array.isArray(order.items)) {
      order.items = order.items.map((raw: RawItem) => {
        const it = fillItemDefaults(raw)
        // ม่านลอนเทป/รางม่านลอนเทป ที่ไม่ได้ลงจำนวนกระดูม → คำนวณจากความกว้างให้เลย
        if (!it.hooks) { const h = autoTapeHooks(it); if (h) it.hooks = h }
        if (typeof it.type === 'string' && it.type.startsWith('ราง')) return it
        const ft = fabricTypeFromCode(it.color_code)
        return ft ? { ...it, fabric_type: ft } : it
      })
    }
    return NextResponse.json({ order })
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง', raw }, { status: 500 })
  }
}
