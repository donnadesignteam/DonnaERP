import type { Metadata } from 'next'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Donna Design',
  description: 'Donna Design Management System',
  // apple-touch-icon ผ่าน metadata (ไม่ฮาร์ดโค้ดใน <head>) — โลโก้แบรนด์เว้นขอบ วางบนพื้นน้ำตาล
  icons: { apple: '/icon-hub-apple-180.png' },
  // ‼️ iOS ไม่อ่านชื่อ/ไอคอนจาก manifest — ชื่อแอปบน iPhone มาจาก title ตรงนี้เท่านั้น (ต้องตรงกับ manifest)
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Donna Design',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#C47E3A" />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}