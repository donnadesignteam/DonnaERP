'use client'

// ── ยอดตัดผ้า: ใครตัดไปกี่เมตร + รวมทั้งร้านกี่เมตร ─────────────────────────
// ข้อมูลมาจากแถวสแกนของแผนกตัด (production_scans.stage = 'ตัด') ที่บันทึกเมตรไว้ตอนสแกน
// ‼️ ต้องรัน sql/fabric_meters.sql ก่อน ไม่งั้นคอลัมน์ meters ไม่มี → หน้านี้ขึ้นวิธีแก้ให้

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { fmtMeters, round2 } from '@/lib/fabricUsage'
import StaffTabs from '@/components/StaffTabs'

type CutScan = {
  id: number
  order_number: string
  tech_code: string | null
  tech_name: string | null
  meters: number | null
  meters_calc: { total?: number; warns?: string[]; lines?: { type: string; rule: string; meters: number; warn?: string }[] } | null
  scanned_at: string
  is_helper: boolean
}

const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--ink)', borderBottom: '1px solid var(--border)' }

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ flex: '1 1 190px', minWidth: 190, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.25, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Bar({ label, value, max, valueText, sub }: { label: string; value: number; max: number; valueText: string; sub?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ width: 110, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#0f766e', borderRadius: 4 }} />
      </div>
      <div style={{ width: 130, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flexShrink: 0, textAlign: 'right' }}>
        {valueText}{sub && <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 11 }}> · {sub}</span>}
      </div>
    </div>
  )
}

const thisMonth = () => new Date().toISOString().slice(0, 7)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })

export default function CuttingPage() {
  const cached = getPageCache<CutScan[]>('staff:cutting')
  const [rows, setRows] = useState<CutScan[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(thisMonth())

  useEffect(() => {
    ;(async () => {
      const { data, error } = await fetchAllRows<CutScan>(() => supabase
        .from('production_scans')
        .select('id, order_number, tech_code, tech_name, meters, meters_calc, scanned_at, is_helper')
        .eq('stage', 'ตัด')
        .order('id', { ascending: false }))
      if (error) {
        setError(error.message.includes('meters')
          ? 'ยังไม่ได้รัน sql/fabric_meters.sql ใน Supabase — รันก่อนแล้วรีเฟรชหน้านี้'
          : error.message)
      } else {
        setRows(data)
        setPageCache('staff:cutting', data)
      }
      setLoading(false)
    })()
  }, [])

  const months = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => r.scanned_at && s.add(r.scanned_at.slice(0, 7)))
    s.add(thisMonth())
    return [...s].sort().reverse()
  }, [rows])

  const view = useMemo(() => {
    const inRange = rows.filter(r => !month || (r.scanned_at || '').startsWith(month))
    const total = round2(inRange.reduce((s, r) => s + (r.meters ?? 0), 0))
    const orders = new Set(inRange.filter(r => (r.meters ?? 0) > 0).map(r => r.order_number)).size

    const byTech = new Map<string, { name: string; meters: number; orders: Set<string>; pending: number }>()
    for (const r of inRange) {
      const key = r.tech_code || r.tech_name || '—'
      let e = byTech.get(key)
      if (!e) { e = { name: r.tech_name || key, meters: 0, orders: new Set(), pending: 0 }; byTech.set(key, e) }
      if (r.meters == null) e.pending++
      else { e.meters = round2(e.meters + r.meters); e.orders.add(r.order_number) }
    }
    const techs = [...byTech.values()].sort((a, b) => b.meters - a.meters)

    // แถวที่ยังไม่มีเมตร = สแกนก่อนเปิดระบบนี้ (หรือยังไม่ได้รัน SQL)
    const noMeters = inRange.filter(r => r.meters == null)
    // รายการที่ระบบอ่านชนิดไม่ออก → เมตรอาจต่ำกว่าจริง ให้แอดมินไปแก้ชนิดในออเดอร์
    const warnRows = inRange.filter(r => (r.meters_calc?.warns?.length ?? 0) > 0)

    return { inRange, total, orders, techs, noMeters, warnRows }
  }, [rows, month])

  const maxMeters = Math.max(...view.techs.map(t => t.meters), 1)

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>ยอดตัดผ้า</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 16, fontSize: 14 }}>
        นับจากการสแกนของแผนกตัด — เมตรคิดจากรายการสินค้าในออเดอร์ (ช่างไม่ต้องกรอกเอง)
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
        <Tile label="ตัดไปทั้งหมด" value={fmtMeters(view.total)} sub={month ? 'เฉพาะเดือนที่เลือก' : 'ทุกเดือนรวมกัน'} color="#0f766e" />
        <Tile label="จำนวนออเดอร์ที่ตัด" value={String(view.orders)} sub={`${view.inRange.length} ครั้งที่สแกน`} color="var(--ink)" />
        <Tile label="ช่างที่ตัดเดือนนี้" value={String(view.techs.filter(t => t.meters > 0).length)} sub="คน" color="var(--blue)" />
        <Tile label="เฉลี่ยต่อออเดอร์" value={view.orders ? fmtMeters(view.total / view.orders) : '—'} color="var(--ink)" />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>ใครตัดไปกี่เมตร</div>
        {view.techs.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>ยังไม่มีการสแกนของแผนกตัดในเดือนนี้</div>}
        {view.techs.map(t => (
          <Bar key={t.name} label={t.name} value={t.meters} max={maxMeters}
            valueText={fmtMeters(t.meters)} sub={`${t.orders.size} ออเดอร์`} />
        ))}
      </div>

      {view.noMeters.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '14px 18px', marginBottom: 18, fontSize: 13, color: 'var(--ink-2)' }}>
          มีการสแกนขั้นตัด <b>{view.noMeters.length}</b> ครั้งที่ยังไม่มีเมตร — เป็นการสแกนก่อนเปิดระบบนับเมตร (ของเก่าไม่ย้อนคำนวณให้ เพราะรายการสินค้าอาจถูกแก้ไปแล้ว)
        </div>
      )}

      {view.warnRows.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--yellow, #eab308)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '16px 18px', marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>⚠️ ออเดอร์ที่ระบบคิดเมตรไม่ครบ</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
            ส่วนใหญ่คือรายการที่ชื่อไม่บอกว่าเป็นม่านแบบไหน (เช่น &quot;ผ้าม่านหน้าต่าง&quot;) — แก้ชื่อ/หัวรางในออเดอร์แล้วให้ช่างสแกนใหม่ ตัวเลขถึงจะครบ
          </div>
          {view.warnRows.slice(0, 20).map(r => (
            <div key={r.id} style={{ fontSize: 12.5, color: 'var(--ink-2)', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
              <b>{r.order_number}</b> · {r.tech_name} · {(r.meters_calc?.warns ?? []).join(' / ')}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>วันที่</th>
              <th style={th}>ออเดอร์</th>
              <th style={th}>ช่าง</th>
              <th style={{ ...th, textAlign: 'right' }}>เมตร</th>
              <th style={th}>รายการที่ตัด</th>
            </tr>
          </thead>
          <tbody>
            {view.inRange.slice(0, 200).map(r => (
              <tr key={r.id}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>{fmtDate(r.scanned_at)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.order_number.startsWith('claim:') ? 'งานเคลม' : r.order_number}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.tech_name || '—'}{r.is_helper && <span style={{ color: 'var(--ink-4)', fontSize: 11 }}> (ช่วย)</span>}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.meters == null ? 'var(--ink-4)' : '#0f766e', whiteSpace: 'nowrap' }}>
                  {r.meters == null ? '—' : fmtMeters(r.meters)}
                </td>
                <td style={{ ...td, fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {(r.meters_calc?.lines ?? []).filter(l => l.meters > 0).map(l => l.type).join(', ') || '—'}
                </td>
              </tr>
            ))}
            {view.inRange.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--ink-3)', padding: 32 }}>ยังไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {view.inRange.length > 200 && (
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>โชว์ 200 แถวล่าสุดจาก {view.inRange.length} แถว</div>
      )}
    </div>
  )
}
