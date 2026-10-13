// "ใช้ของ" — ของจากพัสดุส่งกลับ / งานยกเลิก-ตีกลับ ที่เอาไปใช้ต่อ
// เมนู ⋯ → ปริ้นใช้ของ = ใบรายการแบบเดียวกับใบออเดอร์ + QR · สแกน QR (หน้า /use) = จำว่าใครเอาไปใช้ แล้วแถวย้ายไปช่อง "ใช้แล้ว"
// ‼️ แยกขาดจากสายสแกนงานผลิต: เขียนเฉพาะตาราง item_reuse — ไม่เรียก scan_advance / claim_scan_advance ไม่แตะ order_entries / claims / rail_packed
// ตาราง: sql/create_item_reuse.sql
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { formatOrderHtml, escPrintHtml, openFormPrintWindow, type PrintableOrder } from '@/lib/orderPrint'

export type ReuseKind = 'parcel' | 'stock' | 'order'
export type Reuse = { kind: ReuseKind; ref_id: string; used_by_code: string | null; used_by_name: string | null; used_at: string }
export type ReuseMap = Record<string, Reuse>

export const REUSE_TABLE = 'item_reuse'

// ‼️ QR ใบใช้ของ = /use?uk=<kind>&u=<id> — ชื่อพารามิเตอร์ต้องไม่ซ้ำกับ QR ใบออเดอร์ (/scan?id=&o=) และใบเคลม (/scan?c=)
//    หน้าสแกน (app/scan + ScanFolderButton) แกะ QR ด้วย [?&]id= / [?&]o= / [?&]c= — ถ้าใบใช้ของมี id= ของออเดอร์ที่ยกเลิก
//    เครื่องที่ยังค้างหน้าสแกนรุ่นเก่าจะเอาไปเดินสถานะออเดอร์นั้นแทน (เคยมีบั๊กใบเคลมซ้อนกับออเดอร์แบบนี้มาแล้ว)
export const reuseQrUrl = (origin: string, kind: ReuseKind, id: string) => `${origin}/use?uk=${kind}&u=${encodeURIComponent(id)}`
// อ่าน QR ใบใช้ของ → query string ของหน้า /use (ไม่ใช่ใบใช้ของ = '')
export function reuseQuery(text: string): string {
  const m = String(text).match(/\/use\?(uk=(?:parcel|stock|order)&u=[0-9a-f-]{36})(?![^\s&#])/i)
  return m ? m[1] : ''
}
export const reuseKey = (kind: ReuseKind, id: string) => `${kind}:${id}`
export const reuseErr = (m: string) => /item_reuse/.test(m) && /(does not exist|schema cache|not find)/i.test(m)
  ? 'ยังไม่มีตาราง item_reuse ในฐานข้อมูล — รันไฟล์ sql/create_item_reuse.sql ใน Supabase ก่อน (ปริ้นใบได้ แต่สแกนใช้ของยังไม่ได้)'
  : m

export async function loadReuse(kinds: ReuseKind[]): Promise<{ map: ReuseMap; error: string }> {
  const { data, error } = await supabase.from(REUSE_TABLE).select('*').in('kind', kinds)
  const map: ReuseMap = {}
  for (const r of (data ?? []) as Reuse[]) map[reuseKey(r.kind, r.ref_id)] = r
  return { map, error: error ? reuseErr(error.message) : '' }
}

// ยกเลิก "ใช้แล้ว" (สแกนผิด/เอาของมาคืน) → แถวกลับไปช่องเดิม
export async function undoReuse(kind: ReuseKind, id: string): Promise<string> {
  const { error } = await supabase.from(REUSE_TABLE).delete().eq('kind', kind).eq('ref_id', id)
  return error ? reuseErr(error.message) : ''
}

export const reuseWho = (u: Reuse) => u.used_by_name || u.used_by_code || 'ไม่ทราบชื่อ'
export const reuseWhen = (u: Reuse) => new Date(u.used_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

// ปริ้นใบใช้ของ — เปิดหน้าต่างทันทีตอนกด (กัน popup blocker) แล้วค่อยเติมเนื้อหา+QR
// body: ออเดอร์/พัสดุที่มีรายการสินค้า = ใช้สูตรใบออเดอร์ (lib/orderPrint) · แถวที่ลงเองเป็นข้อความ = ส่ง text มา
export async function printReuse(o: { kind: ReuseKind; id: string; head: string; order?: PrintableOrder; text?: string }): Promise<boolean> {
  const win = window.open('', '_blank', 'width=1200,height=750')
  if (!win) return false
  const qr = await QRCode.toDataURL(reuseQrUrl(window.location.origin, o.kind, o.id), { margin: 1, width: 240 }).catch(() => '')
  const body = o.order ? formatOrderHtml(o.order) : escPrintHtml(o.text ?? '')
  openFormPrintWindow([{ html: `${escPrintHtml(`ใช้ของ · ${o.head}`)}\n${body}\n\n${escPrintHtml('สแกน QR เมื่อเอาของไปใช้')}`, qr: qr || undefined }], `ใช้ของ ${o.head}`, win)
  return true
}
