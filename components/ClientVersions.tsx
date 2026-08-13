'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isOwnerLogin } from '@/lib/adminActor'

// "เครื่องไหนใช้เวอร์ชันอะไรอยู่" — ทุกหน้าที่เปิดจะเขียนแถวของตัวเองไว้ (ดู components/UpdateBanner.tsx)
// ใช้ตอบคำถามว่า ทีมอัปเดตกันครบหรือยัง / ใครยังค้างของเก่าจนเจอบั๊กที่แก้ไปแล้ว
// ‼️ ต้องรัน sql/add_client_versions.sql ก่อน ไม่งั้นการ์ดนี้จะขึ้นว่ายังไม่ได้เปิดใช้

type Row = {
  client_id: string
  staff_code: string | null
  staff_name: string | null
  version: string
  user_agent: string | null
  updated_at: string
}

const device = (ua: string | null): string => {
  const t = ua ?? ''
  if (/iPhone|iPad/i.test(t)) return 'iPhone/iPad'
  if (/Android/i.test(t)) return 'Android'
  if (/Macintosh/i.test(t)) return 'Mac'
  if (/Windows/i.test(t)) return 'Windows'
  return 'อื่นๆ'
}

const ago = (iso: string): string => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'เมื่อครู่'
  if (min < 60) return `${min} นาทีที่แล้ว`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ชม.ที่แล้ว`
  return `${Math.floor(hr / 24)} วันที่แล้ว`
}

export default function ClientVersions() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [off, setOff] = useState(false)   // ยังไม่ได้รัน SQL สร้างตาราง
  // เห็นได้เฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน — พนักงานที่ล็อกอินด้วยรหัสตัวเองไม่ต้องเห็นเครื่องคนอื่น
  const [owner, setOwner] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!isOwnerLogin() || !alive) return
      setOwner(true)
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const d = await res.json()
        if (alive) setCurrent(d?.version ?? null)
      } catch { /* อ่านเวอร์ชันปัจจุบันไม่ได้ — ยังโชว์รายการเครื่องได้ */ }
      const { data, error } = await supabase.from('client_versions')
        .select('*').order('updated_at', { ascending: false }).limit(60)
      if (!alive) return
      if (error) setOff(true)
      else setRows((data ?? []) as Row[])
    }
    load()
    return () => { alive = false }
  }, [])

  const old = rows?.filter(r => current && r.version !== current).length ?? 0
  if (!owner) return null

  return (
    <div style={{ width: 340, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>เวอร์ชันที่แต่ละเครื่องใช้อยู่</h2>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
        {off ? 'ยังไม่ได้เปิดใช้ — ต้องรัน sql/add_client_versions.sql ก่อน'
          : rows === null ? 'กำลังโหลด…'
          : old > 0 ? `มี ${old} เครื่องยังใช้เวอร์ชันเก่า (เข้าเว็บแล้วกดปุ่มอัปเดตที่ขึ้นล่างจอ)`
          : 'ทุกเครื่องใช้เวอร์ชันล่าสุดแล้ว'}
      </p>

      {rows !== null && rows.length > 0 && (
        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => {
            const isOld = !!current && r.version !== current
            return (
              <div key={r.client_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: isOld ? '#fff6f6' : 'var(--bg)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: isOld ? 'var(--red)' : '#34c759', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.staff_name || r.staff_code || 'รหัสรวมของร้าน'} · {device(r.user_agent)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {isOld ? 'ค้างเวอร์ชันเก่า' : 'ล่าสุด'} · เห็นครั้งสุดท้าย {ago(r.updated_at)}
                  </div>
                </div>
                <code style={{ fontSize: 10, color: 'var(--ink-4)' }}>{r.version.slice(0, 7)}</code>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
