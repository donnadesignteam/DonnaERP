'use client'

import Sidebar from './Sidebar'
import HistoryBar from './HistoryBar'
import HubButton from './HubButton'
import StaffNameSync from './StaffNameSync'
import { NotifyProvider } from './NotifyBell'
import BoardToast from './BoardToast'
import StickyHScroll from './StickyHScroll'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  // NotifyProvider = ข้อมูลกระดิ่งแจ้งเตือนชุดเดียวของทั้งเว็บ · ปุ่มกระดิ่งวางในหัวหน้าของแต่ละหน้า (ซ้ายของปุ่มปริ้น/เพิ่มรายการ)
  return (
    <NotifyProvider>
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
        <BoardToast />
        <StickyHScroll />
        <HistoryBar />
        <HubButton />
      </div>
    </NotifyProvider>
  )
}
