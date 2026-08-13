// ── คำนวณ "ช่างตัดผ้าไปกี่เมตร" จากรายการสินค้าของออเดอร์ ─────────────────────────
// ‼️ สูตรทั้งหมดมาจากชีทของร้าน (user อธิบายเอง 2 ส.ค. 69) — ห้ามเอาสูตรจากเว็บคำนวณราคามาปน
//
// กติกา (ต่อ 1 รายการ):
//   ตาไก่        ผืนละไม่เกิน 2.00 ม. → ความกว้างรวม × 0.6   ·  ผืนเกิน 2.00 ม. → × 1
//   ม่านสอด      ความกว้างรวม × 1
//   ซ่อนหู       ผืนละไม่เกิน 2.00 ม. → × 1                  ·  ผืนเกิน 2.00 ม. → × 1.6
//   คอกระเช้า    ความกว้างรวม × 1.6
//   ม่านจีบ      ความกว้างรวม × 2.2   (ไม่สนว่าผืนกว้างเกิน 2 ม. ไหม)
//   ลอนตะขอ      ความกว้างรวม × 1.6   (ไม่สนความกว้างต่อผืน)
//   ลอนเทป       ความกว้างรวม × 2.5   (ไม่สนความกว้างต่อผืน)
//   ม่านพับ      ไม่คิดตามความกว้าง — จำนวนที่สั่ง × 6 เมตร
//   เบาะ/หมอน/พรม ความกว้างรวม × 0.5
//   งานแก้/งานเคลม  ทุกชนิดคิด × 1 (ทับกติกาข้างบนทั้งหมด)
//   ราง อุปกรณ์ มู่ลี่ ม่านม้วน มุ้ง → ไม่ใช่งานตัดผ้า ไม่นับ
//   ชนิดที่ระบบอ่านไม่ออก → ไม่นับ แต่ขึ้น ⚠️ ให้คนเห็น (ห้ามนับเงียบๆ เป็น 0)
//
// "ความกว้างรวม" = ความกว้างต่อผืน × จำนวน

export type FabricItem = {
  type?: string | null
  width?: number | string | null
  height?: number | string | null
  quantity?: number | string | null
  rail_head?: string | null
  pleat?: string | null       // จำนวนจีบ (แยกช่องจากหัวราง ตั้งแต่ 13 ส.ค. 69)
  hook_type?: string | null   // ชนิดตะขอ (แยกช่องจากจำนวนจีบ)
  note?: string | null
  unit?: string | null
  color_name?: string | null
  color_desc?: string | null
  eyelet_color?: string | null
  chemical?: string | null
}

export type CutLine = {
  i: number             // ลำดับรายการในออเดอร์ (index ใน items)
  type: string
  width: number         // ความกว้างต่อผืน (เมตร)
  qty: number
  rule: string          // ชื่อกติกาที่ใช้ เช่น "ตาไก่ ≤2 ม. ×0.6"
  meters: number        // เมตรที่ได้จากรายการนี้
  warn?: string         // มีปัญหา (อ่านชนิดไม่ออก / ไม่มีขนาด) — ไม่นับเมตร
  skip?: boolean        // ไม่ใช่งานตัดผ้า (ราง/อุปกรณ์) — ไม่ต้องโชว์เป็นปัญหา
}

export type CutCalc = {
  total: number         // เมตรรวมของรายการที่เลือก
  lines: CutLine[]      // ทุกรายการ (รวมที่ไม่นับ) เรียงตาม index เดิม
  warns: string[]       // ข้อความเตือนรวม
}

const MULT = {
  eyeletSmall: 0.6,   // ตาไก่ ผืน ≤ 2 ม.
  eyeletBig: 1,       // ตาไก่ ผืน > 2 ม.
  slide: 1,           // ม่านสอด
  hiddenSmall: 1,     // ซ่อนหู ผืน ≤ 2 ม.
  hiddenBig: 1.6,     // ซ่อนหู ผืน > 2 ม.
  basket: 1.6,        // คอกระเช้า
  pleat: 2.2,         // ม่านจีบ
  hookWave: 1.6,      // ลอนตะขอ
  tapeWave: 2.5,      // ลอนเทป
  cushion: 0.5,       // เบาะ/หมอน/พรม
  repair: 1,          // งานแก้/งานเคลม
} as const

const FOLD_PER_PIECE = 6   // ม่านพับ 1 ผืน/ชุด = 6 เมตร
const BIG_PANEL = 2        // เส้นแบ่ง "ผืนเกิน 2 เมตร"

// อ่านตัวเลขจากค่าที่อาจเป็นสตริง: "1.50" · "1.69+0.49" (รางต่อโค้ง = บวกกัน) · "ซ2.845*ข3.345"
export function num(v: number | string | null | undefined): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  const s = String(v ?? '').trim()
  if (!s) return 0
  const parts = s.match(/\d+(?:\.\d+)?/g)
  if (!parts) return 0
  if (s.includes('+')) return parts.reduce((a, b) => a + parseFloat(b), 0)
  return parseFloat(parts[0])
}

const has = (s: string, ...words: string[]) => words.some(w => s.includes(w))

// ไม่ใช่งานตัดผ้า: ราง อุปกรณ์ มู่ลี่ ม่านม้วน มุ้ง ตัวอย่างผ้า
function isNotFabricWork(t: string): boolean {
  if (has(t, 'มู่ลี่', 'ม่านม้วน', 'มุ้ง')) return true
  if (t.startsWith('ราง') || t.startsWith('หัวราง') || t.startsWith('ขาราง')) return true
  // ชื่อที่ไม่ได้ขึ้นต้นด้วย ผ้า/ม่าน/เบาะ/หมอน/พรม = อุปกรณ์ (พุก ตะขอ ลูกล้อ ตัวต่อ เทป ห่วง สาย ฯลฯ)
  return !/^(ผ้า|ม่าน|เบาะ|หมอน|พรม)/.test(t)
}

type Kind = { rule: string; mult: number } | { rule: string; perPiece: number }

const eyelet = (big: boolean): Kind => big
  ? { rule: 'ตาไก่ ผืน>2 ม. ×1', mult: MULT.eyeletBig }
  : { rule: 'ตาไก่ ผืน≤2 ม. ×0.6', mult: MULT.eyeletSmall }
const hidden = (big: boolean): Kind => big
  ? { rule: 'ซ่อนหู ผืน>2 ม. ×1.6', mult: MULT.hiddenBig }
  : { rule: 'ซ่อนหู ผืน≤2 ม. ×1', mult: MULT.hiddenSmall }

// หาชนิดจาก "ชื่อรายการ" — แหล่งหลัก (แอดมินส่วนใหญ่พิมพ์ชื่อม่านมาครบ)
function styleFromName(s: string, big: boolean): Kind | null {
  if (has(s, 'คอกระเช้า')) return { rule: 'คอกระเช้า ×1.6', mult: MULT.basket }
  if (has(s, 'ซ่อนหู')) return hidden(big)
  if (has(s, 'ตาไก่')) return eyelet(big)
  if (has(s, 'สอด')) return { rule: 'ม่านสอด ×1', mult: MULT.slide }
  if (has(s, 'ลอนเทป')) return { rule: 'ลอนเทป ×2.5', mult: MULT.tapeWave }
  if (has(s, 'จีบ')) return { rule: 'ม่านจีบ ×2.2', mult: MULT.pleat }
  if (has(s, 'ตะขอ')) return { rule: 'ลอนตะขอ ×1.6', mult: MULT.hookWave }
  return null
}

// ตาข่ายกันตกหล่น (user สั่ง 2 ส.ค. 69): ชื่อรายการไม่บอกแบบม่าน เช่น "ผ้าม่านหน้าต่าง"
// → ดูข้อความที่เขียนต่อท้ายชื่อม่าน (สี / เคมี / จีบ-ตะขอ) แทน
//   สีตาไก่ (สีสัก สีดำ สีขาว สีโอ๊ค) = ม่านตาไก่ · ใส่เคมี/ไม่ใส่เคมี = ม่านซ่อนหู
//   1จีบ 2จีบ 3จีบ (จะมีตะขอสั้น/ยาวต่อท้ายก็ได้) = ม่านจีบ · มีแต่ตะขอสั้น/ตะขอยาว = ลอนตะขอ
// ‼️ ห้ามจับคำว่า "ขาว/ดำ" เปล่าๆ — เป็นสีผ้า (ขาวครีม ขาวนวล) ไม่ใช่สีตาไก่
// ช่องสีที่กรอกมาเป็นสีตาไก่ล้วนๆ ("ขาว" "ดำ" "สัก" "โอ๊ค") — เทียบทั้งช่องแบบเป๊ะ
// (เทียบแบบ "มีคำนี้อยู่ในข้อความ" ไม่ได้ เพราะสีผ้าอย่าง ขาวครีม/ขาวนวล/ขาวสว่าง จะโดนไปด้วย)
const EYELET_ONLY = new Set(['ขาว', 'ดำ', 'สัก', 'โอ๊ค', 'โอ็ค', 'เงิน', 'ทอง'])
const isEyeletColorField = (v: string) => {
  const s = v.trim().replace(/^สี/, '')
  return EYELET_ONLY.has(s)
}

function styleFromHint(s: string, big: boolean): Kind | null {
  if (/เคมี/.test(s)) return hidden(big)
  if (/จีบ/.test(s)) return { rule: 'ม่านจีบ ×2.2 (จากคำต่อท้ายชื่อม่าน)', mult: MULT.pleat }
  if (/ตะขอ/.test(s)) return { rule: 'ลอนตะขอ ×1.6 (จากคำต่อท้ายชื่อม่าน)', mult: MULT.hookWave }
  if (/สีสัก|สีดำ|สีขาว|สีโอ๊ค|สีโอ็ค|โอ๊ค|สัก(?!หลาด)/.test(s)) {
    const k = eyelet(big)
    return { ...k, rule: k.rule + ' (จากสีตาไก่ที่ต่อท้ายชื่อม่าน)' } as Kind
  }
  return null
}

function classify(typeRaw: string, fields: string[], eyeletColor: string, panelWidth: number, repair: boolean): Kind | null {
  const t = typeRaw.replace(/\s+/g, '')
  if (has(t, 'เบาะ', 'หมอน', 'พรม')) return { rule: 'เบาะ/หมอน/พรม ×0.5', mult: MULT.cushion }
  if (repair) return { rule: 'งานแก้/เคลม ×1', mult: MULT.repair }
  if (has(t, 'พับ')) return { rule: `ม่านพับ ${FOLD_PER_PIECE} ม./ผืน`, perPiece: FOLD_PER_PIECE }

  const big = panelWidth > BIG_PANEL
  const fromName = styleFromName(t, big)
  if (fromName) return fromName
  if (eyeletColor.trim()) return eyelet(big)      // มีสีตาไก่ในช่องของมันเอง = ม่านตาไก่แน่นอน
  const fromHint = styleFromHint(fields.join(' ').replace(/\s+/g, ''), big)
  if (fromHint) return fromHint
  if (fields.some(isEyeletColorField)) {
    const k = eyelet(big)
    return { ...k, rule: k.rule + ' (จากสีตาไก่ที่ต่อท้ายชื่อม่าน)' } as Kind
  }
  return null
}

// คำนวณรายการเดียว — คืน CutLine เสมอ (skip = ไม่ใช่งานตัดผ้า, warn = อ่านไม่ออก)
export function cutLine(it: FabricItem, i: number, opts?: { isClaim?: boolean }): CutLine {
  const type = String(it.type ?? '').trim()
  const width = num(it.width)
  const qty = Math.max(1, Math.round(num(it.quantity) || 1))
  // ข้อความที่เขียนต่อท้ายชื่อม่านในออเดอร์ (สี/เคมี/จีบ-ตะขอ) — ใช้เดาแบบม่านเมื่อชื่อรายการไม่บอก
  const hint = [it.color_name, it.color_desc, it.note, it.chemical, it.rail_head, it.pleat, it.hook_type].map(v => String(v ?? ''))
  const base: CutLine = { i, type: type || '(ไม่ระบุชนิด)', width, qty, rule: '', meters: 0 }

  if (!type) return { ...base, skip: true, rule: 'ไม่มีชื่อรายการ' }
  if (isNotFabricWork(type.replace(/\s+/g, ''))) return { ...base, skip: true, rule: 'ไม่ใช่งานตัดผ้า' }

  const repair = !!opts?.isClaim || has(type, 'แก้', 'เคลม')
  // ‼️ ไม่มีค่าเริ่มต้น — อ่านชนิดไม่ออกคือขึ้นเตือนให้คนไปแก้ชื่อม่านในออเดอร์ ห้ามเดาให้เป็นแบบใดแบบหนึ่ง (user สั่ง)
  const kind = classify(type, hint, String(it.eyelet_color ?? ''), width, repair)
  if (!kind) return { ...base, warn: 'ไม่รู้ว่าเป็นม่านแบบไหน — ยังไม่นับเมตร', rule: 'ไม่รู้ชนิด' }

  if ('perPiece' in kind) {
    return { ...base, rule: kind.rule, meters: round2(qty * kind.perPiece) }
  }
  if (width <= 0) return { ...base, warn: 'ไม่มีขนาดกว้าง — ยังไม่นับเมตร', rule: kind.rule }
  return { ...base, rule: kind.rule, meters: round2(width * qty * kind.mult) }
}

export const round2 = (n: number) => Math.round(n * 100) / 100

// ผ้าโปร่ง/รายการที่อ่านชนิดไม่ออก ในใบเดียวกับม่านตาไก่ = ตาไก่ตามกัน (user สั่ง 2 ส.ค. 69)
// เคสจริง: "ม่านตาไก่ สีขาว" + บรรทัดถัดมา "โปร่งเรียบ ขาวสว่าง" (ไม่ได้เขียนสีตาไก่ซ้ำ) → ผ้าโปร่งเป็นตาไก่ด้วย
function inheritEyelet(list: FabricItem[], lines: CutLine[]): CutLine[] {
  const hasEyelet = list.some(it =>
    has(String(it.type ?? '').replace(/\s+/g, ''), 'ตาไก่') || String(it.eyelet_color ?? '').trim() !== '')
  if (!hasEyelet) return lines
  return lines.map(l => {
    if (l.skip || l.rule !== 'ไม่รู้ชนิด' || l.width <= 0) return l
    const k = eyelet(l.width > BIG_PANEL) as { rule: string; mult: number }
    return { ...l, rule: k.rule + ' (ยึดตามม่านตาไก่ในใบเดียวกัน)', meters: round2(l.width * l.qty * k.mult), warn: undefined }
  })
}

// คำนวณทั้งออเดอร์ · pick = index ของรายการที่จะนับ (ไม่ส่ง = นับทุกรายการ)
export function cutMeters(items: unknown, opts?: { isClaim?: boolean; pick?: number[] }): CutCalc {
  const list: FabricItem[] = Array.isArray(items) ? (items as FabricItem[]) : []
  const lines = inheritEyelet(list, list.map((it, i) => cutLine(it, i, opts)))
  const picked = opts?.pick
  const counted = picked ? lines.filter(l => picked.includes(l.i)) : lines
  const total = round2(counted.reduce((s, l) => s + l.meters, 0))
  const warns: string[] = []
  if (!list.length) warns.push('ออเดอร์นี้ไม่มีรายการสินค้า — ยังนับเมตรไม่ได้')
  for (const l of counted) if (l.warn) warns.push(`${l.type}: ${l.warn}`)
  return { total, lines, warns }
}

// รายการที่ "ตัดได้" (ไว้ทำช่องติ๊กเลือกตอนช่างช่วยกันตัด)
export const cuttableLines = (c: CutCalc) => c.lines.filter(l => !l.skip)

export const fmtMeters = (n: number) => `${round2(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ม.`
