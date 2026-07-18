'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { HOLIDAYS } from '@/lib/holidays'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { INSTALL_STATUS_COLOR, DAYS_TH, TH_MONTHS, ymdOf, monthCells } from '@/lib/shopCalendar'
import { useStickyState, usePullToRefresh, useSheetBack, PullIndicator, UpdatedRow, pillBtn, searchInput, monthNavBtn, clamp } from './mobileUi'

// ปฏิทินงานติดตั้งบนมือถือ — ดูอย่างเดียว (เดสก์ท็อป = app/(admin)/installations)
type Installation = {
  id: string
  serial_no: string | null
  appointment_datetime: string | null
  work_type: string | null
  platform: string | null
  customer_id: string | null
  customer_real_name: string | null
  province: string | null
  install_zone: string | null
  phone: string | null
  work_details: string | null
  location_link: string | null
  price: number | null
  notes: string | null
  payment_status: string | null
  installation_status: string | null
  send_to_technician: string | null
  source_order_id?: string | null   // ผูกกับ order_entries ถ้าแถวนี้ sync มาจากหมวดออเดอร์
}
// ‼️ ตาราง installations ไม่มีคอลัมน์ items — รายการสินค้าอยู่ที่ order_entries ต้องดึงตาม source_order_id
//    (ทำแบบเดียวกับหน้าเดสก์ท็อป app/(admin)/installations)

const ZONES = ['เชียงราย', 'เชียงใหม่', 'กทม']

export default function MobileInstallations() {
  const cached = getPageCache<Installation[]>('installations')
  const [rows, setRows] = useState<Installation[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const today = new Date()
  const [year, setYear] = useStickyState('inst:year', today.getFullYear())
  const [month, setMonth] = useStickyState('inst:month', today.getMonth())
  const [zone, setZone] = useStickyState<string>('inst:zone', '')       // '' = ทุกโซน
  const [search, setSearch] = useState('')          // ค้นหา = โหมดรายการ ไม่ผูกกับเดือน (ไม่ต้องจำ)
  const [daySheet, setDaySheet] = useState<string | null>(null)
  const [orderItems, setOrderItems] = useState<Record<string, RawItem[]>>({})
  const [itemsLoading, setItemsLoading] = useState(false)

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Installation>(() =>
      supabase.from('installations').select('*').order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    else {
      setError('')
      setPageCache('installations', data)
      setUpdatedAt(Date.now())
    }
    setRows(data)
    setLoading(false)
    setItemsLoading(true)
    // รายการสินค้าอยู่ที่ออเดอร์ต้นทาง ต้องดึงตามมาอีกรอบ (เหมือนหน้าเดสก์ท็อป)
    const orderIds = data.map(r => r.source_order_id).filter((v): v is string => !!v)
    if (orderIds.length) {
      const { data: oes } = await supabase.from('order_entries').select('id, items').in('id', orderIds)
      const map: Record<string, RawItem[]> = {}
      for (const oe of (oes ?? []) as { id: string; items: RawItem[] | null }[]) {
        if (Array.isArray(oe.items) && oe.items.length) map[oe.id] = oe.items
      }
      setOrderItems(map)
    }
    setItemsLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const { pull, refreshing, refresh } = usePullToRefresh(load)
  useSheetBack(!!daySheet, () => setDaySheet(null))

  const filtered = useMemo(() => zone ? rows.filter(r => r.install_zone === zone) : rows, [rows, zone])

  // ค้นหา = ออกจากปฏิทินไปเป็นรายการทั้งหมดที่ตรงคำค้น (เดิมหางานของลูกค้าคนเดียวต้องไล่กดทีละวัน)
  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return filtered
      .filter(r => [r.customer_real_name, r.customer_id, r.serial_no, r.phone, r.work_details, r.notes]
        .some(v => (v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (b.appointment_datetime ?? '').localeCompare(a.appointment_datetime ?? ''))
  }, [filtered, search])
  const cells = useMemo(() => monthCells(year, month), [year, month])

  // จัดงานลงวัน (ตาม appointment_datetime) — คีย์เป็น YYYY-MM-DD ของเวลาท้องถิ่น
  const byDay = useMemo(() => {
    const map = new Map<string, Installation[]>()
    for (const r of filtered) {
      if (!r.appointment_datetime) continue
      const dt = new Date(r.appointment_datetime)
      if (isNaN(dt.getTime())) continue
      const key = ymdOf(dt.getFullYear(), dt.getMonth(), dt.getDate())
      const arr = map.get(key)
      if (arr) arr.push(r); else map.set(key, [r])
    }
    // เรียงตามเวลานัดในแต่ละวัน
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.appointment_datetime!).getTime() - new Date(b.appointment_datetime!).getTime())
    }
    return map
  }, [filtered])

  const timeOf = (r: Installation) =>
    r.appointment_datetime ? new Date(r.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  const sheetJobs = daySheet ? (byDay.get(daySheet) ?? []) : []
  const monthCount = cells.reduce<number>((n, d) => n + (d ? (byDay.get(ymdOf(year, month, d))?.length ?? 0) : 0), 0)
  const searching = search.trim().length > 0
  const isThisMonth = year === today.getFullYear() && month === today.getMonth()

  // การ์ดงาน 1 ใบ — ใช้ทั้งใน bottom sheet (กดวันในปฏิทิน) และในผลค้นหา
  const jobCard = (j: Installation, showDate = false) => {
    const c = INSTALL_STATUS_COLOR[j.installation_status ?? ''] ?? 'var(--ink-3)'
    const itemLines = formatItemLines(j.source_order_id ? (orderItems[j.source_order_id] ?? null) : null)
    const dt = j.appointment_datetime ? new Date(j.appointment_datetime) : null
    return (
      <div key={j.id} style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${c}`, borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', minWidth: 0, ...clamp(2) }}>
            {showDate && dt ? `${dt.getDate()} ${TH_MONTHS[dt.getMonth()]} ` : ''}{timeOf(j)} {j.customer_real_name || j.customer_id || 'ไม่ระบุชื่อ'}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: c, flexShrink: 0 }}>{j.installation_status || '—'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
          {[j.serial_no && `#${j.serial_no}`, j.work_type, j.install_zone || j.province, j.platform].filter(Boolean).join(' · ')}
        </div>
        {j.work_details && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.45, ...clamp(4) }}>{j.work_details}</div>}
        {itemLines.length > 0 ? (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {itemLines.map((line, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>•</span><span>{line}</span>
              </div>
            ))}
          </div>
        ) : (itemsLoading && j.source_order_id) ? (
          // รายการสินค้าอยู่คนละตาราง โหลดตามมาทีหลัง — บอกให้รู้ว่ายังไม่จบ ไม่ใช่ "ไม่มีของ"
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 6 }}>กำลังโหลดรายการสินค้า…</div>
        ) : null}
        {j.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5, lineHeight: 1.45, ...clamp(3) }}>หมายเหตุ: {j.notes}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
          {j.phone && <a href={`tel:${j.phone}`} style={linkBtn}>📞 {j.phone}</a>}
          {j.location_link && <a href={j.location_link} target="_blank" rel="noreferrer" style={linkBtn}>📍 แผนที่</a>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ไม่มีชื่อหน้า — ผู้ใช้สั่งเอาออกทุกหน้า (แถบเมนูล่างบอกอยู่แล้ว) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'calc(env(safe-area-inset-top) + 10px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '0 14px 8px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ลูกค้า / เลขงาน / เบอร์" style={searchInput} />
        </div>
        {!searching && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px 8px', gap: 8 }}>
            <button onClick={prevMonth} aria-label="เดือนก่อน" style={monthNavBtn}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>
                {TH_MONTHS[month]} {year + 543}
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-4)', marginLeft: 7 }}>{monthCount} งาน</span>
              </div>
              {/* ปุ่ม "วันนี้" แยกออกมาให้เห็นชัด — เดิมต้องเดาว่ากดชื่อเดือนได้ */}
              {!isThisMonth && (
                <button onClick={goToday} style={{ marginTop: 2, border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '2px 8px' }}>
                  ← กลับไปเดือนนี้
                </button>
              )}
            </div>
            <button onClick={nextMonth} aria-label="เดือนถัดไป" style={monthNavBtn}>›</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '0 14px 10px' }}>
          {['', ...ZONES].map(z => (
            <button key={z || 'all'} onClick={() => setZone(z)} style={pillBtn(zone === z)}>{z || 'ทุกโซน'}</button>
          ))}
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

      {searching ? (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {searchHits.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>ไม่เจองานติดตั้งที่ค้นหา</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>เจอ {searchHits.length} งาน (ทุกเดือน)</div>
              {searchHits.map(j => jobCard(j, true))}
            </>
          )}
        </div>
      ) : (
      <div style={{ padding: '10px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
          {DAYS_TH.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--ink-4)' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const ymd = ymdOf(year, month, day)
            const jobs = byDay.get(ymd) ?? []
            const holiday = HOLIDAYS[ymd]
            const isSunday = new Date(year, month, day).getDay() === 0
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            return (
              <button key={i} onClick={() => setDaySheet(ymd)}
                style={{
                  // ‼️ ทุกช่องต้องเท่ากันเป๊ะ — height ตายตัว + minWidth 0 + overflow hidden
                  //    (grid 1fr อย่างเดียวไม่พอ: ช่องที่มีชื่อลูกค้ายาวจะดัน min-content ทำให้คอลัมน์กว้างไม่เท่ากัน)
                  height: 76, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2,
                  background: holiday ? 'var(--cal-holiday)' : isSunday ? 'var(--cal-sunday)' : 'var(--surface)',
                  border: isToday ? '2px solid var(--blue)' : '1px solid var(--border)',
                  borderRadius: 8, padding: '4px 4px 3px', cursor: 'pointer', textAlign: 'left', font: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ fontSize: 12.5, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--blue)' : holiday ? 'var(--cal-holiday-ink)' : 'var(--ink-2)' }}>{day}</span>
                {/* ‼️ ตัวหนังสือในช่องวันต้องไม่ต่ำกว่า 10.5px — ของเดิม 8.5px อ่านไม่ออกจริงบนมือถือ */}
                {jobs.slice(0, 2).map(j => {
                  const c = INSTALL_STATUS_COLOR[j.installation_status ?? ''] ?? 'var(--ink-3)'
                  return (
                    <span key={j.id} style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.3, borderRadius: 3, padding: '1px 3px',
                      background: c + '26', color: c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.customer_real_name || j.customer_id || 'ไม่ระบุชื่อ'}
                    </span>
                  )
                })}
                {jobs.length > 2 && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)' }}>+{jobs.length - 2} งาน</span>}
              </button>
            )
          })}
        </div>

        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>กำลังโหลดงานติดตั้ง…</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, padding: '14px 6px 4px', fontSize: 11 }}>
          {Object.entries(INSTALL_STATUS_COLOR).map(([label, c]) => (
            <span key={label} style={{ color: 'var(--ink-3)' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 4 }} />{label}
            </span>
          ))}
        </div>
      </div>
      )}

      {/* กดวัน → งานของวันนั้น */}
      {daySheet && (
        <div onClick={() => setDaySheet(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxHeight: '80dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '18px 18px 0 0', padding: '8px 16px calc(20px + env(safe-area-inset-bottom))' }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border-2)', margin: '4px auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
              {parseInt(daySheet.slice(8), 10)} {TH_MONTHS[parseInt(daySheet.slice(5, 7), 10) - 1]} {parseInt(daySheet.slice(0, 4), 10) + 543}
            </h3>
            {HOLIDAYS[daySheet] && <div style={{ fontSize: 12.5, color: 'var(--cal-holiday-ink)', fontWeight: 600, marginBottom: 8 }}>🏖️ วันหยุดร้าน · {HOLIDAYS[daySheet]}</div>}

            {sheetJobs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '10px 0 6px' }}>ไม่มีงานติดตั้งวันนี้</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
                {sheetJobs.map(j => jobCard(j))}
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

const linkBtn: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--blue)', textDecoration: 'none', minHeight: 36,
  display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 11px', background: 'var(--surface)', WebkitTapHighlightColor: 'transparent',
}
