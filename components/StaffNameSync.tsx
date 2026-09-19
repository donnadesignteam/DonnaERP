'use client'

// ชื่อเล่นในคุกกี้ล็อกอิน (donna_staff) ถูกเขียนไว้ตอนล็อกอิน → เปลี่ยนชื่อเล่นในหน้าพนักงานแล้ว
// คนที่ล็อกอินค้างอยู่ยังติดชื่อเก่า (โพสต์ในตามงาน/ประวัติแก้ไขขึ้นชื่อเดิม) จนกว่าจะล็อกอินใหม่
// → เปิดเว็บแต่ละครั้งเช็กชื่อเล่นล่าสุดจากตาราง staff (1 แถว เล็กมาก) ถ้าไม่ตรงเขียนคุกกี้ใหม่ให้เลย
// ลายเซ็นในคุกกี้ผูกกับรหัสพนักงานอย่างเดียว (lib/staffAuth.ts) — เปลี่ยนชื่อได้โดยลายเซ็นยังใช้ได้
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { STAFF_COOKIE } from '@/lib/staffAuth'

export default function StaffNameSync() {
  useEffect(() => {
    const raw = document.cookie.split('; ').find(c => c.startsWith(STAFF_COOKIE + '='))
    if (!raw) return
    const [code, nickEnc, sig] = decodeURIComponent(raw.slice(STAFF_COOKIE.length + 1)).split('|')
    if (!code || !sig) return
    const cur = nickEnc ? decodeURIComponent(nickEnc) : ''
    let alive = true
    supabase.from('staff').select('nickname').eq('code', code).maybeSingle().then(({ data }) => {
      const nick = (data as { nickname: string | null } | null)?.nickname ?? ''
      if (!alive || !nick || nick === cur) return
      const value = encodeURIComponent(`${code}|${encodeURIComponent(nick)}|${sig}`)
      const secure = location.protocol === 'https:' ? '; secure' : ''
      document.cookie = `${STAFF_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`
    })
    return () => { alive = false }
  }, [])
  return null
}
