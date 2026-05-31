'use client'

import Sidebar from './Sidebar'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: 64,
        minHeight: '100vh',
      }}>
        <div style={{ padding: '32px 36px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
