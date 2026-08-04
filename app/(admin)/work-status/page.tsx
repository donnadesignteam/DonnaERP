'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'

// สีแยกตามขั้นผลิต — ให้ตรงกับหน้าออเดอร์ (PROD_STATUS_COLOR ใน OrderWorkspace)
const statusColor: Record<string, string> = {
  'รอดำเนินการ': '#ff9f0a',
  'ตัดผ้าแล้ว': '#0ea5e9',
  'เย็บแล้ว': '#8b5cf6',
  'ตรวจสอบแล้ว': '#6366f1',
  'รีดแล้ว': '#ec4899',
  'แพ็คแล้ว': '#14b8a6',
  'กำลังตัด': '#0ea5e9',
  'กำลังเย็บ': '#8b5cf6',
  'กำลังรีด': '#ec4899',
  'กำลังแพ็ค': '#14b8a6',
  'สำเร็จ': '#34c759',
}

const stages = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'ตรวจสอบแล้ว', 'รีดแล้ว', 'แพ็คแล้ว', 'สำเร็จ']
// สถานะที่ยังอยู่ในสายผลิต (โชว์บนบอร์ด) — ตัดพวกที่ออกจากผลิตแล้ว (รอจัดส่ง/รอติดตั้ง/จัดส่งแล้ว/ยกเลิก)
const IN_PRODUCTION = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'ตรวจสอบแล้ว', 'รีดแล้ว', 'แพ็คแล้ว']

export default function WorkStatusPage() {
  // เปิดหน้าซ้ำ → โชว์ข้อมูลรอบก่อนทันที แล้วดึงของใหม่เบื้องหลัง (stale-while-revalidate)
  const cached = getPageCache<{ ws: any[]; ord: any[] }>('work-status')
  const [orders, setOrders] = useState<any[]>(cached?.ord ?? [])
  const [workStatus, setWorkStatus] = useState<any[]>(cached?.ws ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    const [wsRes, ordRes] = await Promise.all([
      fetchAllRows<any>(() => supabase.from('work_status').select('*').order('id', { ascending: true })),
      fetchAllRows<any>(() => supabase.from('order_entries').select('order_number, customer_name, order_status, deadline').in('order_status', IN_PRODUCTION).order('order_number', { ascending: true }).order('id', { ascending: true })),
    ])
    if (wsRes.error || ordRes.error) {
      setError(wsRes.error?.message || ordRes.error?.message || 'โหลดข้อมูลไม่สำเร็จ')
      setLoading(false)
      return
    }
    const ws = wsRes.data, ord = ordRes.data
    setPageCache('work-status', { ws, ord })
    setWorkStatus(ws)
    setOrders(ord)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const grouped = stages.reduce<Record<string, any[]>>((acc, s) => {
    acc[s] = orders.filter(o => o.order_status === s)
    return acc
  }, {})

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>สถานะงาน</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 32, fontSize: 14 }}>ติดตามความคืบหน้าของงานแต่ละขั้นตอน</p>

      {error ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--surface)', border: '1.5px solid var(--red)', borderRadius: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>โหลดข้อมูลไม่สำเร็จ</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>{error}</div>
          <button onClick={() => { setLoading(true); load() }}
            style={{ border: 'none', background: 'var(--blue)', color: '#fff', borderRadius: 10, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>ลองใหม่</button>
        </div>
      ) : loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {stages.filter(s => s !== 'สำเร็จ').map(stage => {
              const items = grouped[stage] ?? []
              const color = statusColor[stage] ?? 'var(--ink-3)'
              return (
                <div key={stage} style={{ minWidth: 200, flex: '0 0 200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 14px', borderRadius: 10, background: color + '18' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color }}>{stage}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: color + '30', color, borderRadius: 980, padding: '1px 7px' }}>{items.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.length === 0 ? (
                      <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, border: '1.5px dashed rgba(0,0,0,0.10)' }}>ว่าง</div>
                    ) : items.map(o => {
                      const isOverdue = o.deadline && new Date(o.deadline) < new Date()
                      return (
                        <div key={o.order_number} style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 8, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${color}` }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', marginBottom: 4 }}>{o.order_number}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 6 }}>{o.customer_name}</div>
                          {o.deadline && (
                            <div style={{ fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--ink-3)', fontWeight: isOverdue ? 600 : 400 }}>
                              {isOverdue ? '⚠ ' : ''}กำหนด {new Date(o.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {workStatus.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16, color: 'var(--ink)' }}>บันทึกสถานะแผนก</h2>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                      <th style={{ textAlign: 'left', padding: '14px 20px', color: 'var(--ink-3)', fontWeight: 500 }}>เลขที่ออเดอร์</th>
                      <th style={{ textAlign: 'left', padding: '14px 20px', color: 'var(--ink-3)', fontWeight: 500 }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workStatus.map(w => (
                      <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 20px', color: 'var(--blue)', fontWeight: 500 }}>{w.order_number ?? w.id}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ background: (statusColor[w.status] ?? 'var(--ink-3)') + '22', color: statusColor[w.status] ?? 'var(--ink-3)', padding: '3px 10px', borderRadius: 980, fontSize: 12, fontWeight: 500 }}>{w.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
