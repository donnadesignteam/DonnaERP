'use client'

import Sidebar, { SIDEBAR_W } from './Sidebar'
import HistoryBar from './HistoryBar'
import HubButton from './HubButton'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        minWidth: 0,
        marginLeft: SIDEBAR_W,
        minHeight: '100vh',
      }}>
        <div style={{ padding: '32px 36px' }}>
          {children}
        </div>
      </main>
      <HistoryBar />
      <HubButton />
    </div>
  )
}
