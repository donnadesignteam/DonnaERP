// ทะเบียนลูกค้า — รวบจากชื่อที่เคยลงไว้ในใบงาน (ระบบไม่มีตารางลูกค้าแยก)
// ‼️ ทำเพราะแอดมินแต่ละคนเคยลงชื่อลูกค้าคนเดียวกันคนละแบบ (ชื่อไลน์ / ชื่อ Shopee / ชื่อจริง)
//    ใบของลูกค้าคนเดียวเลยแตกเป็นหลายโฟลเดอร์ → ตอนเพิ่มรายการให้ค้นชื่อเดิมก่อนเสมอ
// ใช้ร่วมกับ components/CustomerPickStep.tsx — ห้ามก๊อปตรรกะไปเขียนซ้ำที่อื่น

export type CustomerRow = {
  name?: string | null
  phone?: string | null
  order_number?: string | null
  date?: string | null        // วันที่ของใบ (ใช้เรียงว่าใครล่าสุด)
}

export type CustomerEntry = {
  name: string
  phone: string               // เบอร์แรกที่เจอ — เอาไปเติมให้ฟอร์มตอนเลือก
  phones: string[]            // ทุกเบอร์ที่เคยลงให้ชื่อนี้ (เฉพาะตัวเลข) — ใช้ค้น
  orders: string[]            // เลขคำสั่งซื้อทุกใบของชื่อนี้ (พิมพ์เล็ก) — ใช้ค้น
  last: string
}

// เทียบชื่อแบบหลวม: ไม่สนตัวพิมพ์เล็ก/ใหญ่ ช่องว่าง และคำนำหน้า → "คุณมุก" กับ "มุก" ถือว่าใกล้เคียงกัน
export const normName = (v: string) =>
  v.toLowerCase().replace(/^(คุณ|พี่|น้อง|k\.|k\s)\s*/, '').replace(/\s+/g, '')

export function buildCustomerBook(rows: CustomerRow[]): CustomerEntry[] {
  const m = new Map<string, CustomerEntry>()
  for (const r of rows) {
    const name = (r.name ?? '').trim()
    if (!name) continue
    const date = r.date ?? ''
    const digits = (r.phone ?? '').replace(/\D/g, '')
    const ono = (r.order_number ?? '').trim().toLowerCase()
    const cur = m.get(name)
    if (cur) {
      if (!cur.phone && r.phone) cur.phone = r.phone
      if (date > cur.last) cur.last = date
      if (digits && !cur.phones.includes(digits)) cur.phones.push(digits)
      if (ono && !cur.orders.includes(ono)) cur.orders.push(ono)
    } else {
      m.set(name, { name, phone: r.phone ?? '', phones: digits ? [digits] : [], orders: ono ? [ono] : [], last: date })
    }
  }
  return [...m.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
}

// ค้นได้ 3 ทาง: ชื่อ (แบบหลวม) · เบอร์โทร · เลขคำสั่งซื้อ — เบอร์/เลขออเดอร์ตรงกันคือตัวชี้ขาดว่าเป็นคนเดียวกัน
export function matchCustomers(book: CustomerEntry[], query: string): CustomerEntry[] {
  const q = query.trim()
  if (!q) return book.slice(0, 8)
  const nq = normName(q)
  const lq = q.toLowerCase()
  const digits = q.replace(/\D/g, '')
  return book
    .filter(c =>
      (nq && normName(c.name).includes(nq))
      || (digits.length >= 4 && c.phones.some(p => p.includes(digits)))
      || (lq.length >= 4 && c.orders.some(o => o.includes(lq))))
    .sort((a, b) => Number(normName(b.name).startsWith(nq)) - Number(normName(a.name).startsWith(nq)))
    .slice(0, 20)
}
