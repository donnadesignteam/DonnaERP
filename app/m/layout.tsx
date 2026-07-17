import type { Metadata, Viewport } from 'next'
import MobileNav from '@/components/mobile/MobileNav'

export const metadata: Metadata = {
  title: 'Donna Design',
}

// หน้ามือถือแยก URL /m/* ต่างหากจากหน้าเดสก์ท็อป — หน้าเดสก์ท็อปเดิมไม่ถูกแตะเลย
// viewport meta ใส่เฉพาะกลุ่มนี้ (root layout ไม่มี) → หน้า ERP เดิมยังทำงานเหมือนเดิมทุกอย่าง
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C47E3A',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* เว้นที่ล่างให้แถบเมนู ไม่ให้ทับเนื้อหาแถวสุดท้าย */}
      <div style={{ paddingBottom: 'calc(68px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
      <MobileNav />
    </div>
  )
}
