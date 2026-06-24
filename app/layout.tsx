import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Donna Admin',
  description: 'Donna Design Management System',
  // apple-touch-icon ผ่าน metadata (ไม่ฮาร์ดโค้ดใน <head>) → หน้า /scan override เหลือไอคอน QR อันเดียวได้
  icons: { apple: '/donna-logo.jpg' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Donna',
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
      <body>{children}</body>
    </html>
  )
}