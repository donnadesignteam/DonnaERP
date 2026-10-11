// ตัดช่องที่ค่าเท่ากับตอนเปิดกล่องแก้ไขออก — ส่งไปฐานเฉพาะช่องที่คนแก้จริง
// ‼️ 11ต.ค.69 กล่องแก้ไขเดิมส่งทุกช่องกลับไป ระหว่างเปิดกล่องค้างไว้ถ้ามีคนสแกน/เปลี่ยนสถานะจากเครื่องอื่น
//    กดบันทึกแล้วค่าเก่าในกล่องทับกลับ (สถานะย้อน, ติ๊กจัดส่งหาย)
// ค่าว่าง ('' / undefined / null) ถือว่าเท่ากัน · keep = ช่องที่ส่งเสมอ
export function changedOnly<T extends object>(patch: T, orig: object | null | undefined, keep: string[] = ['updated_at']): Partial<T> {
  if (!orig) return patch
  const nv = (v: unknown) => JSON.stringify(v === undefined || v === '' ? null : v)
  const o = orig as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) if (keep.includes(k) || nv(v) !== nv(o[k])) out[k] = v
  return out as Partial<T>
}
