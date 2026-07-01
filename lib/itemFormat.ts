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
  note?: string
}

// ความกว้างอาจเป็น "1.69+0.49" (รางต่อโค้ง) ต้องเก็บทั้งสองค่าไว้
export const widthText = (w?: number | string): string => {
  const raw = typeof w === 'string' ? w.trim() : ''
  if (raw.includes('+')) return raw
  const n = Number(w)
  return n > 0 ? n.toFixed(2) : ''
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
    const brandParts = [item.color_code || '', colorName, item.color_desc || ''].filter(Boolean)
    if (brandParts.length) out.push({ t: brandParts.join(' ') })
  }

  const h = Number(item.height)
  const wStr = widthText(item.width)
  const hStr = h > 0 ? h.toFixed(2) : ''
  const dim = wStr && hStr ? `ก${wStr}*ส${hStr}` : wStr ? `ก${wStr}` : ''
  // กระดูม/ตะขอ เช่น "(30+30)" — ใส่ต่อท้ายบรรทัดขนาดให้เหมือนใบออเดอร์ต้นฉบับ
  // เผื่อบางเคสเก็บมาไม่มีวงเล็บ (30+30) ให้เติมวงเล็บให้เอง
  const hooksRaw = (item.hooks ?? '').trim()
  const hooksStr = hooksRaw && !hooksRaw.startsWith('(') ? `(${hooksRaw})` : hooksRaw
  const tail = `${item.quantity} ${item.unit || ''}${item.note ? ` (${item.note})` : ''}${hooksStr ? ` ${hooksStr}` : ''}`
  out.push({ t: dim ? `${dim} = ${tail}` : `= ${tail}`, rail: isRail })
  return out
}
