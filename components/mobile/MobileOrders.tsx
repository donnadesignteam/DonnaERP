'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { effShipping } from '@/lib/shipping'
import { ORDER_TABS, matchQuickTab, PROD_STATUS_COLOR, effectiveDueDate, daysRemaining, daysLabel, daysColor, type QuickTab } from '@/lib/orderTabs'
import { useStickyState, useScrollRestore, usePullToRefresh, PullIndicator, UpdatedRow, CardSkeleton, pillBtn, searchInput, clamp } from './mobileUi'
import ScanFolderButton from './ScanFolderButton'

// หน้าออเดอร์บนมือถือ — ดูอย่างเดียว แก้ไม่ได้ (ตามที่ผู้ใช้สั่ง)
// ‼️ เป็นคนละไฟล์กับหน้าเดสก์ท็อป (OrderWorkspace) โดยตั้งใจ — ของเดิมเป็นตาราง+จิ้มแก้ในช่อง ยัดลงมือถือไม่ไหว
//    แต่ตรรกะแท็บ/สี ใช้ lib/orderTabs.ts ร่วมกัน จะได้ไม่กรองข้อมูลเพี้ยนจากหน้าเดสก์ท็อป
type Entry = {
  id: string
  entry_date: string | null
  deadline: string | null
  shipping_datetime: string | null
  customer_name: string | null
  order_number: string | null
  platform: string | null
  order_status: string | null
  courier: string | null
  items: RawItem[] | null
  is_urgent: boolean | null
  is_installation: boolean | null
  is_dropoff: boolean | null   // ‼️ ต้องมี — effShipping ใช้เลื่อนกำหนดส่ง +2 วัน ถ้าไม่ดึงมา วันที่จะไม่ตรงกับหน้าคอม
  install_time: string | null
  notes: string | null
  address: string | null
  phone: string | null
}

// daysRemaining / daysLabel / daysColor / effectiveDueDate อยู่ใน lib/orderTabs.ts — ใช้ตัวเดียวกับหน้าเดสก์ท็อป

export default function MobileOrders() {
  const cached = getPageCache<{ rows: Entry[] }>('order_entries')
  const [rows, setRows] = useState<Entry[]>(cached?.rows ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  // แท็บ/คำค้น จำไว้ข้ามการเปลี่ยนหน้า — กดการ์ดเข้าโฟลเดอร์ลูกค้าแล้วกด back ต้องกลับมาที่เดิม
  const [tab, setTab] = useStickyState<QuickTab>('orders:tab', 'all')
  const [search, setSearch] = useStickyState('orders:q', '')
  const tabStrip = useRef<HTMLDivElement>(null)

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Entry>(() =>
      // ‼️ เลือกเฉพาะคอลัมน์ที่การ์ด + ตรรกะแท็บ/วันที่ (orderTabs/shipping) ใช้จริง — เดิม select('*') ดึงทุกคอลัมน์เปลืองเน็ตมือถือ
      supabase.from('order_entries')
        .select('id, entry_date, deadline, shipping_datetime, customer_name, order_number, platform, order_status, courier, items, is_urgent, is_installation, is_dropoff, install_time, notes, address, phone')
        .order('entry_date', { ascending: false, nullsFirst: false }).order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    else {
      setError('')
      // เก็บลง cache กลางด้วย (เดิมอ่านอย่างเดียว) → สลับหน้าไปมาไม่ต้องรอโหลดใหม่ทุกครั้ง
      setPageCache('order_entries', { ...(getPageCache<{ rows: Entry[] }>('order_entries') ?? {}), rows: data })
      setUpdatedAt(Date.now())
    }
    setRows(data)
    setLoading(false)
  }
  // โหลดข้อมูลตอนเปิดหน้า (แนวเดียวกับหน้าอื่นทั้งเว็บ) — setState เกิดหลัง await ไม่ได้ทำให้ render ซ้อน
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const { pull, refreshing, refresh } = usePullToRefresh(load)
  useScrollRestore('orders', !loading)

  // แท็บที่เลือกอยู่ต้องเลื่อนมาให้เห็น (มี 9 แท็บ ส่วนใหญ่ซ่อนอยู่นอกจอ)
  useEffect(() => {
    tabStrip.current?.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [tab])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of ORDER_TABS) c[t.id] = rows.filter(r => matchQuickTab(r, t.id)).length
    return c
  }, [rows])

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rows.filter(r => {
      if (!matchQuickTab(r, tab)) return false
      if (!q) return true
      return (r.customer_name ?? '').toLowerCase().includes(q)
        || (r.order_number ?? '').toLowerCase().includes(q)
        || (r.phone ?? '').toLowerCase().includes(q)
    })
    // เรียงตามวันที่ต้องส่ง ใกล้ครบกำหนดขึ้นก่อน · งานเสร็จแล้ว (is_urgent) ไปท้ายสุด เหมือนหน้าเดสก์ท็อป
    const parseD = (r: Entry) => {
      const es = effShipping(r)
      if (!es || es === '-') return null
      const m = es.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      return m ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime() : null
    }
    return [...list].sort((a, b) => {
      if (a.is_urgent !== b.is_urgent) return a.is_urgent ? 1 : -1
      const da = parseD(a), db = parseD(b)
      if (da === null && db === null) return 0
      if (da === null) return 1
      if (db === null) return -1
      return da - db
    })
  }, [rows, tab, search])

  return (
    <div>
      {/* ค้นหา + แท็บ ติดบนสุดตอนเลื่อน — ไม่มีชื่อหน้า (ผู้ใช้สั่งเอาออก แถบเมนูล่างบอกอยู่แล้วว่าอยู่หน้าไหน) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'calc(env(safe-area-inset-top) + 10px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '0 14px 8px' }}>
          {/* ‼️ ต้องมี div ครอบชั้นนี้ (position: relative) — ปุ่ม QR วางทับมุมขวาของช่องค้นหา ไม่ใช่มุมขวาของแถบทั้งแถบ
              paddingRight ในช่องค้นหาเผื่อที่ให้ปุ่ม ไม่งั้นคำค้นยาวๆ ลอดใต้ปุ่ม */}
          <div style={{ position: 'relative' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อลูกค้า / เลขออเดอร์ / เบอร์" style={{ ...searchInput, paddingRight: 44 }} />
            <ScanFolderButton />
          </div>
        </div>
        <UpdatedRow at={updatedAt} refreshing={refreshing} onRefresh={refresh} />
        {/* เงาขอบขวาบอกว่ายังมีแท็บซ่อนอยู่ (มี 9 แท็บ เห็นพร้อมกันไม่หมด) */}
        <div style={{ position: 'relative' }}>
          <div ref={tabStrip} style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '0 14px 10px', WebkitOverflowScrolling: 'touch' }}>
            {ORDER_TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} data-active={active ? '1' : '0'} onClick={() => setTab(t.id)} style={pillBtn(active)}>
                  {t.label}
                  <span style={{ fontSize: 11.5, opacity: 0.85 }}>{counts[t.id] ?? 0}</span>
                </button>
              )
            })}
          </div>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 10, width: 22, pointerEvents: 'none', background: 'linear-gradient(to right, transparent, var(--bg))' }} />
        </div>
      </div>

      <PullIndicator pull={pull} refreshing={refreshing} />

      {error && (
        <div style={{ margin: '12px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 12px', color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span>
          <button onClick={() => { setLoading(true); load() }} style={{ border: 'none', background: 'transparent', color: 'var(--red)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>ลองใหม่</button>
        </div>
      )}

      {loading ? (
        <CardSkeleton n={5} />
      ) : displayed.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
          {search ? 'ไม่เจอออเดอร์ที่ค้นหา' : 'ไม่มีออเดอร์ในหมวดนี้'}
        </div>
      ) : (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(r => {
            // ให้ตรงกับหน้าเดสก์ท็อปแท็บ "ทั้งหมด": จัดส่งแล้ว/งานเสร็จ โชว์สถานะแทนจำนวนวัน
            const due = effectiveDueDate(r)
            const d = due && due !== '-' ? daysRemaining(due) : null
            const itemLines = formatItemLines(r.items)
            const shippedDone = r.order_status === 'จัดส่งแล้ว'
            const done = !!r.is_urgent   // is_urgent = ธง "งานเสร็จ" ในระบบนี้ (ชื่อคอลัมน์เก่า)
            // แตะการ์ด → โฟลเดอร์ออเดอร์ของลูกค้าคนนั้น (ไม่มีชื่อลูกค้า = เปิดไม่ได้ เพราะโฟลเดอร์จับคู่ด้วยชื่อ)
            const folderHref = r.customer_name ? `/m/customers?name=${encodeURIComponent(r.customer_name)}` : null
            const CardTag = (folderHref ? Link : 'div') as React.ElementType
            return (
              <CardTag key={r.id} {...(folderHref ? { href: folderHref, className: 'm-card-tap' } : {})}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', boxShadow: 'var(--shadow)', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700, color: folderHref ? 'var(--blue)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.customer_name || 'ไม่ระบุชื่อลูกค้า'}
                    </span>
                    {folderHref && <span style={{ fontSize: 11, color: 'var(--ink-4)', flexShrink: 0 }}>›</span>}
                  </span>
                  {/* จัดส่งแล้ว = ปิดจ๊อบจริง (เขียวเข้ม) · งานเสร็จ = ผลิตเสร็จรอส่ง (เขียวอ่อน) — เดิมสีเดียวกันแยกไม่ออก */}
                  {shippedDone ? (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>✓ จัดส่งแล้ว</span>
                  ) : done ? (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#65B36B', flexShrink: 0 }}>งานเสร็จ · รอส่ง</span>
                  ) : d !== null ? (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: daysColor(d), flexShrink: 0 }}>{daysLabel(d)}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', flexShrink: 0 }}>รอกำหนด</span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                  {[r.order_number, r.platform].filter(Boolean).join(' · ') || '—'}
                </div>

                {itemLines.length > 0 && (
                  <div style={{ margin: '9px 0 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* ออเดอร์ที่มีของเยอะๆ เคยยาวเต็มจอทั้งการ์ด — ตัดที่ 4 บรรทัด ที่เหลือดูในโฟลเดอร์ลูกค้า */}
                    {itemLines.slice(0, 4).map((line, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>•</span>
                        <span style={clamp(2)}>{line}</span>
                      </div>
                    ))}
                    {itemLines.length > 4 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', paddingLeft: 12 }}>+ อีก {itemLines.length - 4} รายการ</div>
                    )}
                  </div>
                )}

                {(r.is_installation && r.address) && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 7, lineHeight: 1.45, ...clamp(2) }}>📍 {r.address}</div>
                )}
                {r.notes && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45, ...clamp(3) }}>หมายเหตุ: {r.notes}</div>
                )}

                {/* โทร / เปิดแผนที่ ได้จากการ์ดเลย (หน้าติดตั้งมีอยู่แล้ว หน้านี้เคยเป็นข้อความเปล่า)
                    ‼️ ใช้ span + window.open ไม่ใช่ <a> — การ์ดทั้งใบเป็น <Link> อยู่แล้ว ซ้อน <a> ใน <a> ไม่ได้ */}
                {(r.phone || r.address) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                    {r.phone && (
                      <span role="button" tabIndex={0} style={miniBtn}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${r.phone}` }}>
                        📞 {r.phone}
                      </span>
                    )}
                    {r.address && (
                      <span role="button" tabIndex={0} style={miniBtn}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address!)}`, '_blank', 'noopener') }}>
                        📍 แผนที่
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: PROD_STATUS_COLOR[r.order_status ?? ''] ?? 'var(--ink-4)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: PROD_STATUS_COLOR[r.order_status ?? ''] ?? 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.order_status || '—'}
                    </span>
                  </span>
                  {r.courier && (
                    <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.courier}
                    </span>
                  )}
                </div>
              </CardTag>
            )
          })}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-4)', padding: '6px 0 2px' }}>
            {displayed.length} รายการ
          </div>
        </div>
      )}
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--blue)', minHeight: 34, display: 'inline-flex', alignItems: 'center',
  border: '1px solid var(--border)', borderRadius: 8, padding: '0 11px', background: 'var(--bg)',
  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
}
