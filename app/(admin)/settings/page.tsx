'use client'

// หน้าตั้งค่า — จัด UX ใหม่ (17ก.ย.69)
// เดิมยัดการ์ด 4 ใบเรียงกันในแถวเดียว กว้างไม่เท่ากัน แต่ละใบมีแถบเลื่อนของตัวเอง อ่านยาก
// ใหม่: แถบบัญชีด้านบน (ชื่อ + ปุ่มที่ใช้บ่อย) แล้วแบ่งเนื้อหาเป็น 3 แท็บ เปิดทีละเรื่องเต็มความกว้าง

import NotifyBell from '@/components/NotifyBell'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import ActivityLog from '@/components/ActivityLog'
import ClientVersions from '@/components/ClientVersions'
import { CHANGELOG } from '@/lib/changelog'
import { readStaffSession } from '@/lib/staffSession'
import { fetchStaffOne } from '@/lib/staffDb'
import { clearRowCache } from '@/lib/rowCache'

const fmtChangeDate = (d: string) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

type Tab = 'activity' | 'updates' | 'devices'
const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: 'activity', label: 'ประวัติการแก้ไข', sub: 'ใครแก้อะไรไปบ้างทั้งร้าน' },
  { id: 'updates', label: 'อัปเดตเว็บ', sub: 'ฟังก์ชั่นใหม่และการแก้ไขที่เพิ่มเข้ามา' },
  { id: 'devices', label: 'เครื่องที่ใช้งาน', sub: 'ใครยังค้างเว็บเวอร์ชันเก่า' },
]

export default function SettingsPage() {
  const [loggingOut, setLoggingOut] = useState(false)
  const [tab, setTab] = useState<Tab>('activity')
  const [updateSearch, setUpdateSearch] = useState('')
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
    clearRowCache()   // ล้างออเดอร์ที่จำไว้ในเครื่อง (มีชื่อ/ที่อยู่/เบอร์ลูกค้า)
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      // เผื่อ network พลาด ก็ยังพาไปหน้า login (cookie จะถูกเช็คซ้ำที่ proxy)
    }
    window.location.href = '/login'
  }

  // ค้นในประวัติอัปเดต — พิมพ์คำแล้วเหลือเฉพาะรอบที่มีคำนั้น
  const q = updateSearch.trim().toLowerCase()
  const updates = !q
    ? CHANGELOG
    : CHANGELOG.map(c => ({ ...c, items: c.items.filter(it => it.toLowerCase().includes(q)) })).filter(c => c.items.length)
  const updateCount = CHANGELOG.reduce((t, c) => t + c.items.length, 0)

  return (
    <div>
      <div style={{ float: 'right', marginLeft: 12 }}><NotifyBell /></div>
      <h1 className="sc-title">ตั้งค่า</h1>
      <p className="sc-sub" style={{ marginBottom: 22 }}>บัญชีที่เข้าใช้งาน · ประวัติการแก้ไข · สิ่งที่เพิ่งเพิ่มเข้ามาในเว็บ</p>

      {/* ── แถบบัญชี: ชื่อคนที่ล็อกอิน + ปุ่มที่ใช้บ่อย ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
        boxShadow: '0 4px 16px rgba(120,86,58,0.10)', padding: '16px 20px', marginBottom: 22,
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--cream)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>เข้าใช้งานอยู่</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
            {me ? (me.nickname || me.code) : 'Donna Design Admin'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>
            {me ? [me.code, meDetail].filter(Boolean).join(' · ') : 'เข้าด้วยรหัสรวมของร้าน — ประวัติการแก้ไขจะไม่ติดชื่อคน'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {me && (
            <Link href={`/staff/${me.code}`} className="sc-btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              ข้อมูลของฉัน
            </Link>
          )}
          <button onClick={logout} disabled={loggingOut}
            style={{ padding: '11px 22px', borderRadius: 999, border: '1px solid #E2B9A8', background: 'var(--red-bg)', color: 'var(--red)', cursor: loggingOut ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, opacity: loggingOut ? 0.6 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {loggingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
          </button>
        </div>
      </div>

      {/* ── แท็บเนื้อหา — เปิดทีละเรื่อง เต็มความกว้าง อ่านง่ายกว่าเรียงการ์ดติดกัน ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(t => {
          const on = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} title={t.sub}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 999,
                border: on ? 'none' : '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13.5, fontWeight: 600, background: on ? 'var(--brand)' : 'var(--cream-2)',
                color: on ? '#FFF8F0' : 'var(--ink-2)', boxShadow: on ? '0 3px 10px rgba(158,106,73,0.25)' : 'none',
              }}>
              {t.label}
              {t.id === 'updates' && (
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: on ? 'rgba(255,248,240,0.22)' : 'var(--cream)', color: on ? '#FFF8F0' : '#8A6142' }}>
                  {updateCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'activity' && <ActivityLog />}

      {tab === 'updates' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 4px 16px rgba(120,86,58,0.10)', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ประวัติการอัปเดตเว็บ</h2>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>ฟังก์ชั่นใหม่และการแก้ไขที่เพิ่มเข้ามา · ใหม่สุดอยู่บน</p>
            </div>
            <input value={updateSearch} onChange={e => setUpdateSearch(e.target.value)} placeholder="ค้นในรายการอัปเดต…"
              style={{ width: 240, maxWidth: '100%', background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 999, padding: '9px 16px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: 'var(--ink)' }} />
          </div>

          {updates.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>ไม่เจอรายการที่ตรงกับ “{updateSearch}”</p>
          ) : (
            /* เรียงเป็นคอลัมน์ตามความกว้างจอ — จอกว้างอ่านได้หลายรอบพร้อมกัน ไม่ต้องเลื่อนในกล่องเล็ก */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
              {updates.map(c => (
                <div key={c.date} style={{ background: 'var(--cream-2)', border: '1px solid var(--hairline)', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: '#8A6142', background: 'var(--cream)', borderRadius: 999, padding: '3px 12px', marginBottom: 9 }}>
                    {fmtChangeDate(c.date)}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {c.items.map((it, i) => (
                      <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'devices' && <ClientVersions />}
    </div>
  )
}
