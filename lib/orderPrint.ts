// ข้อความ "ใบออเดอร์" ที่ใช้ทั้งตอนคัดลอกและตอนปริ้นแบบฟอร์ม
// เดิมอยู่ใน components/OrderWorkspace.tsx — ย้ายออกมาเพราะหน้าปฏิทินงานติดตั้งขอปริ้นฟอร์มหน้าตาเดียวกัน
// ‼️ แก้ที่นี่ที่เดียว แล้วได้เหมือนกันทั้งหมวดออเดอร์และปฏิทินติดตั้ง
import { itemBlockLines, type RawItem } from '@/lib/itemFormat'
import { effShipping } from '@/lib/shipping'
import { OUTSIDE_PLATFORMS } from '@/lib/orderTabs'

export type PrintLine = { t: string; rail?: boolean }

// ช่องที่ใบออเดอร์ใช้ — เขียนแบบหลวมๆ ให้ Entry ของหน้าออเดอร์และแถวที่ดึงตรงจาก order_entries ใส่ได้ทั้งคู่
export type PrintableOrder = {
  entry_date?: string | null
  platform?: string | null
  customer_name?: string | null
  order_number?: string | null
  items?: RawItem[] | null
  outsource_at?: string | null
  is_installation?: boolean | null
  is_dropoff?: boolean | null
  shipping_datetime?: string | null
  courier?: string | null
  notes?: string | null
  address?: string | null
  phone?: string | null
  province?: string | null
  admin_name?: string | null
}

export function formatOrderLines(r: PrintableOrder): PrintLine[] {
  const lines: PrintLine[] = []
  const push = (t: string, rail = false) => lines.push({ t, rail })

  if (r.entry_date) {
    push(new Date(r.entry_date).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }))
  }

  const platformLine = [r.platform, r.customer_name].filter(Boolean).join(': ')
  if (platformLine) push(platformLine)
  if (r.order_number) push(r.order_number)

  push('')

  if (r.items && r.items.length > 0) {
    // รายการที่ลงสั่งนอก: ชื่อที่สั่ง + วัน/เดือนที่ลง ต่อท้ายรายการ เช่น "KC 8/7"
    const pushOutsource = (item: RawItem) => {
      const out = (item.outsource ?? '').trim()
      if (out) {
        const dt = r.outsource_at ? new Date(r.outsource_at) : new Date()
        push(`${out} ${dt.getDate()}/${dt.getMonth() + 1}`)
      }
    }
    // งานนอก/งานติดตั้งที่ลงจุดไว้ในช่องหมายเหตุของรายการ (ห้องครัว/โถงหน้าบ้าน…) — พิมพ์แยกหัวข้อตามจุด
    // เหมือนใบเสนอราคา จะได้รู้ว่ารางชุดไหนคู่กับผ้าผืนไหน · งานแพลตฟอร์มพิมพ์แบบเดิม (หมายเหตุมักเป็น ซ้าย/ขวา ไม่ใช่จุด)
    const isOutsideOrder = OUTSIDE_PLATFORMS.includes(r.platform ?? '') || !!r.is_installation
    const noted = r.items.filter(it => (it.note ?? '').trim())
    const byPoint = isOutsideOrder && noted.length >= 2
    if (byPoint) {
      const points: string[] = []
      for (const it of r.items) {
        const p = (it.note ?? '').trim()
        if (!points.includes(p)) points.push(p)
      }
      points.forEach((p, gi) => {
        if (gi > 0) push('')
        if (p) push(`[${p}]`)
        r.items!.filter(it => (it.note ?? '').trim() === p).forEach(item => {
          itemBlockLines(item, { hideNote: true }).forEach((ln, li) => push(li === 0 ? `• ${ln.t}` : `   ${ln.t}`, ln.rail))
          pushOutsource(item)
        })
      })
    } else {
      r.items.forEach((item, idx) => {
        if (idx > 0) push('')
        for (const ln of itemBlockLines(item)) push(ln.t, ln.rail)
        pushOutsource(item)
      })
    }
  }

  push('')

  // ‼️ ใช้ effShipping (dropoff +2 + เลี่ยงวันอาทิตย์/วันหยุดร้าน) ให้ตรงกับวันที่ที่โชว์บนหน้าจอ — ห้ามใช้ shipping_datetime ดิบ
  const effShip = effShipping(r)
  if (effShip && effShip !== '-') push(`ส่งก่อน ${effShip}`)
  if (r.courier) push(r.courier)
  if (r.notes) push(`หมายเหตุ: ${r.notes}`)

  // ที่อยู่จัดส่ง — ขึ้นเมื่อมีข้อมูลเท่านั้น
  // ‼️ คอลัมน์ "ที่อยู่จัดส่งแยก" ของแท็บงานแพลตฟอร์ม = ช่อง address ตัวเดียวกับ "ที่อยู่" ของแท็บอื่น
  const shipAddr = (r.address ?? '').trim()
  const shipPhone = (r.phone ?? '').trim()
  if (shipAddr || shipPhone) {
    push('')
    push(r.is_installation ? 'ที่อยู่หน้างาน' : 'ที่อยู่จัดส่ง')
    if (r.customer_name) push(r.customer_name)
    if (shipPhone) push(shipPhone)
    if (shipAddr) {
      const prov = (r.province ?? '').trim()
      push(prov && !shipAddr.includes(prov) ? `${shipAddr} ${prov}` : shipAddr)
    }
  }

  // ชื่อแอดมินต่อท้ายสุด — ขึ้นทั้งตอนคัดลอกและใบปริ้น
  if (r.admin_name) {
    push('')
    push(`แอดมิน: ${r.admin_name}`)
  }

  return lines
}

export const escPrintHtml = (v: string) => v.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))

export function formatOrderText(r: PrintableOrder): string {
  return formatOrderLines(r).map(l => l.t).join('\n')
}

// เวอร์ชัน HTML สำหรับปริ้น: บรรทัดของราง = สีแดง
export function formatOrderHtml(r: PrintableOrder): string {
  return formatOrderLines(r).map(l => (l.rail ? `<span class="rail">${escPrintHtml(l.t)}</span>` : escPrintHtml(l.t))).join('\n')
}

export function linesToHtml(lines: PrintLine[]): string {
  return lines.map(l => (l.rail ? `<span class="rail">${escPrintHtml(l.t)}</span>` : escPrintHtml(l.t))).join('\n')
}

// CSS + หน้าต่างปริ้นแบบ "ฟอร์ม" (ก้อนข้อความ + QR) — หน้าตาเดียวกับใบปริ้นในหมวดออเดอร์
// existing = หน้าต่างที่เปิดค้างไว้ก่อนแล้ว (เปิดทันทีตอนกดปุ่มเพื่อกัน popup blocker แล้วค่อยเติมเนื้อหา)
export function openFormPrintWindow(blocks: { html: string; qr?: string }[], title: string, existing?: Window | null): Window | null {
  const win = existing ?? window.open('', '_blank', 'width=1200,height=750')
  if (!win) return null
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${escPrintHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 12px; color: #000; margin: 0; padding: 16px; }
  pre.copy { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 16px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; margin: 0; }
  pre.copy .rail { color: #c00; }
  .order { display: block; break-inside: avoid; page-break-inside: avoid; padding-bottom: 28px; margin-bottom: 28px; border-bottom: 1px dashed #b0b0b0; }
  .order:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: none; }
  .qr-box { display: inline-block; text-align: center; margin-top: 14px; }
  .qr { width: 120px; height: 120px; display: block; }
  @page { margin: 0; }
  @media print { body { padding: 14mm; } .toolbar { display: none !important; } pre.copy { outline: none !important; background: transparent !important; } }
  pre.copy[contenteditable]:hover { outline: 1.5px dashed #c0c0c0; outline-offset: 4px; }
  pre.copy[contenteditable]:focus { outline: 1.5px solid #2563eb; outline-offset: 4px; background: #fafcff; }
  .toolbar { position: fixed; top: 10px; right: 10px; background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 8px 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); display: flex; gap: 10px; align-items: center; z-index: 99; }
  .toolbar .hint { font-size: 12px; color: #888; }
  .toolbar button.go { padding: 8px 20px; border-radius: 8px; border: none; background: #1a1a1a; color: #fff; cursor: pointer; font-size: 14px; font-weight: 700; font-family: inherit; }
</style>
</head>
<body>
<div class="toolbar">
  <span class="hint">แตะข้อความเพื่อแก้ไขได้ก่อนปริ้น</span>
  <button class="go" onclick="window.print()">🖨 ปริ้น</button>
</div>
${blocks.map(b => `<div class="order"><pre class="copy" contenteditable="true" spellcheck="false">${b.html}</pre>${b.qr ? `<div class="qr-box"><img class="qr" src="${b.qr}"/></div>` : ''}</div>`).join('')}
</body>
</html>`
  win.document.open(); win.document.write(html); win.document.close(); win.focus()
  return win
}
