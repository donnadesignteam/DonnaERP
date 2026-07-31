'use client'

// ── ใครทำอะไรกับออเดอร์ + เจ้าของโบนัส ────────────────────────────────
// เว็บแปะ "คนที่กำลังบันทึก" (จากคุกกี้ล็อกอินพนักงาน) ลงในทุกค่าที่เขียนกลับ DB
// แล้ว trigger log_activity() ฝั่ง Supabase คัดลอกเข้า activity_logs ให้เอง
// ‼️ ต้องรัน sql/admin_activity.sql ก่อน ไม่งั้นคอลัมน์ไม่มี → คำสั่งพังทั้งก้อน (42703)
//
// กติกาที่ user เคาะไว้ (2026-07-31):
// - โบนัสของออเดอร์อยู่กับ "แอดมินหลักคนล่าสุดที่แก้เนื้อออเดอร์"
// - ‼️ คนที่ไม่ใช่แอดมินหลัก 3 คนมาแก้เนื้อออเดอร์ = **ล้างเจ้าของโบนัสทิ้ง ไม่มีใครได้โบนัสใบนั้น**
//   (รวมถึงคนที่ล็อกอินด้วยรหัสรวมของร้าน เพราะระบบไม่รู้ว่าเป็นใคร)
// - ช่องแอดมินในตารางออเดอร์ระบบคุมเอง แก้มือไม่ได้แล้ว
// - ชื่อคนแก้ในประวัติ เห็นได้เฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน (isOwnerLogin)

import { readStaffSession } from './staffSession'
import { supabase } from './supabase'

type Row = Record<string, unknown>

// แอดมินหลักที่รับโบนัสออเดอร์ — ฝังในโค้ดตามที่ user สั่ง (เปลี่ยนตัวคนต้องมาแก้ที่นี่ที่เดียว)
export const BONUS_ADMINS: { code: string; name: string }[] = [
  { code: 'DN029', name: 'หนูนา' },
  { code: 'DN010', name: 'แพท' },
  { code: 'DN035', name: 'กาย' },
  { code: 'DN015', name: 'น็อต' },   // เพิ่ม 31 ก.ค. 69 (user ขอไว้ลองเทสระบบ) — เอาออกเมื่อไหร่ก็ลบบรรทัดนี้
]

export const isBonusAdmin = (code: string | null | undefined) =>
  !!code && BONUS_ADMINS.some(a => a.code === code)

// ช่องที่ "ไม่ใช่เนื้อออเดอร์" — แตะแค่พวกนี้ไม่ถือว่าทำออเดอร์ (โบนัสไม่ย้าย)
// เช่น กดปริ้น ติ๊กจัดส่ง เดินสถานะผลิต แนบรูป เช็คเลขพัสดุ
const NON_CONTENT = new Set([
  'order_status', 'work_status', 'status_history', 'is_urgent',
  'printed_at', 'shipped_at', 'shipments', 'packing_photos', 'technician',
  'updated_at', 'created_at',
  'actor_code', 'actor_name', 'admin_name', 'admin_code',
  'created_by_code', 'created_by_name', 'last_content_at',
  // สั่งนอก = ฝ่ายจัดซื้อ sync มาจากหน้าสั่งซื้อเอง ไม่ใช่แอดมินแก้ออเดอร์ (กันโบนัสโดนล้างเพราะลบใบสั่งซื้อ)
  'outsource', 'outsource_at',
])

export const touchesContent = (patch: Row) =>
  Object.keys(patch).some(k => !NON_CONTENT.has(k))

// แปะคนทำลงในค่าที่กำลังจะ update
// - actor_* = ทุกการกระทำ (ใช้โชว์ในประวัติ)
// - admin_* = เฉพาะตอนแก้เนื้อออเดอร์โดยแอดมินหลัก (= ย้ายเจ้าของโบนัส)
export function stampUpdate(patch: Row): Row {
  const s = readStaffSession()               // ไม่มี = ล็อกอินด้วยรหัสรวมของร้าน (ไม่รู้ว่าใคร)
  const out: Row = { ...patch }
  if (s) { out.actor_code = s.code; out.actor_name = s.nickname }
  if (touchesContent(patch)) {
    out.last_content_at = new Date().toISOString()
    if (s && isBonusAdmin(s.code)) {
      out.admin_code = s.code
      out.admin_name = s.nickname
    } else {
      // ‼️ คนนอก 3 คนหลักแก้เนื้อออเดอร์ = ล้างโบนัสทิ้ง ไม่ใช่คงเจ้าของเดิม
      out.admin_code = null
      out.admin_name = null
    }
  }
  return out
}

// แปะคนทำลงในแถวที่กำลังจะ insert — คนลงออเดอร์ตั้งครั้งเดียวตรงนี้ ไม่เปลี่ยนอีก
export function stampInsert(row: Row): Row {
  const s = readStaffSession()
  if (!s) return row
  const now = new Date().toISOString()
  const out: Row = {
    ...row,
    created_by_code: s.code, created_by_name: s.nickname,
    actor_code: s.code, actor_name: s.nickname,
    last_content_at: now,
  }
  if (isBonusAdmin(s.code)) {
    out.admin_code = s.code
    out.admin_name = s.nickname
  }
  return out
}

// ‼️ ทุกการเขียนตาราง order_entries ให้เรียก 2 ตัวนี้แทน supabase.from('order_entries').update/insert
//    (ยกเว้นการใส่แถวเดิมกลับตอน undo/redo ที่ต้องคงค่าเก่าไว้ทั้งแถว)
//    ต้องประกาศชนิดคืนค่าเป็น any ตรงๆ ไม่งั้น TS ไล่ชนิดจาก supabase client ที่ไม่ได้ generate type แล้ววน (TS7023)
/* eslint-disable @typescript-eslint/no-explicit-any */
export const oeUpdate = (patch: Row): any => supabase.from('order_entries').update(stampUpdate(patch))
export const oeInsert = (row: Row): any => supabase.from('order_entries').insert(stampInsert(row))

// ตารางอื่นที่แอดมินทำงานด้วย — แปะแค่ "ใครทำ" ไว้ให้ประวัติมีชื่อ (ไม่มีเรื่องโบนัส)
const stampActor = (patch: Row): Row => {
  const s = readStaffSession()
  return s ? { ...patch, actor_code: s.code, actor_name: s.nickname } : patch
}
export const claimUpdate = (patch: Row): any => supabase.from('claims').update(stampActor(patch))
export const claimInsert = (row: Row): any => supabase.from('claims').insert(stampActor(row))
export const instUpdate = (patch: Row): any => supabase.from('installations').update(stampActor(patch))
export const instInsert = (row: Row): any => supabase.from('installations').insert(stampActor(row))
/* eslint-enable @typescript-eslint/no-explicit-any */

// ‼️ ใครเห็นชื่อคนแก้ในประวัติได้บ้าง — เฉพาะคนที่ล็อกอินด้วย "รหัสรวมของร้าน" เท่านั้น
//    พนักงานทุกคน (รวมแอดมิน) เห็นแค่ว่ามีการแก้อะไร ไม่เห็นชื่อ
//    เช็คจากคุกกี้ donna_staff: ไม่มี = เข้าด้วยรหัสร้าน
//    (กันแบบสวยงามไม่ได้ 100% — ลบคุกกี้ตัวเองทิ้งก็เห็นชื่อได้ ถ้าจะกันจริงต้องย้ายไปเช็คฝั่งเซิร์ฟเวอร์)
export const isOwnerLogin = () => readStaffSession() === null
