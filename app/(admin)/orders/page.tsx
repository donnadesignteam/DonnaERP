'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const statusColor: Record<string, string> = {
  'รอดำเนินการ': '#ff9f0a',
  'ตัดผ้าแล้ว': '#ff9f0a',
  'เย็บแล้ว': '#ff9f0a',
  'รีดแล้ว': '#ff9f0a',
  'แพ็คแล้ว': '#ff9f0a',
  'กำลังตัด': '#ff9f0a',
  'กำลังเย็บ': '#ff9f0a',
  'กำลังรีด': '#ff9f0a',
  'กำลังแพ็ค': '#ff9f0a',
  'สำเร็จ': '#34c759',
}

const statuses = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'รีดแล้ว', 'แพ็คแล้ว', 'สำเร็จ']

function OrdersContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status') ?? undefined
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)
      const { data } = await query
      setOrders(data ?? [])
      setLoading(false)
    })()
  }, [status])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>ออเดอร์</h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{loading ? '…' : orders.length} รายการ</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/orders" style={{ padding: '6px 14px', borderRadius: 980, fontSize: 13, fontWeight: 500, textDecoration: 'none', background: !status ? 'var(--blue)' : 'rgba(0,0,0,0.10)', color: !status ? '#fff' : 'var(--ink)' }}>ทั้งหมด</Link>
        {statuses.map(s => (
          <Link key={s} href={`/orders?status=${encodeURIComponent(s)}`} style={{ padding: '6px 14px', borderRadius: 980, fontSize: 13, fontWeight: 500, textDecoration: 'none', background: status === s ? (statusColor[s] ?? 'rgba(0,0,0,0.10)') : 'rgba(0,0,0,0.10)', color: status === s ? '#fff' : 'var(--ink)' }}>{s}</Link>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>ไม่มีออเดอร์</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {['เลขที่', 'ลูกค้า', 'สถานะ', 'กำหนดส่ง', 'วันที่สั่ง'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 20px', color: 'var(--ink-3)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const isOverdue = o.deadline && new Date(o.deadline) < new Date() && o.status !== 'สำเร็จ'
                return (
                  <tr key={o.id ?? o.order_number} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <Link href={`/orders/${o.order_number}`} style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}>{o.order_number}</Link>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--ink)' }}>{o.customer_name}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: (statusColor[o.status] ?? 'var(--ink-3)') + '22', color: statusColor[o.status] ?? 'var(--ink-3)', padding: '3px 10px', borderRadius: 980, fontSize: 12, fontWeight: 500 }}>{o.status ?? '-'}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: isOverdue ? 'var(--red)' : 'var(--ink)', fontWeight: isOverdue ? 600 : 400 }}>
                      {o.deadline ? new Date(o.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--ink-3)' }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>}>
      <OrdersContent />
    </Suspense>
  )
}
