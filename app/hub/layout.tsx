import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Donna Design',
}

// ‼️ root layout ไม่มี viewport meta (มีแต่ /scan ที่ export เอง) — ถ้าไม่ใส่ มือถือจะเรนเดอร์หน้านี้ที่ ~980px แล้วซูมออกจนอ่านไม่ออก
// ใส่เฉพาะ /hub ก่อน ยังไม่แตะหน้า ERP — หน้า ERP เป็นตารางเดสก์ท็อป ถ้าใส่ device-width ตอนนี้จะยิ่งอ่านยากบนมือถือ
// (เฟส 2 ค่อยใส่พร้อมหน้ามือถือของ ERP)
// viewportFit: 'cover' → env(safe-area-inset-*) ถึงจะมีค่าจริง (ดูคอมเมนต์ใน app/m/layout.tsx)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#C47E3A',
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
