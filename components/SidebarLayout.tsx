'use client'

import Sidebar from './Sidebar'
import HistoryBar from './HistoryBar'
import HubButton from './HubButton'
import StaffNameSync from './StaffNameSync'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <StaffNameSync />
      <Sidebar />
      <main style={{
        flex: 1,
        minWidth: 0,
        marginLeft: 64,
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
