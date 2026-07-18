'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { RAIL_PATH } from '@/lib/rail'
import { CALC_PATH } from '@/lib/calc'

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
    // hub ใช้จากแอปมือถือเป็นหลัก → เข้าหน้า ERP เวอร์ชันมือถือ (/m) ไม่ใช่ตารางเดสก์ท็อป
    // บนคอมเข้าเว็บตรงๆ ยังได้ /dashboard เหมือนเดิม (root '/' redirect ไป /dashboard ไม่ได้แตะ)
    go: router => router.push('/m/orders'),
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
  {
    id: 'calc',
    title: 'คำนวณราคาม่าน',
    desc: 'ประเมินราคาม่าน · มู่ลี่',
    color: '#7C3AED',
    icon: <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path strokeLinecap="round" d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>,
    // เว็บบน GitHub Pages — ดูคอมเมนต์ใน lib/calc.ts ว่าทำไมต้องเป็น /calc/Index.html
    go: router => router.push(CALC_PATH),
  },
]

function HubContent() {
  const router = useRouter()
  const params = useSearchParams()
  const pickMode = params.get('pick') === '1'
  const [ready, setReady] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)   // ติดป้าย "ใช้ล่าสุด" ให้รู้ว่าเปิดแอปเฉยๆ จะเด้งไปไหน

  useEffect(() => {
    // เปิดแอปรอบใหม่ + เคยเลือกเครื่องมือไว้ → เข้าเครื่องมือนั้นเลย ไม่ต้องกดซ้ำทุกครั้ง
    const launched = sessionStorage.getItem(LAUNCHED_KEY)
    sessionStorage.setItem(LAUNCHED_KEY, '1')
    const last = localStorage.getItem(LAST_APP_KEY)
    // ‼️ ?pick=1 (มาจากปุ่ม "เครื่องมือ") = ตั้งใจมาเลือกเอง ห้ามเด้งไปไหนเด็ดขาด
    //    เดิมใช้แค่ sessionStorage เดาว่า "เข้า /hub ครั้งแรก = เพิ่งเปิดแอป" ซึ่งผิด —
    //    ถ้าแอปเปิดเข้า ERP ตรงๆ (แอปที่ติดตั้งไว้จำ start_url เก่า) การกดปุ่มเครื่องมือจะกลายเป็น
    //    การเข้า /hub ครั้งแรกของ session → โดนเด้งไปเครื่องมือล่าสุดแทนที่จะได้เห็น hub
    if (!pickMode && !launched && last) {
      const tool = TOOLS.find(t => t.id === last)
      // ราง/คำนวณราคา = เว็บคนละโปรเจกต์ ไม่มีปุ่มกลับ hub → ไม่เด้งเข้าให้อัตโนมัติ ต้องกดเอง
      if (tool && tool.id !== 'rail' && tool.id !== 'calc') { tool.go(router); return }
    }
    // จำเป็นต้อง setState ใน effect: sessionStorage/localStorage อ่านได้เฉพาะบนเบราว์เซอร์
    // ถ้าอ่านตอน render แรกเลย ผลจะไม่ตรงกับที่ server เรนเดอร์มา → hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastId(last)
    setReady(true)
  }, [router, pickMode])

  const pick = (tool: Tool) => {
    localStorage.setItem(LAST_APP_KEY, tool.id)
    tool.go(router)
  }

  // ระหว่างเช็คว่าจะเด้งไปเครื่องมือล่าสุดไหม — เดิมเป็น div เปล่า ผู้ใช้เห็นจอขาวทุกครั้งที่เปิดแอป
  if (!ready) return <HubSplash />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(32px + env(safe-area-inset-top)) 20px calc(32px + env(safe-area-inset-bottom))', gap: 28 }}>
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
          <button key={tool.id} onClick={() => pick(tool)} className="m-card-tap"
            style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 18px', cursor: 'pointer', boxShadow: 'var(--shadow)', color: 'var(--ink)', font: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: 14, background: tool.color + '1a', color: tool.color, flexShrink: 0 }}>
              {tool.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{tool.title}</span>
                {tool.id === lastId && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: tool.color, background: tool.color + '1a', borderRadius: 999, padding: '2px 7px' }}>ใช้ล่าสุด</span>
                )}
              </span>
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

// จอเปิดแอป — โลโก้ + ตัวหมุน แทนจอขาวเปล่า (เห็นทุกครั้งที่เปิดแอป ก่อนรู้ว่าจะเด้งไปเครื่องมือไหน)
function HubSplash() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Image src="/donna-logo.jpg" alt="Donna Design" width={72} height={72} priority style={{ borderRadius: 18, boxShadow: 'var(--shadow-md)' }} />
      <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border-2)', borderTopColor: 'var(--blue)', animation: 'm-spin 0.7s linear infinite' }} />
    </div>
  )
}

export default function HubPage() {
  // useSearchParams ต้องอยู่ใน Suspense (ข้อบังคับของ Next)
  return (
    <Suspense fallback={<HubSplash />}>
      <HubContent />
    </Suspense>
  )
}
