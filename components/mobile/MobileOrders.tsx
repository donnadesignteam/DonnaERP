'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache } from '@/lib/pageCache'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { effShipping } from '@/lib/shipping'
import { ORDER_TABS, matchQuickTab, PROD_STATUS_COLOR, effectiveDueDate, daysRemaining, daysLabel, daysColor, type QuickTab } from '@/lib/orderTabs'

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
  const [tab, setTab] = useState<QuickTab>('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Entry>(() =>
      supabase.from('order_entries').select('*')
        .order('entry_date', { ascending: false, nullsFirst: false }).order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    else setError('')
    setRows(data)
    setLoading(false)
  }
  // โหลดข้อมูลตอนเปิดหน้า (แนวเดียวกับหน้าอื่นทั้งเว็บ) — setState เกิดหลัง await ไม่ได้ทำให้ render ซ้อน
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

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
      {/* หัวเรื่อง + ค้นหา + แท็บ ติดบนสุดตอนเลื่อน */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>ออเดอร์</h1>
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>ดูอย่างเดียว · แก้ที่คอม</span>
        </div>
        <div style={{ padding: '0 14px 8px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อลูกค้า / เลขออเดอร์ / เบอร์"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 15, outline: 'none', background: 'var(--surface)', color: 'var(--ink)', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '0 14px 10px', WebkitOverflowScrolling: 'touch' }}>
          {ORDER_TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13,
                  border: active ? 'none' : '1px solid var(--border)', background: active ? 'var(--blue)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--ink-3)', fontWeight: active ? 700 : 500 }}>
                {t.label}
                <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.85 }}>{counts[t.id] ?? 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div style={{ margin: '12px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 12px', color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span>
          <button onClick={() => { setLoading(true); load() }} style={{ border: 'none', background: 'transparent', color: 'var(--red)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>ลองใหม่</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
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
            return (
              <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.customer_name || '—'}
                  </span>
                  {shippedDone ? (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>งานเสร็จแล้ว</span>
                  ) : done ? (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>งานเสร็จ</span>
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
                    {itemLines.map((line, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>•</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(r.is_installation && r.address) && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 7, lineHeight: 1.45 }}>📍 {r.address}</div>
                )}
                {r.notes && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>หมายเหตุ: {r.notes}</div>
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
              </div>
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
