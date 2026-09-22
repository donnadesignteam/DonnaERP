// ตัดสต็อกผ้าตามออเดอร์ — เรียกทุกครั้งที่ขั้นตัดผ้ามีการสแกน/ยกเลิกสแกน (app/scan/page.tsx → splitCut)
// เมตรต่อรายการใช้สูตรเดียวกับยอดตัดผ้าของพนักงาน (cutMeters ใน lib/fabricUsage.ts)
// จับคู่สีผ้า: รหัสสีในรายการ = fabric_code ในสต็อก (ไม่เจอ → shop_code) · ไม่มีรหัส → ชื่อสีตรงกันพอดี
//   ‼️ รหัส/ชื่อที่ตรงกับสต็อกมากกว่า 1 แถว = กำกวม → ไม่ตัด (ห้ามเดา)
// RPC sync_stock_cut (sql/stock_cut.sql): มีคนสแกนตัดอยู่ = ตัดครั้งเดียว · ยกเลิกจนไม่เหลือใคร = คืนสต็อก
import { supabase } from '@/lib/supabase'
import { round2, type CutLine } from '@/lib/fabricUsage'

type StockRow = { id: string | number; fabric_code: string | null; shop_code: string | null; color_name: string | null; suppliers?: { shop_code?: string }[] | null }
const norm = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '')

// หาแถวสต็อกที่ตรงแบบไม่กำกวม (ตรงแถวเดียวเท่านั้น)
function uniqueBy(stock: StockRow[], key: (s: StockRow) => string) {
  const m = new Map<string, StockRow | null>()
  for (const s of stock) {
    const k = key(s)
    if (!k) continue
    m.set(k, m.has(k) ? null : s)   // เจอซ้ำ = null (กำกวม)
  }
  return m
}

export async function syncStockCut(scanNo: string, items: unknown, lines: CutLine[]) {
  const list = Array.isArray(items) ? (items as { color_code?: string; color_name?: string }[]) : []
  const need = lines.filter(l => !l.skip && !l.warn && l.meters > 0)
  const sum = new Map<string, number>()
  if (need.length) {
    // suppliers = รหัสร้านทุกเจ้าของรหัสผ้านี้ (ยังไม่ได้รัน sql/stock_merge_suppliers.sql = ไม่มีคอลัมน์ → ดึงแบบเดิม)
    let { data, error } = await supabase.from('stock').select('id, fabric_code, shop_code, color_name, suppliers')
    if (error && /suppliers/.test(error.message)) ({ data, error } = await supabase.from('stock').select('id, fabric_code, shop_code, color_name'))
    if (error) throw new Error(error.message)
    const stock = (data ?? []) as StockRow[]
    const byFabric = uniqueBy(stock, s => norm(s.fabric_code))
    // รหัสร้านของทุกซัพพลายเออร์ชี้มาที่แถวเดียวกัน
    const byShop = uniqueBy(stock.flatMap(s => [...new Set([s.shop_code, ...(s.suppliers ?? []).map(x => x?.shop_code)].map(norm).filter(Boolean))].map(code => ({ ...s, shop_code: code }))), s => norm(s.shop_code))
    const byName = uniqueBy(stock, s => norm(s.color_name))
    for (const l of need) {
      const it = list[l.i] ?? {}
      const code = norm(it.color_code)
      const hit = code
        ? (byFabric.has(code) ? byFabric.get(code) : byShop.get(code))
        : byName.get(norm(it.color_name))
      if (!hit) continue   // ไม่เจอ/กำกวม → ไม่ตัด
      const k = String(hit.id)
      sum.set(k, round2((sum.get(k) ?? 0) + l.meters))
    }
  }
  // ‼️ เรียก RPC เสมอแม้ไม่มีอะไรต้องตัด — กรณียกเลิกสแกนตัด RPC จะคืนสต็อกที่หักไป
  const rows = [...sum].map(([stock_id, meters]) => ({ stock_id, meters }))
  const { error } = await supabase.rpc('sync_stock_cut', { p_scan_no: scanNo, p_rows: rows })
  if (error) throw new Error(error.message)
}
