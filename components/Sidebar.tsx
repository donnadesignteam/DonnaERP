'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/dashboard',      label: 'ภาพรวม',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
  { href: '/order-entry',    label: 'ออเดอร์',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6M7.5 3h9A1.5 1.5 0 0118 4.5v15a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5v-15A1.5 1.5 0 017.5 3z"/></svg> },
  { href: '/claims',         label: 'งานเคลม',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75h4.875a2.625 2.625 0 010 5.25H12M8.25 9.75L10.5 7.5M8.25 9.75L10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg> },
{ href: '/stock',          label: 'สต็อก',        icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg> },
  { href: '/purchase-orders',label: 'สั่งซื้อ',    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg> },
  { href: '/pricing',        label: 'ราคาสินค้า',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg> },
  { href: '/installations',  label: 'งานติดตั้ง',  icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg> },
  { href: '/employees',      label: 'พนักงาน',     icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg> },
  { href: '/settings',       label: 'ตั้งค่า',      icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
]

// icon จะอยู่ที่ตำแหน่ง x=24 จากขอบซ้ายเสมอ (กลาง 64px = 32, ลบ icon 8px = 24)
const ICON_X = 24

export default function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        width: expanded ? 224 : 64,
        minHeight: '100vh',
        background: '#1E1208',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.22s ease',
        zIndex: 40,
        boxShadow: expanded ? '4px 0 24px rgba(0,0,0,0.25)' : 'none',
      }}
    >
      {/* Brand */}
      <Link href="/dashboard" style={{
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        height: 72,
        paddingLeft: expanded ? ICON_X : (64 - 40) / 2,
        transition: 'padding-left 0.22s ease',
        flexShrink: 0,
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 8px rgba(196,126,58,0.4)' }}>
          <Image src="/donna-logo.jpg" alt="Donna Design" width={40} height={40} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
        </div>
        <div style={{ paddingLeft: 10, maxWidth: expanded ? 160 : 0, overflow: 'hidden', transition: 'max-width 0.22s ease', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FAF6F0', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>Donna Design</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1, fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ERP System</div>
        </div>
      </Link>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(196,126,58,0.15)', margin: '0 12px 6px', flexShrink: 0 }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 0' }}>
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <div key={href} style={{ padding: '1px 8px' }}>
              <Link href={href} title={!expanded ? label : undefined} style={{
                display: 'flex',
                alignItems: 'center',
                paddingLeft: ICON_X - 8,   /* 8px มาจาก padding ของ div wrapper */
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: 7,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? '#FFFFFF' : 'rgba(250,246,240,0.5)',
                background: active ? 'linear-gradient(135deg, #C47E3A, #9D6025)' : 'transparent',
                boxShadow: active ? '0 2px 8px rgba(196,126,58,0.35)' : 'none',
                transition: 'background 0.12s, box-shadow 0.12s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}>
                <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0, display: 'flex', width: 16 }}>{icon}</span>
                <span style={{ paddingLeft: 9, maxWidth: expanded ? 160 : 0, overflow: 'hidden', transition: 'max-width 0.22s ease', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
                  {href !== '/dashboard' && href !== '/order-entry' && href !== '/stock' && href !== '/claims' && (
                    <span style={{ fontSize: 9, color: 'rgba(250,246,240,0.3)', fontWeight: 400, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>ยังไม่เปิดใช้งาน</span>
                  )}
                </span>
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(196,126,58,0.12)', flexShrink: 0 }}>
        <div style={{ paddingLeft: ICON_X, paddingTop: 10, paddingBottom: 14, maxWidth: expanded ? 200 : 0, overflow: 'hidden', transition: 'max-width 0.22s ease' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>v1.0.0</div>
        </div>
      </div>
    </aside>
  )
}
