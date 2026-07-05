// ตัวเดาโครง JSON ของขนส่ง — หา timeline (เวลา+ข้อความ) จาก response โดยไม่ผูกชื่อ field ตายตัว
// ใช้ร่วมกันใน API route ฝั่งเซิร์ฟเวอร์ (SPX ฯลฯ) — ฝั่ง extension มี logic เดียวกันใน extension/scraper.js

export type TrackEvent = { time: string; desc: string }

const TIME_KEY = /routed_?at|scan_?time|operate_?time|track_?time|created_?at|time_?stamp|^time$|^date$|_time$|_date$|_at$/i
const DESC_KEY = /message|_desc$|^desc|content|route_?action|state_?text|remark|detail|status_?name|tracking_?name/i

export function fmtTime(v: unknown): string {
  if (typeof v === 'number') {
    const d = new Date(v < 1e12 ? v * 1000 : v)
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Bangkok' }) + ' ' +
      d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  }
  return String(v ?? '')
}

export function extractEvents(obj: unknown): TrackEvent[] | null {
  let best: { arr: Record<string, unknown>[]; timeKey: string; descKey: string } | null = null
  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 8) return
    if (Array.isArray(node)) {
      if (node.length && node[0] && typeof node[0] === 'object' && !Array.isArray(node[0])) {
        const keys = Object.keys(node[0] as object)
        const timeKey = keys.find((k) => TIME_KEY.test(k))
        const descKey = keys.find((k) => DESC_KEY.test(k))
        if (timeKey && descKey && (!best || node.length > best.arr.length)) {
          best = { arr: node as Record<string, unknown>[], timeKey, descKey }
        }
      }
      node.forEach((x) => visit(x, depth + 1))
    } else if (typeof node === 'object') {
      Object.values(node as object).forEach((x) => visit(x, depth + 1))
    }
  }
  visit(obj, 0)
  if (!best) return null
  const b = best as { arr: Record<string, unknown>[]; timeKey: string; descKey: string }
  const events = b.arr
    .map((e) => ({ raw: e[b.timeKey], time: fmtTime(e[b.timeKey]), desc: String(e[b.descKey] ?? '').trim() }))
    .filter((e) => e.desc)
  if (events.length === 0) return null
  // เรียงใหม่ → เก่า ถ้าเวลาเป็นตัวเลขเทียบได้
  if (events.length > 1 && typeof events[0].raw === 'number' && (events[0].raw as number) < (events[events.length - 1].raw as number)) events.reverse()
  return events.map(({ time, desc }) => ({ time, desc }))
}

export function extractStateText(obj: unknown): string {
  let found = ''
  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 8 || found) return
    if (Array.isArray(node)) { node.forEach((x) => visit(x, depth + 1)); return }
    if (typeof node === 'object' && node) {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string' && v.trim() && /state_?text|latest_?track|current_?status/i.test(k)) { found = v.trim(); return }
      }
      Object.values(node).forEach((x) => visit(x, depth + 1))
    }
  }
  visit(obj, 0)
  return found
}
