// แคตตาล็อกรหัสผ้า (ใช้ร่วมกันระหว่างหน้า stock และ AI แปลงออเดอร์)
// fabric_type ในที่นี้เป็นข้อความเต็มของคลัง เช่น 'DIMOUT สูงปกติ', 'SHEER ผ้าโปร่ง', 'BLACKOUT ...'

export type FabricMeta = {
  color_name: string
  fabric_width: number
  fabric_type: string
  shop_code: string
  shop_name: string
}

export const FABRIC_LOOKUP: Record<string, FabricMeta> = {
  // ── ตามชีทสต็อก (แท็บ "ชีต21" · 19 ก.ย. 69) — รหัสที่มี 2 ร้าน ใช้ร้านแรก ──
  'S010': { color_name: 'ครีมขาว', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85/01', shop_name: 'Darika (DK)' },
  'D038': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'AU004-26', shop_name: 'ออร่า Aura Art' },
  'W17': { color_name: 'ขาวควัน', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'MU101-17', shop_name: 'M&X' },
  'S700': { color_name: 'ครีมลาเต้', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'dk107/2', shop_name: 'Darika (DK)' },
  'S05': { color_name: 'เทาเบจ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'MU101-5', shop_name: 'M&X' },
  'S18': { color_name: 'เทาเมฆ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'MU101-18', shop_name: 'M&X' },
  'M80': { color_name: 'เทาเข้ม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'BSW-3', shop_name: 'CT store' },
  'S61': { color_name: 'เทาเบจ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'BSW-1', shop_name: 'CT store' },
  'S10': { color_name: 'Jet Black', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'COS 18-13', shop_name: 'Cosi' },
  'DS01': { color_name: 'โปร่งลายฝนขาวสว่าง สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-101', shop_name: 'CT store' },
  'DS02': { color_name: 'โปร่งลายฝนขาวนวล สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-102', shop_name: 'CT store' },
  'DS03': { color_name: 'โปร่งเรียบขาวสว่าง สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-104', shop_name: 'CT store' },
  'DS04': { color_name: 'โปร่งเรียบขาวนวล สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-103', shop_name: 'CT store' },
  'DS05': { color_name: 'Mist Gray โปร่งเทา', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-130', shop_name: 'CT store' },
  'DS06': { color_name: 'โปร่งลายฝนขาวสว่าง สูงพิเศษ', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'OK301-21A', shop_name: 'Sue M' },
  'DS07': { color_name: 'โปร่งลายฝนขาวนวล สูงพิเศษ', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'OK301-21B', shop_name: 'Sue M' },
  'DS08': { color_name: 'Clear Off White', fabric_width: 3.00, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '', shop_name: 'CT store' },
  'DS09': { color_name: 'raindrop off white', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '', shop_name: 'CT store' },
  'DS091': { color_name: 'raindrop off white', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '', shop_name: 'CT store' },
  'AB21': { color_name: 'โปร่งเรียบหนา Mid-modern', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB21', shop_name: 'จิงจิง' },
  'AB22': { color_name: 'โปร่งเรียบหนาพิเศษ Richy', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB22', shop_name: 'จิงจิง' },
  'AB58': { color_name: 'โปร่งลาย Linen', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB58', shop_name: 'จิงจิง' },
  'AB41': { color_name: 'โปร่งหนา Butter Cup linen Pie', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB41', shop_name: 'จิงจิง' },
  'H01': { color_name: 'ครีม', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'G471', shop_name: 'เดอะแกรน The Grand' },
  'HJJ-6': { color_name: 'ครีมอ่อน', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '820-1', shop_name: 'จิงจิง' },
  'HJJ-7': { color_name: 'ครีมน้ำตาล', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '1018-6', shop_name: 'จิงจิง' },
  'HJJ-5': { color_name: 'เทาเข้ม', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '1018-7', shop_name: 'จิงจิง' },
  'H222': { color_name: 'เบจน้ำตาล', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '1018-5', shop_name: 'จิงจิง' },
  'H99': { color_name: 'เทาเบจ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '820-3', shop_name: 'โกลเฮ้าส์ Gold house' },
  'M11': { color_name: 'แมคคาเดเมียแกมเขียว', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'ha189', shop_name: 'โกลเฮ้าส์ Gold house' },
  'A11': { color_name: 'แมคคาเดเมียแกมครีมขาว', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'ha188', shop_name: 'โกลเฮ้าส์ Gold house' },
  'S01': { color_name: 'ครีมมินิมอล', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'DD-1', shop_name: 'จิงจิง' },
  'M20': { color_name: 'เบจ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'DD-2', shop_name: 'จิงจิง' },
  'S581': { color_name: 'ขาวครีมติดเนื้อ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '5008-1', shop_name: 'เควี KV' },
  'M14': { color_name: 'นู๊ดเบจ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'PC-A-33', shop_name: 'Pro textile' },
  'KW5-1': { color_name: 'ขาวมุก วิ้งเกาหลี', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ วิ้งเกาหลี', shop_code: 'CX5000-1', shop_name: 'CX' },
  'HB81': { color_name: 'เทาเบจน้ำตาล', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-1', shop_name: 'จิงจิง' },
  'HB16': { color_name: 'ขาวออฟไวท์', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-3', shop_name: 'จิงจิง' },
  'HB82': { color_name: 'เทาเมฆ', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-2', shop_name: 'จิงจิง' },
  'HB83': { color_name: 'เทาอ่อน', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-5', shop_name: 'จิงจิง' },
  'HB85': { color_name: 'เทาเข้ม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-4', shop_name: 'จิงจิง' },
  'HB88': { color_name: 'ขาวครีม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'KK1', shop_name: 'จิงจิง' },
  'HB87': { color_name: 'ลินินหม่นขาว', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-22', shop_name: 'Asia fabric' },
  'HB93': { color_name: 'Mocha Grey', fabric_width: 0, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '777-3', shop_name: '' },
  'HB94': { color_name: 'Cloud Grey', fabric_width: 0, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '777-4', shop_name: '' },
  'HB95': { color_name: 'Soft grey', fabric_width: 0, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '777-5', shop_name: '' },
  'HB96': { color_name: 'Charcoal Grey', fabric_width: 0, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '777-6', shop_name: '' },
  'SHB91': { color_name: 'Cotton คอตต้อน', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3401', shop_name: 'Amazing อเมซิ่ง' },
  'SHB92': { color_name: 'Cloud Whisper เทาเมฆ', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3406', shop_name: 'Amazing อเมซิ่ง' },
  'SHB93': { color_name: 'Stone Echo เทาเข้ม', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3407', shop_name: 'Amazing อเมซิ่ง' },
  'SHB94': { color_name: 'brich brown', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3405', shop_name: 'Amazing อเมซิ่ง' },
  'SHB97': { color_name: 'Linen Beige ลินินเบจ', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3403', shop_name: 'Amazing อเมซิ่ง' },
  'SHB98': { color_name: 'Oatmeal โอ้ตมิล', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3402', shop_name: 'Amazing อเมซิ่ง' },
  'SHB99': { color_name: 'Mocha Stone ม่อคค่า', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3404', shop_name: 'Amazing อเมซิ่ง' },
  'HB-R1': { color_name: 'มาชเมลโล่ว', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-4', shop_name: 'จิงจิง' },
  'HB-R2': { color_name: 'น้ำตาลนู๊ด', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-7', shop_name: 'จิงจิง' },
  'HB-R3': { color_name: 'เทาเมฆ', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-2', shop_name: 'จิงจิง' },
  'HB-R4': { color_name: 'เทาเข้ม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-5', shop_name: 'จิงจิง' },
  'KB-1': { color_name: 'น้ำตาลเทา', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-1', shop_name: 'CT store' },
  'KB-2': { color_name: 'ขาว', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-2', shop_name: 'CT store' },
  'KB-3': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-3', shop_name: 'CT store' },
  'KB-4': { color_name: 'เทาขาว', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-4', shop_name: 'CT store' },
  'KB-5': { color_name: 'เทาเมฆ', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-5', shop_name: 'CT store' },
  'KB-6': { color_name: 'น้ำเงิน', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-6', shop_name: 'CT store' },
  'KB-7': { color_name: 'เทาอ่อน', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-7', shop_name: 'CT store' },
  'KB-8': { color_name: 'เทาน้ำเงิน', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-8', shop_name: 'CT store' },
  'KB-9': { color_name: 'เทากลาง', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-9', shop_name: 'CT store' },
  'KB-10': { color_name: 'เทาเข้มกลาง', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-10', shop_name: 'CT store' },
  'A1': { color_name: 'ครีมเบจ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85/05', shop_name: 'Darika (DK)' },
  'M21': { color_name: 'เบจอ่อน', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'AU004-27', shop_name: 'ออร่า Aura Art' },
  'MS01': { color_name: '-', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-1', shop_name: 'จิงจิง' },
  'B82': { color_name: 'เทาเมฆ', fabric_width: 2.80, fabric_type: 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', shop_code: '520-10', shop_name: 'จิงจิง' },
  'B16': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', shop_code: '520-16', shop_name: 'จิงจิง' },
  'B85': { color_name: 'เทาเข้ม', fabric_width: 2.80, fabric_type: 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', shop_code: '520-29', shop_name: 'จิงจิง' },
  'DS12': { color_name: 'โปร่ง "สีทอง"', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '-', shop_name: 'จิงจิง' },
  'DS13': { color_name: 'โปร่ง"เรียบ"ขาวนวล สูงปกติ', fabric_width: 3.00, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '301-22B', shop_name: 'Cosi' },
  'DS14': { color_name: 'โปร่ง"เรียบ"ขาวสว่าง สูงปกติ', fabric_width: 3.00, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '301-22A', shop_name: 'Cosi' },
  'HB24': { color_name: 'ขาวครีม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-24', shop_name: 'Asia fabric' },
  'HB25': { color_name: 'อัลมอนด์', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-25', shop_name: 'Asia fabric' },
  'HB26': { color_name: 'ซินนาม่อน', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-26', shop_name: 'Asia fabric' },
  'D516': { color_name: 'Hunter green / Forest green', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85-16', shop_name: 'Darika (DK)' },
  'S40': { color_name: 'butter ครีมเนย', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'ART06-40', shop_name: 'ออร่า Aura Art' },
  'S42': { color_name: 'Navy gray เทากรม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'ART06-42', shop_name: 'ออร่า Aura Art' },
  // ── รหัสเก่าที่ไม่อยู่ในชีทแล้ว — เก็บไว้ให้ออเดอร์เก่าที่ลงรหัสนี้ยังรู้ชนิดผ้า ──
  'D00': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'St160-13', shop_name: 'รุ่งโรจน์' },
  'S22': { color_name: 'เบจน้ำตาล', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'รอหาตัวใหม่', shop_name: 'M&X' },
  'DS10': { color_name: 'โปร่งลาย Linen', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB58', shop_name: 'จิงจิง' },
  'DS11': { color_name: 'โปร่งหนา Butter Cup linen Pie', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB41', shop_name: 'จิงจิง' },
  'HJJ-8': { color_name: 'เทาเข้ม', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '1018-7', shop_name: 'จิงจิง' },
  'J-DD13': { color_name: 'เทาเมฆ', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังไม่เหมือนกัน', shop_code: '1021-3', shop_name: 'จิงจิง' },
  'HUNTER GREEN': { color_name: 'สีเขียว', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85/16', shop_name: 'Darika (DK)' },
}

// แปลงข้อความ fabric_type เต็มของคลัง → ชนิดผ้าแบบสั้นสำหรับใบออเดอร์
export function shortFabricType(fullType: string | undefined | null): string {
  const t = (fullType ?? '').toUpperCase()
  if (!t) return ''
  if (t.includes('SHEER') || t.includes('โปร่ง')) return 'ผ้าโปร่ง'
  if (t.includes('DIMOUT')) return 'Dimout'
  if (t.includes('BLACKOUT')) return 'Blackout'
  return ''
}

// ข้อมูลผ้าจากรหัสสี (ไม่สนตัวพิมพ์เล็กใหญ่/ช่องว่างหัวท้าย) — ไม่รู้จักรหัสคืน null
export function fabricMeta(code: string | undefined | null): FabricMeta | null {
  const c = (code ?? '').trim()
  if (!c) return null
  const up = c.toUpperCase()
  return FABRIC_LOOKUP[up] ?? FABRIC_LOOKUP[c] ?? Object.entries(FABRIC_LOOKUP).find(([k]) => k.toUpperCase() === up)?.[1] ?? null
}

// ── หารหัสผ้าโปร่งจากชื่อ ──
// ชื่อเดียวกันมีทั้งสูงปกติ/สูงพิเศษ (เช่น โปร่งลายฝนขาวสว่าง = DS01 / DS06)
// กติกาแอดมิน: สูงปกติไม่เขียนบอก · สูงพิเศษเขียน "สูงพิเศษ" → มีคำนี้ในรายการ = เลือกตัวสูงพิเศษ
// เทียบชื่อแบบตัดคำกลางๆ ออก (โปร่ง/ผ้า/ลาย/สูงปกติ/สูงพิเศษ/ช่องว่าง/เครื่องหมายคำพูด)
// หาไม่เจอ หรือเจอหลายตัวที่ชื่อต่างกัน → ไม่ใส่รหัส (ไม่เดา)
const sheerNorm = (s: string) => s.toLowerCase().replace(/สูงปกติ|สูงพิเศษ|โปร่ง|ผ้า|ลาย|["'“”\s\-–]/g, '')
const isSpecialHeight = (m: FabricMeta) => m.color_name.includes('สูงพิเศษ') || m.fabric_width >= 3.2
const SHEER_CODES = Object.entries(FABRIC_LOOKUP).filter(([, m]) => m.fabric_type.toUpperCase().includes('SHEER'))

export function sheerCodeFromName(it: Record<string, unknown>): string | null {
  const name = typeof it.color_name === 'string' ? it.color_name : ''
  const n = sheerNorm(name)
  if (n.length < 2) return null
  const allText = Object.values(it).filter(v => typeof v === 'string').join(' ')
  const wantSpecial = allText.includes('สูงพิเศษ')

  const exact = SHEER_CODES.filter(([, m]) => sheerNorm(m.color_name) === n)
  const loose = SHEER_CODES.filter(([, m]) => { const c = sheerNorm(m.color_name); return c.length >= 2 && (n.includes(c) || (n.length >= 4 && c.includes(n))) })
  const found = exact.length ? exact : loose
  if (!found.length) return null
  // เลือกตามความสูง — ถ้าไม่มีตัวที่ตรงความสูงเลย (เช่น Richy มีแต่สูงพิเศษ) ใช้ที่เจอทั้งหมด
  const byHeight = found.filter(([, m]) => isSpecialHeight(m) === wantSpecial)
  const pool = byHeight.length ? byHeight : found
  // เหลือหลายตัวแต่ชื่อต่างกัน → ไม่เดา
  if (new Set(pool.map(([, m]) => sheerNorm(m.color_name))).size !== 1) return null
  // ชื่อเดียวกันหลายหน้าผ้า (โปร่งเรียบขาวสว่าง = DS03 2.80 / DS14 3.00 · ขาวนวล = DS04 / DS13)
  // ม่านสูงเกิน 2.63 (ม่านลอนเทปเกิน 2.70) แต่ไม่ได้เขียนสูงพิเศษ → ใช้ตัวหน้าผ้ากว้างกว่า · นอกนั้นตัวแรกตามลำดับชีท
  const h = Number(it.height) || 0
  const tall = h > (String(it.type ?? '').includes('ลอนเทป') ? 2.70 : 2.63)
  if (tall && !wantSpecial) {
    const wider = [...pool].sort((a, b) => b[1].fabric_width - a[1].fabric_width)[0]
    if (wider[1].fabric_width > pool[0][1].fabric_width) return wider[0]
  }
  return pool[0][0]
}

// ตอนแปลงรายการ: รายการผ้าที่มีรหัสสีในแคตตาล็อก → แก้ fabric_type ให้ถูก + ชื่อสีว่างอยู่ เติมชื่อสีจากสต็อก
// (แอดมินลงแค่ "AB21" → color_name = "โปร่งเรียบหนา Mid-modern") · ถ้าแอดมินเขียนชื่อสีมาเอง ใช้ของแอดมิน
export function applyFabricCatalog<T extends { color_code?: unknown; color_name?: unknown; fabric_type?: unknown }>(it: T): T {
  let meta = fabricMeta(typeof it.color_code === 'string' ? it.color_code : null)
  if (!meta && !(typeof it.color_code === 'string' && it.color_code.trim())) {
    // ไม่มีรหัสสี แต่เขียนชื่อผ้าโปร่งมา → หารหัสจากชื่อ (แอดมินมักไม่ลงรหัสผ้าโปร่ง)
    const code = sheerCodeFromName(it)
    if (code) { it = { ...it, color_code: code }; meta = FABRIC_LOOKUP[code] }
  }
  if (!meta) return it
  const ft = shortFabricType(meta.fabric_type)
  const hasName = typeof it.color_name === 'string' && it.color_name.trim() !== ''
  const name = meta.color_name && meta.color_name !== '-' ? meta.color_name : ''
  return { ...it, ...(ft ? { fabric_type: ft } : {}), ...(!hasName && name ? { color_name: name } : {}) }
}

// หาชนิดผ้าแบบสั้นจากรหัสสี (เช่น 'D038' → 'ผ้า Dimout'); คืน '' ถ้าไม่รู้จักรหัส
export function fabricTypeFromCode(code: string | undefined | null): string {
  const meta = fabricMeta(code)
  return meta ? shortFabricType(meta.fabric_type) : ''
}
