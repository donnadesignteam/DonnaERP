// ข้อความขอ "ตัวอย่างผ้า" — แยกเองด้วยกติกาตายตัว ไม่ส่งให้ AI (AI แปลงข้อความแบบนี้ไม่ออก)
//   ตัวอย่างผ้า
//   M21 S010 S581 D14  อย่างละ  สี
// → รายการละ 1 รหัส: ประเภท "ตัวอย่างผ้า" + รหัสสี (ชื่อสี/ประเภทผ้าเติมจากแคตตาล็อก) 1 ชิ้น ไม่มีขนาด
import { applyFabricCatalog } from '@/lib/fabrics'
import { fillItemDefaults, type RawItem } from '@/lib/itemFormat'

const KEYWORD = /ตัวอย่าง\s*ผ้า/
// รหัสผ้า = ตัวอังกฤษ 1-3 ตัว + ตัวเลข (M21 / S010 / HB26 / D-14)
const CODE = /(?<![A-Za-z0-9])[A-Za-z]{1,3}-?\d{1,4}[A-Za-z]?(?![A-Za-z0-9])/g

export type FabricSample = {
  items: RawItem[]
  rest: string   // ข้อความส่วนที่เหลือ (ชื่อ/ที่อยู่/เบอร์) — ว่าง = ไม่ต้องส่ง AI เลย
}

export function parseFabricSample(text: string): FabricSample | null {
  const lines = String(text ?? '').split(/\r?\n/)
  const at = lines.findIndex(l => KEYWORD.test(l))
  if (at < 0) return null
  const codes: string[] = []
  const used = new Set<number>([at])
  // รหัสบนบรรทัดเดียวกับคำว่าตัวอย่างผ้า + บรรทัดถัดๆ ไปจนเจอบรรทัดที่ไม่มีรหัส (ข้ามบรรทัดว่าง)
  const take = (i: number) => (lines[i].replace(KEYWORD, ' ').match(CODE) ?? []).map(c => c.replace('-', '').toUpperCase())
  codes.push(...take(at))
  for (let i = at + 1; i < lines.length; i++) {
    if (!lines[i].trim()) { if (codes.length) break; used.add(i); continue }
    const found = take(i)
    if (!found.length) break
    codes.push(...found)
    used.add(i)
  }
  const uniq = [...new Set(codes)]
  if (!uniq.length) return null
  const items = uniq.map(code => applyFabricCatalog(fillItemDefaults({
    type: 'ตัวอย่างผ้า', color_code: code, width: '', height: '', quantity: 1, unit: 'ชิ้น',
  })))
  const rest = lines.filter((_, i) => !used.has(i)).join('\n').trim()
  return { items, rest }
}
