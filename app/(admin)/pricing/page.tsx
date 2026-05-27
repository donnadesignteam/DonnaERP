'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const colLabel: Record<string, string> = {
  type: 'ประเภท', product_type: 'ประเภทสินค้า', name: 'ชื่อ',
  price: 'ราคา', unit: 'หน่วย', width: 'กว้าง', height: 'สูง', notes: 'หมายเหตุ',
}

export default function PricingPage() {
  const [pricing, setPricing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('pricing').select('*').order('id')
      setPricing(data ?? [])
      setLoading(false)
    })()
  }, [])

  const columns = pricing.length > 0 ? Object.keys(pricing[0]).filter(k => k !== 'id') : []
  const glassCard: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, boxShadow: 'var(--shadow)',
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>ตารางราคา</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{loading ? '…' : pricing.length} รายการ</p>
      </div>

      {loading ? (
        <div style={{ ...glassCard, padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      ) : pricing.length === 0 ? (
        <div style={{ ...glassCard, padding: '64px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>💰</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>ยังไม่มีตารางราคา</div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>เพิ่มข้อมูลใน Supabase ตาราง pricing</div>
        </div>
      ) : (
        <div style={{ ...glassCard, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {columns.map(col => (
                  <th key={col} style={{ textAlign: 'left', padding: '14px 20px', color: 'var(--ink-3)', fontWeight: 500 }}>{colLabel[col] ?? col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pricing.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {columns.map(col => (
                    <td key={col} style={{ padding: '14px 20px', color: 'var(--ink)' }}>
                      {col === 'price' && row[col] != null ? `฿${Number(row[col]).toLocaleString()}` : row[col] != null ? String(row[col]) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
