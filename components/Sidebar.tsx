'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/dashboard',      label: 'ภาพรวม',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
  { href: '/order-entry',    label: 'ออเดอร์',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6M7.5 3h9A1.5 1.5 0 0118 4.5v15a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5v-15A1.5 1.5 0 017.5 3z"/></svg> },
  { href: '/claims',         label: 'งานเคลม',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h4.875a2.625 2.625 0 010 5.25H12M8.25 9.75L10.5 7.5M8.25 9.75L10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg> },
  { href: '/returns',        label: 'พัสดุส่งกลับ',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg> },
  { href: '/installations',  label: 'ปฏิทินงานติดตั้ง',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg> },
  { href: '/employees',      label: 'ปฏิทินร้าน',   icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg> },
  { href: '/staff',          label: 'พนักงาน',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg> },
  { href: '/analytics',      label: 'วิเคราะห์ข้อมูล', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg> },
  { href: '/stock',          label: 'สต็อก',        icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg> },
  { href: '/purchase-orders',label: 'สั่งซื้อ',    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg> },
  { href: '/settings',       label: 'ตั้งค่า',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
]

// ‼️ 13ก.ย.69 ดีไซน์ใหม่ตามภาพต้นแบบ (Downloadsbe6f782-...png): แถบกว้างพื้นครีม ไอคอน+ชื่อโชว์ตลอด ไม่ต้องชี้เมาส์
//    ความกว้างใช้ SIDEBAR_W ร่วมกับ components/SidebarLayout.tsx
export const SIDEBAR_W = 208

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: SIDEBAR_W, minHeight: '100vh', background: '#F3E9DF',
      borderRight: '1px solid rgba(138,97,66,0.10)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0,
      overflowY: 'auto', overflowX: 'hidden', zIndex: 40,
    }}>
      {/* โลโก้ DONNA DESIGN — ป้ายน้ำตาลมุมมน */}
      <Link href="/dashboard" style={{ display: 'flex', justifyContent: 'center', padding: '28px 0 26px', flexShrink: 0 }}>
        <Image src="/donna-logo.jpg" alt="Donna Design" width={92} height={92} priority
          style={{ width: 92, height: 92, borderRadius: 20, objectFit: 'cover', boxShadow: '0 6px 18px rgba(120,86,58,0.22)' }} />
      </Link>

      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className="sb-link" data-active={active || undefined} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 14px', borderRadius: 14, textDecoration: 'none',
              fontSize: 14, fontWeight: active ? 600 : 500,
              color: active ? '#5C3B25' : '#6B5040',
              background: active ? '#E8D6C4' : 'transparent',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ display: 'flex', flexShrink: 0, width: 20, justifyContent: 'center', transform: 'scale(1.2)' }}>{icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ข้อความลายมือ + กิ่งไม้เส้นบาง ด้านล่าง */}
      <div style={{ position: 'relative', padding: '28px 22px 26px', flexShrink: 0, color: '#B08A6E' }}>
        <div style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive', fontSize: 13, lineHeight: 1.5, transform: 'rotate(-8deg)', transformOrigin: 'left bottom', opacity: 0.85 }}>
          Small details<br />make a big home ♡
        </div>
        <svg width="54" height="70" viewBox="0 0 54 70" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"
          style={{ position: 'absolute', right: 26, bottom: 10, opacity: 0.55 }}>
          <path d="M14 69 C20 50 26 34 44 6" />
          <path d="M22 50 C12 48 6 40 5 30 C14 32 20 40 22 50Z" />
          <path d="M27 38 C36 36 44 30 47 20 C38 22 30 28 27 38Z" />
          <path d="M33 26 C26 22 22 14 23 5 C31 9 34 17 33 26Z" />
        </svg>
      </div>
    </aside>
  )
}
