'use client'

import { useState } from 'react'
import ActivityLog from '@/components/ActivityLog'
import { CHANGELOG } from '@/lib/changelog'

const fmtChangeDate = (d: string) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

export default function SettingsPage() {
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      // เผื่อ network พลาด ก็ยังพาไปหน้า login (cookie จะถูกเช็คซ้ำที่ proxy)
    }
    window.location.href = '/login'
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>ตั้งค่า</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 32, fontSize: 14 }}>ข้อมูลบัญชีที่เข้าใช้งาน</p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Account info */}
        <div style={{ width: 340, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--ink)' }}>บัญชีที่เข้าใช้งาน</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--blue)22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Donna Design Admin</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>ระบบจัดการหลังบ้าน</div>
            </div>
          </div>
          <button onClick={logout} disabled={loggingOut} style={{ marginTop: 20, width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #ff375f', background: '#fff', color: 'var(--red)', cursor: loggingOut ? 'default' : 'pointer', fontSize: 14, fontWeight: 500, opacity: loggingOut ? 0.6 : 1 }}>
            {loggingOut ? 'กำลังออกจากระบบ…' : '🚪 Logout'}
          </button>
        </div>

        {/* ประวัติการอัปเดตเว็บ — ฟีเจอร์/การแก้ไขที่เพิ่มเข้ามาแต่ละวัน */}
        <div style={{ width: 400, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>🛠 ประวัติการอัปเดตเว็บ</h2>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>ฟังก์ชั่นใหม่และการแก้ไขที่เพิ่มเข้ามา</p>
          <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {CHANGELOG.map((c) => (
              <div key={c.date}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>{fmtChangeDate(c.date)}</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {c.items.map((it, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.55 }}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ประวัติการแก้ไขทั้งร้าน — อยู่ขวาของการ์ดบัญชี */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <ActivityLog />
        </div>
      </div>
    </div>
  )
}
