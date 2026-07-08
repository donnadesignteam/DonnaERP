// add_new_staff.mjs — เพิ่มพนักงานใหม่จาก Google Sheet HR เข้า DB (เฉพาะรหัสที่ยังไม่มีในตาราง staff)
// พร้อม import ประวัติลาของคนใหม่ (กันซ้ำด้วย key code|date|type แบบเดียว migrate เดิม)
// ใช้ซ้ำได้ทุกครั้งที่มีพนักงานเข้าใหม่ — คนเก่าไม่โดนแตะ
//
// วิธีใช้ (จากโฟลเดอร์ donnaweb):
//   node scripts/add_new_staff.mjs           <- ดูตัวอย่าง (dry run ไม่เขียน)
//   node scripts/add_new_staff.mjs --apply   <- เขียนจริง

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const APPLY = process.argv.includes('--apply')
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.trim().match(/^([^#=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// ชีท HR ปัจจุบัน (ก.ค. 2026) — แท็บสรุปพนักงาน + แท็บประวัติลา (gid เดิมตั้งแต่ชีทรุ่นแรก)
const SHEET = '1EHLyXg_bQOz2jYheq00ii6rjm8dIqQh1aDkVoNUTBls'
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
const toYMD = (v) => {
  const s = clean(v); if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}`
}
// เนื้องานเดาจากตำแหน่ง (แนวเดียวกับ DIVISION map เดิม): งานผลิต/หน้างาน = ปฏิบัติการ, ที่เหลือ = ธุรการ
const guessDivision = (position) =>
  /ช่าง|แพค|จัดส่ง|ผลิต|ผู้จัดการร้าน/.test(position || '') ? 'ปฏิบัติการ' : 'ธุรการ'

const main = async () => {
  const [sumRes, lvRes] = await Promise.all([fetch(csvUrl(GID_SUMMARY)), fetch(csvUrl(GID_LEAVES))])
  const sumRows = parseCsv(await sumRes.text())
  const lvRows = parseCsv(await lvRes.text())

  // รหัสที่มีใน DB แล้ว
  const { data: existingStaff, error: e1 } = await sb.from('staff').select('code')
  if (e1) { console.error('อ่านตาราง staff ไม่สำเร็จ:', e1.message); process.exit(1) }
  const have = new Set((existingStaff || []).map((s) => s.code))

  // วันเริ่มงานต่อรหัส (จากชีทประวัติลา col15)
  const startByCode = {}
  for (const r of lvRows) { const code = (r[4] || '').trim().toUpperCase(); if (code && !startByCode[code]) { const sd = toYMD(r[15]); if (sd) startByCode[code] = sd } }

  // ----- พนักงานใหม่ (ยังไม่มีใน DB) -----
  const staff = sumRows
    .filter((r) => /^DN\d+/i.test((r[0] || '').trim()))
    .map((r) => {
      const code = (r[0] || '').trim().toUpperCase()
      return {
        code, name: clean(r[1]), nickname: clean(r[2]), position: clean(r[3]),
        division: guessDivision(clean(r[3])), active: true,
        start_date: startByCode[code] || null,
        sick_avail: num(r[4]), sick_used: num(r[5]), sick_left: num(r[6]),
        personal_avail: num(r[7]), personal_full: num(r[8]), personal_half: num(r[9]), personal_left: num(r[10]),
        vacation_avail: num(r[11]), vacation_used: num(r[12]), vacation_left: num(r[13]),
        wop_full: num(r[14]), wop_half: num(r[15]), wop_hours: num(r[16]),
        late: num(r[17]), warning: clean(r[18]), note: clean(r[19]),
      }
    })
    .filter((s) => !have.has(s.code))

  // ----- ประวัติลาของคนใหม่ (กันซ้ำ) -----
  const newCodes = new Set(staff.map((s) => s.code))
  const { data: existingLeaves } = await sb.from('leave_requests').select('employee_code, leave_date, leave_type')
  const seen = new Set((existingLeaves || []).map((e) => `${e.employee_code}|${e.leave_date}|${e.leave_type}`))
  const byCode = Object.fromEntries(staff.map((s) => [s.code, s]))
  const leaves = []
  for (const r of lvRows.slice(1)) {
    const code = (r[4] || '').trim().toUpperCase()
    if (!newCodes.has(code)) continue
    const date = toYMD(r[2]), type = clean(r[6])
    if (!date || !type) continue
    const key = `${code}|${date}|${type}`
    if (seen.has(key)) continue
    seen.add(key)
    const s = byCode[code]
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
  // ‼️ ประวัติลาที่ import มา ไม่ตัดสิทธิซ้ำ — ตัวเลขสิทธิ (used/left) มาจากชีทซึ่งนับลาพวกนี้แล้ว

  if (!staff.length) { console.log('ไม่มีพนักงานใหม่ — ชีทกับ DB ตรงกันแล้ว'); return }
  console.log(`พนักงานใหม่ ${staff.length} คน:`)
  for (const s of staff) console.log(` ${s.code} ${s.nickname} (${s.name}) ${s.position} · ${s.division} · เริ่มงาน ${s.start_date || 'ไม่ทราบ (แก้ในเว็บได้)'}`)
  console.log(`ประวัติลาที่จะ import: ${leaves.length} แถว`)
  for (const l of leaves) console.log(` ${l.employee_code} ${l.leave_type} ${l.leave_date}`)

  if (!APPLY) { console.log('\n(dry run — ใส่ --apply เพื่อเขียนจริง)'); return }

  const ins = await sb.from('staff').insert(staff)
  if (ins.error) { console.error('staff insert error:', ins.error.message); process.exit(1) }
  console.log(`✓ เพิ่ม staff ${staff.length} คน`)
  if (leaves.length) {
    const lv = await sb.from('leave_requests').insert(leaves)
    if (lv.error) { console.error('leave insert error:', lv.error.message); process.exit(1) }
    console.log(`✓ import ประวัติลา ${leaves.length} แถว`)
  }
  console.log('✅ เสร็จ')
}
main()
