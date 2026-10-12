'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onPhone, wantsDesktop } from '@/lib/device'

// ทางลัดจากลิงก์ที่บอทไลน์ส่ง: /go?focus=<id งานติดตั้ง> → พาไปหน้าปฏิทินงานติดตั้งของเครื่องนั้นตรงๆ
// ‼️ เดิมลิงก์ชี้ /installations (หน้าคอม ไฟล์ใหญ่) แล้วมือถือค่อยโดนเด้งไป /m/installations อีกที = โหลด 2 หน้า ช้า
//    หน้านี้เบา เลือกปลายทางฝั่งเบราว์เซอร์ (ดู lib/device.ts) แล้วไปหน้าเดียวจบ
export default function GoPage() {
  const router = useRouter()
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('focus')
    const base = onPhone() && !wantsDesktop() ? '/m/installations' : '/installations'
    router.replace(focus ? `${base}?focus=${encodeURIComponent(focus)}` : base)
  }, [router])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--ink-3)', fontSize: 14 }}>
      กำลังเปิดงาน…
    </div>
  )
}
