// Fix: ปรับค่าฝั่งดึง (pull_side) ของรายการสินค้าให้เป็นรูปแบบเดียวกัน
//   "ซ้าย"  → "ดึงซ้าย"
//   "ขวา"  → "ดึงขวา"
// (ข้อมูลเก่าจาก migrate รอบแรกเก็บแค่ ซ้าย/ขวา ส่วนของใหม่เก็บ ดึงซ้าย/ดึงขวา)
//
// วิธีรัน (จากโฟลเดอร์ donnaweb):
//   node scripts/fix_pull_side_prefix.mjs           ← ดูตัวอย่าง (dry-run ไม่เขียนจริง)
//   node scripts/fix_pull_side_prefix.mjs --apply   ← เขียนแก้จริง
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

// คืนค่าใหม่ของ pull_side ถ้าต้องแก้ ไม่ต้องแก้คืน null
function fixPullSide(raw) {
  if (typeof raw !== 'string') return null
  const v = raw.trim().replace(/^\(|\)$/g, '').trim()   // เผื่อเก็บมาแบบมีวงเล็บ "(ซ้าย)"
  if (v === 'ซ้าย') return 'ดึงซ้าย'
  if (v === 'ขวา') return 'ดึงขวา'
  return null
}

const { data: rows, error } = await supabase.from('order_entries').select('id, order_number, customer_name, items')
if (error) { console.error('ดึงข้อมูลไม่สำเร็จ:', error.message); process.exit(1) }

let changedRows = 0, changedItems = 0
for (const r of rows) {
  if (!Array.isArray(r.items) || r.items.length === 0) continue
  let dirty = false
  const items = r.items.map((it) => {
    const fixed = fixPullSide(it?.pull_side)
    if (!fixed) return it
    dirty = true; changedItems++
    console.log(`  ${r.order_number || r.customer_name || r.id}: pull_side "${it.pull_side}" → "${fixed}"`)
    return { ...it, pull_side: fixed }
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
