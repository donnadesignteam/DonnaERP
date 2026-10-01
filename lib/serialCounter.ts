// ขอเลขที่ใบใหม่จากตัวนับกลางในฐาน (sql/serial_counter.sql → RPC take_serial)
// ‼️ ทุกที่ที่ออกเลขใหม่ต้องเรียกตัวนี้ — ตัวนับจำเลขสูงสุดที่ "เคยออกไปแล้ว"
//    ลบใบล่าสุดทิ้งแล้วเพิ่มใหม่จะได้เลขถัดไป ไม่ใช่เลขเดิมซ้ำ (เดิมคิดจากเลขสูงสุดที่ยังเหลืออยู่ในตาราง)
import { supabase } from '@/lib/supabase'
import { serialNum, type SerialKind } from '@/lib/serialNo'

// existing = เลขของทุกใบในหมวดนั้นที่เห็นตอนนี้ — ใช้เป็นพื้นขั้นต่ำ (ตัวนับต่ำกว่าเมื่อไหร่ก็ขยับขึ้นมาก่อน)
// ยังไม่ได้รัน SQL (ไม่มี RPC) → ใช้วิธีเดิม (เลขสูงสุดที่มี + 1) ให้บันทึกได้ไม่พัง
export async function takeSerialNumber(kind: SerialKind, existing: (string | null | undefined)[]): Promise<number> {
  const floor = existing.reduce<number>((mx, s) => Math.max(mx, serialNum(s)), 0)
  try {
    const { data, error } = await supabase.rpc('take_serial', { p_kind: kind, p_floor: floor })
    if (!error && typeof data === 'number' && data > floor) return data
  } catch { /* ใช้วิธีเดิมข้างล่าง */ }
  return floor + 1
}
