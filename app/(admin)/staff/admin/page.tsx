'use client'

// ── งานแอดมิน: ทั้งทีมทำได้เท่าไหร่ + ใครได้เท่าไหร่ ────────────────────────
// เจ้าของออเดอร์ = ช่อง "แอดมิน" ของใบนั้น (admin_name/admin_code — ระบบใส่ให้เองหรือแอดมินเลือกเอง)
// ดูกติกาการใส่ชื่อได้ที่ lib/adminActor.ts

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import StaffTabs from '@/components/StaffTabs'

type OrderRow = {
  id: string
  order_number: string | null
  customer_name: string | null
  created_at: string
  price: number | null
  admin_name: string | null
  admin_code: string | null
  is_installation: boolean | null
  order_status: string | null
}
type ClaimRow = { id: string; created_at: string; admin_name: string | null }
type Data = { orders: OrderRow[]; claims: ClaimRow[] }

const NONE = 'ไม่ระบุแอดมิน'

const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)' }

const fmtBaht = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' ฿'
const thisMonth = () => new Date().toISOString().slice(0, 7)

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ flex: '1 1 190px', minWidth: 190, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.25, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Bar({ label, value, max, valueText, sub, color }: { label: string; value: number; max: number; valueText: string; sub?: string; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ width: 110, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <div style={{ width: 150, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flexShrink: 0, textAlign: 'right' }}>
        {valueText}{sub && <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 11 }}> · {sub}</span>}
      </div>
    </div>
  )
}

export default function AdminWorkPage() {
  const cached = getPageCache<Data>('staff:adminwork')
  const [data, setData] = useState<Data>(cached ?? { orders: [], claims: [] })
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(thisMonth())

  useEffect(() => {
    ;(async () => {
      const [o, c] = await Promise.all([
        fetchAllRows<OrderRow>(() => supabase.from('order_entries')
          .select('id, order_number, customer_name, created_at, price, admin_name, admin_code, is_installation, order_status')
          .order('id', { ascending: false })),
        fetchAllRows<ClaimRow>(() => supabase.from('claims')
          .select('id, created_at, admin_name')
          .order('id', { ascending: false })),
      ])
      if (o.error) setError(o.error.message)
      else {
        const next = { orders: o.data, claims: c.data }
        setData(next)
        setPageCache('staff:adminwork', next)
      }
      setLoading(false)
    })()
  }, [])

  const months = useMemo(() => {
    const s = new Set<string>()
    data.orders.forEach(o => o.created_at && s.add(o.created_at.slice(0, 7)))
    s.add(thisMonth())
    return [...s].sort().reverse()
  }, [data])

  const view = useMemo(() => {
    const inMonth = (iso: string | null) => !!iso && (!month || iso.startsWith(month))
    const orders = data.orders.filter(o => inMonth(o.created_at))
    const claims = data.claims.filter(c => inMonth(c.created_at))

    const rows = new Map<string, { name: string; orders: number; sales: number; installs: number; claims: number }>()
    const at = (name: string) => {
      let e = rows.get(name)
      if (!e) { e = { name, orders: 0, sales: 0, installs: 0, claims: 0 }; rows.set(name, e) }
      return e
    }
    for (const o of orders) {
      const e = at((o.admin_name || '').trim() || NONE)
      e.orders++
      e.sales += o.price || 0
      if (o.is_installation) e.installs++
    }
    for (const c of claims) at((c.admin_name || '').trim() || NONE).claims++

    const list = [...rows.values()].sort((a, b) => b.orders - a.orders)
    const totalOrders = orders.length
    const totalSales = orders.reduce((s, o) => s + (o.price || 0), 0)
    const noAdmin = rows.get(NONE)?.orders ?? 0
    return { list, totalOrders, totalSales, noAdmin, claims: claims.length }
  }, [data, month])

  const maxOrders = Math.max(...view.list.map(r => r.orders), 1)
  const maxSales = Math.max(...view.list.map(r => r.sales), 1)

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>งานแอดมิน</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 16, fontSize: 14 }}>
        ทั้งทีมทำออเดอร์ได้เท่าไหร่ และแยกเป็นของใครบ้าง (นับตามช่อง &quot;แอดมิน&quot; ของออเดอร์)
      </p>

      <StaffTabs />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '9px 13px', border: '1px solid var(--border-2)', borderRadius: 9, fontSize: 14, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}>
          <option value="">ทุกเดือน</option>
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</option>)}
        </select>
        {loading && <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>กำลังโหลด…</span>}
      </div>

      {error && <div style={{ color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Tile label="ออเดอร์ทั้งหมด" value={String(view.totalOrders)} sub={month ? 'เดือนที่เลือก' : 'ทุกเดือนรวมกัน'} color="var(--blue)" />
        <Tile label="ยอดขายรวม" value={fmtBaht(view.totalSales)} color="#0f766e" />
        <Tile label="เฉลี่ยต่อใบ" value={view.totalOrders ? fmtBaht(view.totalSales / view.totalOrders) : '—'} color="var(--ink)" />
        <Tile label="ยังไม่มีชื่อแอดมิน" value={String(view.noAdmin)} sub="ใบที่ระบบยังไม่รู้ว่าใครทำ" color={view.noAdmin ? 'var(--yellow, #eab308)' : 'var(--ink)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 18 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>จำนวนออเดอร์ · ใครได้เท่าไหร่</div>
          {view.list.map(r => (
            <Bar key={r.name} label={r.name} value={r.orders} max={maxOrders} color="var(--blue)"
              valueText={`${r.orders} ใบ`} sub={r.installs ? `ติดตั้ง ${r.installs}` : undefined} />
          ))}
          {!view.list.length && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>ยังไม่มีออเดอร์ในเดือนนี้</div>}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>ยอดขาย · ใครได้เท่าไหร่</div>
          {[...view.list].sort((a, b) => b.sales - a.sales).map(r => (
            <Bar key={r.name} label={r.name} value={r.sales} max={maxSales} color="#0f766e" valueText={fmtBaht(r.sales)} />
          ))}
          {!view.list.length && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>—</div>}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>แอดมิน</th>
              <th style={{ ...th, textAlign: 'right' }}>ออเดอร์</th>
              <th style={{ ...th, textAlign: 'right' }}>งานติดตั้ง</th>
              <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
              <th style={{ ...th, textAlign: 'right' }}>เฉลี่ยต่อใบ</th>
              <th style={{ ...th, textAlign: 'right' }}>งานเคลมที่ดูแล</th>
            </tr>
          </thead>
          <tbody>
            {view.list.map(r => (
              <tr key={r.name}>
                <td style={{ ...td, fontWeight: 600, color: r.name === NONE ? 'var(--ink-4)' : 'var(--ink)' }}>{r.name}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{r.orders}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--ink-3)' }}>{r.installs || '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>{fmtBaht(r.sales)}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--ink-3)' }}>{r.orders ? fmtBaht(r.sales / r.orders) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--ink-3)' }}>{r.claims || '—'}</td>
              </tr>
            ))}
            {!view.list.length && !loading && (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--ink-3)', padding: 32 }}>ยังไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>
        ยอดขายนับจากช่อง &quot;ราคา&quot; ของออเดอร์ · ใบที่ไม่ได้กรอกราคานับเป็น 0
      </div>
    </div>
  )
}
