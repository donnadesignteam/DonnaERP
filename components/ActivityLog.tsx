'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  type Log, CAT_COLOR, actionLabel, changeSummary, groupByDay, hhmm, actorName,
} from '@/lib/activityText'

const PAGE = 50

export default function ActivityLog() {
  const [logs, setLogs] = useState<Log[]>([])
  const [cat, setCat] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // เห็นชื่อคนแก้ได้เฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน (อ่านคุกกี้ได้เฉพาะฝั่งเบราว์เซอร์)
  const [canSeeNames, setCanSeeNames] = useState(false)
  useEffect(() => { setCanSeeNames(true) }, [])   // 19ก.ย.69 user สั่ง: ทุกคนเห็นว่าใครแก้อะไร

  const load = useCallback(async (reset: boolean) => {
    setLoading(true)
    setError(null)
    const offset = reset ? 0 : logs.length
    let q = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (cat) q = q.eq('category', cat)
    const { data, error } = await q
    if (error) {
      // ตารางยังไม่ถูกสร้าง = ยังไม่ได้รัน SQL
      setError(error.message.includes('activity_logs') || error.code === '42P01'
        ? 'ยังไม่ได้รัน scripts/add_activity_logs.sql ใน Supabase'
        : error.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as Log[]
    setHasMore(rows.length === PAGE)
    setLogs(reset ? rows : [...logs, ...rows])
    setLoading(false)
  }, [cat, logs])

  // โหลดใหม่เมื่อเปลี่ยนหมวด
  useEffect(() => { load(true) /* eslint-disable-next-line */ }, [cat])

  const cats = ['', 'ออเดอร์', 'เคลม', 'งานติดตั้ง', 'สั่งซื้อ', 'สต็อก', 'ใบลา', 'สแกนผลิต']

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 4px 16px rgba(120,86,58,0.10)', padding: '22px 24px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>ประวัติการแก้ไข</h2>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>ทุกการเพิ่ม/แก้ไข/ลบ ในระบบ — เชื่อมทั้งร้านอัตโนมัติ</p>

      {/* ตัวกรองหมวด */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {cats.map(c => (
          <button key={c || 'all'} onClick={() => setCat(c)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: cat === c ? 'none' : '1px solid var(--border-2)',
              background: cat === c ? 'var(--brand)' : 'var(--cream-2)',
              color: cat === c ? '#FFF8F0' : 'var(--ink-2)', fontWeight: 600,
              boxShadow: cat === c ? '0 3px 10px rgba(158,106,73,0.25)' : 'none',
            }}>
            {c || 'ทั้งหมด'}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 14, borderRadius: 14, background: 'var(--red-bg)', border: '1px solid #E2B9A8', color: 'var(--red)', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {!error && (
        <div>
          {groupByDay(logs).map(group => (
            <div key={group.key}>
              {/* หัววัน — เหมือน Chrome history */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', padding: '16px 4px 7px', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                {group.label}
              </div>
              {group.items.map(log => {
                const act = actionLabel(log.action, log.table_name)
                const summary = changeSummary(log.changes)
                const who = actorName(log, canSeeNames)
                return (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 42, flexShrink: 0, fontSize: 12, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' }}>{hhmm(log.created_at)}</span>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: CAT_COLOR[log.category] || '#8e8e93', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {who && <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{who} </span>}
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
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>ยังไม่มีประวัติ</div>
          )}

          {loading && <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>กำลังโหลด…</div>}

          {hasMore && !loading && (
            <button onClick={() => load(false)}
              style={{ marginTop: 12, padding: '11px', borderRadius: 999, border: '1px solid var(--border-2)', background: 'var(--cream-2)', color: 'var(--brand)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              โหลดเพิ่ม
            </button>
          )}
        </div>
      )}
    </div>
  )
}
