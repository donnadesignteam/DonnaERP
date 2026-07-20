'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { useStickyState, useScrollRestore, usePullToRefresh, PullIndicator, UpdatedRow, CardSkeleton, pillBtn, searchInput, clamp } from './mobileUi'
import ScanFolderButton from './ScanFolderButton'

// หน้างานเคลมบนมือถือ — ดูอย่างเดียว แก้ไม่ได้ (คนละไฟล์กับ ClaimsWorkspace ของเดสก์ท็อป)
type Claim = {
  id: string
  claim_date: string | null
  channel: string | null
  customer_username: string | null
  original_order_number: string | null
  claim_type: string | null
  fault: string | null
  cause: string | null
  resolution: string | null
  items: RawItem[] | null
  ship_name: string | null
  ship_address: string | null
  refund_amount: number | null
  money_direction: string | null
  money_status: string | null
  status: string
  notes: string | null
  admin_name: string | null
  closed_at: string | null
  shipped_at: string | null
}

// ให้ตรงกับ WORKFLOW ใน ClaimsWorkspace (เดสก์ท็อป)
const WORKFLOW: { key: string; color: string }[] = [
  { key: 'รอของคืน', color: '#ff9f0a' },
  { key: 'ตัดผ้าแล้ว', color: '#30d158' },
  { key: 'เย็บแล้ว', color: '#5e9eff' },
  { key: 'รีดแล้ว', color: '#bf5af2' },
  { key: 'แพ็คแล้ว', color: '#f43f5e' },
  { key: 'ส่งแล้ว', color: '#34c759' },
]
const STATUS_COLOR = (s: string) => WORKFLOW.find(w => w.key === s)?.color ?? 'var(--ink-4)'

export default function MobileClaims() {
  const cached = getPageCache<Claim[]>('claims')
  const [rows, setRows] = useState<Claim[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [tab, setTab] = useStickyState<string>('claims:tab', 'all')
  const [search, setSearch] = useStickyState('claims:q', '')
  const tabStrip = useRef<HTMLDivElement>(null)

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Claim>(() =>
      supabase.from('claims').select('*')
        .order('claim_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    else {
      setError('')
      setPageCache('claims', data)   // เดิมอ่าน cache อย่างเดียว ไม่เคยเขียนกลับ
      setUpdatedAt(Date.now())
    }
    setRows(data)
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const { pull, refreshing, refresh } = usePullToRefresh(load)
  useScrollRestore('claims', !loading)
  useEffect(() => {
    tabStrip.current?.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [tab])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const w of WORKFLOW) c[w.key] = rows.filter(r => r.status === w.key).length
    return c
  }, [rows])

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (tab !== 'all' && r.status !== tab) return false
      if (!q) return true
      return (r.customer_username ?? '').toLowerCase().includes(q)
        || (r.original_order_number ?? '').toLowerCase().includes(q)
        || (r.cause ?? '').toLowerCase().includes(q)
    })
  }, [rows, tab, search])

  // ‼️ แท็บที่เลือกใช้สีน้ำตาลของระบบทุกอัน ไม่ใช่สีสถานะ — เดิมแท็บ "แพ็คแล้ว" active เป็นสีชมพูแดง อ่านแล้วนึกว่าเป็นการเตือน
  //    (สีสถานะยังอยู่ที่จุดกลมในการ์ดเหมือนเดิม)
  const tabs: [string, string][] = [['all', 'ทั้งหมด'], ...WORKFLOW.map(w => [w.key, w.key] as [string, string])]

  return (
    <div>
      {/* ไม่มีชื่อหน้า — ผู้ใช้สั่งเอาออกทุกหน้า (แถบเมนูล่างบอกอยู่แล้ว) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'calc(env(safe-area-inset-top) + 10px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '0 14px 8px' }}>
          {/* ‼️ div ครอบชั้นนี้ต้อง position: relative — ปุ่ม QR วางทับมุมขวาของช่องค้นหา ไม่ใช่ของแถบทั้งแถบ */}
          <div style={{ position: 'relative' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ลูกค้า / เลขออเดอร์ / สาเหตุ" style={{ ...searchInput, paddingRight: 44 }} />
            <ScanFolderButton />
          </div>
        </div>
        <UpdatedRow at={updatedAt} refreshing={refreshing} onRefresh={refresh} />
        <div style={{ position: 'relative' }}>
          <div ref={tabStrip} style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '0 14px 10px', WebkitOverflowScrolling: 'touch' }}>
            {tabs.map(([key, label]) => {
              const active = tab === key
              return (
                <button key={key} data-active={active ? '1' : '0'} onClick={() => setTab(key)} style={pillBtn(active)}>
                  {label}
                  <span style={{ fontSize: 11.5, opacity: 0.85 }}>{counts[key] ?? 0}</span>
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
          {search ? 'ไม่เจอเคสที่ค้นหา' : 'ไม่มีเคสในหมวดนี้'}
        </div>
      ) : (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(r => {
            const itemLines = formatItemLines(r.items)
            // แตะการ์ด → โฟลเดอร์ลูกค้า เหมือนหน้าออเดอร์ (เดิมหน้าเคลมกดไม่ได้ทั้งที่มีชื่อลูกค้าพร้อมอยู่แล้ว)
            const folderHref = r.customer_username ? `/m/customers?name=${encodeURIComponent(r.customer_username)}` : null
            const CardTag = (folderHref ? Link : 'div') as React.ElementType
            return (
              // ‼️ งานที่ปิดแล้วเดิมใช้ opacity 0.62 ทั้งใบ ตัวหนังสือสีเทาจางจนอ่านไม่ออก — เปลี่ยนเป็นป้าย "ปิดงานแล้ว" แทน
              <CardTag key={r.id} {...(folderHref ? { href: folderHref, className: 'm-card-tap' } : {})}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', boxShadow: 'var(--shadow)', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700, color: folderHref ? 'var(--blue)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.customer_username || 'ไม่ระบุชื่อลูกค้า'}
                    </span>
                    {folderHref && <span style={{ fontSize: 11, color: 'var(--ink-4)', flexShrink: 0 }}>›</span>}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>
                    {r.claim_date ? new Date(r.claim_date).toLocaleDateString('th-TH-u-ca-gregory', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                  {[r.original_order_number && `#${r.original_order_number}`, r.channel].filter(Boolean).join(' · ') || '—'}
                </div>

                {(r.claim_type || r.fault) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {r.claim_type && <span style={{ fontSize: 11.5, background: 'var(--blue-bg)', color: 'var(--blue)', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{r.claim_type}</span>}
                    {r.fault && <span style={{ fontSize: 11.5, background: 'var(--bg)', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>ผิดที่{r.fault}</span>}
                  </div>
                )}

                {r.cause && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 7, lineHeight: 1.45, ...clamp(3) }}>{r.cause}</div>}

                {itemLines.length > 0 && (
                  <div style={{ margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {itemLines.map((line, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>•</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}

                {r.refund_amount != null && (
                  <div style={{ fontSize: 12.5, marginTop: 7, fontWeight: 600, color: r.money_direction === 'เก็บลูกค้า' ? '#16A34A' : 'var(--red)' }}>
                    {/* บอกทิศทางเงินเป็นคำ ไม่ใช่แค่ +/− ตัวเล็กที่ต้องเดา */}
                    {r.money_direction === 'เก็บลูกค้า' ? '+' : '−'}{Number(r.refund_amount).toLocaleString('th-TH')} บาท
                    <span style={{ fontWeight: 400, color: 'var(--ink-4)', marginLeft: 6 }}>
                      {[r.money_direction || 'คืนลูกค้า', r.money_status].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}

                {/* ที่อยู่ส่งกลับ — เดิมดึงมาแล้วไม่ได้แสดงผลเลย */}
                {(r.ship_name || r.ship_address) && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 7, lineHeight: 1.45, ...clamp(2) }}>
                    📦 {[r.ship_name, r.ship_address].filter(Boolean).join(' · ')}
                  </div>
                )}
                {r.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45, ...clamp(3) }}>หมายเหตุ: {r.notes}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR(r.status), flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: STATUS_COLOR(r.status) }}>{r.status || '—'}</span>
                    {r.closed_at && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 7px', flexShrink: 0 }}>ปิดงานแล้ว</span>
                    )}
                  </span>
                  {r.admin_name && <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>{r.admin_name}</span>}
                </div>
              </CardTag>
            )
          })}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-4)', padding: '6px 0 2px' }}>
            {displayed.length} เคส
          </div>
        </div>
      )}
    </div>
  )
}
