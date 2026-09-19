'use client'

// กระดิ่งแจ้งเตือนของค้างอนุมัติ — ใบลาที่พนักงานยื่นแล้วยังไม่มีใครตัดสิน
// และเคลมที่พนักงานยื่นอุทธรณ์แล้วยังไม่ได้ตัดสิน
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { isApproved } from '@/lib/leave'

// วันที่แบบไทยสั้นๆ (ชุดเดียวกับหน้างานเคลม)
const thaiDate = (v: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

type LeaveRow = {
  id: string
  employee_nickname: string
  employee_name: string
  leave_date: string
  leave_type: string
  supervisor_approval: string
  hr_approval: string
  leave_status: string
}

type ClaimRow = {
  id: string
  fault_by: string | null
  claim_date: string | null
  original_order_number: string | null
  fault_review: string | null
  fault_appeal: string | null
  fault_appeal_at: string | null
}

type Item = { key: string; href: string; who: string; what: string; when: string; kind: 'leave' | 'appeal' }

export default function NotifyBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [ready, setReady] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const out: Item[] = []

    // ── ใบลาที่ยังไม่มีใครกดอนุมัติ/ไม่อนุมัติ (เกณฑ์เดียวกับปุ่ม "รออนุมัติ" ในหน้าปฏิทินร้าน) ──
    const { data: leaves } = await fetchAllRows<LeaveRow>(() =>
      supabase.from('leave_requests')
        .select('id, employee_nickname, employee_name, leave_date, leave_type, supervisor_approval, hr_approval, leave_status')
        .order('leave_date', { ascending: false }))
    for (const l of (leaves ?? [])) {
      if (isApproved(l as never)) continue
      if (l.supervisor_approval === 'ไม่อนุมัติ' || l.hr_approval === 'ไม่อนุมัติ') continue
      out.push({
        key: 'l' + l.id, href: '/employees', kind: 'leave',
        who: l.employee_nickname || l.employee_name || 'พนักงาน',
        what: `ยื่น${l.leave_type || 'ใบลา'}`,
        when: thaiDate(l.leave_date),
      })
    }

    // ── เคลมที่ยื่นอุทธรณ์แล้วยังไม่ได้ตัดสิน (ยังไม่ถูกเปลี่ยนเป็น "ไม่พบความผิด") ──
    // ‼️ คอลัมน์ fault_appeal มาจาก sql/add_claim_fault_appeal.sql — ถ้ายังไม่ได้รัน ให้ข้ามส่วนนี้ไปเงียบๆ
    const { data: claims, error: claimErr } = await fetchAllRows<ClaimRow>(() =>
      supabase.from('claims')
        .select('id, fault_by, claim_date, original_order_number, fault_review, fault_appeal, fault_appeal_at')
        .order('id', { ascending: false }))
    if (!claimErr) {
      for (const c of (claims ?? [])) {
        if (!(c.fault_appeal ?? '').trim()) continue
        if (c.fault_review === 'ตรวจสอบแล้วไม่พบความผิด') continue
        out.push({
          key: 'c' + c.id, href: '/staff/claims', kind: 'appeal',
          who: c.fault_by || 'พนักงาน',
          what: `ยื่นอุทธรณ์งานเคลม${c.original_order_number ? ' ' + c.original_order_number : ''}`,
          when: thaiDate(c.fault_appeal_at ?? c.claim_date),
        })
      }
    }

    setItems(out)
    setReady(true)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 120000)   // เช็กใหม่ทุก 2 นาที
    return () => clearInterval(t)
  }, [])

  // คลิกนอกกล่องแล้วปิด
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const leaveCount = items.filter(i => i.kind === 'leave').length
  const appealCount = items.filter(i => i.kind === 'appeal').length

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="ของค้างอนุมัติ"
        style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)',
                 boxShadow: 'var(--shadow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                 color: 'var(--brand)', flexShrink: 0, position: 'relative' }}>
        <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
        </svg>
        {/* จุดแดง = มีของค้าง */}
        {ready && items.length > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, padding: '0 4px',
                         borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700,
                         display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, maxHeight: 440, overflowY: 'auto',
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                      boxShadow: 'var(--shadow-md)', zIndex: 300 }}>
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ของค้างอนุมัติ</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
              {!ready ? 'กำลังโหลด…'
                : items.length === 0 ? 'ไม่มีของค้าง เคลียร์หมดแล้ว'
                : `ใบลา ${leaveCount} · อุทธรณ์เคลม ${appealCount}`}
            </div>
          </div>

          {ready && items.length === 0 ? (
            <div style={{ padding: '24px 18px', fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>ไม่มีอะไรรออนุมัติ</div>
          ) : (
            items.slice(0, 40).map(it => (
              <Link key={it.key} href={it.href} onClick={() => setOpen(false)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 18px', textDecoration: 'none',
                         borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                               background: it.kind === 'leave' ? 'var(--cream)' : 'var(--red-bg)',
                               color: it.kind === 'leave' ? 'var(--brand)' : 'var(--red)',
                               display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {it.kind === 'leave' ? (
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-1.5a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                    </svg>
                  )}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)' }}>
                    <b style={{ fontWeight: 500 }}>{it.who}</b> {it.what}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{it.when}</span>
                </span>
              </Link>
            ))
          )}

          {items.length > 40 && (
            <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--ink-4)' }}>และอีก {items.length - 40} รายการ</div>
          )}
        </div>
      )}
    </div>
  )
}
