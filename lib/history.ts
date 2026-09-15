// กองประวัติการกระทำทั้งเว็บ (undo/redo แบบ Google Sheets)
// singleton นอก React เพื่อให้ทุกหน้า/ทุกจุดแก้ข้อมูล เรียก recordAction ได้โดยไม่ต้องส่ง context
//
// แต่ละ action เก็บวิธี undo (ย้อน) + redo (ทำซ้ำ) เป็นฟังก์ชัน — ตัวที่ record เป็นคนกำหนดว่าย้อนยังไง
// ความถูกต้องยึดจากฐานข้อมูล: undo/redo แก้ DB แล้วสั่ง reload หน้า → UI ตรงกับ DB เสมอ
//
// ── จำข้ามการรีเฟรช (user ขอ 15ก.ย.69) ──
// ‼️ เดิมกองอยู่ในหน่วยความจำอย่างเดียว รีเฟรชแล้วหาย → เผลอลบแล้วรีเฟรช ย้อนไม่ได้ (เคสงานติดตั้ง MIL)
// ตอนนี้ action ที่ส่ง undoOps/redoOps (คำสั่ง DB แบบข้อมูลล้วน ดู lib/historyOps.ts) จะเก็บลง sessionStorage
// → รีเฟรชแล้วยังย้อนได้ · ปิดแท็บ/ปิดเบราว์เซอร์ = ล้าง (sessionStorage อยู่แค่ในแท็บนั้น)
// action ที่มาจากก่อนรีเฟรชไม่มีฟังก์ชันแล้ว → รันคำสั่ง DB ที่เก็บไว้ แล้วโหลดหน้าใหม่ให้ข้อมูลตรง
import type { DbOp } from './historyOps'

export type HistoryAction = {
  label: string                          // โชว์บนปุ่ม/ทูลทิป เช่น "ลบออเดอร์ #1234"
  undo?: () => Promise<void> | void      // ไม่มี = action ที่กู้มาจากก่อนรีเฟรช (ใช้ undoOps แทน)
  redo?: () => Promise<void> | void
  undoOps?: DbOp[]                       // คำสั่ง DB ของการย้อน — มี = จำข้ามการรีเฟรชได้
  redoOps?: DbOp[]
}

const MAX = 100
const KEY = 'donna_history_v1'
let undoStack: HistoryAction[] = []
let redoStack: HistoryAction[] = []
let busy = false
let restored = false
const listeners = new Set<() => void>()

// เก็บเฉพาะ action ที่มีคำสั่ง DB ครบทั้งสองทาง (อันที่มีแต่ฟังก์ชันเก็บไม่ได้ → หายตอนรีเฟรชเหมือนเดิม)
function persist() {
  if (typeof window === 'undefined') return
  const strip = (s: HistoryAction[]) => s.filter(a => a.undoOps && a.redoOps).map(a => ({ label: a.label, undoOps: a.undoOps, redoOps: a.redoOps }))
  let u = strip(undoStack), r = strip(redoStack)
  // ใหญ่เกินที่เบราว์เซอร์ยอม (ลบออเดอร์ทีละเยอะๆ) → ทิ้งอันเก่าสุดทีละครึ่งจนเก็บได้
  for (let i = 0; i < 6; i++) {
    try { sessionStorage.setItem(KEY, JSON.stringify({ undo: u, redo: r })); return } catch {
      u = u.slice(Math.floor(u.length / 2)); r = r.slice(Math.floor(r.length / 2))
    }
  }
  try { sessionStorage.removeItem(KEY) } catch { /* เก็บไม่ได้ก็แค่ไม่จำ */ }
}

// อ่านกองเดิมตอนมีคนเริ่มฟัง (หลังหน้า hydrate แล้ว) — อ่านตอนโหลดโมดูลจะทำให้ปุ่ม ↶ ฝั่งเซิร์ฟเวอร์กับเบราว์เซอร์ไม่ตรงกัน
function restore() {
  if (restored || typeof window === 'undefined') return
  restored = true
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null') as { undo?: HistoryAction[]; redo?: HistoryAction[] } | null
    if (!saved) return
    // action ในหน่วยความจำ (ทำหลังโหลดหน้าแต่ก่อน HistoryBar ฟัง) ต่อท้ายของเดิม
    undoStack = [...(saved.undo ?? []), ...undoStack].slice(-MAX)
    if (!redoStack.length) redoStack = saved.redo ?? []
  } catch { /* ข้อมูลเสีย = เริ่มกองใหม่ */ }
}

function emit() { persist(); listeners.forEach(l => l()) }

export function subscribeHistory(fn: () => void): () => void {
  if (!restored) { restore(); setTimeout(() => listeners.forEach(l => l()), 0) }
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function recordAction(a: HistoryAction) {
  restore()
  undoStack.push(a)
  if (undoStack.length > MAX) undoStack.shift()
  redoStack = []          // มีการกระทำใหม่ → ล้างสาย redo (เหมือน Sheets)
  emit()
}

export function historySnapshot() {
  return {
    canUndo: undoStack.length > 0 && !busy,
    canRedo: redoStack.length > 0 && !busy,
    undoLabel: undoStack.length ? undoStack[undoStack.length - 1].label : '',
    redoLabel: redoStack.length ? redoStack[redoStack.length - 1].label : '',
    busy,
  }
}

// รันทางใดทางหนึ่ง: มีฟังก์ชัน (ทำในหน้านี้) ใช้ฟังก์ชัน · ไม่มี (กู้จากก่อนรีเฟรช) รันคำสั่ง DB แล้วโหลดหน้าใหม่
async function run(fn: (() => Promise<void> | void) | undefined, ops: DbOp[] | undefined): Promise<boolean> {
  if (fn) { await fn(); return false }
  if (!ops) throw new Error('รายการนี้ย้อนไม่ได้แล้ว')
  const { runOps } = await import('./historyOps')
  await runOps(ops)
  return true
}

export async function performUndo() {
  if (busy) return
  const a = undoStack.pop()
  if (!a) return
  busy = true; emit()
  let reload = false
  try {
    reload = await run(a.undo, a.undoOps)
    redoStack.push(a)
  } catch (e) {
    undoStack.push(a)      // ย้อนไม่สำเร็จ → คืน action กลับกอง
    throw e
  } finally {
    busy = false; emit()
  }
  if (reload) window.location.reload()
}

export async function performRedo() {
  if (busy) return
  const a = redoStack.pop()
  if (!a) return
  busy = true; emit()
  let reload = false
  try {
    reload = await run(a.redo, a.redoOps)
    undoStack.push(a)
  } catch (e) {
    redoStack.push(a)
    throw e
  } finally {
    busy = false; emit()
  }
  if (reload) window.location.reload()
}

export function clearHistory() { undoStack = []; redoStack = []; emit() }
