'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Log = {
  id: string
  action: string
  table_name: string
  details: string
  created_at: string
}

export default function SettingsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [dark, setDark] = useState(false)
  const [dbOk, setDbOk] = useState<boolean | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') { setDark(true); document.documentElement.style.background = 'var(--ink)' }
    ;(async () => {
      const { error } = await supabase.from('orders').select('id').limit(1)
      setDbOk(!error)
    })()
    ;(async () => {
      const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50)
      setLogs((data ?? []) as Log[])
    })()
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.style.background = next ? 'var(--ink)' : ''
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>ตั้งค่า</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 32, fontSize: 14 }}>ข้อมูลระบบและการตั้งค่าทั่วไป</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Account info */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--ink)' }}>บัญชีที่เข้าใช้งาน</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--blue)22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Donna Design Admin</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>ระบบจัดการหลังบ้าน</div>
            </div>
          </div>
          <button style={{ marginTop: 20, width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #ff375f', background: '#fff', color: 'var(--red)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            🚪 Logout
          </button>
        </div>

        {/* DB Status */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--ink)' }}>สถานะการเชื่อมข้อมูล</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: dbOk === null ? 'var(--ink-3)' : dbOk ? '#34c759' : 'var(--red)', display: 'inline-block' }} />
            <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
              {dbOk === null ? 'กำลังตรวจสอบ…' : dbOk ? 'เชื่อมต่อ Supabase สำเร็จ' : 'ไม่สามารถเชื่อมต่อได้'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'monospace', background: 'var(--bg)', padding: '8px 12px', borderRadius: 8 }}>
            {process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').split('.')[0] ?? '-'}.supabase.co
          </div>
        </div>

        {/* Theme */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--ink)' }}>ธีม</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => !dark && toggleTheme()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${dark ? 'var(--blue)' : 'rgba(0,0,0,0.10)'}`, background: dark ? 'var(--ink)' : '#fff', color: dark ? '#fff' : 'var(--ink)', cursor: 'pointer', fontSize: 13, fontWeight: dark ? 600 : 400 }}>
              🌙 Dark Mode
            </button>
            <button onClick={() => dark && toggleTheme()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${!dark ? 'var(--blue)' : 'rgba(0,0,0,0.10)'}`, background: '#fff', color: 'var(--ink)', cursor: 'pointer', fontSize: 13, fontWeight: !dark ? 600 : 400 }}>
              ☀️ Light Mode
            </button>
          </div>
        </div>

        {/* Report issue */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--ink)' }}>รายงานปัญหา</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 }}>
            หากพบปัญหาในการใช้งานระบบ กรุณาส่งรายงานผ่านปุ่มด้านล่าง
          </p>
          <a href="mailto:prawattana111@gmail.com?subject=Donna ERP - รายงานปัญหา" style={{ display: 'block', padding: '10px', borderRadius: 10, border: 'none', background: '#ff9f0a22', color: '#ff9f0a', textAlign: 'center', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            📮 รายงานปัญหา
          </a>
        </div>
      </div>

      {/* Activity logs */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--ink)' }}>ประวัติการแก้ไข (Activity Log)</h2>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>ยังไม่มี log — log จะแสดงเมื่อเพิ่มตาราง activity_logs ใน Supabase</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {logs.map(l => (
              <div key={l.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap', minWidth: 130 }}>{new Date(l.created_at).toLocaleString('th-TH')}</span>
                <span style={{ fontWeight: 600, color: 'var(--blue)', minWidth: 80 }}>{l.action}</span>
                <span style={{ color: 'var(--ink-3)', minWidth: 80 }}>{l.table_name}</span>
                <span style={{ color: 'var(--ink)', flex: 1 }}>{l.details}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
        Donna Design ERP v1.0 · Next.js {process.env.npm_package_version ?? '16'} · Supabase
      </div>
    </div>
  )
}
