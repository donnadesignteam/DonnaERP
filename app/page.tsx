'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { landingPath } from '@/lib/device'
import { readStaffSession } from '@/lib/staffSession'

// เปิดเว็บที่ URL เปล่าๆ (donna-erp.vercel.app) → ส่งไปหน้าที่เหมาะกับเครื่องที่เปิด
// ‼️ เดิมเป็น redirect('/dashboard') ตายตัว → แอดมินเปิดจากมือถือได้ตารางเดสก์ท็อปกว้างๆ
//    เลือกฝั่งเบราว์เซอร์ เพราะเช็คจอสัมผัส/โหมดแอปจากเซิร์ฟเวอร์ไม่ได้ (ดู lib/device.ts)
export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace(landingPath(!!readStaffSession()))
  }, [router])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--ink-3)', fontSize: 14 }}>
      กำลังเปิด…
    </div>
  )
}
