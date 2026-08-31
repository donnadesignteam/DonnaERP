'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onPhone, wantsDesktop, clearDesktopPreference } from '@/lib/device'
import { readStaffSession } from '@/lib/staffSession'

// หน้าเดสก์ท็อป (กลุ่ม (admin)) ถูกเปิดจากมือถือ → พาไปเวอร์ชันมือถือให้
// ‼️ เกิดได้ทั้งจากบุ๊กมาร์ก/ประวัติเบราว์เซอร์ที่ชี้ /dashboard ตรงๆ และลิงก์ที่ส่งกันในไลน์
//    (หน้า /login กับ '/' เลือกปลายทางให้อยู่แล้ว แต่ครอบไม่ถึงเคสพวกนี้)
// ทางออกฉุกเฉิน: /hub มีปุ่ม "เปิดเวอร์ชันคอมพิวเตอร์" → /dashboard?desktop=1 แล้วเครื่องนั้นจำไว้
//                กลับมาโหมดมือถือได้ด้วยปุ่มลอยมุมล่างซ้ายที่คอมโพเนนต์นี้วาดให้
const MOBILE_OF: Record<string, string> = {
  '/dashboard': '/hub',
  '/order-entry': '/m/orders',
  '/claims': '/m/claims',
  '/installations': '/m/installations',
  '/customers': '/m/customers',
}

export default function PhoneRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const [forced, setForced] = useState(false)   // มือถือที่เลือก "ดูแบบคอม" ไว้ → โชว์ปุ่มกลับ

  useEffect(() => {
    if (!onPhone()) return
    if (wantsDesktop()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForced(true)   // รู้ได้เฉพาะบนเบราว์เซอร์ (localStorage/matchMedia) จึงต้องตั้งค่าใน effect
      return
    }
    const target = MOBILE_OF[pathname ?? '']
    if (!target) return                        // หน้าที่ยังไม่มีเวอร์ชันมือถือ = เปิดหน้าเดสก์ท็อปไปตามเดิม
    if (pathname === '/dashboard' && readStaffSession()) { router.replace('/m/me'); return }
    router.replace(target)
  }, [router, pathname])

  if (!forced) return null
  return (
    <button
      onClick={() => { clearDesktopPreference(); router.replace('/hub') }}
      style={{
        position: 'fixed', left: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 1200,
        minHeight: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--border)',
        background: 'var(--surface)', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600,
        boxShadow: 'var(--shadow-md)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
      }}>
      กลับเวอร์ชันมือถือ
    </button>
  )
}
