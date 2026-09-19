// คำสั่ง DB แบบ "ข้อมูลล้วน" ของกองย้อนกลับ — เก็บลง sessionStorage ได้ (ฟังก์ชันเก็บไม่ได้)
// ใช้ตอนกดย้อน/ทำซ้ำ action ที่ทำไว้ก่อนรีเฟรชหน้า (ดู lib/history.ts)
// ‼️ ทุกคำสั่งต้องเช็ค error แล้ว throw — ย้อนพลาดต้องฟ้อง ห้ามเงียบ (เคสลบงานติดตั้ง MIL แล้วย้อนไม่ขึ้น)
import { supabase } from './supabase'
import { stampUpdate, stampActor } from './adminActor'
import { applyLeaveToStaff } from './leave'

type Row = Record<string, unknown>

export type DbOp =
  | { t: 'update'; table: string; values: Row; col?: string; val: unknown }        // update … where col = val (col ไม่ใส่ = id)
  | { t: 'insert'; table: string; rows: Row[] }                                     // ใส่แถวเดิมกลับทั้งแถว (id เดิม)
  | { t: 'delete'; table: string; col?: string; vals: unknown[] }                   // delete … where col in vals
  | { t: 'leave'; code: string; type: string; days: number; sign: 1 | -1 }          // ปรับสิทธิลาพนักงาน

// แปะ "ใครทำ" ให้เหมือนตอนแก้จากหน้าเว็บปกติ (ชื่อในประวัติจะได้ถูกคน)
const stampFor = (table: string, v: Row) =>
  table === 'order_entries' ? stampUpdate(v) : (table === 'claims' || table === 'installations') ? stampActor(v) : v

export async function runOps(ops: DbOp[]) {
  for (const op of ops) {
    if (op.t === 'update') {
      const { error } = await supabase.from(op.table).update(stampFor(op.table, op.values)).eq(op.col ?? 'id', op.val)
      if (error) throw error
    } else if (op.t === 'insert') {
      if (!op.rows.length) continue
      const rows = op.table === 'order_entries' ? op.rows : op.rows.map(r => stampFor(op.table, r))
      const { error } = await supabase.from(op.table).insert(rows)
      if (error) throw error
    } else if (op.t === 'delete') {
      if (!op.vals.length) continue
      const { error } = await supabase.from(op.table).delete().in(op.col ?? 'id', op.vals)
      if (error) throw error
    } else if (op.t === 'leave') {
      await applyLeaveToStaff(op.code, op.type, op.days, op.sign)
    }
  }
}

// ตัวช่วยสร้างคำสั่งสั้นๆ ที่จุด recordAction
export const opUpdate = (table: string, id: unknown, values: Row, col = 'id'): DbOp => ({ t: 'update', table, values, col, val: id })
export const opInsert = (table: string, rows: Row | Row[]): DbOp => ({ t: 'insert', table, rows: Array.isArray(rows) ? rows : [rows] })
export const opDelete = (table: string, ids: unknown | unknown[], col = 'id'): DbOp => ({ t: 'delete', table, col, vals: Array.isArray(ids) ? ids : [ids] })
