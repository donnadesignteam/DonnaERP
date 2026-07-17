'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { RAIL_PATH } from '@/lib/rail'

// หน้ารวมเครื่องมือของแอป "Donna Design" (start_url ของ PWA ชี้มาที่นี่)
// เปิดแอปครั้งแรกของรอบ → เด้งเข้าเครื่องมือที่ใช้ล่าสุดให้เลย · กดปุ่มกลับ hub / ปุ่ม back → เห็นหน้านี้ตามปกติ
const LAST_APP_KEY = 'donna_last_app'      // localStorage — จำข้ามการปิดแอป
const LAUNCHED_KEY = 'donna_hub_launched'  // sessionStorage — เด้งอัตโนมัติแค่ครั้งเดียวต่อการเปิดแอป (กันวนลูปตอนกด back)

type Tool = {
  id: string
  title: string
  desc: string
  color: string
  icon: React.ReactNode
  go: (router: ReturnType<typeof useRouter>) => void
}

const TOOLS: Tool[] = [
  {
    id: 'erp',
    title: 'ระบบร้าน',
    desc: 'ออเดอร์ · งานเคลม · ปฏิทิน',
    color: '#C47E3A',
    icon: <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6M7.5 3h9A1.5 1.5 0 0118 4.5v15a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5v-15A1.5 1.5 0 017.5 3z"/></svg>,
    go: router => router.push('/dashboard'),
  },
  {
    id: 'scan',
    title: 'สแกนงาน',
    desc: 'สแกน QR อัปเดตสถานะผลิต',
    color: '#3D6FD6',
    icon: <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 14.25h2.25v2.25H13.5zM18 18.75h2.25V21H18zM13.5 18.75h2.25V21H13.5zM18 14.25h2.25v2.25H18z"/></svg>,
    go: router => router.push('/scan'),
  },
  {
    id: 'rail',
    title: 'อุปกรณ์ราง',
    desc: 'คำนวณอะไหล่ราง',
    color: '#3E8E5A',
    icon: <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18M7 4v3m5-3v3m5-3v3"/></svg>,
    // RAIL_PATH ไม่ใช่ '/rail' เฉยๆ — ต้องมี /index.html ปิดท้ายให้ base เป็น '/rail/'
    // ไม่งั้นไฟล์ในหน้าราง (calc.js, parts/…) ที่อ้างแบบสัมพัทธ์จะไปหาที่ root แล้ว 404
    go: router => router.push(RAIL_PATH),
  },
]

export default function HubPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // เปิดแอปรอบใหม่ + เคยเลือกเครื่องมือไว้ → เข้าเครื่องมือนั้นเลย ไม่ต้องกดซ้ำทุกครั้ง
    const launched = sessionStorage.getItem(LAUNCHED_KEY)
    sessionStorage.setItem(LAUNCHED_KEY, '1')
    const last = localStorage.getItem(LAST_APP_KEY)
    if (!launched && last) {
      const tool = TOOLS.find(t => t.id === last)
      if (tool) { tool.go(router); return }
    }
    // จำเป็นต้อง setState ใน effect: sessionStorage/localStorage อ่านได้เฉพาะบนเบราว์เซอร์
    // ถ้าอ่านตอน render แรกเลย ผลจะไม่ตรงกับที่ server เรนเดอร์มา → hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true)
  }, [router])

  const pick = (tool: Tool) => {
    localStorage.setItem(LAST_APP_KEY, tool.id)
    tool.go(router)
  }

  // กันจอกระพริบ: ระหว่างเช็คว่าจะเด้งไปเครื่องมือล่าสุดไหม ยังไม่ต้องวาดอะไร
  if (!ready) return <div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Image src="/donna-logo.jpg" alt="Donna Design" width={84} height={84} priority
          style={{ borderRadius: 20, boxShadow: 'var(--shadow-md)' }} />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px' }}>Donna Design</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>เลือกเครื่องมือที่จะใช้</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}>
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => pick(tool)}
            style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 18px', cursor: 'pointer', boxShadow: 'var(--shadow)', color: 'var(--ink)', font: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: 14, background: tool.color + '1a', color: tool.color, flexShrink: 0 }}>
              {tool.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{tool.title}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{tool.desc}</span>
            </span>
            <svg width="18" height="18" fill="none" stroke="var(--ink-4)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
