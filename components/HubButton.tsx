'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ปุ่มกลับหน้ารวมเครื่องมือ (/hub) — โผล่เฉพาะตอนเปิดจากแอปที่ติดตั้งบนมือถือ (display-mode: standalone)
// ‼️ ในเบราว์เซอร์ปกติ (คอม) จะไม่ขึ้นเลย — หน้าเดสก์ท็อปต้องเหมือนเดิมเป๊ะตามที่ผู้ใช้สั่ง
// inline = ไม่ลอยทับจอ วางเป็นชิปในแถบของหน้านั้นเอง (ใช้ในหน้าสแกน ที่กล้อง+แผงล่างกินพื้นที่หมด)
export default function HubButton({ dark = false, inline = false }: { dark?: boolean; inline?: boolean }) {
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
        ...(inline ? {} : {
          position: 'fixed' as const, right: 'max(12px, env(safe-area-inset-right))',
          bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 9997,
        }),
        display: inline ? 'inline-flex' : 'flex', alignItems: 'center', gap: 6,
        padding: inline ? '6px 10px' : '9px 14px', borderRadius: 999, textDecoration: 'none',
        whiteSpace: 'nowrap',
        background: dark ? 'rgba(255,255,255,0.1)' : 'var(--surface)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
        color: dark ? '#e8eaf0' : 'var(--ink-2)',
        fontSize: inline ? 12 : 13, fontWeight: 600,
        boxShadow: inline ? 'none' : '0 2px 10px rgba(0,0,0,0.15)',
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
