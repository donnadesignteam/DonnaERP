// Backfill: แก้ fabric_type ของรายการผ้าในออเดอร์เก่าทั้งหมด ให้ตรงกับแคตตาล็อกรหัสผ้า
// (เฉพาะรายการที่ไม่ใช่ราง และมี color_code ตรงกับแคตตาล็อก)
//
// วิธีรัน (จากโฟลเดอร์ donnaweb):
//   node scripts/backfill_fabric_type.mjs           ← ดูตัวอย่าง (dry-run ไม่เขียนจริง)
//   node scripts/backfill_fabric_type.mjs --apply   ← เขียนแก้จริง
//
// ใช้ key เดียวกับเว็บ (anon) จาก .env.local

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ----- code -> ชนิดผ้า (gen จาก lib/fabrics.ts) -----
const FABRIC_TYPE = {
  "S010": "Dimout", "D00": "Dimout", "D038": "Dimout", "W17": "Dimout", "S22": "Dimout",
  "S700": "Dimout", "S05": "Dimout", "S18": "Dimout", "M80": "Dimout", "S61": "Dimout",
  "S10": "Dimout", "DS01": "ผ้าโปร่ง", "DS02": "ผ้าโปร่ง", "DS03": "ผ้าโปร่ง", "DS04": "ผ้าโปร่ง",
  "DS05": "ผ้าโปร่ง", "DS06": "ผ้าโปร่ง", "DS07": "ผ้าโปร่ง", "DS08": "ผ้าโปร่ง", "DS09": "ผ้าโปร่ง",
  "DS10": "ผ้าโปร่ง", "DS11": "ผ้าโปร่ง", "H01": "Dimout", "HJJ-6": "Dimout", "HJJ-7": "Dimout",
  "HJJ-8": "Dimout", "H222": "Dimout", "H99": "Dimout", "M11": "Dimout", "A11": "Dimout",
  "S01": "Dimout", "M20": "Dimout", "S581": "Dimout", "M14": "Dimout", "KW5-1": "Dimout",
  "HB81": "ผ้าทึบ", "HB16": "ผ้าทึบ", "HB82": "ผ้าทึบ", "HB83": "ผ้าทึบ", "HB85": "ผ้าทึบ",
  "HB88": "ผ้าทึบ", "HB87": "ผ้าทึบ", "SHB91": "ผ้าทึบ", "SHB92": "ผ้าทึบ", "SHB93": "ผ้าทึบ",
  "SHB94": "ผ้าทึบ", "SHB97": "ผ้าทึบ", "SHB98": "ผ้าทึบ", "SHB99": "ผ้าทึบ", "HB-R1": "ผ้าทึบ",
  "HB-R2": "ผ้าทึบ", "HB-R3": "ผ้าทึบ", "HB-R4": "ผ้าทึบ", "KB-1": "ผ้าทึบ", "KB-2": "ผ้าทึบ",
  "KB-3": "ผ้าทึบ", "KB-4": "ผ้าทึบ", "KB-5": "ผ้าทึบ", "KB-6": "ผ้าทึบ", "KB-7": "ผ้าทึบ",
  "KB-8": "ผ้าทึบ", "KB-9": "ผ้าทึบ", "KB-10": "ผ้าทึบ", "A1": "Dimout", "M21": "Dimout",
  "J-DD13": "ผ้าทึบ", "MS01": "ผ้าทึบ", "B82": "ผ้าทึบ", "B16": "ผ้าทึบ", "B85": "ผ้าทึบ",
  "DS12": "ผ้าโปร่ง", "DS13": "ผ้าโปร่ง", "DS14": "ผ้าโปร่ง", "HB24": "ผ้าทึบ", "HB25": "ผ้าทึบ",
  "HB26": "ผ้าทึบ", "HUNTER GREEN": "Dimout", "S40": "Dimout", "S42": "Dimout",
}

const typeFromCode = (code) => {
  if (!code) return ''
  const c = String(code).trim()
  return FABRIC_TYPE[c] ?? FABRIC_TYPE[c.toUpperCase()] ?? ''
}

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

const { data: rows, error } = await supabase.from('order_entries').select('id, order_number, items')
if (error) { console.error('ดึงข้อมูลไม่สำเร็จ:', error.message); process.exit(1) }

let changedRows = 0, changedItems = 0
for (const r of rows) {
  if (!Array.isArray(r.items) || r.items.length === 0) continue
  let dirty = false
  const items = r.items.map((it) => {
    if (typeof it?.type === 'string' && it.type.startsWith('ราง')) return it
    const ft = typeFromCode(it?.color_code)
    if (ft && it.fabric_type !== ft) {
      dirty = true; changedItems++
      console.log(`  ${r.order_number || r.id}: ${it.color_code} "${it.fabric_type || '(ว่าง)'}" → "${ft}"`)
      return { ...it, fabric_type: ft }
    }
    return it
  })
  if (!dirty) continue
  changedRows++
  if (APPLY) {
    const { error: upErr } = await supabase.from('order_entries').update({ items }).eq('id', r.id)
    if (upErr) console.error(`  ! อัปเดต ${r.id} ไม่สำเร็จ:`, upErr.message)
  }
}

console.log(`\n${APPLY ? 'แก้แล้ว' : '[DRY-RUN] จะแก้'} ${changedItems} รายการ ใน ${changedRows} ออเดอร์`)
if (!APPLY) console.log('รันซ้ำด้วย --apply เพื่อเขียนจริง')
