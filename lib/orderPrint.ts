// ข้อความ "ใบออเดอร์" ที่ใช้ทั้งตอนคัดลอกและตอนปริ้นแบบฟอร์ม
// เดิมอยู่ใน components/OrderWorkspace.tsx — ย้ายออกมาเพราะหน้าปฏิทินงานติดตั้งขอปริ้นฟอร์มหน้าตาเดียวกัน
// ‼️ แก้ที่นี่ที่เดียว แล้วได้เหมือนกันทั้งหมวดออเดอร์และปฏิทินติดตั้ง
import { itemBlockLines, itemPrice, splitPullItems, pullRuns, type RawItem } from '@/lib/itemFormat'
import { effShipping } from '@/lib/shipping'
import { OUTSIDE_PLATFORMS } from '@/lib/orderTabs'
import { moneyLines, baht, type MoneyOrder } from '@/lib/orderMoney'

export type PrintLine = { t: string; rail?: boolean }

// ช่องที่ใบออเดอร์ใช้ — เขียนแบบหลวมๆ ให้ Entry ของหน้าออเดอร์และแถวที่ดึงตรงจาก order_entries ใส่ได้ทั้งคู่
export type PrintableOrder = MoneyOrder & {
  entry_date?: string | null
  platform?: string | null
  customer_name?: string | null
  order_number?: string | null
  serial_no?: string | null       // เลขที่ใบ (DR/IN/DM) — ขึ้นแทนเลขคำสั่งซื้อเมื่อใบนั้นไม่มีเลขคำสั่งซื้อ
  items?: RawItem[] | null
  outsource_at?: string | null
  is_installation?: boolean | null
  is_dropoff?: boolean | null
  shipping_datetime?: string | null
  deadline?: string | null        // วันกำหนดของงานนอก/งานเคลม = วันนัดติดตั้งของงานติดตั้ง (YYYY-MM-DD)
  install_time?: string | null    // เวลานัดติดตั้ง เช่น "9:00"
  courier?: string | null
  notes?: string | null
  address?: string | null
  phone?: string | null
  province?: string | null
  admin_name?: string | null
}

// opts.noMoney = ไม่ใส่บรรทัดยอดเงิน (ใบใช้ของ)
export function formatOrderLines(r: PrintableOrder, opts: { noMoney?: boolean } = {}): PrintLine[] {
  const lines: PrintLine[] = []
  const push = (t: string, rail = false) => lines.push({ t, rail })

  if (r.entry_date) {
    push(new Date(r.entry_date).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }))
  }

  const platformLine = [r.platform, r.customer_name].filter(Boolean).join(': ')
  if (platformLine) push(platformLine)
  // เลขคำสั่งซื้อ · ไม่มี (งานนอก/งานติดตั้ง/งานเคลมที่ไม่ได้มาจากแพลตฟอร์ม) → ขึ้นเลขที่ใบตรงนี้แทน
  if (r.order_number) push(r.order_number)
  else if (r.serial_no) push(r.serial_no)

  push('')

  itemSectionLines(r, opts).forEach(l => lines.push(l))

  push('')

  // ยอดเงิน (งานนอก/งานติดตั้ง): ยอดรวม · ค่าส่ง/ค่าติดตั้ง · ชำระแล้ว · เหลือชำระ — lib/orderMoney.ts
  const money = opts.noMoney ? [] : moneyLines(r)
  if (money.length) { money.forEach(t => push(t)); push('') }

  // บรรทัดวันกำหนด — ใช้วันชุดเดียวกับคอลัมน์ "วันที่เหลือ" บนหน้าจอ (effectiveDueDate ใน lib/orderTabs.ts)
  // งานติดตั้ง → "ติดตั้ง <วันนัด> <เวลา> น." · งานนอก/งานเคลม → "ส่งก่อน <deadline>"
  // งานแพลตฟอร์ม → "ส่งก่อน" จาก effShipping (dropoff +2 + เลี่ยงวันอาทิตย์/วันหยุดร้าน) — ห้ามใช้ shipping_datetime ดิบ
  const dl = ymdToDmy(r.deadline)
  if (r.is_installation && dl) {
    const t = (r.install_time ?? '').trim().replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1')
    push(`ติดตั้ง ${dl}${t ? ` ${t} น.` : ''}`)
  } else if (isOutsideOrderRow(r) && dl) {
    push(`ส่งก่อน ${dl}`)
  } else {
    const effShip = effShipping(r)
    if (effShip && effShip !== '-') push(`ส่งก่อน ${effShip}`)
  }
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

// ส่วนรายการสินค้าของใบคัดลอก/ปริ้น (📍ห้อง · ฝั่งดึง · ผ้าโปร่ง · ราคาท้ายบรรทัด) — แยกออกมาให้บอท LINE ใช้หน้าตาเดียวกัน (app/api/item-lines)
export function itemSectionLines(r: PrintableOrder, opts: { noMoney?: boolean } = {}): PrintLine[] {
  const lines: PrintLine[] = []
  const push = (t: string, rail = false) => lines.push({ t, rail })
  if (r.items && r.items.length > 0) {
    // รายการที่ลงสั่งนอก: ชื่อที่สั่ง + วัน/เดือนที่ลง ต่อท้ายรายการ เช่น "KC 8/7"
    const pushOutsource = (item: RawItem) => {
      const out = (item.outsource ?? '').trim()
      if (out) {
        const dt = r.outsource_at ? new Date(r.outsource_at) : new Date()
        push(`${out} ${dt.getDate()}/${dt.getMonth() + 1}`)
      }
    }
    // บรรทัดของรายการ 1 ชิ้นในใบคัดลอก/ปริ้น
    // - ผ้าโปร่ง: ย้ายคำว่า "ผ้าโปร่ง" ขึ้นไปหน้าชื่อชนิด "ผ้าโปร่งม่านลอนเทป" ไม่ซ้ำในบรรทัดสี (ทุกชนิดม่าน — user ขอ 17ต.ค.69)
    // - ราคาแยกของรายการ → ต่อท้ายบรรทัด "= 1 ชุด" เช่น "= 1 ชุด 1,500 บาท" (ใบใช้ของไม่ใส่)
    // ‼️ ทำที่นี่ ไม่ทำใน itemBlockLines เพราะตัวนั้นใช้กับหน้าจออื่นด้วย (รายละเอียดออเดอร์/มือถือ/สต็อก…)
    const blockOf = (item: RawItem, o?: { hideNote?: boolean }) => {
      const ls = itemBlockLines(item, o).map(l => ({ ...l }))
      const isRail = (item.type ?? '').startsWith('ราง')
      if (!isRail && (item.fabric_type ?? '').includes('โปร่ง') && ls.length >= 2 && !ls[0].t.includes('โปร่ง')) {
        ls[0].t = `ผ้าโปร่ง${ls[0].t}`
        const rest = ls[1].t.replace(/^(ผ้า)?โปร่ง\s*/, '').trim()
        if (rest) ls[1].t = rest
        else ls.splice(1, 1)
      }
      const p = opts.noMoney ? null : itemPrice(item.price)
      if (p != null && ls.length) ls[ls.length - 1] = { ...ls[ls.length - 1], t: `${ls[ls.length - 1].t} ${baht(p)} บาท` }
      return ls
    }
    // ฝั่งดึงรวมในรายการเดียว ("2 ชุด ดึงขวา1 ดึงซ้าย1") → แตกเป็นบรรทัดละฝั่ง เหมือนลงแยกรายการ
    const items = splitPullItems(r.items)
    const noteOf = (it: RawItem) => (it.note ?? '').trim()
    // รายการที่มีฝั่งดึงและหัวรายการ (ชนิด/สี) เหมือนกัน ติดกัน → ขึ้นหัวครั้งเดียว แล้วตามด้วยบรรทัดขนาดของแต่ละฝั่ง (ซ้ายก่อนขวา)
    // indent = แบบแยกตามห้อง: ชื่อชนิดชิดซ้าย บรรทัดอื่นเยื้อง 3 ช่อง
    // noteHead = หมายเหตุขึ้นท้ายชื่อชนิด "มู่ลี่ไม้ (บังราง)" แทนท้ายบรรทัดขนาด
    const pushList = (list: RawItem[], o: { indent: boolean; hideNote: boolean; noteHead: boolean }) => {
      pullRuns(list).forEach((run, ri) => {
        if (!o.indent && ri > 0) push('')
        const blocks = run.map(it => blockOf(it, { hideNote: o.hideNote || o.noteHead }))
        const notes = o.noteHead ? [...new Set(run.map(noteOf).filter(Boolean))] : []
        blocks[0].slice(0, -1).forEach((ln, li) => {
          const t = li === 0 && notes.length ? `${ln.t} (${notes.join(' ')})` : ln.t
          push(o.indent && li > 0 ? `   ${t}` : t, ln.rail)
        })
        blocks.forEach(ls => {
          const ln = ls[ls.length - 1]
          const t = ls.length === 1 && notes.length ? `${ln.t} (${notes.join(' ')})` : ln.t
          push(o.indent && ls.length > 1 ? `   ${t}` : t, ln.rail)
        })
        const seen = new Set<string>()
        run.forEach(it => { const k = (it.outsource ?? '').trim(); if (!seen.has(k)) { seen.add(k); pushOutsource(it) } })
      })
    }
    // แยกหัวข้อตามห้อง (ช่อง "ห้อง") เหมือนใบเสนอราคา จะได้รู้ว่ารางชุดไหนคู่กับผ้าผืนไหน — หัวข้อ "📍ห้องนอน"
    // ไม่มีช่องห้อง: งานนอก/งานติดตั้งที่ลงจุดไว้ในหมายเหตุ ≥ 2 รายการ แยกตามหมายเหตุแบบเดิม · งานแพลตฟอร์มพิมพ์เรียงตามเดิม
    // ทุกรายการในห้องมีหมายเหตุเดียวกัน (เช่น "สูงเต็ม") → ต่อท้ายหัวข้อห้องครั้งเดียว "📍ประตูหน้า สูงเต็ม"
    const hasRoom = items.some(it => (it.room ?? '').trim())
    const isOutsideOrder = OUTSIDE_PLATFORMS.includes(r.platform ?? '') || !!r.is_installation
    const pointOf = (it: RawItem) => (hasRoom ? (it.room ?? '') : noteOf(it)).trim()
    const byPoint = hasRoom || (isOutsideOrder && items.filter(it => noteOf(it)).length >= 2)
    if (byPoint) {
      const points: string[] = []
      for (const it of items) { const p = pointOf(it); if (!points.includes(p)) points.push(p) }
      points.forEach((p, gi) => {
        if (gi > 0) push('')
        let list = items.filter(it => pointOf(it) === p)
        let head = p
        if (hasRoom && p && list.length > 1) {
          const shared = noteOf(list[0])
          if (shared && list.every(it => noteOf(it) === shared)) { head = `${p} ${shared}`; list = list.map(it => ({ ...it, note: '' })) }
        }
        if (head) push(`📍${head}`)
        pushList(list, { indent: true, hideNote: !hasRoom, noteHead: hasRoom })
      })
    } else {
      pushList(items, { indent: false, hideNote: false, noteHead: false })
    }
  }

  return lines
}

// 'YYYY-MM-DD' → 'D/M/YYYY' (รูปแบบเดียวกับวันส่งของงานแพลตฟอร์มในใบ)
export function ymdToDmy(v: string | null | undefined): string {
  const m = (v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${parseInt(m[3])}/${parseInt(m[2])}/${m[1]}` : ''
}
const isOutsideOrderRow = (r: PrintableOrder) => OUTSIDE_PLATFORMS.includes(r.platform ?? '') || !!r.is_installation

export const escPrintHtml = (v: string) => v.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))

export function formatOrderText(r: PrintableOrder): string {
  return formatOrderLines(r).map(l => l.t).join('\n')
}

// เวอร์ชัน HTML สำหรับปริ้น: บรรทัดของราง = สีแดง
export function formatOrderHtml(r: PrintableOrder, opts: { noMoney?: boolean } = {}): string {
  return formatOrderLines(r, opts).map(l => (l.rail ? `<span class="rail">${escPrintHtml(l.t)}</span>` : escPrintHtml(l.t))).join('\n')
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
