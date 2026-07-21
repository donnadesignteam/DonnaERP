'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { HOLIDAYS } from '@/lib/holidays'
import { RED_ZONES, CAMPAIGNS, LEAVE_STATUS_COLOR, DAYS_TH, TH_MONTHS, ymdOf, monthCells } from '@/lib/shopCalendar'
import { useStickyState, usePullToRefresh, useSheetBack, PullIndicator, UpdatedRow, monthNavBtn, clamp } from './mobileUi'

// ปฏิทินร้านบนมือถือ — ดูอย่างเดียว (เดสก์ท็อป = app/(admin)/employees ที่มีฟอร์มขอลาด้วย)
type Leave = {
  id: string
  employee_nickname: string
  employee_name: string
  department: string
  leave_date: string
  leave_end_date: string | null
  leave_time: string | null
  leave_type: string
  reason: string | null
  leave_status: string
}

// ใบลาคลุมวันไหนบ้าง (ลาหลายวัน = leave_date → leave_end_date)
const coversDay = (l: Leave, ymd: string) => {
  const start = (l.leave_date || '').slice(0, 10)
  const end = (l.leave_end_date || l.leave_date || '').slice(0, 10)
  if (!start) return false
  return ymd >= start && ymd <= end
}

export default function MobileCalendar() {
  const cached = getPageCache<Leave[]>('leave_requests')
  const [leaves, setLeaves] = useState<Leave[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const today = new Date()
  const [year, setYear] = useStickyState('cal:year', today.getFullYear())
  const [month, setMonth] = useStickyState('cal:month', today.getMonth())
  const [daySheet, setDaySheet] = useState<string | null>(null)   // ymd ของวันที่กดดู

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Leave>(() =>
      // ‼️ เลือกเฉพาะคอลัมน์ที่ปฏิทินใบลาใช้ — เดิม select('*') ดึงทุกคอลัมน์เปลืองเน็ตมือถือ
      supabase.from('leave_requests')
        .select('id, employee_nickname, employee_name, department, leave_date, leave_end_date, leave_time, leave_type, reason, leave_status')
        .order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    else {
      setError('')
      setPageCache('leave_requests', data)
      setUpdatedAt(Date.now())
    }
    setLeaves(data)
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const { pull, refreshing, refresh } = usePullToRefresh(load)
  useSheetBack(!!daySheet, () => setDaySheet(null))

  const cells = useMemo(() => monthCells(year, month), [year, month])
  const leavesOn = (ymd: string) => leaves.filter(l => coversDay(l, ymd))
  const isThisMonth = year === today.getFullYear() && month === today.getMonth()
  // จำนวนใบลาทั้งเดือน (หน้าติดตั้งมี "N งาน" อยู่แล้ว หน้านี้เคยไม่มี)
  const monthLeaveCount = useMemo(
    () => cells.reduce<number>((n, d) => n + (d ? leavesOn(ymdOf(year, month, d)).length : 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, leaves, year, month])

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  const sheetLeaves = daySheet ? leavesOn(daySheet) : []

  return (
    <div>
      {/* ไม่มีชื่อหน้า — ผู้ใช้สั่งเอาออกทุกหน้า (แถบเมนูล่างบอกอยู่แล้ว) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'calc(env(safe-area-inset-top) + 10px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px 8px', gap: 8 }}>
          <button onClick={prevMonth} aria-label="เดือนก่อน" style={monthNavBtn}>‹</button>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>
              {TH_MONTHS[month]} {year + 543}
              <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-4)', marginLeft: 7 }}>ลา {monthLeaveCount} ครั้ง</span>
            </div>
            {!isThisMonth && (
              <button onClick={goToday} style={{ marginTop: 2, border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '2px 8px' }}>
                ← กลับไปเดือนนี้
              </button>
            )}
          </div>
          <button onClick={nextMonth} aria-label="เดือนถัดไป" style={monthNavBtn}>›</button>
        </div>
        <UpdatedRow at={updatedAt} refreshing={refreshing} onRefresh={refresh} />
      </div>

      <PullIndicator pull={pull} refreshing={refreshing} />

      {error && (
        <div style={{ margin: '12px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 12px', color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span>
          <button onClick={() => { setLoading(true); load() }} style={{ border: 'none', background: 'transparent', color: 'var(--red)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>ลองใหม่</button>
        </div>
      )}

      <div style={{ padding: '10px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
          {DAYS_TH.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--ink-4)' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const ymd = ymdOf(year, month, day)
            const holiday = HOLIDAYS[ymd]
            const isSunday = new Date(year, month, day).getDay() === 0
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const redzone = RED_ZONES.has(ymd)
            const campaign = CAMPAIGNS[ymd]
            const dayLeaves = leavesOn(ymd)
            return (
              <button key={i} onClick={() => setDaySheet(ymd)}
                style={{
                  // ‼️ ทุกช่องเท่ากันเป๊ะ (ดูคอมเมนต์เดียวกันใน MobileInstallations)
                  height: 76, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2,
                  // Red Zone = ช่วงห้ามลา → แดงทั้งช่อง (user สั่งเปลี่ยนจากขีดแดงบนหัวช่อง) มาก่อนวันหยุด/วันอาทิตย์
                  background: redzone ? 'var(--cal-redzone)' : holiday ? 'var(--cal-holiday)' : isSunday ? 'var(--cal-sunday)' : 'var(--surface)',
                  border: isToday ? '2px solid var(--blue)' : redzone ? '1px solid var(--cal-redzone-border)' : '1px solid var(--border)',
                  borderRadius: 8, padding: '4px 4px 3px', cursor: 'pointer', textAlign: 'left', font: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ fontSize: 12.5, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--blue)' : redzone ? 'var(--red)' : holiday ? 'var(--cal-holiday-ink)' : 'var(--ink-2)' }}>
                  {day}
                </span>
                {/* ‼️ ขั้นต่ำ 10.5px — ของเดิม 8.5px อ่านไม่ออกจริงบนมือถือ */}
                {campaign && <span style={{ fontSize: 10, color: '#c2510a', fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📣{campaign}</span>}
                {holiday && !campaign && <span style={{ fontSize: 10, color: 'var(--cal-holiday-ink)', fontWeight: 600, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holiday}</span>}
                {dayLeaves.length > 0 && (
                  <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 'auto' }}>
                    {dayLeaves.slice(0, 2).map(l => (
                      <span key={l.id} style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 3, padding: '1px 3px', lineHeight: 1.3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        background: (LEAVE_STATUS_COLOR[l.leave_status] ?? '#a1a1aa') + '26', color: LEAVE_STATUS_COLOR[l.leave_status] ?? '#71717a' }}>
                        {l.employee_nickname}
                      </span>
                    ))}
                    {dayLeaves.length > 2 && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)' }}>+{dayLeaves.length - 2}</span>}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>กำลังโหลดใบลา…</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '14px 6px 4px', fontSize: 11.5, color: 'var(--ink-3)' }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--cal-holiday)', border: '1px solid var(--border-2)', marginRight: 4 }} />วันหยุดร้าน</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--cal-redzone)', border: '1px solid var(--cal-redzone-border)', marginRight: 4 }} />ช่วงห้ามลา</span>
          <span>📣 แคมเปญ</span>
          {/* สีชิปคนลาในช่องวันเคยไม่มีคำอธิบายเลย */}
          {Object.entries(LEAVE_STATUS_COLOR).map(([label, c]) => (
            <span key={label}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, marginRight: 4 }} />{label}</span>
          ))}
        </div>
      </div>

      {/* กดวัน → รายละเอียดวันนั้น */}
      {daySheet && (
        <div onClick={() => setDaySheet(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxHeight: '78dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '18px 18px 0 0', padding: '8px 16px calc(20px + env(safe-area-inset-bottom))' }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '4px auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>
              {parseInt(daySheet.slice(8), 10)} {TH_MONTHS[parseInt(daySheet.slice(5, 7), 10) - 1]} {parseInt(daySheet.slice(0, 4), 10) + 543}
            </h3>

            {HOLIDAYS[daySheet] && <div style={{ ...badge, background: 'var(--cal-holiday)', border: '1px solid var(--border-2)', color: 'var(--cal-holiday-ink)' }}>🏖️ วันหยุดร้าน · {HOLIDAYS[daySheet]}</div>}
            {CAMPAIGNS[daySheet] && <div style={{ ...badge, background: 'var(--blue-bg)', border: '1px solid var(--border-2)', color: '#c2510a' }}>📣 แคมเปญ · {CAMPAIGNS[daySheet]}</div>}
            {RED_ZONES.has(daySheet) && <div style={{ ...badge, background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)' }}>🔴 ช่วงห้ามลา (Red Zone)</div>}

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '14px 0 8px' }}>
              คนลา {sheetLeaves.length > 0 ? `(${sheetLeaves.length})` : ''}
            </div>
            {sheetLeaves.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '4px 0 10px' }}>ไม่มีคนลาวันนี้</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sheetLeaves.map(l => (
                  <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{l.employee_nickname}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: LEAVE_STATUS_COLOR[l.leave_status] ?? 'var(--ink-4)' }}>{l.leave_status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                      {[l.leave_type, l.department, l.leave_time].filter(Boolean).join(' · ')}
                    </div>
                    {l.leave_end_date && l.leave_end_date.slice(0, 10) !== l.leave_date.slice(0, 10) && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                        {l.leave_date.slice(0, 10)} → {l.leave_end_date.slice(0, 10)}
                      </div>
                    )}
                    {l.reason && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.45, ...clamp(3) }}>{l.reason}</div>}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setDaySheet(null)}
              style={{ width: '100%', marginTop: 16, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, cursor: 'pointer', color: 'var(--ink)' }}>ปิด</button>
          </div>
        </div>
      )}
    </div>
  )
}

const badge: React.CSSProperties = { borderRadius: 10, padding: '9px 12px', marginBottom: 8, fontSize: 12.5, fontWeight: 600 }
