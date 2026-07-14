// กองประวัติการกระทำทั้งเว็บ (undo/redo แบบ Google Sheets) — เก็บในหน่วยความจำเซสชันปัจจุบัน
// singleton นอก React เพื่อให้ทุกหน้า/ทุกจุดแก้ข้อมูล เรียก recordAction ได้โดยไม่ต้องส่ง context
// รีเฟรช/ปิดแท็บ = กองล้าง (เหมือนปิดแท็บ Sheets)
//
// แต่ละ action เก็บวิธี undo (ย้อน) + redo (ทำซ้ำ) เป็นฟังก์ชัน — ตัวที่ record เป็นคนกำหนดว่าย้อนยังไง
// ความถูกต้องยึดจากฐานข้อมูล: undo/redo แก้ DB แล้วสั่ง reload หน้า → UI ตรงกับ DB เสมอ

export type HistoryAction = {
  label: string                          // โชว์บนปุ่ม/ทูลทิป เช่น "ลบออเดอร์ #1234"
  undo: () => Promise<void> | void
  redo: () => Promise<void> | void
}

const MAX = 100
let undoStack: HistoryAction[] = []
let redoStack: HistoryAction[] = []
let busy = false
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

export function subscribeHistory(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function recordAction(a: HistoryAction) {
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

export async function performUndo() {
  if (busy) return
  const a = undoStack.pop()
  if (!a) return
  busy = true; emit()
  try {
    await a.undo()
    redoStack.push(a)
  } catch (e) {
    undoStack.push(a)      // ย้อนไม่สำเร็จ → คืน action กลับกอง
    throw e
  } finally {
    busy = false; emit()
  }
}

export async function performRedo() {
  if (busy) return
  const a = redoStack.pop()
  if (!a) return
  busy = true; emit()
  try {
    await a.redo()
    undoStack.push(a)
  } catch (e) {
    redoStack.push(a)
    throw e
  } finally {
    busy = false; emit()
  }
}

export function clearHistory() { undoStack = []; redoStack = []; emit() }
