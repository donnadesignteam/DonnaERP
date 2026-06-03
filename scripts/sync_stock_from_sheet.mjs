// sync_stock_from_sheet.mjs
// ดึงข้อมูลจาก Google Sheet (แท็บ Stock_Summary) มา sync เข้าตาราง stock ใน Supabase
//
// วิธีใช้:
//   node scripts/sync_stock_from_sheet.mjs            <- ดูตัวอย่างการเปลี่ยนแปลงก่อน (dry run ไม่เขียนจริง)
//   node scripts/sync_stock_from_sheet.mjs --apply    <- เขียนข้อมูลจริง
//
// การทำงาน: ยึดข้อมูลใน Sheet เป็นหลัก
//   - รหัสผ้าที่มีทั้งใน Sheet และใน DB  -> อัพเดตให้ตรงกับ Sheet
//   - รหัสผ้าที่มีใน Sheet แต่ไม่มีใน DB -> เพิ่มใหม่
//   - รหัสผ้าที่มีใน DB แต่ไม่มีใน Sheet -> ลบออก

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const SHEET_ID = '1RFkbGYojC5KzB0_RfbB4zzzXYGSUD_SCOI5wY4nvN-I'
const STOCK_SUMMARY_GID = '963096045'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${STOCK_SUMMARY_GID}`

const APPLY = process.argv.includes('--apply')

// ---------- โหลด .env.local ----------
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.trim().match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// ---------- CSV parser (รองรับค่าใน "..." ที่มี , และ "" ข้างใน) ----------
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c !== '\r') field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ---------- แปลงวันที่ "4/5/2026, 16:48:36" (วัน/เดือน/ปี ค.ศ.) -> ISO ----------
function parseThaiDate(s) {
  if (!s || !s.trim()) return null
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})?/)
  if (!m) return null
  const [, d, mo, y, h, mi, se] = m
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h - 7, +mi, +(se ?? 0))) // เวลาไทย UTC+7
  return isNaN(date) ? null : date.toISOString()
}

// สถานะคำนวณแบบเดียวกับหน้าเว็บ (app/(admin)/stock/page.tsx)
const getStatus = (n) =>
  n === 0 ? 'ของหมด' : n <= 3 ? 'ควรสั่ง' : n <= 6 ? 'ของเหลือน้อย' : 'ปกติ'

// ---------- main ----------
async function main() {
  console.log('📥 กำลังดึงข้อมูลจาก Google Sheet (Stock_Summary)...')
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`ดึง Sheet ไม่ได้: HTTP ${res.status}`)
  const csv = await res.text()

  const rows = parseCSV(csv)
  const header = rows[0]
  console.log(`   คอลัมน์: ${header.slice(0, 12).join(' | ')}`)

  // คอลัมน์: 0=รหัสผ้า 1=ชื่อสี 2=หน้าผ้า 3=ลักษณะผ้า 4=รหัสร้าน 5=ร้าน
  //          6=จำนวนทั้งหมด 7=ยังไม่ได้เปิดใช้ 8=เปิดใช้ 9=สถานะ 10=วันอัพเดต 11=หมายเหตุ
  const sheetItems = []
  const warnings = []
  let rowIndex = 0
  for (const r of rows.slice(1)) {
    const fabric_code = (r[0] ?? '').trim()
    if (!fabric_code) continue
    rowIndex++

    const color_name = (r[1] ?? '').trim()
    // แถวที่ชื่อสีเป็นวันที่ (เช่น "07/04/2026") = แถวที่กรอกไม่ครบใน Sheet
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(color_name)) {
      warnings.push(`⚠️  ${fabric_code}: ชื่อสีใน Sheet เป็นวันที่ ("${color_name}") — ข้อมูลอาจกรอกไม่ครบ (sync ตามที่มี)`)
    }

    const roll_count = Number(r[6]) || 0
    sheetItems.push({
      fabric_code,
      color_name,
      fabric_width: r[2] && !isNaN(Number(r[2])) ? Number(r[2]) : null,
      fabric_type: (r[3] ?? '').trim(),
      shop_code: (r[4] ?? '').trim(),
      shop_name: (r[5] ?? '').trim(),
      roll_count,
      unused_rolls: Number(r[7]) || 0,
      in_use_rolls: Number(r[8]) || 0,
      status: (r[9] ?? '').trim() || getStatus(roll_count),
      sort_order: rowIndex, // ลำดับแถวใน Sheet
      updated_at: parseThaiDate(r[10]) ?? new Date().toISOString(),
    })
  }

  // เช็ครหัสผ้าซ้ำใน Sheet
  const seen = new Map()
  for (const it of sheetItems) {
    if (seen.has(it.fabric_code)) warnings.push(`⚠️  รหัสผ้า "${it.fabric_code}" ซ้ำใน Sheet — จะใช้แถวล่างสุด`)
    seen.set(it.fabric_code, it)
  }
  const items = [...seen.values()]
  console.log(`   พบผ้าใน Sheet: ${items.length} รายการ\n`)
  warnings.forEach(w => console.log(w))

  // ---------- อ่านข้อมูลปัจจุบันใน DB ----------
  console.log('\n📊 กำลังอ่านข้อมูลปัจจุบันจาก Supabase...')
  const { data: dbRows, error: readErr } = await supabase.from('stock').select('*')
  if (readErr) throw new Error(`อ่านตาราง stock ไม่ได้: ${readErr.message}`)
  const dbByCode = new Map(dbRows.map(r => [r.fabric_code, r]))
  console.log(`   พบใน DB: ${dbRows.length} รายการ\n`)

  // ---------- เปรียบเทียบ ----------
  const toInsert = [], toUpdate = [], unchanged = []
  const compareFields = ['color_name', 'fabric_width', 'fabric_type', 'shop_code', 'shop_name', 'roll_count', 'unused_rolls', 'in_use_rolls', 'status', 'sort_order']

  for (const it of items) {
    const db = dbByCode.get(it.fabric_code)
    if (!db) { toInsert.push(it); continue }
    const changed = compareFields.filter(f => String(db[f] ?? '') !== String(it[f] ?? ''))
    if (changed.length) toUpdate.push({ id: db.id, item: it, changed })
    else unchanged.push(it)
  }
  const sheetCodes = new Set(items.map(i => i.fabric_code))
  const toDelete = dbRows.filter(r => !sheetCodes.has(r.fabric_code))

  // ---------- สรุปแผน ----------
  console.log('═══════════════ แผนการ sync ═══════════════')
  console.log(`  ➕ เพิ่มใหม่:   ${toInsert.length} รายการ`)
  toInsert.forEach(i => console.log(`       + ${i.fabric_code} (${i.color_name || '-'}) ${i.roll_count} ม้วน`))
  console.log(`  ✏️  อัพเดต:     ${toUpdate.length} รายการ`)
  toUpdate.forEach(u => console.log(`       ~ ${u.item.fabric_code}: ${u.changed.map(f => `${f}: ${JSON.stringify(dbByCode.get(u.item.fabric_code)[f])} -> ${JSON.stringify(u.item[f])}`).join(', ')}`))
  console.log(`  🗑️  ลบ (ไม่มีใน Sheet): ${toDelete.length} รายการ`)
  toDelete.forEach(d => console.log(`       - ${d.fabric_code} (${d.color_name || '-'})`))
  console.log(`  ✓  เหมือนเดิม:  ${unchanged.length} รายการ`)
  console.log('════════════════════════════════════════════\n')

  if (!APPLY) {
    console.log('🔍 นี่คือ DRY RUN ยังไม่ได้เขียนข้อมูลจริง')
    console.log('   ถ้าแผนถูกต้อง รันอีกครั้งด้วย:  node scripts/sync_stock_from_sheet.mjs --apply')
    return
  }

  // ---------- เขียนจริง ----------
  console.log('💾 กำลังเขียนข้อมูล...')
  let ok = 0, fail = 0

  for (const it of toInsert) {
    const { error } = await supabase.from('stock').insert(it)
    if (error) { console.log(`   ❌ insert ${it.fabric_code}: ${error.message}`); fail++ } else ok++
  }
  for (const u of toUpdate) {
    const { error } = await supabase.from('stock').update(u.item).eq('id', u.id)
    if (error) { console.log(`   ❌ update ${u.item.fabric_code}: ${error.message}`); fail++ } else ok++
  }
  for (const d of toDelete) {
    const { error } = await supabase.from('stock').delete().eq('id', d.id)
    if (error) { console.log(`   ❌ delete ${d.fabric_code}: ${error.message}`); fail++ } else ok++
  }

  console.log(`\n✅ เสร็จสิ้น: สำเร็จ ${ok} รายการ${fail ? `, ล้มเหลว ${fail} รายการ` : ''}`)
  console.log('   เปิดดูได้ที่ http://localhost:3000/stock')
}

main().catch(e => { console.error('❌ เกิดข้อผิดพลาด:', e.message); process.exit(1) })
