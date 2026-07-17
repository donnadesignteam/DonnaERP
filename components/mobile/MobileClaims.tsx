'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache } from '@/lib/pageCache'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'

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
  const [tab, setTab] = useState<string>('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Claim>(() =>
      supabase.from('claims').select('*')
        .order('claim_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    else setError('')
    setRows(data)
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

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

  const tabs: [string, string, string][] = [
    ['all', 'ทั้งหมด', 'var(--blue)'],
    ...WORKFLOW.map(w => [w.key, w.key, w.color] as [string, string, string]),
  ]

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>งานเคลม</h1>
          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>ดูอย่างเดียว · แก้ที่คอม</span>
        </div>
        <div style={{ padding: '0 14px 8px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ลูกค้า / เลขออเดอร์ / สาเหตุ"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 15, outline: 'none', background: 'var(--surface)', color: 'var(--ink)', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '0 14px 10px', WebkitOverflowScrolling: 'touch' }}>
          {tabs.map(([key, label, color]) => {
            const active = tab === key
            return (
              <button key={key} onClick={() => setTab(key)}
                style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13,
                  border: active ? 'none' : '1px solid var(--border)', background: active ? color : 'var(--surface)',
                  color: active ? '#fff' : 'var(--ink-3)', fontWeight: active ? 700 : 500 }}>
                {label}
                <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.85 }}>{counts[key] ?? 0}</span>
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
          {search ? 'ไม่เจอเคสที่ค้นหา' : 'ไม่มีเคสในหมวดนี้'}
        </div>
      ) : (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(r => {
            const itemLines = formatItemLines(r.items)
            return (
              <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', boxShadow: 'var(--shadow)', opacity: r.closed_at ? 0.62 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.customer_username || '—'}
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

                {r.cause && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 7, lineHeight: 1.45 }}>{r.cause}</div>}

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
                    {r.money_direction === 'เก็บลูกค้า' ? '+' : '−'}{Number(r.refund_amount).toLocaleString('th-TH')} บาท
                    {r.money_status && <span style={{ fontWeight: 400, color: 'var(--ink-4)', marginLeft: 6 }}>({r.money_status})</span>}
                  </div>
                )}

                {r.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>หมายเหตุ: {r.notes}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR(r.status), flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: STATUS_COLOR(r.status) }}>{r.status || '—'}</span>
                    {r.closed_at && <span style={{ fontSize: 11, color: '#16A34A', flexShrink: 0 }}>· ปิดงานแล้ว</span>}
                  </span>
                  {r.admin_name && <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>{r.admin_name}</span>}
                </div>
              </div>
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
