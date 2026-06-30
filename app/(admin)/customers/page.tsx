'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { itemBlockLines, type RawItem } from '@/lib/itemFormat'

type Item = RawItem

type StatusEvent = { status: string; at: string; by: string | null }

type Order = {
  id: string
  entry_date: string | null
  created_at: string | null
  updated_at: string | null
  order_number: string | null
  platform: string | null
  order_status: string | null
  payment_status: string | null
  is_installation: boolean | null
  price: number | null
  items: Item[] | null
  notes: string | null
  status_history: StatusEvent[] | null
  done_at: string | null
  shipped_at: string | null
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

// format รายการใช้ formatter กลาง (lib/itemFormat) ให้ตรงกับใบคัดลอก/ปริ้นเสมอ
const itemLines = itemBlockLines

function CustomerFolder() {
  const params = useSearchParams()
  const name = params.get('name') ?? ''
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!name) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('order_entries')
        .select('id, entry_date, created_at, updated_at, order_number, platform, order_status, payment_status, is_installation, price, items, notes, status_history, done_at, shipped_at')
        .eq('customer_name', name)
        .order('entry_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      setOrders((data as Order[]) ?? [])
      setLoading(false)
    })()
  }, [name])

  const total = orders.reduce((s, o) => s + (o.price ?? 0), 0)
  const latest = orders.find(o => o.entry_date)?.entry_date ?? null

  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <Link
        href="/order-entry"
        style={{ color: 'var(--ink-3)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← กลับไปออเดอร์
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 30 }}>📁</span>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
          {name || 'ไม่ระบุชื่อลูกค้า'}
        </h1>
      </div>

      {/* สรุป */}
      <div style={{ display: 'flex', gap: 12, margin: '18px 0 24px', flexWrap: 'wrap' }}>
        {[
          ['จำนวนออเดอร์', `${orders.length}`],
          ['ยอดรวมทั้งหมด', `${total.toLocaleString('th-TH')} ฿`],
          ['ออเดอร์ล่าสุด', fmtDate(latest)],
        ].map(([label, val]) => (
          <div key={label} style={{ ...card, padding: '14px 18px', minWidth: 150 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>{val}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      ) : orders.length === 0 ? (
        <div style={{ ...card, padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          ไม่พบประวัติออเดอร์ของลูกค้านี้
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map((o, i) => {
            const history = Array.isArray(o.status_history) ? o.status_history : []
            return (
            <div key={o.id} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)' }}>#{orders.length - i}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                      {o.order_number || (o.is_installation ? 'งานติดตั้ง' : 'ไม่มีเลขออเดอร์')}
                    </span>
                    {o.platform && (
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px' }}>
                        {o.platform}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{fmtDate(o.entry_date)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {o.price != null && (
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{o.price.toLocaleString('th-TH')} ฿</div>
                  )}
                  {o.order_status && (
                    <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, marginTop: 2 }}>{o.order_status}</div>
                  )}
                </div>
              </div>

              {Array.isArray(o.items) && o.items.length > 0 && (
                <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {o.items.map((it, j) => (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {itemLines(it).map((ln, k) => (
                        <div key={k} style={{ fontSize: 13, lineHeight: 1.5, fontWeight: k === 0 ? 600 : 400, color: ln.rail ? 'var(--red)' : k === 0 ? 'var(--ink)' : 'var(--ink-2)' }}>{ln.t}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* ไทม์ไลน์สถานะ — สถานะไหน เกิดวันไหน ใครทำ */}
              <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 8 }}>ประวัติสถานะ</div>
                {history.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {history.map((h, k) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: k === history.length - 1 ? 'var(--blue)' : 'var(--border-2)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 90 }}>{h.status}</span>
                        <span style={{ color: 'var(--ink-3)' }}>{fmtDateTime(h.at)}</span>
                        <span style={{ color: 'var(--ink-4)' }}>· โดย {h.by || '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                    {o.order_status ? <>สถานะปัจจุบัน: <strong style={{ color: 'var(--ink-3)' }}>{o.order_status}</strong> — ยังไม่มีประวัติย้อนหลัง (เริ่มบันทึกเมื่อมีการเปลี่ยนสถานะครั้งถัดไป)</> : 'ยังไม่มีประวัติสถานะ'}
                  </div>
                )}
              </div>

              {o.notes && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, fontStyle: 'italic' }}>📝 {o.notes}</div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CustomerFolderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: 'var(--ink-3)' }}>กำลังโหลด…</div>}>
      <CustomerFolder />
    </Suspense>
  )
}
