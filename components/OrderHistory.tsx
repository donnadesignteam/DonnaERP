'use client'

// ประวัติของออเดอร์ใบเดียว — "ใครทำอะไรกับออเดอร์นี้บ้าง"
// เห็นได้ทุกคนที่เปิดโฟลเดอร์ลูกค้า (ทั้งคอมและมือถือ ใช้คอมโพเนนต์ตัวนี้ร่วมกัน)
// ‼️ ทุกคนเห็นว่ามีการแก้อะไร แต่ "ชื่อคนแก้" โชว์เฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน (isOwnerLogin)

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isOwnerLogin } from '@/lib/adminActor'
import { type Log, actionLabel, changeSummary, actorName, dateTimeLabel } from '@/lib/activityText'

export default function OrderHistory({ orderId, compact = false }: { orderId: string; compact?: boolean }) {
  const [logs, setLogs] = useState<Log[]>([])
  const [canSeeNames, setCanSeeNames] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // โหลดตอนกดเปิดครั้งแรกเท่านั้น (ออเดอร์ในโฟลเดอร์มีหลายใบ — ไม่ยิง query ให้ทุกใบตั้งแต่เปิดหน้า)
  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next || loaded) return
    setLoading(true)
    const res = await supabase.from('activity_logs')
      .select('id, table_name, category, action, row_id, label, changes, created_at, actor_code, actor_name')
      .eq('table_name', 'order_entries').eq('row_id', orderId)
      .order('created_at', { ascending: false }).limit(60)
    setLogs((res.data ?? []) as Log[])
    setCanSeeNames(isOwnerLogin())
    setLoaded(true)
    setLoading(false)
  }

  const fs = compact ? 11.5 : 12

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={toggle}
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: fs, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
        ประวัติการแก้ไขออเดอร์นี้ <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          {loading && <div style={{ fontSize: fs, color: 'var(--ink-4)' }}>กำลังโหลด…</div>}
          {!loading && logs.length === 0 && (
            <div style={{ fontSize: fs, color: 'var(--ink-4)' }}>ยังไม่มีประวัติ (เก็บเฉพาะที่เกิดหลังเปิดใช้ระบบนี้)</div>
          )}
          {logs.map(log => {
            const act = actionLabel(log.action, log.table_name)
            const who = actorName(log, canSeeNames)
            const summary = changeSummary(log.changes, 3)
            return (
              <div key={log.id} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: fs, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--ink-4)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{dateTimeLabel(log.created_at)}</span>
                <span style={{ minWidth: 0 }}>
                  {who && <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{who} </span>}
                  <span style={{ color: act.c, fontWeight: 600 }}>{act.t}</span>
                  {summary && <span style={{ color: 'var(--ink-3)' }}> · {summary}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
