// ช่อง "ผิดโดย" ของงานเคลม — ค่าที่ไม่ใช่ชื่อพนักงาน ต้องรู้จักตรงกันทั้งหน้าเคลมและหมวดพนักงาน
// ‼️ แก้ที่นี่ที่เดียว (เดิมรายชื่อขนส่งเขียนซ้ำ 2 ไฟล์ ทำให้กรองไม่ตรงกัน)

// เคสที่ตรวจแล้วไม่เป็นความผิดของใคร (ของเสียจากโรงงาน ลูกค้าเปลี่ยนใจ ฯลฯ)
// เลือกค่านี้ = ไม่ถูกนับเป็นงานเคลมของพนักงานคนไหน ไม่ขึ้นในหมวดพนักงาน/แอปมือถือ
export const NO_FAULT = 'ไม่ถือว่าเป็นความผิด'

// ช่างที่ใส่ในช่อง "ผิดโดย" ได้ (คนละชุดกับ TECH_OPTIONS ที่เป็นช่างผู้รับผิดชอบงาน)
export const FAULT_BY_TECHS = ['ช่างพี่ฟอง', 'ช่างบัวบาน', 'ช่างกทม']

export const FAULT_COURIERS = ['Flash Express', 'J&T Express', 'Kerry', 'ไปรษณีย์ไทย', 'SPX Express']

// ค่านี้นับเป็น "งานเคลมของคน" ไหม — ว่าง / ขนส่ง / ไม่ถือว่าเป็นความผิด = ไม่นับ
export const isPersonFault = (name?: string | null): boolean => {
  const n = (name ?? '').trim()
  return !!n && n !== NO_FAULT && !FAULT_COURIERS.includes(n)
}

// ช่อง "ผิดโดย" ใส่ได้หลายชื่อ — เก็บในคอลัมน์ข้อความเดิม (claims.fault_by) คั่นด้วย ", " ไม่ต้องแก้ฐานข้อมูล
export const FAULT_SEP = ', '
export const splitFaultBy = (v?: string | null): string[] =>
  (v ?? '').split(',').map(s => s.trim()).filter(Boolean)
export const joinFaultBy = (names: string[]): string =>
  Array.from(new Set(names.map(s => s.trim()).filter(Boolean))).join(FAULT_SEP)

// ชื่อพนักงาน/ช่างในช่อง "ผิดโดย" ของเคสนั้น (ตัดขนส่ง/ไม่ถือว่าผิดออก)
export const faultPeople = (v?: string | null): string[] => splitFaultBy(v).filter(isPersonFault)

// ค่าเคลมหารกี่ส่วน = จำนวนผู้ผิดทั้งหมดในช่อง (รวมบริษัทขนส่งด้วย เพราะเป็นผู้ผิดอีกรายหนึ่ง) อย่างน้อย 1
export const faultShareCount = (v?: string | null): number =>
  Math.max(1, splitFaultBy(v).filter(n => n !== NO_FAULT).length)
