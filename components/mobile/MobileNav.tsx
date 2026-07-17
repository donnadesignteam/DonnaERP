'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// แถบเมนูล่างของหน้ามือถือ — มีแค่ 4 หมวดที่ผู้ใช้สั่งให้เห็น (ดูอย่างเดียว)
// หมวดอื่นของ ERP (สต็อก/สั่งซื้อ/วิเคราะห์/พนักงาน/ตั้งค่า) ไม่มีหน้ามือถือ ตั้งใจไม่ใส่
const NAV = [
  {
    href: '/m/orders', label: 'ออเดอร์',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6M7.5 3h9A1.5 1.5 0 0118 4.5v15a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5v-15A1.5 1.5 0 017.5 3z" />,
  },
  {
    href: '/m/claims', label: 'งานเคลม',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h4.875a2.625 2.625 0 010 5.25H12M8.25 9.75L10.5 7.5M8.25 9.75L10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />,
  },
  {
    href: '/m/installations', label: 'ติดตั้ง',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />,
  },
  {
    href: '/m/calendar', label: 'ปฏิทินร้าน',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
  },
  {
    // กลับหน้ารวมเครื่องมือ (?pick=1 = กดมาเอง อย่าเด้งไปเครื่องมือล่าสุด)
    // อยู่ในแถบเมนูแทนปุ่มลอย เพราะปุ่มลอยมุมขวาล่างจะทับแถบเมนูนี้พอดี
    href: '/hub?pick=1', label: 'เครื่องมือ',
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  },
]

export default function MobileNav() {
  const pathname = usePathname()
  return (
    <nav style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
      display: 'flex', background: 'var(--surface)', borderTop: '1px solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -1px 8px rgba(0,0,0,0.04)',
    }}>
      {NAV.map(item => {
        // /hub?pick=1 ไม่มีทางเป็นหน้าปัจจุบัน (อยู่คนละ layout) → ไม่ต้องไฮไลต์
        const active = item.href.startsWith('/m/') && pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '9px 2px 8px', textDecoration: 'none',
            color: active ? 'var(--blue)' : 'var(--ink-4)',
          }}>
            <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} viewBox="0 0 24 24">{item.icon}</svg>
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
