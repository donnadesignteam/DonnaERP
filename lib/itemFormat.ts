// Formatter รายการสินค้าแบบหลายบรรทัด ใช้ร่วมกันระหว่าง
// ใบออเดอร์ (คัดลอก/ปริ้น) และหน้าโฟลเดอร์ลูกค้า — เพื่อให้แสดงตรงกันเสมอ

export type RawItem = {
  type?: string
  supply?: string         // แบบ: สั่งตัด (ต้องเข้าผลิต) / พร้อมส่ง (ของสำเร็จ แพ็คส่งได้เลย) — ไม่ระบุ = สั่งตัด
  floors?: number | null
  rail_head?: string      // หัวราง (ของรางตาไก่): หัวกระดุม / หัวกลมจุก / หัวกลมเรียบ
  pleat?: string          // จีบ (ของม่านจีบ): 1จีบ / 2จีบ / 3จีบ — แยกช่องจากหัวราง
  rail_color?: string     // สีราง: ลายไม้ / สัก / โอ๊ค / ขาว / ดำ
  opacity?: string        // ความทึบ (ม่านม้วน): 3% / 1% / Blackout
  model?: string          // รุ่น: มุ้งจีบ Luxury,P-net · มุ้งนิรภัย ปกติ,RG · มู่ลี่อลูมิเนียม STE,KACEE
  slat_size?: string      // ขนาดใบ (มู่ลี่): 16mm / 25mm / 35mm / 50mm
  hook_type?: string      // ชนิดตะขอ (ตะขอสั้น/ตะขอยาว/ตะขอเพดาน) — แยกช่องจากจำนวนจีบ
  eyelet_color?: string   // สีห่วงตาไก่ (เฉพาะม่านตาไก่): สีขาว สีดำ สีโอ๊ค สีสัก สีเงิน
  fabric_type?: string    // Dimout / Blackout / ลินิน / ผ้าโปร่ง (ต่อท้ายได้ เช่น "Blackout เนื้อแมทกึ่งเงา")
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

// ===== คำมาตรฐานของชื่อชนิด (type) =====
// AI แปลงข้อความเขียนชื่อชนิดได้หลายแบบ (รางตาไก่ / รางม่านตาไก่ / รางม่านตาไก่ 2 ชั้น)
// ทำให้ระบบที่เทียบชื่อแบบเป๊ะ (เช่น ปุ่มคำนวณอุปกรณ์ราง) หลุดไปใช้ค่า fallback ผิดชนิด
// → กวาดให้เหลือคำเดียวกันเสมอ ตั้งแต่ตอนแปลง โดยดูจาก "คำในชื่อ" ไม่ใช่ทั้งสตริง
// ชนิดที่อ่านแบบม่านไม่ออก (ผ้าม่านหน้าต่าง, ม่านพับ, มู่ลี่ไม้) ไม่แตะ — เก็บชื่อต้นฉบับตามเดิม

// [คำที่ต้องเจอในชื่อ, ชื่อแบบม่าน] เรียงจากเฉพาะเจาะจงไปกว้าง (ลอนเทปต้องมาก่อนลอนตะขอ/จีบ)
const STYLE_WORDS: [RegExp, string][] = [
  [/ตาไก่/, 'ตาไก่'],
  [/ซ่อนหู/, 'ซ่อนหู'],
  [/คอกระเช้า/, 'คอกระเช้า'],
  [/ไข่?\s*ปลา|ลอนโซ่/, 'ลอนโซ่'],   // ต้นฉบับพิมพ์ "ไขปลา" (ไม่มีไม้เอก) / "ไข่ ปลา" ก็นับ
  [/ลอนเทป|snake/i, 'ลอนเทป'],       // ใบเสนอราคาเรียก "รางsnake"
  [/ลอน.*ตะขอ|ลอนตะขอ/, 'ลอนตะขอ'],
  [/จีบ/, 'จีบ'],
  [/สอด/, 'สอด'],
]

// ชนิดที่ไม่ได้แยกตามแบบหัวม่าน — กวาดให้เหลือคำมาตรฐานคำเดียว (ตัดคำต่อท้ายที่ก็อบมาจากหน้าสินค้า
// เช่น "ม่านพับมินิมอล" → "ม่านพับ" · "มู่ลี่อลูมิเนียม ใบ25mm" → "มู่ลี่อลูมิเนียม" ขนาดใบไปช่องของมัน)
const FIXED_TYPES: [RegExp, string][] = [
  [/มู่ลี่.*(ไม้|wood)/i, 'มู่ลี่ไม้'],
  [/มู่ลี่.*(อลูม|อะลูม|alu)/i, 'มู่ลี่อลูมิเนียม'],
  [/มู่ลี่/, 'มู่ลี่ไม้'],
  [/มุ้ง.*(รังผึ้ง|รังผึ่ง|รังฝึ้ง)/, 'มุ้งรังผึ้ง'],
  [/มุ้ง.*นิรภัย|มุ้งกันขโมย/, 'มุ้งนิรภัย'],
  [/มุ้ง/, 'มุ้งจีบ'],
  [/ม่านพับ/, 'ม่านพับ'],
  [/ม่านม้วน/, 'ม่านม้วน'],
  // "บังราง" ต้องเป็นชื่อรายการเอง — ถ้าเป็นคำต่อท้ายม่าน ("ม่านลอนตะขอสั้นบังราง") = ชนิดตะขอ ไม่ใช่กล่องบังราง
  [/^(กล่อง)?บังราง/, 'กล่องบังราง'],
]

// รางที่ไม่ได้แยกตามแบบหัวม่าน
const FIXED_RAILS: [RegExp, string][] = [
  [/ยึด.*(ไม่|ไม่ต้อง).*เจาะ|ไม่ต้องเจาะ|ไม่เจาะ/, 'รางยึดไม่เจาะ'],
  [/โรงพยาบาล|รพ\./, 'รางโรงพยาบาล'],
]

// ‼️ ชนิดรางมีแค่ 4 แบบตามแบบหัวม่าน (+ รางยึดไม่เจาะ / รางโรงพยาบาล ด้านบน) — ร้านไม่มี "รางลอนตะขอ"
// ม่านลอนตะขอใช้รางลอนโซ่ · ต้นฉบับมักเขียนรวมกันว่า "รางลอนตะขอโซ่ไข่ปลา" → ต้องอ่านเป็นรางลอนโซ่
// (เรียงจากเฉพาะเจาะจงไปกว้าง: โซ่/ไข่ปลา ต้องมาก่อนลอนตะขอเสมอ)
const RAIL_STYLES: [RegExp, string][] = [
  [/ตาไก่/, 'ตาไก่'],
  [/ไข่?\s*ปลา|ลอนโซ่|โซ่/, 'ลอนโซ่'],
  [/ลอนเทป|snake/i, 'ลอนเทป'],
  [/จีบ/, 'จีบ'],
]

// อุปกรณ์เสริมที่เขียนกันหลายแบบ → คำเดียว
const FIXED_PARTS: [RegExp, string][] = [
  [/พุก|สกรู|สครู|น๊อต|น็อต/, 'พุก สกรู'],   // จุดยึดต่อท้ายเติมทีหลัง (ผนัง/ฝ้า/เพดาน)
  [/ลูกล้อ|ลูกค้อ/, 'ลูกล้อ'],
  [/(ตัว|)สไลด์/, 'ตัวสไลด์'],
  [/(หัว|ตัว|ฝา)ปิด(หัว|)ราง/, 'หัวปิดราง'],
  [/(ลวด|สาย)สลิง/, 'ลวดสลิง'],
]

export function normalizeItemType(type: string): string {
  const t = String(type ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return t
  if (/ตัวอย่าง/.test(t)) return t            // ขอตัวอย่างผ้า — ไม่ใช่สินค้า เก็บข้อความเดิม
  // อุปกรณ์เสริมเช็กก่อน แต่เฉพาะชื่อที่ไม่ได้ขึ้นต้นด้วยตัวสินค้าหลัก
  // (กัน "รางจีบ สไลด์เดี่ยว" กลายเป็น "ตัวสไลด์")
  const isMain = /^(ราง|ม่าน|ผ้า|มู่ลี่|มุ้ง|กล่อง|เบาะ|หมอน)/.test(t)
  const part = isMain ? undefined : FIXED_PARTS.find(([re]) => re.test(t))?.[1]
  if (part === 'พุก สกรู') {
    // จุดยึด: ผนัง / ฝ้า / เพดาน — ถ้าไม่ได้บอกไว้ ใช้ "พุก สกรู" เฉยๆ
    const at = /เพดาน/.test(t) ? ' ยึดเพดาน' : /ฝ้า/.test(t) ? ' ยึดฝ้า' : /ผนัง|หนัง/.test(t) ? ' ยึดผนัง' : ''
    return part + at
  }
  if (part) return part
  if (t.startsWith('ราง')) {
    const fixed = FIXED_RAILS.find(([re]) => re.test(t))?.[1]
    if (fixed) return fixed
    const style = RAIL_STYLES.find(([re]) => re.test(t))?.[1]
    return style ? 'ราง' + style : t     // รางที่อ่านชนิดไม่ออก — เก็บชื่อเดิมไว้ให้คนแก้
  }
  const fixed = FIXED_TYPES.find(([re]) => re.test(t))?.[1]
  if (fixed) return fixed
  const style = STYLE_WORDS.find(([re]) => re.test(t))?.[1]
  // ชื่อชนิดของม่านผ้าใช้คำนำหน้า "ม่าน" เสมอ — ผ้าโปร่ง/ทึบเป็นชนิดผ้า ไปลงช่องประเภทผ้า
  if (style) return 'ม่าน' + style
  return t   // อุปกรณ์อื่น (หัวราง ขาราง ตะขอ ห่วงติ่ง) ไม่แตะ
}

// ชนิดรางสำหรับเว็บคำนวณอุปกรณ์ราง (donna-rail) — ดูจากคำในชื่อ ไม่เทียบทั้งสตริง
export function railKind(type: string): 'รางจีบ' | 'รางลอนเทป' | 'รางตาไก่' | null {
  const t = String(type ?? '')
  if (!t.startsWith('ราง')) return null
  if (t.includes('ตาไก่')) return 'รางตาไก่'
  if (t.includes('ลอนเทป') || t.includes('เทป')) return 'รางลอนเทป'
  if (t.includes('จีบ')) return 'รางจีบ'
  // ‼️ ราง "ลอน" แบบอื่น (ลอนตะขอ / ลอนโซ่ไข่ปลา) ห้ามแมปเป็นรางลอนเทป — สูตรลอนเทปคิดลูกล้อ/กระดุม
  // จากระยะลอนของ "เทป" ซึ่งคนละอุปกรณ์กัน · เครื่องคำนวณยังไม่มีสูตร 2 ชนิดนี้ ให้บอกว่ายังไม่มีในระบบ
  return null   // ไม่รองรับ — ผู้เรียกต้องข้ามรายการนี้ ห้ามเดาชนิดให้
}

// ===== คำมาตรฐานของแต่ละช่อง =====

// หัวราง (ของรางตาไก่) — ในข้อมูลเดิมสะกดกันหลายแบบ (กระดูม/หัวกระดุม/กลมจุก/กลมเรียบ)
export function normalizeRailHead(v: string): string {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (/กระด(ู|ุ)ม/.test(t)) return 'หัวกระดุม'
  if (/กลม\s*จุก|จุก/.test(t)) return 'หัวกลมจุก'
  if (/กลม\s*เรียบ/.test(t)) return 'หัวกลมเรียบ'
  return t
}

// สีราง — ไม้อ่อน/ลายไม้/จุกลายไม้ คือสีเดียวกัน
// ‼️ "สักลายไม้" (แอดมินพิมพ์บ่อย) = ลายไม้ ไม่ใช่สัก → เช็ก "ลายไม้" ก่อน "สัก" เสมอ
// ‼️ ตัดวรรณยุกต์/ไม้ไต่คู้ก่อนเทียบ กันพิมพ์วรรณยุกต์ผิดตำแหน่ง เช่น "สักลายไม่้" ที่เคยหลุดเป็น "สัก"
export function normalizeRailColor(v: string): string {
  const t = String(v ?? '').replace(/\s*สี\s*/g, '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const k = t.replace(/[็-๎]/g, '')   // ลายไม่้ → ลายไม · เมเปิ้ล → เมเปิล · โอ๊ค → โอค
  if (/ไมออน|ลายไม|เมเปิล|เมเปล/.test(k)) return 'ลายไม้'
  if (/โอค|โอก|โอต/.test(k)) return 'โอ๊ค'
  if (/สัก/.test(k)) return 'สัก'
  if (/ขาว/.test(k)) return 'ขาว'
  if (/ดำ/.test(k)) return 'ดำ'
  return t
}

// ชนิดตะขอ — "บังราง" = ตะขอสั้น · "ใต้ราง" = ตะขอยาว (คำที่ช่างใช้เรียกกันหน้างาน)
export function normalizeHookType(v: string): string {
  const t = String(v ?? '').replace(/\s+/g, '').trim()
  if (!t) return ''
  if (/เพดาน/.test(t)) return 'ตะขอเพดาน'
  if (/ยาว|ใต้ราง/.test(t)) return 'ตะขอยาว'
  if (/สั้น|บังราง/.test(t)) return 'ตะขอสั้น'
  return t.includes('ตะขอ') ? t : ''
}

// สีตาไก่ 5 สี — "สุ่มสีสัก" ตัดคำว่าสุ่มออกเหลือ "สีสัก" · เขียนแบบไม่มีคำว่า "สี" ก็เติมให้
export function normalizeEyeletColor(v: string): string {
  const t = String(v ?? '').replace(/\s+/g, '').replace(/^สุ่ม/, '').replace(/ตาไก่/g, '').replace(/^สี/, '')
  if (!t) return ''
  if (/ขาว/.test(t)) return 'สีขาว'
  if (/ดำ/.test(t)) return 'สีดำ'
  if (/โอ๊ค|โอ๊ก|โอ๊ต/.test(t)) return 'สีโอ๊ค'
  if (/สัก|สะก|สีก/.test(t)) return 'สีสัก'
  if (/เงิน/.test(t)) return 'สีเงิน'
  return ''   // ไม่ใช่สีตาไก่ (เช่น "ใส่เคมี" ที่หลุดมาผิดช่อง) — ทิ้ง
}

// ประเภทผ้า: Dimout · Blackout · ลินิน · ผ้าโปร่ง (ต่อท้ายรายละเอียดได้ เช่น "Blackout เนื้อแมทกึ่งเงา")
// "ผ้าทึบ" ไม่ใช้แล้ว — ถ้าเขียนคู่กับชนิดจริง ("ผ้าทึบ Dimout") เก็บเฉพาะชนิดจริง ถ้ามีแต่ผ้าทึบให้เว้นว่าง
export function normalizeFabricType(v: string): string {
  const raw = String(v ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  const t = raw.replace(/ผ้าทึบ/g, '').replace(/^ผ้า\s*/, '').trim()
  const extra = (kw: string) => {
    const rest = t.replace(new RegExp(kw, 'i'), '').replace(/^ผ้า\s*/, '').replace(/\s+/g, ' ').trim()
    return rest ? ' ' + rest : ''
  }
  if (/blackout/i.test(t)) return 'Blackout' + extra('blackout')
  if (/dimout/i.test(t)) return 'Dimout' + extra('dimout')
  if (/ลินิน|linen/i.test(t)) return 'ลินิน' + extra('ลินิน|linen')
  if (/โปร่ง|sheer/i.test(t)) return 'ผ้าโปร่ง'
  return ''
}

// โซ่ถ่วง 2 แบบ — "ไม่รับโซ่ถ่วง" ที่ลูกค้าเขียนมา = ไม่ใส่โซ่ถ่วง
export function normalizeWeightChain(v: string): string {
  const t = String(v ?? '').replace(/\s+/g, '')
  if (!t) return ''
  return /ไม่/.test(t) ? 'ไม่ใส่โซ่ถ่วง' : 'ใส่โซ่ถ่วง'
}

// ขนาดใบมู่ลี่ — แอดมินพิมพ์ "35มม" / "ใบ 25 mm" → 35mm / 25mm
export function normalizeSlatSize(v: string): string {
  const m = String(v ?? '').match(/(\d{2})\s*(mm|มม|มิล)/i)
  return m ? `${m[1]}mm` : ''
}

// ===== ช่องที่ต้องโชว์ในตาราง/ฟอร์มรายการสินค้า =====
// รายการสินค้ามี 20 กว่าช่อง แต่สินค้าชิ้นหนึ่งใช้จริงไม่กี่ช่อง → โชว์เฉพาะช่องที่ "มีข้อมูล"
// บวกช่องหลักที่ต้องกรอกทุกชิ้น · ช่องที่เหลือกดปุ่ม "ทุกช่อง" เอาเมื่อจะกรอกเพิ่ม
// แบบของรายการ — มีแค่ 2 คำ · ไม่ได้ระบุมา = สั่งตัด (ของส่วนใหญ่ของร้านต้องตัด)
export const SUPPLY_KINDS = ['สั่งตัด', 'พร้อมส่ง']
export const normalizeSupply = (v: unknown): string =>
  /พร้อม\s*ส่?ง|พร้อมสง|ready|stock/i.test(String(v ?? '')) ? 'พร้อมส่ง' : 'สั่งตัด'

export const CORE_ITEM_FIELDS = ['type', 'supply', 'width', 'height', 'quantity', 'unit']

// ช่องทั้งหมดของรายการสินค้า [ชื่อคอลัมน์, คีย์, ชนิดช่องกรอก, กว้างในตาราง]
// ‼️ ชุดเดียวใช้ร่วมกันทุกหน้า (หมวดออเดอร์ + ปฏิทินงานติดตั้ง) — ห้ามก๊อปไปเขียนซ้ำ
//    เพิ่ม/ย้ายคอลัมน์ที่นี่ที่เดียว ทุกหน้าจะได้คอลัมน์ตำแหน่งเดียวกันเสมอ
export const ITEM_FIELDS: [string, keyof RawItem, string, number][] = [
  ['ประเภท', 'type', 'text', 110],
  ['แบบ', 'supply', 'text', 76],
  ['สีตาไก่', 'eyelet_color', 'text', 64],
  ['ชั้น', 'floors', 'number', 44],
  ['หัวราง', 'rail_head', 'text', 78],
  ['จีบ', 'pleat', 'text', 48],
  ['ตะขอ', 'hook_type', 'text', 70],
  ['สีราง', 'rail_color', 'text', 58],
  ['ความทึบ', 'opacity', 'text', 56],
  ['รุ่น', 'model', 'text', 58],
  ['ขนาดใบ', 'slat_size', 'text', 54],
  ['ประเภทผ้า', 'fabric_type', 'text', 76],
  ['รหัสสี', 'color_code', 'text', 60],
  ['สีม่าน', 'color_name', 'text', 90],
  ['สีจริง', 'color_desc', 'text', 80],
  ['กว้าง (ม.)', 'width', 'text', 56],
  ['สูง (ม.)', 'height', 'text', 56],
  ['จำนวน', 'quantity', 'number', 50],
  ['หน่วย', 'unit', 'text', 46],
  ['กระดูม', 'hooks', 'text', 60],
  ['เกินขนาด', 'orientation', 'text', 60],
  ['แบ่งผ้า', 'fabric_split', 'text', 74],
  ['เคมี', 'chemical', 'text', 64],
  ['โซ่ถ่วง', 'weight_chain', 'text', 80],
  ['ฝั่งดึง', 'pull_side', 'text', 54],
  ['สั่งนอก', 'outsource', 'text', 90],
  ['หมายเหตุ', 'note', 'text', 90],
]

// ช่องที่กรอกด้วยการเลือก ไม่ใช่พิมพ์เอง (กันพิมพ์ไม่ตรงคำมาตรฐาน)
export const ITEM_FIELD_OPTIONS: Record<string, string[]> = { supply: SUPPLY_KINDS }

// ช่องที่ต้องโชว์ของรายการหนึ่งชิ้น = ช่องหลัก + ช่องที่มีข้อมูลอยู่จริง (ช่องว่างไม่ต้องขึ้นให้รก)
export const shownFields = (it: RawItem): Set<string> => {
  const s = new Set(CORE_ITEM_FIELDS)
  for (const [, key] of ITEM_FIELDS) {
    const v = it[key]
    if (v !== '' && v != null && !(key === 'quantity' && v === 0)) s.add(key as string)
  }
  return s
}

// คอลัมน์ที่จะโชว์ในตารางแก้รายการ — เรียงตาม ITEM_FIELDS เสมอ (ตำแหน่งเดียวกันทุกหน้า)
export const visibleItemCols = (items: RawItem[], showAll: boolean) => {
  const shown = items.map(shownFields)
  return ITEM_FIELDS.filter(([, key]) => showAll || shown.length === 0 || shown.some(s => s.has(key as string)))
}

export const emptyItem = (): RawItem => ({ type: '', supply: 'สั่งตัด', floors: null, rail_head: '', pleat: '', rail_color: '', opacity: '', model: '', slat_size: '', hook_type: '', eyelet_color: '', fabric_type: '', color_code: '', color_name: '', color_desc: '', width: '', height: '', quantity: 1, unit: 'ชุด', hooks: '', orientation: '', fabric_split: '', chemical: '', weight_chain: '', pull_side: '', note: '', outsource: '' })

// จำนวนชั้นของราง — ออเดอร์เก่าบางใบชั้นติดอยู่ในชื่อชนิด ("รางม่านจีบ 2 ชั้น") ช่อง floors ว่าง
// ถ้าไม่เผื่ออ่านจากชื่อด้วย เว็บคำนวณอุปกรณ์รางจะคิดเป็นชั้นเดียว (ราง/หัวปิด/ลูกล้อ ขาดครึ่ง)
export function railLayers(it: { floors?: number | null; type?: string }): number {
  const n = Number(it.floors)
  if (n >= 1 && n <= 3) return n
  const inName = Number(String(it.type ?? '').match(/(\d+)\s*ชั้น/)?.[1] ?? 0)
  return inName >= 2 && inName <= 3 ? inName : 1
}

// แยกกลาง / สไลด์เดี่ยว สำหรับเว็บคำนวณอุปกรณ์ราง — ออเดอร์ที่ไม่ได้ลงข้อมูลคืนค่าว่าง
// ห้ามเดาเป็น "แยกกลาง" เพราะจำนวนลูกล้อ/สไลด์/ตะขอยู คิดจากค่านี้ (ให้ช่างกดเลือกเองในเว็บราง)
export function railSplit(text: string): 'แยกกลาง' | 'สไลด์เดี่ยว' | '' {
  const t = String(text ?? '')
  if (/สไลด์|เดี่ยว/.test(t)) return 'สไลด์เดี่ยว'
  if (/แยกกลาง|แยก\s*กลาง/.test(t)) return 'แยกกลาง'
  return ''
}

// ขนาดกว้างที่ส่งให้เว็บคำนวณราง — "1.10+3.10" (รางต่อท่อน) ส่งเป็นข้อความ นอกนั้นเป็นตัวเลข
export function railSize(width: unknown): string | number {
  return typeof width === 'string' && width.includes('+') ? width.trim() : (Number(width) || 0)
}

// หัวรางพวกนี้เป็นของ "รางตาไก่" เท่านั้น — ถ้าชนิดเขียนแค่ "ราง" แต่มีหัวราง = กรอกชนิดไม่ครบ
const TAIKAI_HEAD = /กระด(ู|ุ)ม|กลม\s*จุก|กลม\s*เรียบ|จุก/

// เตือนก่อนเปิดเว็บคำนวณราง — เว็บรางจะ "ข้ามเงียบๆ" รายการที่ไม่มีขนาด
// (เคยทำให้บิลขาดไปทั้งรายการโดยไม่มีใครรู้) และเปิดชนิดกำกวมเป็น "อื่นๆ" ให้กรอกเอง
export function railIssues(items: RawItem[]): string[] {
  const out: string[] = []
  for (const it of items) {
    const name = String(it.type ?? '')
    const sizeN = String(railSize(it.width)).split('+').reduce((a, x) => a + (Number(x) || 0), 0)
    const kind = railKind(name)
    if (!(sizeN > 0) && kind) out.push(`${name} — ไม่มีขนาดกว้าง จะตกหล่นจากบิลราง`)
    if (!kind && TAIKAI_HEAD.test(String(it.rail_head ?? ''))) out.push(`${name} (หัวราง${it.rail_head}) — ชนิดไม่ชัด น่าจะเป็นรางตาไก่ จะเปิดเป็น "อื่นๆ" ให้กรอกเอง`)
  }
  return out
}

// เติมฟิลด์ที่ AI ตัดทิ้งตอนค่าว่างกลับให้ครบ (ประหยัด output token แต่ผลลัพธ์เหมือนเดิม)
// เช็ก == null เท่านั้น: ถ้า AI ยังส่ง "" มาก็ไม่ทับ → ได้ค่าเดียวกันไม่ว่า AI จะตัดหรือส่งว่าง
// รวมฟิลด์หลัก (type/width/height/quantity/unit) ด้วย — AI ตัดทิ้งได้จริงถ้าต้นฉบับไม่ระบุ
// (เช่นรางไม่ลงความสูง) ถ้าไม่เติม ช่องในตาราง/ใบออเดอร์จะขึ้น undefined
const ITEM_EMPTY_FIELDS = ['type', 'rail_head', 'pleat', 'rail_color', 'opacity', 'model', 'slat_size',
  'hook_type', 'eyelet_color', 'fabric_type', 'color_code', 'color_name',
  'color_desc', 'width', 'height', 'quantity', 'unit', 'hooks', 'orientation', 'fabric_split',
  'chemical', 'weight_chain', 'pull_side', 'note', 'outsource', 'supply'] as const
export function fillItemDefaults(it: RawItem): RawItem {
  const out: RawItem = { ...it }
  if (out.floors == null) out.floors = null
  for (const k of ITEM_EMPTY_FIELDS) if (out[k] == null) out[k] = ''
  const nameRaw = String(out.type ?? '')
  // จำนวนชั้นที่ AI ติดมาในชื่อ ("รางตาไก่ 2 ชั้น") → ย้ายลง floors ก่อนกวาดชื่อ ไม่ให้หาย
  const floorsInName = nameRaw.match(/(\d+)\s*ชั้น/)
  if (floorsInName && !out.floors) out.floors = Number(floorsInName[1])
  // ข้อมูลที่ติดมาในชื่อชนิด ก่อนกวาดชื่อทิ้ง — จีบ / ตะขอ / ขนาดใบมู่ลี่ / ความทึบม่านม้วน
  if (!out.pleat) { const m = nameRaw.match(/(\d)\s*จีบ/); if (m) out.pleat = `${m[1]}จีบ` }
  if (!out.hook_type && /ตะขอ|บังราง|ใต้ราง/.test(nameRaw) && !nameRaw.startsWith('ราง')) {
    out.hook_type = normalizeHookType(nameRaw.match(/ตะขอ\s*(สั้น|ยาว|เพดาน)?|บังราง|ใต้ราง/)?.[0] ?? '')
  }
  if (!out.slat_size) out.slat_size = normalizeSlatSize(nameRaw)
  // สีรางที่เขียนต่อท้ายชื่อราง ("รางลอนโซ่ 2ชั้น สีขาว") — เก็บก่อนกวาดชื่อทิ้ง
  if (!out.rail_color && nameRaw.startsWith('ราง')) {
    const c = nameRaw.match(/ลายไม้|ไม้อ่อน|เมเปิ้ล|สีขาว|สีดำ|สีสัก|สีโอ๊ค|ขาว|ดำ|สัก|โอ๊ค/)
    if (c) out.rail_color = normalizeRailColor(c[0])
  }
  if (!out.opacity && /ม่านม้วน/.test(nameRaw)) out.opacity = nameRaw.match(/\d+\s*%/)?.[0].replace(/\s+/g, '') ?? ''
  // แบบ (สั่งตัด/พร้อมส่ง) — ถ้าไม่ได้ส่งมา ลองอ่านจากชื่อชนิด/หมายเหตุ ("(สั่งตัด) ผ้าม่าน..." / "พร้อมส่ง")
  // ที่เหลือเป็นสั่งตัดหมด (ของส่วนใหญ่ของร้านต้องตัด) — ใบปริ้นจะขึ้นป้ายเฉพาะของพร้อมส่ง
  out.supply = normalizeSupply(out.supply || (/พร้อม\s*ส่?ง/.test(`${nameRaw} ${out.note ?? ''}`) ? 'พร้อมส่ง' : ''))
  // คำว่า พร้อมส่ง/สั่งตัด ย้ายลงช่อง "แบบ" แล้ว — ไม่ต้องค้างในชื่อชนิด (ชื่ออุปกรณ์ไม่ถูกกวาดคำ จะติดไปเอง)
  const typeName = nameRaw.replace(/\(?\s*(พร้อม\s*ส่?ง|สั่ง\s*ตัด)\s*\)?/g, ' ').replace(/\s+/g, ' ').trim() || nameRaw
  out.type = normalizeItemType(typeName)
  const isRail = String(out.type ?? '').startsWith('ราง')

  // ---- ช่องหัวราง: เดิมเก็บปนกันทั้งจำนวนจีบ/ชนิดตะขอ/สีราง/แบ่งผ้า → แยกลงช่องของมัน
  let head = String(out.rail_head ?? '').replace(/\s+/g, ' ').trim()
  const pleatInHead = head.match(/(\d)\s*จีบ/)
  if (pleatInHead) { if (!out.pleat) out.pleat = `${pleatInHead[1]}จีบ`; head = head.replace(pleatInHead[0], ' ') }
  const hookInHead = head.match(/ตะขอ\s*(สั้น|ยาว|เพดาน)?|บังราง|ใต้ราง/)
  // ราง: คำว่า "ตะขอ" คือชื่อหัวราง ห้ามย้าย (เว็บคำนวณอุปกรณ์รางอ่านจากหัวราง)
  if (hookInHead && !isRail) {
    if (!out.hook_type) out.hook_type = normalizeHookType(hookInHead[0])
    // "ใต้ราง"/"บังราง" ที่เขียนคู่กับชนิดตะขอเป็นคำเดียวกัน กวาดออกให้หมด ไม่ให้ค้างในช่องหัวราง
    head = head.replace(/ตะขอ\s*(สั้น|ยาว|เพดาน)?/g, ' ').replace(/บังราง|ใต้ราง/g, ' ')
  }
  if (/แยกกลาง|สไลด์|เดี่ยว/.test(head)) {
    if (!out.fabric_split) out.fabric_split = railSplit(head)
    head = head.replace(/แยกกลาง|สไลด์เดี่ยว|สไลด์|เดี่ยว/g, ' ')
  }
  if (/เคมี/.test(head)) {
    if (!out.chemical) out.chemical = /ไม่/.test(head) ? 'ไม่ใส่เคมี' : 'ใส่เคมี'
    head = head.replace(/(ไม่)?ใส่เคมี|เคมี/g, ' ')
  }
  // ไม้อ่อน / ลายไม้ = สีราง ไม่ใช่หัวราง
  if (/ไม้อ่อน|ลายไม้|เมเปิ้ล/.test(head)) {
    if (!out.rail_color) out.rail_color = 'ลายไม้'
    head = head.replace(/จุก\s*ลายไม้|ไม้อ่อน|ลายไม้|เมเปิ้ล/g, ' ')
  }
  out.rail_head = normalizeRailHead(head)

  // ---- ช่องที่เหลือ: กวาดให้เหลือคำมาตรฐาน
  out.pleat = String(out.pleat ?? '').replace(/\s+/g, '')
  out.hook_type = normalizeHookType(String(out.hook_type ?? ''))
  out.eyelet_color = normalizeEyeletColor(String(out.eyelet_color ?? ''))
  out.fabric_type = normalizeFabricType(String(out.fabric_type ?? ''))
  out.weight_chain = normalizeWeightChain(String(out.weight_chain ?? ''))
  out.slat_size = normalizeSlatSize(String(out.slat_size ?? '')) || out.slat_size
  if (out.slat_size && !/^\d{2}mm$/.test(out.slat_size)) out.slat_size = normalizeSlatSize(out.slat_size)
  // สีรางเก็บเฉพาะของราง — ของเดิมลงไว้ในช่องลาย/สไตล์ ย้ายมาให้แล้วล้างช่องเดิมทิ้ง
  if (out.rail_color) out.rail_color = normalizeRailColor(String(out.rail_color))
  if (isRail && out.color_name) {
    if (!out.rail_color) out.rail_color = normalizeRailColor(String(out.color_name))
    out.color_name = ''
  }
  // สีม่านใช้ช่องเดียว — ของเดิมที่แยกเป็น "ลาย/สไตล์" กับ "สีจริง" รวมเข้าช่องเดียวกัน
  if (out.color_desc) {
    const both = [String(out.color_name ?? '').trim(), String(out.color_desc).trim()].filter(Boolean)
    out.color_name = [...new Set(both)].join(' ')
    out.color_desc = ''
  }
  // ฝั่งดึงมีแค่ ดึงซ้าย/ดึงขวา — คำอื่น ("ไม่รับราง") ย้ายไปหมายเหตุ
  const pull = String(out.pull_side ?? '').replace(/\s+/g, '')
  if (pull && !/ซ้าย|ขวา/.test(pull)) {
    const extra = /ราง/.test(pull) ? 'ไม่รับราง' : pull
    out.note = [String(out.note ?? '').trim(), extra].filter(Boolean).join(' ')
    out.pull_side = ''
  } else if (pull) out.pull_side = /ซ้าย/.test(pull) ? 'ดึงซ้าย' : 'ดึงขวา'
  return out
}

// แยก "จำนวนจีบ" กับ "ชนิดตะขอ" ที่เคยเก็บรวมช่องเดียว → ['3จีบ', 'ตะขอยาว']
// ถ้าไม่มีคำว่าตะขอ คืนค่าเดิมทั้งก้อน (เช่น "หัวกระดุม", "วงแหวน")
export function splitHookType(railHead: string): [string, string] {
  const t = String(railHead ?? '').trim()
  const m = t.match(/ตะขอ\s*(?:สั้น|ยาว|เพดาน)?/)
  if (!m) return [t, '']
  const hook = m[0].replace(/\s+/g, '')
  const rest = (t.slice(0, m.index) + ' ' + t.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, ' ').trim()
  return [rest, hook]
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
    if (it.rail_color) parts.push(it.rail_color)
    if (it.pleat) parts.push(it.pleat)
    if (it.hook_type) parts.push(it.hook_type)
    if (it.model) parts.push(it.model)
    if (it.slat_size) parts.push(it.slat_size)
    if (it.opacity) parts.push(it.opacity)
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

// ม่านลอนเทปที่ไม่ได้ลงจำนวนกระดูม → คำนวณจากความกว้าง+แบ่งผ้าให้เอง (สอบทานกับข้อมูลจริง ~60 รายการ)
// กติกาจากร้าน:
//   - แยกกลาง = เอา 2 ผืนรวมกันแล้วหากระดูม → ผ้าลงกว้างต่อผืน (ครึ่งเดียว) ต้อง ×2 ก่อน แล้วโชว์ (n+n)
//     เช่น ผ้าก1.50 → รวม 3.00 → (24+24) · แต่ "ราง..." กว้างเต็มอยู่แล้ว ไม่ต้อง ×2
//   - สไลด์เดี่ยว = ใช้กว้างรวมตรงๆ → (n) เช่น ก1.50 → (26)
//   - ไม่ได้ระบุแบ่งผ้า (และไม่รู้จำนวนผืน) → ไม่ขึ้นกระดูม
//   - "เทปลอน" (คนละคำกับ "ลอนเทป") ไม่เข้าเงื่อนไข → ไม่ขึ้น (ถูกแล้วตามที่ร้านใช้)
// เกินช่วงตาราง (แยกกลาง 6.93 / เดี่ยว 6.32) ไม่เดา — เว้นว่าง
export function autoTapeHooks(item: RawItem): string {
  const type = (item.type ?? '').trim()
  if (!type.includes('ลอนเทป')) return ''
  const w = String(item.width ?? '').trim()
  // รางต่อโค้ง "1.69+0.49" คิดจากผลรวม (แนวเดียวกับเว็บอุปกรณ์ราง)
  const base = w.includes('+')
    ? w.split('+').map(Number).filter(n => n > 0).reduce((a, b) => a + b, 0)
    : Number(w)
  if (!(base > 0)) return ''
  // แบ่งผ้า: ดูจากที่ระบุก่อน ถ้าไม่มีก็เดาจากจำนวนผืน (2 ผืนประกบ = แยกกลาง, 1 ผืน = สไลด์เดี่ยว)
  const splitTxt = `${item.fabric_split || ''} ${item.note || ''}`
  const qty = Number(item.quantity)
  const isPanel = (item.unit || '').includes('ผืน')
  let mode: 'single' | 'center' | null = null
  if (/สไลด์|เดี่ยว/.test(splitTxt)) mode = 'single'
  else if (/แยกกลาง|แยก/.test(splitTxt)) mode = 'center'
  else if (isPanel && qty >= 2 && qty % 2 === 0) mode = 'center'
  else if (isPanel && qty === 1) mode = 'single'
  if (!mode) return ''   // ไม่รู้แบ่งผ้า → ไม่ขึ้น (ตามกติการ้าน)
  if (mode === 'single') {
    if (base > 6.32) return ''
    const n = lookupDown(TAPE_SINGLE, Math.max(0.5, base))
    return n != null ? `(${n})` : ''
  }
  // แยกกลาง: ผ้ารวม 2 ผืน (base×2), แต่ราง = กว้างเต็มอยู่แล้ว
  const size = type.startsWith('ราง') ? base : base * 2
  if (size > 6.93) return ''
  const n = lookupDown(TAPE_CENTER, Math.max(0.5, size))
  return n != null ? `(${n}+${n})` : ''
}

// คืนบรรทัดของรายการ 1 ชิ้น (พร้อมธง rail = บรรทัดของราง ไว้ทำสีแดง)
// opts.hideNote = ไม่ต้องต่อท้าย "(ห้องครัว)" ท้ายบรรทัดขนาด — ใช้ตอนพิมพ์แบบแยกหัวข้อตามจุด (ชื่อจุดอยู่หัวกลุ่มแล้ว)
export function itemBlockLines(item: RawItem, opts?: { hideNote?: boolean }): { t: string; rail?: boolean }[] {
  const out: { t: string; rail?: boolean }[] = []
  const isRail = (item.type ?? '').startsWith('ราง')

  if (isRail) {
    const typeParts = [item.type, item.floors ? `${item.floors}ชั้น` : '', item.rail_head || '', item.hook_type || '', item.rail_color || item.color_name || ''].filter(Boolean)
    out.push({ t: typeParts.join(' '), rail: true })
  } else {
    const ft = (item.fabric_type ?? '').trim()
    const isSheer = ft.includes('โปร่ง')   // ผ้าโปร่ง

    // บรรทัดชื่อชนิด: ชนิด + สีตาไก่/จีบ/ตะขอ + ข้อมูลเฉพาะสินค้า (รุ่น/ขนาดใบ/ความทึบ)
    const typeParts = [item.type ?? '', item.eyelet_color || '', item.floors ? `${item.floors}ชั้น` : '',
      item.rail_head || '', item.pleat || '', item.hook_type || '',
      item.model || '', item.slat_size || '', item.opacity || ''].filter(Boolean)
    out.push({ t: typeParts.join(' ') })

    // บรรทัดชนิดผ้า/ยี่ห้อ/สี — ผ้าโปร่งต้องขึ้นให้เห็น (ชื่อชนิดไม่มีคำว่าโปร่งแล้ว)
    const colorName = isSheer
      ? (item.color_name ?? '').replace(/^โปร่ง\s*/, '')   // โปร่งเรียบขาวนวล → เรียบขาวนวล
      : (item.color_name ?? '')
    // การวางผ้า (ขวางผ้า) ต่อท้ายบรรทัดสี ให้ตรงตำแหน่งกับใบออเดอร์ต้นฉบับ — เติมวงเล็บให้ถ้าเก็บมาไม่มี
    const oriRaw = (item.orientation ?? '').trim()
    const oriStr = oriRaw && !oriRaw.startsWith('(') ? `(${oriRaw})` : oriRaw
    const brandParts = [isSheer ? ft : '', item.color_code || '', colorName, item.color_desc || '', oriStr].filter(Boolean)
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
    normalizeSupply(item.supply) === 'พร้อมส่ง' ? 'พร้อมส่ง' : '',
    (item.fabric_split ?? '').trim(),
    (item.chemical ?? '').trim(),
    (item.weight_chain ?? '').trim(),
    pullRaw ? (pullRaw.startsWith('ดึง') ? pullRaw : `ดึง${pullRaw}`) : '',
  ].filter(Boolean).map(v => `(${v})`).join(' ')
  const noteStr = opts?.hideNote ? '' : (item.note ? ` (${item.note})` : '')
  const tail = `${item.quantity} ${item.unit || ''}${extras ? ` ${extras}` : ''}${noteStr}${hooksStr ? ` ${hooksStr}` : ''}`
  out.push({ t: dim ? `${dim} = ${tail}` : `= ${tail}`, rail: isRail })
  return out
}
