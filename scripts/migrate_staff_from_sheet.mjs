// migrate_staff_from_sheet.mjs — snapshot ข้อมูลพนักงานจาก Google Sheet HR เข้า DB ครั้งเดียว
// (หลังจากนี้แก้ในเว็บแทน ไม่ดึงชีทอีก)
//
// เตรียม: ตาราง staff ต้องมีแล้ว (รัน scripts/add_staff_table.sql ก่อน)
// วิธีใช้:
//   node scripts/migrate_staff_from_sheet.mjs           <- ดูตัวอย่าง (dry run ไม่เขียน)
//   node scripts/migrate_staff_from_sheet.mjs --apply   <- เขียนจริง

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const APPLY = process.argv.includes('--apply')
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.trim().match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const SHEET = '19gWE_qpP6-2IkZAM3PKYAYIP6h6tnjq64MVqHmLJ4v4'
const GID_SUMMARY = '333241367', GID_LEAVES = '1997858290'
const csvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SHEET}/export?format=csv&gid=${gid}`

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' }
    else if (c === '\r') { /* skip */ }
    else f += c
  }
  if (f.length || row.length) { row.push(f); rows.push(row) }
  return rows
}
const clean = (v) => { const s = (v ?? '').trim(); return s === '' || s === '#REF!' ? null : s }
const num = (v) => { const s = clean(v); if (s == null) return null; const n = Number(s); return Number.isFinite(n) ? n : null }
// "7/1/2026" (D/M/YYYY ค.ศ.) -> "2026-01-07"
const toYMD = (v) => {
  const s = clean(v); if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}`
}

const DIVISION = {
  DN001: 'ธุรการ', DN002: 'ธุรการ', DN003: 'ปฏิบัติการ', DN004: 'ปฏิบัติการ', DN005: 'ปฏิบัติการ',
  DN006: 'ปฏิบัติการ', DN007: 'ปฏิบัติการ', DN008: 'ปฏิบัติการ', DN009: 'ปฏิบัติการ', DN010: 'ธุรการ',
  DN011: 'ปฏิบัติการ', DN012: 'ธุรการ', DN013: 'ปฏิบัติการ', DN014: 'ธุรการ', DN015: 'ธุรการ',
  DN016: 'ปฏิบัติการ', DN017: 'ปฏิบัติการ', DN018: 'ปฏิบัติการ', DN019: 'ธุรการ', DN020: 'ปฏิบัติการ',
  DN021: 'ปฏิบัติการ', DN022: 'ปฏิบัติการ', DN023: 'ปฏิบัติการ', DN024: 'ปฏิบัติการ', DN025: 'ธุรการ',
  DN026: 'ธุรการ', DN027: 'ปฏิบัติการ', DN028: 'ปฏิบัติการ', DN029: 'ธุรการ', DN030: 'ธุรการ',
  DN031: 'ปฏิบัติการ', DN032: 'ปฏิบัติการ', DN033: 'ปฏิบัติการ', DN034: 'ปฏิบัติการ',
}
const RESIGNED = new Set(['DN012'])

const main = async () => {
  const [sumRes, lvRes] = await Promise.all([fetch(csvUrl(GID_SUMMARY)), fetch(csvUrl(GID_LEAVES))])
  const sumRows = parseCsv(await sumRes.text())
  const lvRows = parseCsv(await lvRes.text())

  // วันเริ่มงานต่อรหัส (จากชีทประวัติลา col15)
  const startByCode = {}
  for (const r of lvRows) { const code = (r[4] || '').trim().toUpperCase(); if (code && !startByCode[code]) { const sd = toYMD(r[15]); if (sd) startByCode[code] = sd } }

  // ----- staff -----
  const staff = sumRows
    .filter((r) => /^DN\d+/i.test((r[0] || '').trim()))
    .map((r) => {
      const code = (r[0] || '').trim().toUpperCase()
      return {
        code, name: clean(r[1]), nickname: clean(r[2]), position: clean(r[3]),
        division: DIVISION[code] || null, active: !RESIGNED.has(code),
        start_date: startByCode[code] || null,
        sick_avail: num(r[4]), sick_used: num(r[5]), sick_left: num(r[6]),
        personal_avail: num(r[7]), personal_full: num(r[8]), personal_half: num(r[9]), personal_left: num(r[10]),
        vacation_avail: num(r[11]), vacation_used: num(r[12]), vacation_left: num(r[13]),
        wop_full: num(r[14]), wop_half: num(r[15]), wop_hours: num(r[16]),
        late: num(r[17]), warning: clean(r[18]), note: clean(r[19]),
      }
    })
  const nameByCode = Object.fromEntries(staff.map((s) => [s.code, s]))

  // ----- ประวัติลา -> leave_requests (กันซ้ำด้วย key code|date|type) -----
  const { data: existing } = await sb.from('leave_requests').select('employee_code, leave_date, leave_type')
  const seen = new Set((existing || []).map((e) => `${e.employee_code}|${e.leave_date}|${e.leave_type}`))
  const leaves = []
  for (const r of lvRows.slice(1)) {
    const code = (r[4] || '').trim().toUpperCase()
    const date = toYMD(r[2])
    const type = clean(r[6])
    if (!code || !date || !type) continue
    const key = `${code}|${date}|${type}`
    if (seen.has(key)) continue
    seen.add(key)
    const s = nameByCode[code]
    leaves.push({
      employee_code: code,
      employee_name: clean(r[5]) || s?.name || null,
      employee_nickname: clean(r[0]) || s?.nickname || null,
      department: s?.division || null,
      leave_date: date, leave_end_date: date,
      leave_time: clean(r[3]) || '08:00',
      leave_type: type,
      reason: clean(r[8]),
      leave_status: clean(r[12]) || 'ใบลาเรียบร้อย',
      supervisor_approval: clean(r[13]) || 'อนุมัติ',
      hr_approval: clean(r[14]) || 'อนุมัติ',
    })
  }

  console.log(`staff: ${staff.length} คน (ลาออก ${staff.filter((s) => !s.active).length})`)
  console.log(`ประวัติลาใหม่ที่จะ import: ${leaves.length} แถว (ข้ามที่ซ้ำแล้ว)`)

  // ----- โหมด --sql: เขียนไฟล์ SQL รวม (สร้างตาราง + INSERT) ไปวางใน Supabase SQL Editor -----
  if (process.argv.includes('--sql')) {
    const { writeFileSync } = await import('fs')
    const ddl = readFileSync(new URL('./add_staff_table.sql', import.meta.url), 'utf8')
    const q = (v) => (v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
    const nq = (v) => (v == null ? 'NULL' : String(v))
    const SCOLS = ['code', 'name', 'nickname', 'position', 'division', 'active', 'start_date', 'sick_avail', 'sick_used', 'sick_left', 'personal_avail', 'personal_full', 'personal_half', 'personal_left', 'vacation_avail', 'vacation_used', 'vacation_left', 'wop_full', 'wop_half', 'wop_hours', 'late', 'warning', 'note']
    const sVals = staff.map((s) =>
      `(${q(s.code)}, ${q(s.name)}, ${q(s.nickname)}, ${q(s.position)}, ${q(s.division)}, ${s.active ? 'true' : 'false'}, ${s.start_date ? q(s.start_date) : 'NULL'}, ${nq(s.sick_avail)}, ${nq(s.sick_used)}, ${nq(s.sick_left)}, ${nq(s.personal_avail)}, ${nq(s.personal_full)}, ${nq(s.personal_half)}, ${nq(s.personal_left)}, ${nq(s.vacation_avail)}, ${nq(s.vacation_used)}, ${nq(s.vacation_left)}, ${nq(s.wop_full)}, ${nq(s.wop_half)}, ${nq(s.wop_hours)}, ${nq(s.late)}, ${q(s.warning)}, ${q(s.note)})`
    ).join(',\n')
    const LCOLS = ['employee_code', 'employee_name', 'employee_nickname', 'department', 'leave_date', 'leave_end_date', 'leave_time', 'leave_type', 'reason', 'leave_status', 'supervisor_approval', 'hr_approval']
    const lVals = leaves.map((l) =>
      `(${q(l.employee_code)}, ${q(l.employee_name)}, ${q(l.employee_nickname)}, ${q(l.department)}, ${q(l.leave_date)}, ${q(l.leave_end_date)}, ${q(l.leave_time)}, ${q(l.leave_type)}, ${q(l.reason)}, ${q(l.leave_status)}, ${q(l.supervisor_approval)}, ${q(l.hr_approval)})`
    ).join(',\n')
    const sql = `${ddl}\n\n-- ===== ข้อมูลพนักงาน (${staff.length} คน) =====\ninsert into staff (${SCOLS.join(', ')}) values\n${sVals}\non conflict (code) do nothing;\n\n-- ===== ประวัติการลา (${leaves.length} แถว) =====\ninsert into leave_requests (${LCOLS.join(', ')}) values\n${lVals};\n`
    const out = new URL('./staff_migration_full.sql', import.meta.url)
    writeFileSync(out, sql)
    console.log(`\n✓ เขียนไฟล์ SQL แล้ว: scripts/staff_migration_full.sql (เอาไปวางใน Supabase SQL Editor)`)
    return
  }

  console.log('ตัวอย่าง staff[2]:', JSON.stringify(staff[2]))
  console.log('ตัวอย่าง leave[0]:', JSON.stringify(leaves[0]))

  if (!APPLY) { console.log('\n(dry run — ใส่ --apply เพื่อเขียนจริง)'); return }

  const up = await sb.from('staff').upsert(staff, { onConflict: 'code' })
  if (up.error) { console.error('staff upsert error:', up.error.message); process.exit(1) }
  console.log(`✓ upsert staff ${staff.length} แถว`)

  if (leaves.length) {
    const ins = await sb.from('leave_requests').insert(leaves)
    if (ins.error) { console.error('leave insert error:', ins.error.message); process.exit(1) }
    console.log(`✓ import ประวัติลา ${leaves.length} แถว`)
  }
  console.log('✅ เสร็จ')
}
main()
