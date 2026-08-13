'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ActivityLog from '@/components/ActivityLog'
import ClientVersions from '@/components/ClientVersions'
import { CHANGELOG } from '@/lib/changelog'
import { readStaffSession } from '@/lib/staffSession'
import { fetchStaffOne } from '@/lib/staffDb'

const fmtChangeDate = (d: string) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

export default function SettingsPage() {
  const [loggingOut, setLoggingOut] = useState(false)
  // ใครล็อกอินอยู่ — ล็อกอินด้วยรหัสพนักงานจะขึ้นชื่อคนนั้น, รหัสรวมของร้านขึ้นชื่อร้านเหมือนเดิม
  const [me, setMe] = useState<{ code: string; nickname: string } | null>(null)
  const [meDetail, setMeDetail] = useState('')

  useEffect(() => {
    const s = readStaffSession()
    setMe(s)
    if (s) {
      fetchStaffOne(s.code)
        .then(st => setMeDetail([st?.name, st?.position].filter(Boolean).join(' · ')))
        .catch(() => {})
    }
  }, [])

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
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                {me ? (me.nickname || me.code) : 'Donna Design Admin'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                {me ? [me.code, meDetail].filter(Boolean).join(' · ') : 'ระบบจัดการหลังบ้าน'}
              </div>
            </div>
          </div>
          {me && (
            <Link href={`/staff/${me.code}`}
              style={{ display: 'block', marginTop: 14, textAlign: 'center', padding: '8px', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--blue)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              ข้อมูลของฉัน · ประวัติการแก้ไข
            </Link>
          )}
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

        {/* เวอร์ชันที่แต่ละเครื่องใช้อยู่ — ดูว่าใครยังค้างของเก่า */}
        <ClientVersions />

        {/* ประวัติการแก้ไขทั้งร้าน — อยู่ขวาของการ์ดบัญชี */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <ActivityLog />
        </div>
      </div>
    </div>
  )
}
