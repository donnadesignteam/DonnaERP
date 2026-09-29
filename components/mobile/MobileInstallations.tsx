'use client'

import { useState, useEffect, useMemo } from 'react'
import { matchSerial, installSerial } from '@/lib/serialNo'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { HOLIDAYS } from '@/lib/holidays'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { DAYS_TH, TH_MONTHS, ymdOf, monthCells } from '@/lib/shopCalendar'
import { rowColor, normStatus, statusLabel } from '@/lib/installMeta'
import { useStickyState, usePullToRefresh, useSheetBack, PullIndicator, UpdatedRow, clamp } from './mobileUi'
import ScanFolderButton from './ScanFolderButton'
import { usePhotoViewer, type Photo } from './PhotoStrip'
import OrderDetailModal from '@/components/OrderDetailModal'

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
  photos?: Photo[] | null           // รูปหน้างาน (แนบจากเว็บคอม) — ที่นี่ดูอย่างเดียว
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
      // ‼️ เลือกเฉพาะคอลัมน์ที่ปฏิทิน/การ์ดงานใช้ — เดิม select('*') ดึงทุกคอลัมน์เปลืองเน็ตมือถือ
      supabase.from('installations')
        .select('id, serial_no, appointment_datetime, work_type, platform, customer_id, customer_real_name, province, install_zone, phone, work_details, location_link, price, notes, payment_status, installation_status, send_to_technician, source_order_id, photos')
        .order('id', { ascending: true }))
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
  const pv = usePhotoViewer()   // รูปหน้างาน — กดดูเต็มจอ
  // กดการ์ดนัดหมาย → หน้าต่างรายละเอียดออเดอร์แบบบนคอม (openInstall ใน app/(admin)/installations) · ปุ่ม back ของ Android ปิดได้
  const [orderDetail, setOrderDetail] = useState<string | null>(null)
  useSheetBack(!!orderDetail, () => setOrderDetail(null))

  const filtered = useMemo(() => zone ? rows.filter(r => r.install_zone === zone) : rows, [rows, zone])

  // ค้นหา = ออกจากปฏิทินไปเป็นรายการทั้งหมดที่ตรงคำค้น (เดิมหางานของลูกค้าคนเดียวต้องไล่กดทีละวัน)
  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return filtered
      .filter(r => matchSerial(installSerial(r.serial_no), q) || [r.customer_real_name, r.customer_id, r.phone, r.work_details, r.notes]
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

  // มุมมอง เดือน / สัปดาห์ / วัน เหมือนบนคอม · sel = วันที่เลือก (สัปดาห์/วัน)
  const [view, setView] = useStickyState<'month' | 'week' | 'day'>('inst:view', 'month')
  const todayYmd = ymdOf(today.getFullYear(), today.getMonth(), today.getDate())
  const [sel, setSel] = useState(todayYmd)
  const selDate = new Date(sel + 'T00:00')
  const setSelDate = (d: Date) => {
    setSel(ymdOf(d.getFullYear(), d.getMonth(), d.getDate()))
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }
  const weekStart = new Date(selDate); weekStart.setDate(selDate.getDate() - ((selDate.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d })
  const shift = (n: number) => {
    if (view === 'month') { const d = new Date(year, month + n, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); return }
    const d = new Date(selDate); d.setDate(d.getDate() + n * (view === 'week' ? 7 : 1)); setSelDate(d)
  }
  const goToday = () => setSelDate(new Date())
  const isNow = view === 'month'
    ? year === today.getFullYear() && month === today.getMonth()
    : view === 'week' ? weekDays.some(d => ymdOf(d.getFullYear(), d.getMonth(), d.getDate()) === todayYmd) : sel === todayYmd
  const shortMon = (d: Date) => d.toLocaleDateString('th-TH', { month: 'short' })
  const navTitle = view === 'month' ? `${TH_MONTHS[month]} ${year + 543}`
    : view === 'week' ? `${weekDays[0].getDate()} ${shortMon(weekDays[0])} – ${weekDays[6].getDate()} ${shortMon(weekDays[6])} ${weekDays[6].getFullYear() + 543}`
      : `${DOW_FULL[selDate.getDay()]} ${selDate.getDate()} ${TH_MONTHS[selDate.getMonth()]} ${selDate.getFullYear() + 543}`

  // การ์ดของวัน — ชุดเดียวกับ itemsOf ใน Calendar บนคอม (วันหยุด · ร้านปิด · นัดหมายเรียงตามเวลา)
  const itemsOf = (ymd: string): ChipItem[] => {
    const out: ChipItem[] = []
    if (HOLIDAYS[ymd]) out.push({ key: 'h', bg: '#F9E4E1', dot: '#C0564A', title: HOLIDAYS[ymd], sub: 'วันหยุดร้าน' })
    if (new Date(ymd + 'T00:00').getDay() === 0) out.push({ key: 's', bg: '#ECE9E7', dot: '#9A9AA6', title: 'ร้านปิด', sub: 'วันอาทิตย์' })
    for (const j of byDay.get(ymd) ?? []) {
      const c = rowColor(j)
      out.push({ key: j.id, job: j, bg: CHIP_BG[c] ?? '#F1E4D8', dot: c, title: j.customer_real_name || j.customer_id || '-',
        sub: [timeOf(j), (j.work_type || '').replace(/^งาน/, ''), j.install_zone || j.province].filter(Boolean).join(' · ') })
    }
    return out
  }

  const sheetJobs = daySheet ? (byDay.get(daySheet) ?? []) : []
  // งานที่ไม่ผูกออเดอร์ (ลงในปฏิทินตรงๆ) ไม่มีหน้ารายละเอียดออเดอร์ → เปิดแผ่นรายละเอียดวันแทน (มีข้อมูลงานครบ)
  const openJob = (j: Installation) => {
    if (j.source_order_id) { setOrderDetail(j.source_order_id); return }
    const dt = j.appointment_datetime ? new Date(j.appointment_datetime) : null
    if (dt) setDaySheet(ymdOf(dt.getFullYear(), dt.getMonth(), dt.getDate()))
  }
  const monthCount = cells.reduce<number>((n, d) => n + (d ? (byDay.get(ymdOf(year, month, d))?.length ?? 0) : 0), 0)
  const searching = search.trim().length > 0

  // การ์ดงาน 1 ใบ — หน้าตาเดียวกับรายการในหน้าต่างรายละเอียดวันบนคอม (.sc-mitem) · ใช้ทั้งแผ่นรายละเอียดวันและผลค้นหา
  const jobCard = (j: Installation, showDate = false) => {
    const c = rowColor(j)
    const itemLines = formatItemLines(j.source_order_id ? (orderItems[j.source_order_id] ?? null) : null)
    const dt = j.appointment_datetime ? new Date(j.appointment_datetime) : null
    return (
      <div key={j.id} className={`sc-mitem${j.source_order_id ? ' sc-link' : ''}`} style={{ background: CHIP_BG[c] ?? 'var(--cream-2)' }}
        onClick={e => { if ((e.target as HTMLElement).closest('a, button')) return; openJob(j) }}>
        <i className="sc-dot" style={{ background: c }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span className="sc-mname" style={{ minWidth: 0, ...clamp(2) }}>{j.customer_real_name || j.customer_id || 'ไม่ระบุชื่อ'} <small>{installSerial(j.serial_no)}</small></span>
            <span className="sc-mtime">{showDate && dt ? `${dt.getDate()} ${shortMon(dt)} ` : ''}{timeOf(j) ? `${timeOf(j)} น.` : ''}</span>
          </div>
          <div className="sc-mnote" style={{ marginTop: 3 }}>{[j.work_type, j.province, j.install_zone].filter(Boolean).join(' · ')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <span className="sc-mpill" style={{ color: c, background: 'rgba(255,255,255,0.65)' }}>{statusLabel(normStatus(j.installation_status), j.work_type)}</span>
            {j.phone && <a href={`tel:${j.phone}`} className="sc-mpill" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.65)' }}>📞 {j.phone}</a>}
            {j.location_link && <a href={j.location_link} target="_blank" rel="noreferrer" className="sc-mpill" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.65)' }}>📍 ดูแผนที่</a>}
          </div>
          {j.work_details && <div className="sc-mnote" style={{ color: 'var(--ink-2)', lineHeight: 1.5, ...clamp(4) }}>{j.work_details}</div>}
          {itemLines.length > 0 ? (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {itemLines.map((line, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>•</span><span>{line}</span>
                </div>
              ))}
            </div>
          ) : (itemsLoading && j.source_order_id) ? (
            // รายการสินค้าอยู่คนละตาราง โหลดตามมาทีหลัง — บอกให้รู้ว่ายังไม่จบ ไม่ใช่ "ไม่มีของ"
            <div className="sc-mnote">กำลังโหลดรายการสินค้า…</div>
          ) : null}
          {j.notes && <div className="sc-mnote" style={clamp(3)}>หมายเหตุ: {j.notes}</div>}
          {pv.strip(j.photos)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ไม่มีชื่อหน้า — ผู้ใช้สั่งเอาออกทุกหน้า (แถบเมนูล่างบอกอยู่แล้ว)
          ‼️ หน้าตาตามปฏิทินงานติดตั้งบนคอม (.sc-* ใน globals.css) จัดให้พอดีจอมือถือ (.msc-*) — user ขอ 29ก.ย.69 */}
      <div className="msc-top">
        {/* ‼️ div ครอบชั้นนี้ต้อง position: relative — ปุ่ม QR วางทับมุมขวาของช่องค้นหา ไม่ใช่ของแถบทั้งแถบ */}
        <div style={{ position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ลูกค้า / เลขงาน / เบอร์" className="msc-search" />
          <ScanFolderButton />
        </div>
        {!searching && <>
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
              {view === 'month' && <div className="msc-sub">{monthCount} งาน</div>}
            </div>
            <button onClick={() => shift(1)} aria-label="ถัดไป" className="sc-circle msc-circle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </>}
        <div className="msc-zones">
          {['', ...ZONES].map(z => (
            <button key={z || 'all'} onClick={() => setZone(z)} className={`msc-zone${zone === z ? ' on' : ''}`}>{z || 'ทุกโซน'}</button>
          ))}
        </div>
        <div className="msc-subrow">
          {!searching && !isNow ? <button onClick={goToday} className="sc-pill msc-today">วันนี้</button> : <span />}
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

      {searching ? (
        <div style={{ padding: '12px 12px' }}>
          {searchHits.length === 0 ? (
            <div className="sc-mempty" style={{ marginTop: 20 }}>ไม่เจองานติดตั้งที่ค้นหา</div>
          ) : (
            <>
              <div className="sc-msec" style={{ marginTop: 4 }}>ผลค้นหา (ทุกเดือน) <span>{searchHits.length}</span></div>
              {searchHits.map(j => jobCard(j, true))}
            </>
          )}
        </div>
      ) : (
      <div className="msc-card">
        {view === 'month' && (
          <div className="sc-grid msc-grid">
            {DAYS_TH.map(d => <div key={d} className="sc-dow msc-dow">{d}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="sc-cell sc-out msc-cell" />
              const ymd = ymdOf(year, month, day)
              const items = itemsOf(ymd)
              return (
                <button key={i} onClick={() => setDaySheet(ymd)} className={`sc-cell msc-cell${ymd === todayYmd ? ' sc-today' : ''}`}>
                  <span className="sc-num msc-num">{day}</span>
                  {items.slice(0, 3).map(it => (
                    <span key={it.key} className="sc-chip msc-chip" style={{ background: it.bg }}>
                      <i className="sc-dot" style={{ background: it.dot }} />
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
              const items = itemsOf(ymd)
              return (
                <div key={ymd} className={`msc-wrow${ymd === todayYmd ? ' msc-wtoday' : ''}`} onClick={() => setDaySheet(ymd)}>
                  <div className="msc-wdate">
                    <div className="msc-wdow">{DAYS_TH[(d.getDay() + 6) % 7]}</div>
                    <div className="msc-wnum">{d.getDate()}</div>
                  </div>
                  <div className="msc-witems">
                    {items.length === 0 ? <div className="msc-wempty">ไม่มีนัดหมาย</div> : items.map(it => <Chip key={it.key} it={it} onOpen={openJob} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'day' && (() => {
          const items = itemsOf(sel)
          return (
            <div className="sc-dayview msc-dayview" onClick={() => setDaySheet(sel)}>
              {items.length === 0 ? <div className="sc-empty">ไม่มีนัดหมายในวันนี้</div> : items.map(it => <Chip key={it.key} it={it} big onOpen={openJob} />)}
            </div>
          )
        })()}

        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>กำลังโหลดงานติดตั้ง…</div>}

        {/* คำอธิบายสี — ชุดเดียวกับบนคอม */}
        <div className="sc-legend msc-legend">
          {[['#5ac8fa', 'วัดหน้างาน'], ['#C79A4B', 'ติดตั้ง'], ['#C0564A', 'รอแก้'], ['#6F8F6A', 'ติดตั้งเสร็จ'], ['#C0564A', 'วันหยุด'], ['#9A9AA6', 'ร้านปิด (อา.)']].map(([c, l]) => (
            <span key={l}><i style={{ background: c }} />{l}</span>
          ))}
        </div>
      </div>
      )}

      {/* กดวัน → นัดหมายของวันนั้น (แผ่นเลื่อนขึ้นจากล่าง หน้าตาเดียวกับหน้าต่างรายละเอียดวันบนคอม) */}
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
              {(d.getDay() === 0 || HOLIDAYS[daySheet]) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.getDay() === 0 && <Tag bg="#ECE9E7" dot="#9A9AA6" title="ร้านปิด" sub="วันอาทิตย์" />}
                  {HOLIDAYS[daySheet] && <Tag bg="#F9E4E1" dot="#C0564A" title={HOLIDAYS[daySheet]} sub="วันหยุดร้าน" />}
                </div>
              )}
              <div className="sc-msec">นัดหมาย <span>{sheetJobs.length}</span></div>
              {sheetJobs.length === 0 ? <div className="sc-mempty">ไม่มีนัดหมาย</div> : sheetJobs.map(j => jobCard(j))}
            </div>
          </div>
        )
      })()}

      {orderDetail && <OrderDetailModal id={orderDetail} mobile onClose={() => setOrderDetail(null)} />}

      {pv.viewer()}
    </div>
  )
}

const DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

// สีพื้นการ์ดพาสเทลตามสีประจำงาน (rowColor) — ชุดเดียวกับ CHIP_BG ใน app/(admin)/installations
const CHIP_BG: Record<string, string> = {
  '#5ac8fa': '#E3EEF2', '#30b0c7': '#DFEDEF', '#C79A4B': '#FBEAD7', '#6F8F6A': '#E6EEE3',
  '#9A7BA0': '#EFE6EF', 'var(--red)': '#F9E4E1', '#8e8e93': '#ECE9E7',
}

type ChipItem = { key: string; bg: string; dot: string; title: string; sub?: string; job?: Installation }
// การ์ดรายการ — หน้าตาเดียวกับ Chip ในปฏิทินงานติดตั้งบนคอม
// งานที่ผูกออเดอร์ → กดแล้วเปิดรายละเอียดออเดอร์ (stopPropagation ไม่ให้ทะลุไปเปิดแผ่นรายละเอียดวัน)
function Chip({ it, big, onOpen }: { it: ChipItem; big?: boolean; onOpen?: (j: Installation) => void }) {
  const job = it.job
  const open = job?.source_order_id && onOpen ? (e: React.MouseEvent) => { e.stopPropagation(); onOpen(job) } : undefined
  return (
    <div className={`sc-chip${big ? ' sc-big' : ''}${open ? ' sc-link' : ''}`} style={{ background: it.bg }} onClick={open}>
      <i className="sc-dot" style={{ background: it.dot }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="sc-chip-title">{it.title}</div>
        {it.sub && <div className="sc-chip-sub">{it.sub}</div>}
      </div>
      <svg className="sc-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </div>
  )
}
function Tag({ bg, dot, title, sub }: { bg: string; dot: string; title: string; sub: string }) {
  return (
    <div className="sc-chip" style={{ background: bg, padding: '10px 14px' }}>
      <i className="sc-dot" style={{ background: dot }} />
      <div className="sc-chip-title" style={{ fontSize: 13, flex: 1 }}>{title}</div>
      <div className="sc-chip-sub" style={{ marginTop: 0, fontSize: 12 }}>{sub}</div>
    </div>
  )
}
