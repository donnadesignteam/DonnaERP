'use client'

// "ประวัติการแก้ไขของฉัน" — ของคนคนเดียวเท่านั้น (กรองด้วย actor_code)
// ใช้ทั้งหน้าพนักงานรายคนบนคอม (/staff/[code]) และหน้าข้อมูลของฉันบนมือถือ (/m/me)

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type Log, CAT_COLOR, actionLabel, changeSummary, groupByDay, hhmm } from '@/lib/activityText'

const PAGE = 30

export default function MyActivity({ code, mobile = false }: { code: string; mobile?: boolean }) {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)

  // ‼️ ห้าม setState ก่อน await ตัวแรก (react-hooks/set-state-in-effect) — ปุ่ม "โหลดเพิ่ม" ตั้ง loading เอง
  const load = useCallback(async (offset: number) => {
    const { data } = await supabase.from('activity_logs')
      .select('id, table_name, category, action, row_id, label, changes, created_at, actor_code, actor_name')
      .eq('actor_code', code)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    const rows = (data ?? []) as Log[]
    setHasMore(rows.length === PAGE)
    setLogs(prev => offset === 0 ? rows : [...prev, ...rows])
    setLoading(false)
  }, [code])

  useEffect(() => { load(0) }, [load])

  const fs = mobile ? 12.5 : 13

  return (
    <div>
      {groupByDay(logs).map(group => (
        <div key={group.key}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', padding: '14px 2px 6px', borderBottom: '2px solid var(--border)' }}>
            {group.label}
          </div>
          {group.items.map(log => {
            const act = actionLabel(log.action, log.table_name)
            const summary = changeSummary(log.changes)
            return (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 40, flexShrink: 0, fontSize: 12, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' }}>{hhmm(log.created_at)}</span>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: CAT_COLOR[log.category] || '#8e8e93', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: fs, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: act.c, fontWeight: 600 }}>{act.t}</span>
                  {' '}<span style={{ color: 'var(--ink-3)' }}>{log.category}</span>
                  {log.label && <span style={{ fontWeight: 600 }}> {log.label}</span>}
                  {summary && <span style={{ color: 'var(--ink-4)' }}> · {summary}</span>}
                </span>
              </div>
            )
          })}
        </div>
      ))}

      {!loading && logs.length === 0 && (
        <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12.5 }}>
          ยังไม่มีประวัติของคุณ (เก็บเฉพาะที่เกิดหลังเปิดใช้ระบบนี้)
        </div>
      )}
      {loading && <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12.5 }}>กำลังโหลด…</div>}
      {hasMore && !loading && (
        <button onClick={() => { setLoading(true); load(logs.length) }}
          style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          โหลดเพิ่ม
        </button>
      )}
    </div>
  )
}
