// Migration: ย้ายคำในหมายเหตุของรายการสินค้า (ออเดอร์เก่า) ไปลงหมวดใหม่
//   แยกกลาง / สไลด์เดี่ยว  → fabric_split (แบ่งผ้า)
//   ใส่เคมี / ไม่ใส่เคมี     → chemical (เคมี)
//   ถ่วงโซ่ / ไม่ถ่วงโซ่ / ไม่โซ่ / ไม่รับโซ่ถ่วง → weight_chain (โซ่ถ่วง)
//   ดึงซ้าย / ดึงขวา         → pull_side (ฝั่งดึง) เก็บทั้งคำ "ดึงซ้าย"/"ดึงขวา"
// คำที่ย้ายแล้วจะถูกลบออกจากหมายเหตุ ส่วนคำอื่นๆ คงไว้ในหมายเหตุตามเดิม
// เติมเฉพาะช่องที่ยังว่าง — ไม่ทับค่าที่ลงหมวดใหม่ไว้แล้ว
//
// วิธีรัน (จากโฟลเดอร์ donnaweb):
//   node scripts/migrate_note_to_fields.mjs           ← ดูตัวอย่าง (dry-run ไม่เขียนจริง)
//   node scripts/migrate_note_to_fields.mjs --apply   ← เขียนแก้จริง
//
// ใช้ key เดียวกับเว็บ (anon) จาก .env.local

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ----- โหลด env จาก .env.local -----
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) { console.error('ไม่พบ NEXT_PUBLIC_SUPABASE_URL / ANON_KEY ใน .env.local'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const supabase = createClient(url, key)

// แยกคำจากหมายเหตุ → { field, value, token } ตามลำดับที่เช็ค (คำยาว/คำปฏิเสธมาก่อน กันจับผิดตัว)
const RULES = [
  { field: 'fabric_split', value: 'สไลด์เดี่ยว', re: /\(?สไลด์เดี่ยว\)?|\(?สไลด์เดียว\)?|\(?สไลด์\)?/ },
  { field: 'fabric_split', value: 'แยกกลาง', re: /\(?แยกกลาง\)?/ },
  { field: 'chemical', value: 'ไม่ใส่เคมี', re: /\(?ไม่ใส่เคมี\)?/ },
  { field: 'chemical', value: 'ใส่เคมี', re: /\(?ใส่เคมี\)?/ },
  { field: 'weight_chain', value: 'ไม่รับโซ่ถ่วง', re: /\(?ไม่รับโซ่ถ่วง\)?|\(?ไม่ถ่วงโซ่\)?|\(?ไม่โซ่\)?/ },
  { field: 'weight_chain', value: 'ใส่โซ่ถ่วง', re: /\(?ใส่โซ่ถ่วง\)?|\(?ถ่วงโซ่\)?/ },
  // (?![0-9]) กันเคส "ดึงซ้าย1 ขวา1" (สองฝั่ง) — แบบนั้นคงไว้ในหมายเหตุตามเดิม
  { field: 'pull_side', value: 'ดึงซ้าย', re: /\(?ดึงซ้าย\)?(?![0-9])/ },
  { field: 'pull_side', value: 'ดึงขวา', re: /\(?ดึงขวา\)?(?![0-9])/ },
]

// คืน { changed, item } — ย้ายคำจาก note ไปช่องใหม่ (เฉพาะช่องที่ยังว่าง) แล้วเก็บกวาด note
function migrateItem(it) {
  let note = typeof it?.note === 'string' ? it.note : ''
  if (!note.trim()) return { changed: false, item: it }
  const next = { ...it }
  let changed = false
  for (const rule of RULES) {
    if ((next[rule.field] ?? '').toString().trim()) continue   // ช่องนี้มีค่าแล้ว ไม่ทับ
    const m = note.match(rule.re)
    if (!m) continue
    next[rule.field] = rule.value
    note = note.replace(rule.re, ' ')
    changed = true
  }
  if (!changed) return { changed: false, item: it }
  // เก็บกวาดหมายเหตุที่เหลือ: ตัด , / เว้นวรรคซ้ำ / วงเล็บว่าง
  note = note.replace(/\(\s*\)/g, ' ')
  note = note.split(',').map(s => s.trim()).filter(Boolean).join(', ')
  note = note.replace(/\s{2,}/g, ' ').trim()
  next.note = note
  return { changed: true, item: next }
}

const { data: rows, error } = await supabase.from('order_entries').select('id, order_number, customer_name, items')
if (error) { console.error('ดึงข้อมูลไม่สำเร็จ:', error.message); process.exit(1) }

let changedRows = 0, changedItems = 0
for (const r of rows) {
  if (!Array.isArray(r.items) || r.items.length === 0) continue
  let dirty = false
  const items = r.items.map((it) => {
    const { changed, item } = migrateItem(it)
    if (changed) {
      dirty = true; changedItems++
      const moved = RULES.filter(x => item[x.field] && item[x.field] !== (it[x.field] ?? '')).map(x => `${x.field}=${item[x.field]}`).join(', ')
      console.log(`  ${r.order_number || r.customer_name || r.id}: note "${it.note}" → "${item.note || '(ว่าง)'}" | ${moved}`)
    }
    return item
  })
  if (!dirty) continue
  changedRows++
  if (APPLY) {
    const { error: upErr } = await supabase.from('order_entries').update({ items, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (upErr) console.error(`  ! อัปเดต ${r.id} ไม่สำเร็จ:`, upErr.message)
  }
}

console.log(`\n${APPLY ? 'แก้แล้ว' : '[DRY-RUN] จะแก้'} ${changedItems} รายการ ใน ${changedRows} ออเดอร์`)
if (!APPLY) console.log('รันซ้ำด้วย --apply เพื่อเขียนจริง')
