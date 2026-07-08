// Formatter รายการสินค้าแบบหลายบรรทัด ใช้ร่วมกันระหว่าง
// ใบออเดอร์ (คัดลอก/ปริ้น) และหน้าโฟลเดอร์ลูกค้า — เพื่อให้แสดงตรงกันเสมอ

export type RawItem = {
  type?: string
  floors?: number | null
  rail_head?: string
  eyelet_color?: string   // สีห่วงตาไก่ (เฉพาะม่านตาไก่) เช่น สีขาว สีสัก สีดำ
  fabric_type?: string
  color_code?: string
  color_name?: string
  color_desc?: string
  width?: number | string
  height?: number | string
  quantity?: number | string
  unit?: string
  hooks?: string          // จำนวนกระดูม/ตะขอ เช่น "(30+30)", "(16)"
  orientation?: string    // การวางผ้า เช่น "ขวางผ้า" — โชว์ต่อท้ายบรรทัดสีตามใบออเดอร์ต้นฉบับ
  fabric_split?: string   // แบ่งผ้า (ม่านผ้าทั่วไป): แยกกลาง / สไลด์เดี่ยว
  chemical?: string       // เคมี (เฉพาะม่านซ่อนหู): ใส่เคมี / ไม่ใส่เคมี
  weight_chain?: string   // โซ่ถ่วง: ว่าง = ไม่ได้ระบุ / ใส่โซ่ถ่วง / ไม่รับโซ่ถ่วง
  pull_side?: string      // ฝั่งดึง (ม่านพับ/มู่ลี่): ดึงซ้าย / ดึงขวา
  note?: string
  outsource?: string      // สั่งนอกของรายการนี้ — ตอนบันทึกจะรวมไปลงคอลัมน์สั่งนอกของออเดอร์
}

// ทศนิยมตามที่ลูกค้าลงมา: ปกติ 2 ตำแหน่ง แต่ถ้าลงมา 3 ตำแหน่ง (เช่น 2.845) เก็บ 3 ตำแหน่งเลย
const sizeFixed = (v: number | string | undefined, n: number): string => {
  const dec = (String(v ?? '').trim().split('.')[1] || '').length
  return n.toFixed(dec >= 3 ? 3 : 2)
}

// ความกว้างอาจเป็น "1.69+0.49" (รางต่อโค้ง) ต้องเก็บทั้งสองค่าไว้
export const widthText = (w?: number | string): string => {
  const raw = typeof w === 'string' ? w.trim() : ''
  if (raw.includes('+')) return raw
  const n = Number(w)
  return n > 0 ? sizeFixed(w, n) : ''
}

// ความสูงอาจเป็น "ซ2.845*ข3.345" (หน้าต่างสูงซ้าย-ขวาไม่เท่า) ต้องเก็บทั้งสองค่าไว้
export const heightText = (h?: number | string): string => {
  const raw = typeof h === 'string' ? h.trim() : ''
  if (raw && /[^\d.]/.test(raw)) return raw
  const n = Number(h)
  return n > 0 ? sizeFixed(h, n) : ''
}

// สรุปรายการแบบสั้น 1 บรรทัด/ชิ้น — ใช้ในคอลัมน์ "รายการ" ของตาราง (หมวดออเดอร์ + ปฏิทินงานติดตั้ง)
export function formatItemLines(items: RawItem[] | null): string[] {
  if (!items || items.length === 0) return []
  return items.map(it => {
    const parts: string[] = []
    if (it.type) parts.push(it.type)
    if (it.eyelet_color) parts.push(it.eyelet_color)
    if (it.floors) parts.push(`${it.floors}ชั้น`)
    if (it.rail_head) parts.push(it.rail_head)
    if (it.fabric_type) parts.push(it.fabric_type)
    if (it.color_code) parts.push(it.color_code)
    if (it.color_name) parts.push(it.color_name)
    if (it.color_desc) parts.push(it.color_desc)
    if (it.orientation) parts.push(it.orientation.startsWith('(') ? it.orientation : `(${it.orientation})`)
    const wTxt = widthText(it.width), hTxt = heightText(it.height)
    if (wTxt && hTxt) parts.push(`${wTxt}×${hTxt}`)
    else if (wTxt) parts.push(wTxt)
    if (it.quantity) parts.push(`×${it.quantity}${it.unit || ''}`)
    return parts.join(' ')
  })
}

// ตารางกระดุมเทปลอน [ขั้นต่ำของช่วง, จำนวนต่อฝั่ง/ต่อชุด] — ถอดจากเว็บอุปกรณ์ราง (donna-rail calc.js ROLLER_SINGLE/ROLLER_CENTER)
// แยกกลาง = n+n (รวมหัวรางซ้าย 1 - ขวา 1), สไลด์เดี่ยว = n (รวมหัวราง 1)
const TAPE_CENTER: [number, number][] = [[0.50, 6], [0.63, 8], [0.91, 10], [1.19, 12], [1.47, 14], [1.75, 16], [2.03, 18], [2.24, 20], [2.52, 22], [2.80, 24], [3.08, 26], [3.33, 28], [3.59, 30], [3.87, 32], [4.15, 34], [4.43, 36], [4.71, 38], [4.99, 40], [5.27, 42], [5.55, 44], [5.83, 46], [6.10, 48], [6.38, 50], [6.65, 52]]
const TAPE_SINGLE: [number, number][] = [[0.50, 10], [0.55, 12], [0.65, 14], [0.75, 16], [0.95, 18], [1.05, 20], [1.25, 22], [1.35, 24], [1.45, 26], [1.65, 28], [1.75, 30], [1.95, 32], [2.05, 34], [2.15, 36], [2.35, 38], [2.45, 40], [2.65, 42], [2.75, 44], [2.85, 46], [3.05, 48], [3.15, 50], [3.25, 52], [3.45, 54], [3.55, 56], [3.65, 58], [3.85, 60], [3.95, 62], [4.05, 64], [4.15, 66], [4.35, 68], [4.45, 70], [4.55, 72], [4.75, 74], [4.85, 76], [4.95, 78], [5.05, 80], [5.25, 82], [5.35, 84], [5.55, 86], [5.65, 88], [5.75, 90], [6.10, 92], [6.21, 94]]

// XLOOKUP โหมด -1: แถวสุดท้ายที่ค่าในตาราง ≤ ขนาด
const lookupDown = (rows: [number, number][], key: number): number | null => {
  let hit: number | null = null
  for (const r of rows) { if (r[0] <= key + 1e-9) hit = r[1]; else break }
  return hit
}

// ม่านลอนเทปที่ไม่ได้ลงจำนวนกระดูม → คำนวณจากความกว้าง+แบ่งผ้าให้เอง เช่น ก1.00 แยกกลาง=(10+10), สไลด์เดี่ยว=(18)
// เกินช่วงตาราง (แยกกลาง 6.93 / เดี่ยว 6.32) ไม่เดา — เว้นว่างเหมือนเดิม
export function autoTapeHooks(item: RawItem): string {
  const type = (item.type ?? '').trim()
  if (!type.includes('ลอนเทป') || type.startsWith('ราง')) return ''
  const w = String(item.width ?? '').trim()
  // รางต่อโค้ง "1.69+0.49" คิดจากผลรวม (แนวเดียวกับเว็บอุปกรณ์ราง)
  const size = w.includes('+')
    ? w.split('+').map(Number).filter(n => n > 0).reduce((a, b) => a + b, 0)
    : Number(w)
  if (!(size > 0)) return ''
  const single = /สไลด์|เดี่ยว/.test(`${item.fabric_split || ''} ${item.note || ''}`)
  if (single) {
    if (size > 6.32) return ''
    const n = lookupDown(TAPE_SINGLE, Math.max(0.5, size))
    return n != null ? `(${n})` : ''
  }
  if (size > 6.93) return ''
  const n = lookupDown(TAPE_CENTER, Math.max(0.5, size))
  return n != null ? `(${n}+${n})` : ''
}

// คืนบรรทัดของรายการ 1 ชิ้น (พร้อมธง rail = บรรทัดของราง ไว้ทำสีแดง)
export function itemBlockLines(item: RawItem): { t: string; rail?: boolean }[] {
  const out: { t: string; rail?: boolean }[] = []
  const isRail = (item.type ?? '').startsWith('ราง')

  if (isRail) {
    const typeParts = [item.type, item.floors ? `${item.floors}ชั้น` : '', item.rail_head || '', item.color_name || ''].filter(Boolean)
    out.push({ t: typeParts.join(' '), rail: true })
  } else {
    const ft = (item.fabric_type ?? '').trim()
    const isSheer = ft.includes('โปร่ง')   // ผ้าโปร่ง

    // ชนิดม่าน: ถ้าเป็นผ้าโปร่ง แทรกคำว่า "โปร่ง" เข้าไปในชื่อชนิด (เลี่ยงซ้ำ)
    let typeName = item.type ?? ''
    if (isSheer && typeName && !typeName.includes('โปร่ง')) {
      typeName = typeName.startsWith('ผ้า')
        ? 'ผ้าโปร่ง' + typeName.slice('ผ้า'.length)   // ผ้าม่านตาไก่ → ผ้าโปร่งม่านตาไก่
        : 'โปร่ง' + typeName                            // ม่านตาไก่ → โปร่งม่านตาไก่
    }
    // สีตาไก่เขียนต่อหลังชื่อชนิด (เช่น "ผ้าม่านตาไก่ สีขาว")
    const typeParts = [typeName, item.eyelet_color || '', item.floors ? `${item.floors}ชั้น` : '', item.rail_head || ''].filter(Boolean)
    out.push({ t: typeParts.join(' ') })

    // บรรทัดยี่ห้อ/สี — ไม่แสดงชนิดผ้า (Dimout/ผ้าทึบ ฯลฯ) เพราะช่างรู้จากรหัสสีอยู่แล้ว
    // กรณีผ้าโปร่งย้ายคำว่า "โปร่ง" ไปไว้ในชื่อชนิดแล้ว จึงตัดออกจากชื่อสีด้วย
    const colorName = isSheer
      ? (item.color_name ?? '').replace(/^โปร่ง\s*/, '')   // โปร่งเรียบขาวนวล → เรียบขาวนวล
      : (item.color_name ?? '')
    // การวางผ้า (ขวางผ้า) ต่อท้ายบรรทัดสี ให้ตรงตำแหน่งกับใบออเดอร์ต้นฉบับ — เติมวงเล็บให้ถ้าเก็บมาไม่มี
    const oriRaw = (item.orientation ?? '').trim()
    const oriStr = oriRaw && !oriRaw.startsWith('(') ? `(${oriRaw})` : oriRaw
    const brandParts = [item.color_code || '', colorName, item.color_desc || '', oriStr].filter(Boolean)
    if (brandParts.length) out.push({ t: brandParts.join(' ') })
  }

  const wStr = widthText(item.width)
  const hStr = heightText(item.height)
  // สูงแบบ "ซ2.845*ข3.345" มี label ซ้าย/ขวาในตัวแล้ว ไม่ต้องเติม "ส" นำหน้า
  const dim = wStr && hStr ? (/^[\d.]+$/.test(hStr) ? `ก${wStr}*ส${hStr}` : `ก${wStr}*${hStr}`) : wStr ? `ก${wStr}` : ''
  // กระดูม/ตะขอ เช่น "(30+30)" — ใส่ต่อท้ายบรรทัดขนาดให้เหมือนใบออเดอร์ต้นฉบับ
  // เผื่อบางเคสเก็บมาไม่มีวงเล็บ (30+30) ให้เติมวงเล็บให้เอง
  const hooksRaw = (item.hooks ?? '').trim()
  const hooksStr = (hooksRaw && !hooksRaw.startsWith('(') ? `(${hooksRaw})` : hooksRaw) || autoTapeHooks(item)
  // หมวดพิเศษต่อท้ายบรรทัดขนาด: แบ่งผ้า / เคมี / โซ่ถ่วง / ฝั่งดึง เช่น "(ดึงขวา)" "(แยกกลาง)"
  const pullRaw = (item.pull_side ?? '').trim()
  const extras = [
    (item.fabric_split ?? '').trim(),
    (item.chemical ?? '').trim(),
    (item.weight_chain ?? '').trim(),
    pullRaw ? (pullRaw.startsWith('ดึง') ? pullRaw : `ดึง${pullRaw}`) : '',
  ].filter(Boolean).map(v => `(${v})`).join(' ')
  const tail = `${item.quantity} ${item.unit || ''}${extras ? ` ${extras}` : ''}${item.note ? ` (${item.note})` : ''}${hooksStr ? ` ${hooksStr}` : ''}`
  out.push({ t: dim ? `${dim} = ${tail}` : `= ${tail}`, rail: isRail })
  return out
}
