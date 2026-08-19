'use client'

// ── หมวดพนักงาน → งานเคลม: ใครมีงานเคลมบ้าง (อ่านจากช่อง "ผิดโดย" ของหน้าเคลม) ──
// 1 แถว = 1 เคส จัดกลุ่มตามชื่อคน · สถานะผลตรวจสอบเก็บรายเคสที่คอลัมน์ claims.fault_review
// ‼️ ต้องรัน sql/add_claim_fault_review.sql ก่อน ไม่งั้นกดเปลี่ยนสถานะไม่ติด
// ‼️ หน้านี้เปิดเฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน (ไม่ใช่รหัสพนักงานรายคน)

import { useEffect, useMemo, useState, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { isOwnerLogin, claimUpdate } from '@/lib/adminActor'
import StaffTabs from '@/components/StaffTabs'
import Link from 'next/link'

type ClaimRow = {
  id: string
  claim_date: string | null
  original_order_number: string | null
  customer_username: string | null
  claim_type: string | null
  fault: string | null
  fault_by: string | null
  fix_method: string | null
  fault_review: string | null
  fault_appeal: string | null        // ข้อความอุทธรณ์ที่พนักงานยื่นจากแอปมือถือ (sql/add_claim_fault_appeal.sql)
  fault_appeal_at: string | null
  fault_appeal_by: string | null
}

// บริษัทขนส่งไม่ใช่พนักงาน — หน้านี้รวมเฉพาะคน (ชุดเดียวกับกลุ่ม "ขนส่ง" ในหน้าเคลม)
const COURIERS = ['Flash Express', 'J&T Express', 'Kerry', 'ไปรษณีย์ไทย', 'SPX Express']

const PENDING = 'รอตรวจสอบ'
const REVIEWS = ['ตรวจสอบแล้วไม่พบความผิด', 'ตรวจสอบแล้วผิดจริง']
const REVIEW_COLOR: Record<string, string> = {
  [PENDING]: '#f59e0b',
  'ตรวจสอบแล้วไม่พบความผิด': '#22c55e',
  'ตรวจสอบแล้วผิดจริง': '#ef4444',
}

const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)' }

const thaiDate = (v: string | null) => {
  const m = (v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[3])}/${Number(m[2])}/${(Number(m[1]) + 543) % 100}` : '—'
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: '1 1 170px', minWidth: 170, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.25, marginTop: 3 }}>{value}</div>
    </div>
  )
}

export default function StaffClaimsPage() {
  const cached = getPageCache<ClaimRow[]>('staff:claimfault')
  const [rows, setRows] = useState<ClaimRow[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState<boolean | null>(null)   // null = ยังไม่รู้ (กัน hydration ไม่ตรง)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOwner(isOwnerLogin()) }, [])

  useEffect(() => {
    ;(async () => {
      const COLS = 'id, claim_date, original_order_number, customer_username, claim_type, fault, fault_by, fix_method'
      let r = await fetchAllRows<ClaimRow>(() => supabase.from('claims')
        .select(`${COLS}, fault_review, fault_appeal, fault_appeal_at, fault_appeal_by`).order('id', { ascending: false }))
      // ยังไม่ได้รัน sql/add_claim_fault_appeal.sql → ถอยไปดึงแบบไม่มีคอลัมน์อุทธรณ์
      if (r.error) {
        r = await fetchAllRows<ClaimRow>(() => supabase.from('claims')
          .select(`${COLS}, fault_review`).order('id', { ascending: false }))
        if (!r.error) setError('ยังไม่ได้รัน sql/add_claim_fault_appeal.sql — จะยังไม่เห็นเรื่องที่พนักงานยื่นอุทธรณ์')
      }
      // ยังไม่ได้รัน sql/add_claim_fault_review.sql → ดึงแบบไม่มีคอลัมน์ใหม่ จะได้เห็นรายชื่อก่อน
      if (r.error) {
        r = await fetchAllRows<ClaimRow>(() => supabase.from('claims').select(COLS).order('id', { ascending: false }))
        if (!r.error) setError('ยังไม่ได้รัน sql/add_claim_fault_review.sql — เปลี่ยนสถานะแล้วจะยังไม่บันทึก')
      }
      if (r.error) setError(r.error.message)
      else { setRows(r.data); setPageCache('staff:claimfault', r.data) }
      setLoading(false)
    })()
  }, [])

  // เปลี่ยนผลตรวจสอบของเคสนั้น — "รอตรวจสอบ" = ล้างค่าเป็น null
  const setReview = async (id: string, value: string) => {
    const next = value === PENDING ? null : value
    const before = rows.find(r => r.id === id)?.fault_review ?? null
    setRows(prev => prev.map(r => r.id === id ? { ...r, fault_review: next } : r))
    const { error: err } = await claimUpdate({ fault_review: next, fault_review_at: next ? new Date().toISOString() : null }).eq('id', id)
    if (err) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, fault_review: before } : r))
      setError(`บันทึกไม่สำเร็จ: ${err.message}${/fault_review/.test(err.message) ? ' — ยังไม่ได้รัน sql/add_claim_fault_review.sql' : ''}`)
    }
  }

  // จัดกลุ่มตามชื่อคนใน "ผิดโดย" — เอาเฉพาะชื่อที่มีเคสจริง และไม่ใช่บริษัทขนส่ง
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const map = new Map<string, ClaimRow[]>()
    for (const r of rows) {
      const name = (r.fault_by ?? '').trim()
      if (!name || COURIERS.includes(name)) continue
      if (q && !name.toLowerCase().includes(q)) continue
      const list = map.get(name)
      if (list) list.push(r)
      else map.set(name, [r])
    }
    return [...map.entries()]
      .map(([name, list]) => ({
        name,
        list: [...list].sort((a, b) => (b.claim_date ?? '').localeCompare(a.claim_date ?? '')),
        pending: list.filter(c => !c.fault_review).length,
        guilty: list.filter(c => c.fault_review === 'ตรวจสอบแล้วผิดจริง').length,
        appeal: list.filter(c => (c.fault_appeal ?? '').trim()).length,
      }))
      .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name, 'th'))
  }, [rows, search])

  const totals = useMemo(() => ({
    people: groups.length,
    cases: groups.reduce((s, g) => s + g.list.length, 0),
    pending: groups.reduce((s, g) => s + g.pending, 0),
    guilty: groups.reduce((s, g) => s + g.guilty, 0),
    appeal: groups.reduce((s, g) => s + g.appeal, 0),
  }), [groups])

  if (owner === false) {
    return (
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>งานเคลม</h1>
        <StaffTabs />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
          หน้านี้เปิดเฉพาะบัญชีร้าน — ล็อกอินด้วยรหัสรวมของร้านก่อน
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>งานเคลม</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 16, fontSize: 14 }}>
        ใครมีงานเคลมบ้าง — นับจากช่อง &quot;ผิดโดย&quot; ในหมวดงานเคลม (ขึ้นเฉพาะคนที่มีเคส)
      </p>

      <StaffTabs />

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tile label="คนที่มีงานเคลม" value={String(totals.people)} color="var(--ink)" />
        <Tile label="เคสทั้งหมด" value={String(totals.cases)} color="var(--ink)" />
        <Tile label="รอตรวจสอบ" value={String(totals.pending)} color={REVIEW_COLOR[PENDING]} />
        <Tile label="ตรวจแล้วผิดจริง" value={String(totals.guilty)} color={REVIEW_COLOR['ตรวจสอบแล้วผิดจริง']} />
        <Tile label="ยื่นอุทธรณ์" value={String(totals.appeal)} color="var(--blue)" />
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อพนักงาน…"
        style={{ width: '100%', maxWidth: 280, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', marginBottom: 14, background: 'var(--surface)', color: 'var(--ink)' }} />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            {search ? 'ไม่พบชื่อนี้' : 'ยังไม่มีใครถูกลงในช่อง "ผิดโดย" ของงานเคลม'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  <th style={th}>ชื่อ / เคส</th>
                  <th style={th}>วันที่แจ้ง</th>
                  <th style={th}>เลขออเดอร์</th>
                  <th style={th}>ลูกค้า</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>สาเหตุ</th>
                  <th style={th}>วิธีแก้ไข</th>
                  <th style={{ ...th, minWidth: 200 }}>อุทธรณ์ของพนักงาน</th>
                  <th style={{ ...th, width: 210 }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <Fragment key={g.name}>
                    <tr style={{ background: 'var(--bg)' }}>
                      <td style={{ ...td, fontWeight: 700 }} colSpan={9}>
                        {g.name}
                        <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 12 }}> · {g.list.length} เคส</span>
                        {g.pending > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: REVIEW_COLOR[PENDING], background: '#f59e0b22', borderRadius: 10, padding: '1px 8px' }}>รอตรวจสอบ {g.pending}</span>}
                        {g.guilty > 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: REVIEW_COLOR['ตรวจสอบแล้วผิดจริง'], background: '#ef444422', borderRadius: 10, padding: '1px 8px' }}>ผิดจริง {g.guilty}</span>}
                        {g.appeal > 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#2563eb22', borderRadius: 10, padding: '1px 8px' }}>ยื่นอุทธรณ์ {g.appeal}</span>}
                      </td>
                    </tr>
                    {g.list.map(c => {
                      const cur = c.fault_review || PENDING
                      return (
                        <tr key={c.id}>
                          <td style={{ ...td, paddingLeft: 28, color: 'var(--ink-4)' }}>↳</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>{thaiDate(c.claim_date)}</td>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{c.original_order_number || '—'}</td>
                          <td style={td}>
                            {c.customer_username
                              ? <Link href={`/customers?name=${encodeURIComponent(c.customer_username)}`} title="เปิดโฟลเดอร์ออเดอร์" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{c.customer_username}</Link>
                              : '—'}
                          </td>
                          <td style={td}>{c.claim_type || '—'}</td>
                          <td style={td}>{c.fault || '—'}</td>
                          <td style={td}>{c.fix_method || '—'}</td>
                          <td style={{ ...td, maxWidth: 320 }}>
                            {(c.fault_appeal ?? '').trim() ? (
                              <div style={{ background: '#2563eb11', border: '1px solid #2563eb44', borderRadius: 8, padding: '6px 9px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>
                                  {[c.fault_appeal_by, thaiDate(c.fault_appeal_at)].filter(v => v && v !== '—').join(' · ') || 'ยื่นอุทธรณ์'}
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.fault_appeal}</div>
                              </div>
                            ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                          </td>
                          <td style={td}>
                            <select value={cur} onChange={e => setReview(c.id, e.target.value)}
                              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 12, outline: 'none', cursor: 'pointer', fontWeight: 600, color: REVIEW_COLOR[cur] ?? 'var(--ink)', background: 'var(--surface)', maxWidth: 200 }}>
                              <option value={PENDING}>{PENDING}</option>
                              {REVIEWS.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
