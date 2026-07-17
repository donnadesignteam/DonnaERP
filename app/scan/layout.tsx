import type { Metadata, Viewport } from 'next'

// /scan เป็นแค่หน้าหนึ่งในแอป "Donna Design" แล้ว — ไม่มี manifest/ชื่อ/ไอคอนแยกเป็นแอปของตัวเอง
// (เดิมชี้ /scan-app.webmanifest + appleWebApp.title 'สแกนงาน' → กลายเป็นแอปที่ 2 บนมือถือ)
// ไฟล์ public/scan-app.webmanifest ยังคงไว้ให้เครื่องที่ติดตั้งแอปสแกนเดิมใช้ได้จนกว่าจะลบแอปทิ้ง
export const metadata: Metadata = {
  title: 'Donna สแกนงาน',
}

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
