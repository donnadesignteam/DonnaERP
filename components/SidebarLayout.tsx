'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import HistoryBar from './HistoryBar'
import HubButton from './HubButton'
import StaffNameSync from './StaffNameSync'
import NotifyBell from './NotifyBell'
import BoardToast from './BoardToast'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  // กระดิ่งแจ้งเตือนอยู่ทุกหน้า — หน้าภาพรวมวางในหัวหน้าเองอยู่แล้ว หน้าอื่นลอยมุมขวาบน
  // เว้นขอบขวาของเนื้อหาไว้ให้กระดิ่ง ไม่ให้ทับปุ่มมุมขวาบนของแต่ละหน้า (ปริ้น / ＋เพิ่มรายการ)
  const pathname = usePathname()
  const floatBell = pathname !== '/dashboard'
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
        <div style={{ padding: floatBell ? '32px 96px 32px 36px' : '32px 36px' }}>
          {children}
        </div>
      </main>
      {floatBell && (
        <div style={{ position: 'fixed', top: 32, right: 32, zIndex: 400 }}>
          <NotifyBell />
        </div>
      )}
      <BoardToast />
      <HistoryBar />
      <HubButton />
    </div>
  )
}
