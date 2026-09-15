// เลขที่ใบ (serial) แยกตามหมวด — กติกาเดียวกันทุกหน้า ห้ามเขียนซ้ำที่อื่น ให้ import จากที่นี่
//   งานนอก DR · งานติดตั้ง IN · งานเคลม DM · พัสดุตีกลับ BP · งานแพลตฟอร์มไม่มีเลข (ใช้เลขคำสั่งซื้อของแพลตฟอร์มแทน)
// ‼️ เกิน 9999 ให้ต่อเป็น 5 หลักเอง (DR10000) ไม่ตัดหลัก — เรียงลำดับให้ใช้ serialNum() ไม่ใช่เรียงแบบข้อความ
// คอลัมน์ในฐาน: order_entries.serial_no / claims.serial_no / return_parcels.serial_no (sql/add_serial_no.sql)
//   ยกเว้นงานติดตั้งที่ installations.serial_no เก็บเป็นตัวเลขล้วนมาแต่เดิม ('0043') → เติม IN ตอนแสดงผลด้วย installSerial()

export const SERIAL_PREFIX = { outside: 'DR', install: 'IN', claim: 'DM', return: 'BP' } as const
export type SerialKind = keyof typeof SERIAL_PREFIX

// ตัวเลขในเลขที่ใบ ('DR0042' → 42 · ว่าง/ไม่มี → 0)
export const serialNum = (s: string | null | undefined) => {
  const d = (s ?? '').replace(/\D/g, '')
  return d ? parseInt(d, 10) : 0
}

export const formatSerial = (kind: SerialKind, n: number) => `${SERIAL_PREFIX[kind]}${String(n).padStart(4, '0')}`

// เลขถัดไปจากรายการที่มีอยู่ (ส่งเลขทุกใบของหมวดนั้นเข้ามา)
export const nextSerial = (kind: SerialKind, existing: (string | null | undefined)[]) =>
  formatSerial(kind, existing.reduce((mx, s) => Math.max(mx, serialNum(s)), 0) + 1)

// ช่องค้นหาของทุกหน้า: พิมพ์เลขที่ใบแบบไหนก็เจอ — 'DR0042' · 'dr42' · 'DR 42' · '0042' · '42'
// (ไม่สนตัวพิมพ์เล็กใหญ่/ช่องว่าง/เลข 0 นำหน้า · มีตัวอักษรนำหน้าต้องตรงหมวด เช่น IN42 ไม่เจอ DR0042)
export const matchSerial = (serial: string | null | undefined, query: string) => {
  const s = (serial ?? '').toLowerCase()
  const k = query.toLowerCase().replace(/\s+/g, '')
  if (!s || !k) return false
  if (s.includes(k)) return true
  const m = k.match(/^([a-z]{0,2})0*(\d+)$/)
  if (!m) return false
  return (!m[1] || s.replace(/[^a-z]/g, '') === m[1]) && serialNum(s) === Number(m[2])
}

// เลขงานติดตั้งที่เก็บเป็นตัวเลขล้วนในตาราง installations → 'IN0043'
export const installSerial = (s: string | null | undefined) =>
  s ? formatSerial('install', serialNum(s)) : ''
