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

// เลขงานติดตั้งที่เก็บเป็นตัวเลขล้วนในตาราง installations → 'IN0043'
export const installSerial = (s: string | null | undefined) =>
  s ? formatSerial('install', serialNum(s)) : ''
