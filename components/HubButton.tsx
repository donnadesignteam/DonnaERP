'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ปุ่มกลับหน้ารวมเครื่องมือ (/hub) — โผล่เฉพาะตอนเปิดจากแอปที่ติดตั้งบนมือถือ (display-mode: standalone)
// ‼️ ในเบราว์เซอร์ปกติ (คอม) จะไม่ขึ้นเลย — หน้าเดสก์ท็อปต้องเหมือนเดิมเป๊ะตามที่ผู้ใช้สั่ง
export default function HubButton({ dark = false }: { dark?: boolean }) {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const check = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari ไม่รองรับ display-mode ตอน add to home screen ต้องดู navigator.standalone
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    // จำเป็นต้อง setState ใน effect: เช็ค display-mode ได้เฉพาะบนเบราว์เซอร์ (server ไม่รู้ว่าเปิดจากแอปหรือเบราว์เซอร์)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(check())
  }, [])

  if (!standalone) return null

  return (
    // ?pick=1 = บอก hub ว่ากดปุ่มมาเอง อย่าเด้งไปเครื่องมือล่าสุด
    <Link href="/hub?pick=1" aria-label="กลับหน้ารวมเครื่องมือ"
      style={{
        // มุมขวาล่าง — มุมซ้ายล่างมีปุ่มเลิกทำ/ทำซ้ำ (HistoryBar) อยู่แล้ว
        position: 'fixed', right: 'max(12px, env(safe-area-inset-right))',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 9997, display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 14px', borderRadius: 999, textDecoration: 'none',
        background: dark ? 'rgba(255,255,255,0.1)' : 'var(--surface)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
        color: dark ? '#e8eaf0' : 'var(--ink-2)',
        fontSize: 13, fontWeight: 600, boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(8px)',
      }}>
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
      เครื่องมือ
    </Link>
  )
}
