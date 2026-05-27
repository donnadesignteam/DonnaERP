'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('suppliers').select('*').order('name')
      setSuppliers(data ?? [])
      setLoading(false)
    })()
  }, [])

  const glassCard: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, boxShadow: 'var(--shadow)',
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>ซัพพลายเออร์</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{loading ? '…' : suppliers.length} รายการ</p>
      </div>

      {loading ? (
        <div style={{ ...glassCard, padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      ) : suppliers.length === 0 ? (
        <div style={{ ...glassCard, padding: '64px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>ยังไม่มีซัพพลายเออร์</div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>เพิ่มข้อมูลซัพพลายเออร์ใน Supabase ตาราง suppliers</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ ...glassCard, padding: '24px' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{s.name}</div>
              {s.phone && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>📞 {s.phone}</div>}
              {s.contact_person && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>👤 {s.contact_person}</div>}
              {s.products && <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(242,242,247,0.7)', borderRadius: 10, fontSize: 12, color: 'var(--ink)' }}>{s.products}</div>}
              {s.notes && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{s.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
