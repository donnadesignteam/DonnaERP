'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { HOLIDAYS } from '@/lib/holidays'
import { RED_ZONES, CAMPAIGNS, LEAVE_STATUS_COLOR, DAYS_TH, TH_MONTHS, ymdOf, monthCells } from '@/lib/shopCalendar'
import { useStickyState, usePullToRefresh, useSheetBack, PullIndicator, UpdatedRow, clamp } from './mobileUi'

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

  // มุมมอง เดือน / สัปดาห์ / วัน เหมือนบนคอม · sel = วันที่เลือก (สัปดาห์/วัน เลื่อนจากวันนี้)
  const [view, setView] = useStickyState<'month' | 'week' | 'day'>('cal:view', 'month')
  const [sel, setSel] = useState(() => ymdOf(today.getFullYear(), today.getMonth(), today.getDate()))
  const todayYmd = ymdOf(today.getFullYear(), today.getMonth(), today.getDate())

  const cells = useMemo(() => monthCells(year, month), [year, month])
  const leavesOn = (ymd: string) => leaves.filter(l => coversDay(l, ymd))
  // จำนวนใบลาทั้งเดือน
  const monthLeaveCount = useMemo(
    () => cells.reduce<number>((n, d) => n + (d ? leavesOn(ymdOf(year, month, d)).length : 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, leaves, year, month])

  // รายการในวัน — ลำดับ/ชนิดเดียวกับ dayItems ของบนคอม (app/(admin)/employees)
  const dayItems = (ymd: string): CalItem[] => {
    const d = new Date(ymd + 'T00:00')
    const out: CalItem[] = []
    if (HOLIDAYS[ymd]) out.push({ key: 'h', kind: 'holiday', title: HOLIDAYS[ymd], sub: 'วันหยุดร้าน' })
    if (d.getDay() === 0) out.push({ key: 's', kind: 'closed', title: 'ร้านปิด', sub: 'วันอาทิตย์' })
    if (CAMPAIGNS[ymd]) out.push({ key: 'c', kind: 'campaign', title: CAMPAIGNS[ymd], sub: 'แคมเปญ' })
    if (RED_ZONES.has(ymd)) out.push({ key: 'r', kind: 'redzone', title: 'RedZone', sub: 'ช่วงห้ามลา' })
    leavesOn(ymd).forEach(l => out.push({
      key: l.id, kind: 'leave', title: l.employee_nickname || l.employee_name,
      sub: [l.leave_type, l.leave_time].filter(Boolean).join(' · '),
    }))
    return out
  }

  const selDate = new Date(sel + 'T00:00')
  const setSelDate = (d: Date) => {
    setSel(ymdOf(d.getFullYear(), d.getMonth(), d.getDate()))
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }
  // สัปดาห์ของวันที่เลือก (เริ่มวันจันทร์ เหมือนตารางเดือน)
  const weekStart = new Date(selDate); weekStart.setDate(selDate.getDate() - ((selDate.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d })

  const shift = (n: number) => {
    if (view === 'month') {
      const d = new Date(year, month + n, 1)
      setYear(d.getFullYear()); setMonth(d.getMonth())
      return
    }
    const d = new Date(selDate); d.setDate(d.getDate() + n * (view === 'week' ? 7 : 1))
    setSelDate(d)
  }
  const goToday = () => setSelDate(new Date())
  const isNow = view === 'month'
    ? year === today.getFullYear() && month === today.getMonth()
    : view === 'week' ? weekDays.some(d => ymdOf(d.getFullYear(), d.getMonth(), d.getDate()) === todayYmd) : sel === todayYmd

  const shortMon = (d: Date) => d.toLocaleDateString('th-TH', { month: 'short' })
  const navTitle = view === 'month' ? `${TH_MONTHS[month]} ${year + 543}`
    : view === 'week' ? `${weekDays[0].getDate()} ${shortMon(weekDays[0])} – ${weekDays[6].getDate()} ${shortMon(weekDays[6])} ${weekDays[6].getFullYear() + 543}`
      : `${DOW_FULL[selDate.getDay()]} ${selDate.getDate()} ${TH_MONTHS[selDate.getMonth()]} ${selDate.getFullYear() + 543}`

  const sheetLeaves = daySheet ? leavesOn(daySheet) : []

  return (
    <div>
      {/* ไม่มีชื่อหน้า — ผู้ใช้สั่งเอาออกทุกหน้า (แถบเมนูล่างบอกอยู่แล้ว)
          ‼️ หน้าตาตามปฏิทินร้านบนคอม (.sc-* ใน globals.css) จัดให้พอดีจอมือถือ (.msc-*) — user ขอ 29ก.ย.69
          แท็บ เดือน/สัปดาห์/วัน · รายการเป็นการ์ดพาสเทลมีจุดสี ชนิดเดียวกับบนคอม */}
      <div className="msc-top">
        <div className="sc-seg msc-seg">
          {([['month', 'เดือน'], ['week', 'สัปดาห์'], ['day', 'วัน']] as const).map(([k, l]) => (
            <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <div className="msc-nav">
          <button onClick={() => shift(-1)} aria-label="ก่อนหน้า" className="sc-circle msc-circle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div className="msc-month">{navTitle}</div>
            {view === 'month' && <div className="msc-sub">ลา {monthLeaveCount} ครั้ง</div>}
          </div>
          <button onClick={() => shift(1)} aria-label="ถัดไป" className="sc-circle msc-circle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
        <div className="msc-subrow">
          {!isNow ? <button onClick={goToday} className="sc-pill msc-today">วันนี้</button> : <span />}
          <UpdatedRow at={updatedAt} refreshing={refreshing} onRefresh={refresh} />
        </div>
      </div>

      <PullIndicator pull={pull} refreshing={refreshing} />

      {error && (
        <div style={{ margin: '12px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 12px', color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span>
          <button onClick={() => { setLoading(true); load() }} style={{ border: 'none', background: 'transparent', color: 'var(--red)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>ลองใหม่</button>
        </div>
      )}

      <div className="msc-card">
        {view === 'month' && (
          <div className="sc-grid msc-grid">
            {DAYS_TH.map(d => <div key={d} className="sc-dow msc-dow">{d}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="sc-cell sc-out msc-cell" />
              const ymd = ymdOf(year, month, day)
              const items = dayItems(ymd)
              return (
                <button key={i} onClick={() => setDaySheet(ymd)} className={`sc-cell msc-cell${ymd === todayYmd ? ' sc-today' : ''}`}>
                  <span className="sc-num msc-num">{day}</span>
                  {/* การ์ดย่อ: จุดสี + ชื่อ (ช่องแคบ ไม่มีบรรทัดรอง) — ครบทุกบรรทัดดูได้ในแท็บสัปดาห์/วัน หรือกดวัน */}
                  {items.slice(0, 3).map(it => (
                    <span key={it.key} className={`sc-chip sc-${it.kind} msc-chip`}>
                      <i className="sc-dot" />
                      <span className="msc-chip-t">{it.title}</span>
                    </span>
                  ))}
                  {items.length > 3 && <span className="sc-more msc-more">+{items.length - 3}</span>}
                </button>
              )
            })}
          </div>
        )}

        {view === 'week' && (
          <div className="msc-week">
            {weekDays.map(d => {
              const ymd = ymdOf(d.getFullYear(), d.getMonth(), d.getDate())
              const items = dayItems(ymd)
              return (
                <div key={ymd} className={`msc-wrow${ymd === todayYmd ? ' msc-wtoday' : ''}`} onClick={() => setDaySheet(ymd)}>
                  <div className="msc-wdate">
                    <div className="msc-wdow">{DAYS_TH[(d.getDay() + 6) % 7]}</div>
                    <div className="msc-wnum">{d.getDate()}</div>
                  </div>
                  <div className="msc-witems">
                    {items.length === 0
                      ? <div className="msc-wempty">ไม่มีรายการ</div>
                      : items.map(it => <EventChip key={it.key} it={it} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'day' && (() => {
          const items = dayItems(sel)
          return (
            <div className="sc-dayview msc-dayview">
              {items.length === 0
                ? <div className="sc-empty">ไม่มีรายการในวันนี้</div>
                : items.map(it => <EventChip key={it.key} it={it} big onClick={() => setDaySheet(sel)} />)}
            </div>
          )
        })()}

        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>กำลังโหลดใบลา…</div>}

        {/* คำอธิบายสี — ชุดเดียวกับบนคอม */}
        <div className="sc-legend msc-legend">
          {[['#C0564A', 'RedZone'], ['#C79A4B', 'Campaign'], ['#D9AE86', 'วันหยุด'], ['#A8714F', 'ใบลา'], ['#9A9AA6', 'ร้านปิด (อา.)']].map(([c, l]) => (
            <span key={l}><i style={{ background: c }} />{l}</span>
          ))}
        </div>
      </div>

      {/* กดวัน → รายละเอียดวันนั้น (แผ่นเลื่อนขึ้นจากล่าง ธีมเดียวกับหน้าต่างรายละเอียดวันบนคอม) */}
      {daySheet && (() => {
        const d = new Date(daySheet + 'T00:00')
        return (
          <div onClick={() => setDaySheet(null)} className="msc-back">
            <div onClick={e => e.stopPropagation()} className="msc-sheet">
              <div className="msc-handle" />
              <div className="sc-mhead">
                <div className="sc-mdate">
                  <div className="sc-mday">{d.getDate()}</div>
                  <div>
                    <div className="sc-mdow">{DOW_FULL[d.getDay()]}</div>
                    <div className="sc-mmon">{TH_MONTHS[d.getMonth()]} {d.getFullYear() + 543}</div>
                  </div>
                </div>
                <button className="sc-mclose" onClick={() => setDaySheet(null)} aria-label="ปิด">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>

              {/* แถบสถานะวัน — การ์ดสีเดียวกับบนคอม */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.getDay() === 0 && <DayTag kind="closed" title="ร้านปิด" sub="วันอาทิตย์" />}
                {HOLIDAYS[daySheet] && <DayTag kind="holiday" title={HOLIDAYS[daySheet]} sub="วันหยุดร้าน" />}
                {CAMPAIGNS[daySheet] && <DayTag kind="campaign" title={CAMPAIGNS[daySheet]} sub="แคมเปญ" />}
                {RED_ZONES.has(daySheet) && <DayTag kind="redzone" title="RedZone" sub="ช่วงห้ามลา" />}
              </div>

              <div className="sc-msec">การลา <span>{sheetLeaves.length}</span></div>
              {sheetLeaves.length === 0 ? (
                <div className="sc-mempty">ไม่มีการลาในวันนี้</div>
              ) : sheetLeaves.map(l => (
                <div key={l.id} className="sc-mitem">
                  <i className="sc-dot" style={{ background: '#A8714F' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span className="sc-mname">{l.employee_nickname || l.employee_name}{l.department && <small>{l.department}</small>}</span>
                      {l.leave_time && <span className="sc-mtime">{l.leave_time}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                      <span className="sc-mpill">{l.leave_type}</span>
                      {l.leave_status && (
                        <span className="sc-mpill" style={{ color: LEAVE_STATUS_COLOR[l.leave_status] || 'var(--ink-3)', background: (LEAVE_STATUS_COLOR[l.leave_status] || '#8B7460') + '1f' }}>{l.leave_status}</span>
                      )}
                      {l.leave_end_date && l.leave_end_date.slice(0, 10) !== l.leave_date.slice(0, 10) && (
                        <span className="sc-mtime">{fmtShort(l.leave_date)} → {fmtShort(l.leave_end_date)}</span>
                      )}
                    </div>
                    {l.reason && <div className="sc-mnote" style={clamp(3)}>{l.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// วันที่สั้นแบบไทย เช่น "3 ต.ค."
const fmtShort = (ymd: string) => new Date(ymd.slice(0, 10) + 'T00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

// แถบสถานะวันในแผ่นรายละเอียด (สีเดียวกับการ์ดในปฏิทินบนคอม — ModalTag ใน app/(admin)/employees)
function DayTag({ kind, title, sub }: { kind: 'holiday' | 'closed' | 'campaign' | 'redzone'; title: string; sub: string }) {
  return (
    <div className={`sc-chip sc-${kind}`} style={{ padding: '10px 14px', cursor: 'default' }}>
      <i className="sc-dot" />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div className="sc-chip-title" style={{ fontSize: 13 }}>{title}</div>
        <div className="sc-chip-sub" style={{ marginTop: 0, fontSize: 12 }}>{sub}</div>
      </div>
    </div>
  )
}

const DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

// การ์ดรายการ — ชุดเดียวกับ EventChip บนคอม (app/(admin)/employees)
type CalItem = { key: string; kind: 'holiday' | 'closed' | 'campaign' | 'redzone' | 'leave'; title: string; sub?: string }
function EventChip({ it, big, onClick }: { it: CalItem; big?: boolean; onClick?: () => void }) {
  return (
    <div className={`sc-chip sc-${it.kind}${big ? ' sc-big' : ''}`} onClick={onClick}>
      <i className="sc-dot" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="sc-chip-title">{it.title}</div>
        {it.sub && <div className="sc-chip-sub">{it.sub}</div>}
      </div>
      <svg className="sc-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </div>
  )
}
