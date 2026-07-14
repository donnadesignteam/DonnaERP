// ตัวช่วยแก้ข้อมูลแบบ "ย้อนได้" — ทำ DB op แล้ว record วิธีย้อนเข้ากองประวัติ (lib/history.ts)
// ทุก undo/redo จะสั่ง reload() ของหน้านั้นให้ดึงข้อมูลใหม่ → UI ตรงกับ DB เสมอ (ไม่ต้องพึ่ง state เดิม)
//
// ใช้กับ "การกระทำหลักของผู้ใช้" เท่านั้น (เพิ่ม/แก้/ลบแถว) — งานเบื้องหลัง (sync กระดานงาน,
// log ประวัติ, อัปโหลดรูป) ไม่ต้อง track เพราะ reload จะดึงค่าที่ถูกกลับมาเอง
import { supabase } from './supabase'
import { recordAction } from './history'

type Reload = () => Promise<void> | void
type Row = Record<string, any>

// ดึงค่าเดิมเฉพาะฟิลด์ที่กำลังจะแก้ (คีย์เดียวกับ patch) ไว้ใช้ย้อนกลับ
export function prevOf(old: Row, patch: Row): Row {
  const p: Row = {}
  for (const k of Object.keys(patch)) p[k] = old[k] ?? null
  return p
}

// ── แก้ไขค่า (update) ── prev = ค่าเดิมก่อนแก้ (เฉพาะฟิลด์ที่เปลี่ยน) เพื่อย้อนกลับ
export async function tUpdate(
  table: string, id: string | number, patch: Row, prev: Row, label: string, reload: Reload,
): Promise<void> {
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) throw error
  recordAction({
    label,
    undo: async () => { const { error: e } = await supabase.from(table).update(prev).eq('id', id); if (e) throw e; await reload() },
    redo: async () => { const { error: e } = await supabase.from(table).update(patch).eq('id', id); if (e) throw e; await reload() },
  })
}

// ── เพิ่มแถว (insert) ── คืนแถวที่เพิ่ง insert (มี id) · undo = ลบแถวนั้น, redo = insert กลับด้วย id เดิม
export async function tInsert(
  table: string, row: Row, label: string, reload: Reload,
): Promise<Row> {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw error
  const saved = data as Row           // มี id ที่ DB สร้าง
  recordAction({
    label,
    undo: async () => { const { error: e } = await supabase.from(table).delete().eq('id', saved.id); if (e) throw e; await reload() },
    redo: async () => { const { error: e } = await supabase.from(table).insert(saved); if (e) throw e; await reload() },
  })
  return saved
}

// ── ลบแถว (delete) ── ต้องส่ง row เต็ม (ที่ดึงมาก่อนลบ) เพื่อ insert กลับตอน undo
// related = แถวตารางอื่นที่ถูกลบพร้อมกัน (เช่น งานติดตั้งที่ผูกออเดอร์) จะ insert กลับ/ลบซ้ำให้ครบ
export async function tDelete(
  table: string, row: Row, label: string, reload: Reload,
  related: { table: string; rows: Row[] }[] = [],
): Promise<void> {
  for (const r of related) {
    if (r.rows.length) { const { error } = await supabase.from(r.table).delete().in('id', r.rows.map(x => x.id)); if (error) throw error }
  }
  const { error } = await supabase.from(table).delete().eq('id', row.id)
  if (error) throw error
  recordAction({
    label,
    undo: async () => {
      const { error: e } = await supabase.from(table).insert(row); if (e) throw e
      for (const r of related) if (r.rows.length) { const { error: e2 } = await supabase.from(r.table).insert(r.rows); if (e2) throw e2 }
      await reload()
    },
    redo: async () => {
      for (const r of related) if (r.rows.length) await supabase.from(r.table).delete().in('id', r.rows.map(x => x.id))
      const { error: e } = await supabase.from(table).delete().eq('id', row.id); if (e) throw e
      await reload()
    },
  })
}

// ── การกระทำที่มี side-effect ในโค้ด (เช่น แก้สถานะแล้ว sync กระดานงาน+log) ──
// ส่งฟังก์ชัน apply(values) ที่จัดการทั้ง DB+state+งานเบื้องหลังเอง มาให้ undo/redo เรียกซ้ำด้วยค่าเก่า/ใหม่
export function tApply<T>(
  apply: (v: T) => Promise<void> | void, next: T, prev: T, label: string,
): void {
  recordAction({
    label,
    undo: async () => { await apply(prev) },
    redo: async () => { await apply(next) },
  })
}
