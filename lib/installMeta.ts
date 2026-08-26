// คำ/สถานะของงานติดตั้ง (ตาราง installations) — ใช้ร่วมกันระหว่างหน้าปฏิทินติดตั้งกับหมวดออเดอร์
// ‼️ แก้ที่นี่ที่เดียว (เดิมเขียนซ้ำในหน้าปฏิทิน ทำให้ตัวเลือกสองที่ไม่ตรงกัน)

export const WORK_TYPES = ['งานติดตั้ง', 'งานวัดหน้างาน', 'งานแก้']
// คอลัมน์ "งาน" ในตาราง — เลือกได้แค่ 2 อย่าง (งานแก้ใช้สถานะ "รอแก้งาน" แทน)
export const WORK_TYPE_OPTIONS = ['งานวัดหน้างาน', 'งานติดตั้ง']

export const ZONES = ['เชียงราย', 'เชียงใหม่', 'กทม']
export const TECHS = ['ช่างร้าน', 'ช่างนอก', 'ช่างกทม', 'ช่างบัวบาน']
// โซนที่รู้ชนิดช่างอยู่แล้ว → เติมให้อัตโนมัติ (เชียงราย/เชียงใหม่ เว้นไว้ให้เลือกเอง)
export const TECH_BY_ZONE: Record<string, string> = { 'กทม': 'ช่างนอก' }

export const INST_STATUS = ['รอนัดหมาย', 'นัดหมายแล้ว', 'วัดหน้างาน', 'วัดหน้างานแล้ว', 'ติดตั้ง', 'ติดตั้งเสร็จ', 'ติดตั้ง50%', 'รอแก้']

// สถานะที่เลือกได้ ขึ้นกับลักษณะงานในคอลัมน์ "งาน" — ค่าที่เก็บลงฐานคงของเดิมไว้ (แถวเก่าไม่เพี้ยน)
export const STATUS_BY_WORK: Record<string, string[]> = {
  'งานวัดหน้างาน': ['รอนัดหมาย', 'นัดหมายแล้ว', 'วัดหน้างานแล้ว'],
  'งานติดตั้ง': ['รอนัดหมาย', 'ติดตั้งเสร็จ', 'ติดตั้ง50%', 'รอแก้'],
  'งานแก้': ['รอนัดหมาย', 'รอแก้', 'ติดตั้งเสร็จ'],
}
// ป้ายที่โชว์ (ค่าที่เก็บในฐานยังเป็นคำเดิม)
export const STATUS_LABEL: Record<string, string> = { 'ติดตั้ง50%': 'ติดตั้งเสร็จ50%', 'รอแก้': 'รอแก้งาน' }
// ค่าเดิมของแถวเก่า → สถานะใหม่ที่ความหมายเดียวกัน (ยังไม่ได้ลงมือ = รอนัดหมาย)
export const STATUS_ALIAS: Record<string, string> = { 'ติดตั้ง': 'รอนัดหมาย', 'วัดหน้างาน': 'รอนัดหมาย' }

export const normStatus = (s?: string | null) => STATUS_ALIAS[s ?? ''] ?? (s ?? '')
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s
export const statusOptions = (workType?: string | null) => STATUS_BY_WORK[workType ?? ''] ?? INST_STATUS

export const STATUS_COLOR: Record<string, string> = {
  'รอนัดหมาย': '#8e8e93',
  'นัดหมายแล้ว': '#5ac8fa',
  'วัดหน้างาน': '#5ac8fa',
  'วัดหน้างานแล้ว': '#30b0c7',
  'ติดตั้ง': '#ff9f0a',
  'ติดตั้งเสร็จ': '#34c759',
  'ติดตั้ง50%': '#bf5af2',
  'รอแก้': 'var(--red)',
}

// สีของงานที่ยังไม่ลงมือ (รอนัดหมาย/นัดหมายแล้ว) ดูจากลักษณะงาน
export const WORK_COLOR: Record<string, string> = { 'งานวัดหน้างาน': '#5ac8fa', 'งานติดตั้ง': '#ff9f0a', 'งานแก้': 'var(--red)' }

// สีประจำแถวงานติดตั้ง — ยังไม่ลงมือ (รอนัดหมาย/นัดหมายแล้ว) ดูจากลักษณะงาน · ที่เหลือดูจากสถานะ
export const rowColor = (ins: { installation_status?: string | null; work_type?: string | null }) => {
  const s = normStatus(ins.installation_status)
  if (s === 'รอนัดหมาย' || s === 'นัดหมายแล้ว') return WORK_COLOR[ins.work_type ?? ''] ?? '#8e8e93'
  return STATUS_COLOR[s] ?? 'var(--ink-3)'
}

// คอลัมน์ของตารางงานติดตั้ง — ชุดเดียว/ลำดับเดียว ใช้ทั้งแท็บ "งานติดตั้ง" ในหมวดออเดอร์
// และตารางรายการใต้ปฏิทินงานติดตั้ง (ทั้งสองหน้ามีปุ่ม "คอลัมน์" ติ๊กซ่อน/โชว์เอง)
// ‼️ เพิ่ม/ย้ายคอลัมน์ที่นี่ที่เดียว แล้วไปเติมเซลล์ให้ครบทั้ง 2 หน้า
export const INSTALL_COLUMNS: { id: string; label: string }[] = [
  { id: 'days', label: 'วันผลิตที่เหลือ' }, { id: 'serial', label: 'Serial' },
  { id: 'deadline', label: 'วันที่นัดหมาย' }, { id: 'work', label: 'งาน' },
  { id: 'print', label: 'ปริ้น' },
  { id: 'customer', label: 'ลูกค้า' }, { id: 'platform', label: 'แพลตฟอร์ม' },
  { id: 'items', label: 'รายการ' }, { id: 'total', label: 'ยอดทั้งหมด' },
  { id: 'payment', label: 'ชำระ' }, { id: 'paid', label: 'ชำระแล้ว' },
  { id: 'paybefore', label: 'ยอดชำระหลังติดตั้ง' },
  { id: 'assigned', label: 'ลงออเดอร์' }, { id: 'admin', label: 'แอดมิน' },
  { id: 'status', label: 'สถานะงาน' },
  { id: 'done', label: 'งานเสร็จ' }, { id: 'installed', label: 'ติดตั้ง' },
  { id: 'inststatus', label: 'สถานะ' },
  { id: 'rail', label: 'สถานะราง' },
  { id: 'created', label: 'วันที่สร้าง' }, { id: 'outsource', label: 'สั่งนอก' },
  { id: 'province', label: 'จังหวัด' }, { id: 'zone', label: 'โซน' },
  { id: 'insttech', label: 'ช่างติดตั้ง' }, { id: 'tech', label: 'ช่างเย็บ' },
  { id: 'address', label: 'ที่อยู่' }, { id: 'phone', label: 'เบอร์โทร' }, { id: 'maps', label: 'Maps' },
  { id: 'notes', label: 'หมายเหตุ' },
  { id: 'updated', label: 'แก้ไขล่าสุด' },
]
