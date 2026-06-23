import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Donna สแกนงาน',
  manifest: '/scan-app.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'สแกนงาน',
  },
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
