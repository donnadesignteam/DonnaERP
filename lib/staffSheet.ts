// ดึง+parse ข้อมูลพนักงานจาก Google Sheet ฝ่ายบุคคล (server-only, read-only)
const SHEET_ID = '19gWE_qpP6-2IkZAM3PKYAYIP6h6tnjq64MVqHmLJ4v4'
const GID_SUMMARY = '333241367'   // สรุปข้อมูลพนักงาน
const GID_LEAVES = '1997858290'   // ประวัติการลา (ทุกคน)

const csvUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* skip */ }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

const clean = (v: string | undefined) => {
  const s = (v ?? '').trim()
  return s === '' || s === '#REF!' ? null : s
}
const num = (v: string | undefined) => {
  const s = clean(v)
  if (s == null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// แยกพนักงานตาม "เนื้องาน" (ธุรการ / ปฏิบัติการ) — ไม่มีในชีท แมปด้วยรหัส
// คนใหม่/เปลี่ยนแผนกให้อัปเดตที่นี่
const DIVISION: Record<string, string> = {
  DN001: 'ธุรการ', DN002: 'ธุรการ', DN003: 'ปฏิบัติการ', DN004: 'ปฏิบัติการ', DN005: 'ปฏิบัติการ',
  DN006: 'ปฏิบัติการ', DN007: 'ปฏิบัติการ', DN008: 'ปฏิบัติการ', DN009: 'ปฏิบัติการ', DN010: 'ธุรการ',
  DN011: 'ปฏิบัติการ', DN012: 'ธุรการ', DN013: 'ปฏิบัติการ', DN014: 'ธุรการ', DN015: 'ธุรการ',
  DN016: 'ปฏิบัติการ', DN017: 'ปฏิบัติการ', DN018: 'ปฏิบัติการ', DN019: 'ธุรการ', DN020: 'ปฏิบัติการ',
  DN021: 'ปฏิบัติการ', DN022: 'ปฏิบัติการ', DN023: 'ปฏิบัติการ', DN024: 'ปฏิบัติการ', DN025: 'ธุรการ',
  DN026: 'ธุรการ', DN027: 'ปฏิบัติการ', DN028: 'ปฏิบัติการ', DN029: 'ธุรการ', DN030: 'ธุรการ',
  DN031: 'ปฏิบัติการ', DN032: 'ปฏิบัติการ', DN033: 'ปฏิบัติการ', DN034: 'ปฏิบัติการ',
}

// พนักงานที่ลาออกแล้ว (ชีทยังมีข้อมูลอยู่ แต่ไม่ต้องแสดงใน ERP)
const RESIGNED = new Set(['DN012'])

export type Staff = {
  code: string
  name: string | null
  nickname: string | null
  position: string | null
  division: string | null
  sick: { avail: number | null; used: number | null; left: number | null }
  personal: { avail: number | null; full: number | null; half: number | null; left: number | null }
  vacation: { avail: number | null; used: number | null; left: number | null }
  wop: { full: number | null; half: number | null; hours: number | null }
  late: number | null
  warning: string | null
  note: string | null
}

export type LeaveRecord = {
  filed: string | null   // วันที่ยื่น
  date: string | null    // วันที่ลา
  time: string | null
  type: string | null    // ประเภทการลา
  reason: string | null
  redzone: string | null
  lateMin: string | null
  status: string | null  // สถานะใบลา
  supervisor: string | null
}

export async function fetchStaff(): Promise<Staff[]> {
  const res = await fetch(csvUrl(GID_SUMMARY), { next: { revalidate: 300 } })
  if (!res.ok) throw new Error('summary ' + res.status)
  const rows = parseCsv(await res.text())
  return rows
    .filter((r) => /^DN\d+/i.test((r[0] || '').trim()) && !RESIGNED.has((r[0] || '').trim().toUpperCase()))
    .map((r) => ({
      code: (r[0] || '').trim(),
      name: clean(r[1]),
      nickname: clean(r[2]),
      position: clean(r[3]),
      division: DIVISION[(r[0] || '').trim().toUpperCase()] || null,
      sick:     { avail: num(r[4]),  used: num(r[5]),  left: num(r[6]) },
      personal: { avail: num(r[7]),  full: num(r[8]),  half: num(r[9]),  left: num(r[10]) },
      vacation: { avail: num(r[11]), used: num(r[12]), left: num(r[13]) },
      wop:      { full: num(r[14]),  half: num(r[15]), hours: num(r[16]) },
      late: num(r[17]),
      warning: clean(r[18]),
      note: clean(r[19]),
    }))
}

// ประวัติการลาของพนักงานคนหนึ่ง (ตามรหัส) + วันเริ่มงาน
export async function fetchLeavesByCode(code: string): Promise<{ leaves: LeaveRecord[]; startDate: string | null }> {
  const res = await fetch(csvUrl(GID_LEAVES), { next: { revalidate: 300 } })
  if (!res.ok) throw new Error('leaves ' + res.status)
  const rows = parseCsv(await res.text())
  let startDate: string | null = null
  const leaves: LeaveRecord[] = []
  for (const r of rows) {
    if ((r[4] || '').trim().toUpperCase() !== code.toUpperCase()) continue
    if (!startDate) startDate = clean(r[15])
    leaves.push({
      filed: clean(r[1]),
      date: clean(r[2]),
      time: clean(r[3]),
      type: clean(r[6]),
      reason: clean(r[8]),
      redzone: clean(r[10]),
      lateMin: clean(r[11]),
      status: clean(r[12]),
      supervisor: clean(r[13]),
    })
  }
  return { leaves, startDate }
}
