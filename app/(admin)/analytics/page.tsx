'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'

type StatusEvent = { status: string; at: string; by?: string | null }
type OrderRow = {
  id: string
  order_number: string
  order_status: string
  created_at: string
  shipped_at: string | null
  deadline: string | null
  price: number | null
  platform: string | null
  is_installation: boolean
  status_history: StatusEvent[] | null
}
type ScanRow = { order_number: string; status: string; tech_name: string | null; scanned_at: string }
type ClaimRow = { id: string; created_at: string; status: string | null; fault: string | null; refund_amount: number | null; claim_type: string | null }

type AllData = { orders: OrderRow[]; scans: ScanRow[]; claims: ClaimRow[] }

// ลำดับขั้นผลิต + สีตามชุดเดียวกับหน้าออเดอร์/dashboard (PROD_STATUS_COLOR)
const STAGES = [
  { status: 'ตัดผ้าแล้ว', label: 'แผนกตัดผ้า', color: '#0ea5e9' },
  { status: 'เย็บแล้ว',   label: 'แผนกเย็บผ้า', color: '#8b5cf6' },
  { status: 'รีดแล้ว',    label: 'แผนกรีดผ้า',  color: '#ec4899' },
  { status: 'แพ็คแล้ว',   label: 'แผนกแพ็คสินค้า', color: '#14b8a6' },
]

const DAY = 86400000
const MAX_STAGE_MS = 30 * DAY // เกิน 30 วัน = ข้อมูลค้าง/สแกนย้อนหลัง ตัดทิ้งกันค่าเพี้ยน

function median(arr: number[]): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function fmtDur(ms: number | null): string {
  if (ms == null) return '—'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} นาที`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ชม. ${mins % 60} นาที`
  const days = Math.floor(hrs / 24)
  return `${days} วัน ${hrs % 24} ชม.`
}

function fmtBaht(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' ฿'
}

// ---------- ชิ้นส่วน UI ----------

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function StatTile({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 200px', minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '1A', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// แถบนอน: ป้ายชื่อ + แท่ง + ตัวเลขกำกับทุกแถว (ไม่พึ่งสีอย่างเดียว)
function HBar({ label, value, max, color, valueText, subText }: { label: string; value: number; max: number; color: string; valueText: string; subText?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }} title={`${label}: ${valueText}${subText ? ` (${subText})` : ''}`}>
      <div style={{ width: 110, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ width: 120, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flexShrink: 0, textAlign: 'right' }}>
        {valueText}
        {subText && <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 11 }}> · {subText}</span>}
      </div>
    </div>
  )
}

// กราฟแท่งรายเดือน (ซีรีส์เดียว สีทองแดงแบรนด์ + ตัวเลขบนแท่ง)
function MonthBars({ data, fmt }: { data: { label: string; value: number | null }[]; fmt: (v: number) => string }) {
  const max = Math.max(...data.map(d => d.value ?? 0), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, paddingTop: 18 }}>
      {data.map((d, i) => {
        const h = d.value != null && d.value > 0 ? Math.max(4, Math.round((d.value / max) * 100)) : 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
            title={`${d.label}: ${d.value != null ? fmt(d.value) : 'ไม่มีข้อมูล'}`}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{d.value != null ? fmt(d.value) : '—'}</div>
            <div style={{ width: '100%', maxWidth: 44, height: `${h}%`, minHeight: d.value != null && d.value > 0 ? 4 : 0, background: 'var(--blue)', borderRadius: '4px 4px 0 0', opacity: 0.9 }} />
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- หน้า ----------

export default function AnalyticsPage() {
  const cached = getPageCache<AllData>('analytics:data')
  const [data, setData] = useState<AllData>(cached ?? { orders: [], scans: [], claims: [] })
  const [loading, setLoading] = useState(!cached)
  const [month, setMonth] = useState('') // 'YYYY-MM' — เลือกเดือนเจาะจง (ว่าง = ทั้งหมด)

  useEffect(() => {
    ;(async () => {
      const [o, s, c] = await Promise.all([
        fetchAllRows<OrderRow>(() => supabase.from('order_entries').select('id,order_number,order_status,created_at,shipped_at,deadline,price,platform,is_installation,status_history').order('created_at', { ascending: true }).order('id', { ascending: true })),
        fetchAllRows<ScanRow>(() => supabase.from('production_scans').select('order_number,status,tech_name,scanned_at').order('scanned_at', { ascending: true })),
        fetchAllRows<ClaimRow>(() => supabase.from('claims').select('id,created_at,status,fault,refund_amount,claim_type').order('created_at', { ascending: true }).order('id', { ascending: true })),
      ])
      const next: AllData = {
        orders: o.data,
        scans: s.data,
        claims: c.data,
      }
      setPageCache('analytics:data', next)
      setData(next)
      setLoading(false)
    })()
  }, [])

  // รายชื่อเดือนที่มีออเดอร์ (ใหม่ → เก่า) สำหรับ dropdown
  const monthOptions = useMemo(() => {
    const set = new Set<string>()
    data.orders.forEach(o => { if (o.created_at) set.add(o.created_at.slice(0, 7)) })
    return [...set].sort().reverse()
  }, [data])

  const stats = useMemo(() => {
    // เลือกเดือน → กรองเฉพาะเดือนนั้น, ไม่เลือก → ทั้งหมด
    const inRange = (iso: string | null | undefined) =>
      !!iso && (!month || iso.startsWith(month))

    const orders = data.orders.filter(o => inRange(o.created_at))
    const claims = data.claims.filter(c => inRange(c.created_at))

    // --- เวลาแต่ละแผนก: รวม 2 แหล่ง — สแกนผลิต + ประวัติเปลี่ยนสถานะในเว็บ (status_history)
    // เก็บเวลาแรกสุดของแต่ละขั้นต่อออเดอร์ แล้วดูส่วนต่างขั้นก่อนหน้า → ขั้นนี้
    const orderByNumber = new Map<string, OrderRow>()
    data.orders.forEach(o => { if (o.order_number) orderByNumber.set(o.order_number, o) })
    const STAGE_SET = new Set(STAGES.map(st => st.status))

    const stageTimes = new Map<string, { created: string | null; times: Map<string, string> }>()
    const entryFor = (key: string, created: string | null) => {
      let e = stageTimes.get(key)
      if (!e) { e = { created, times: new Map() }; stageTimes.set(key, e) }
      if (!e.created && created) e.created = created
      return e
    }
    const setEarliest = (times: Map<string, string>, status: string, at: string) => {
      const prev = times.get(status)
      if (!prev || at < prev) times.set(status, at)
    }

    for (const s of data.scans) {
      if (!s.order_number || !s.scanned_at || !STAGE_SET.has(s.status)) continue
      const e = entryFor(s.order_number, orderByNumber.get(s.order_number)?.created_at ?? null)
      setEarliest(e.times, s.status, s.scanned_at)
    }
    for (const o of data.orders) {
      if (!Array.isArray(o.status_history)) continue
      const events = o.status_history.filter(h => h?.status && h?.at && STAGE_SET.has(h.status))
      if (!events.length) continue
      const e = entryFor(o.order_number || o.id, o.created_at)
      events.forEach(h => setEarliest(e.times, h.status, h.at))
    }

    const stageDurations: Record<string, number[]> = {}
    STAGES.forEach(st => { stageDurations[st.status] = [] })
    const totalProd: number[] = [] // ตัดเสร็จ → แพ็คเสร็จ

    for (const [, { created, times }] of stageTimes) {
      // เวลาเริ่มของขั้นแรก = วันที่ลงออเดอร์
      let prevT: string | null = created
      for (const st of STAGES) {
        const t = times.get(st.status)
        if (t) {
          if (prevT && inRange(t)) {
            const d = new Date(t).getTime() - new Date(prevT).getTime()
            if (d > 0 && d <= MAX_STAGE_MS) stageDurations[st.status].push(d)
          }
          prevT = t
        }
      }
      const cut = times.get('ตัดผ้าแล้ว'), pack = times.get('แพ็คแล้ว')
      if (cut && pack && inRange(pack)) {
        const d = new Date(pack).getTime() - new Date(cut).getTime()
        if (d > 0 && d <= MAX_STAGE_MS) totalProd.push(d)
      }
    }

    const stageMed = STAGES.map(st => ({ ...st, med: median(stageDurations[st.status]), n: stageDurations[st.status].length }))

    // --- เวลาจัดส่ง: ลงออเดอร์ → จัดส่งแล้ว ---
    const shipped = orders.filter(o => o.shipped_at)
    const shipDur = shipped
      .map(o => new Date(o.shipped_at!).getTime() - new Date(o.created_at).getTime())
      .filter(d => d > 0 && d <= 90 * DAY)

    // ส่งตรงเวลา: จัดส่งไม่เกินวันกำหนดส่ง
    const withDeadline = shipped.filter(o => o.deadline)
    const onTime = withDeadline.filter(o => o.shipped_at!.split('T')[0] <= o.deadline!.split('T')[0])

    // --- รายเดือน 6 เดือนล่าสุด ---
    const months: { key: string; label: string }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('th-TH', { month: 'short' }),
      })
    }
    const monthOrders = months.map(m => ({ label: m.label, value: data.orders.filter(o => o.created_at.startsWith(m.key)).length as number | null }))
    const monthShipDays = months.map(m => {
      const durs = data.orders
        .filter(o => o.shipped_at?.startsWith(m.key))
        .map(o => new Date(o.shipped_at!).getTime() - new Date(o.created_at).getTime())
        .filter(d => d > 0 && d <= 90 * DAY)
      const med = median(durs)
      return { label: m.label, value: med != null ? Math.round((med / DAY) * 10) / 10 : null }
    })

    // --- ผลงานพนักงานผลิต (สแกนในช่วง) ---
    const techMap = new Map<string, Record<string, number>>()
    for (const s of data.scans) {
      if (!s.tech_name || !inRange(s.scanned_at)) continue
      let rec = techMap.get(s.tech_name)
      if (!rec) { rec = {}; techMap.set(s.tech_name, rec) }
      rec[s.status] = (rec[s.status] ?? 0) + 1
    }
    const techs = [...techMap.entries()]
      .map(([name, rec]) => ({ name, rec, total: Object.values(rec).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)

    // --- เคลม ---
    const faultCount = new Map<string, number>()
    let refundSum = 0
    for (const c of claims) {
      const f = c.fault || 'ไม่ระบุ'
      faultCount.set(f, (faultCount.get(f) ?? 0) + 1)
      if (c.refund_amount) refundSum += c.refund_amount
    }
    const faults = [...faultCount.entries()].sort((a, b) => b[1] - a[1])
    const claimRate = orders.length > 0 ? (claims.length / orders.length) * 100 : 0

    // --- แพลตฟอร์ม ---
    const platCount = new Map<string, number>()
    for (const o of orders) {
      const p = o.is_installation ? 'งานติดตั้ง' : (o.platform || 'ไม่ระบุ')
      platCount.set(p, (platCount.get(p) ?? 0) + 1)
    }
    const platforms = [...platCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

    const revenue = shipped.reduce((sum, o) => sum + (o.price ?? 0), 0)

    return {
      orders, claims, stageMed, totalProdMed: median(totalProd), totalProdN: totalProd.length,
      shipMed: median(shipDur), shipN: shipDur.length,
      onTimePct: withDeadline.length > 0 ? Math.round((onTime.length / withDeadline.length) * 100) : null,
      onTimeN: withDeadline.length,
      monthOrders, monthShipDays, techs, faults, claimRate, refundSum, platforms, revenue, shippedCount: shipped.length,
    }
  }, [data, month])

  const maxStage = Math.max(...stats.stageMed.map(s => s.med ?? 0), 1)
  const maxPlat = Math.max(...stats.platforms.map(p => p[1]), 1)
  const maxFault = Math.max(...stats.faults.map(f => f[1]), 1)

  return (
    <div>
      {/* หัวเรื่อง + ตัวเลือกช่วงเวลา */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>วิเคราะห์ข้อมูล</h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '4px 0 0' }}>
            เวลาแต่ละแผนก · เวลาจัดส่ง · เคลม · แพลตฟอร์ม — ค่าเวลาใช้ค่ากลาง (median) กันงานค้างนานผิดปกติดึงค่าเพี้ยน
          </p>
        </div>
        {/* dropdown เดียว: ทั้งหมด + เดือนที่มีออเดอร์ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 12px' }}>
          <svg width="15" height="15" fill="none" stroke="var(--blue)" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
          </svg>
          <select value={month} onChange={e => setMonth(e.target.value)}
            style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--ink)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">ทั้งหมด</option>
            {monthOptions.map(m => (
              <option key={m} value={m}>
                {new Date(parseInt(m.slice(0, 4)), parseInt(m.slice(5, 7)) - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>กำลังโหลดข้อมูล...</p>}

      {/* การ์ดสรุป */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <StatTile label="เวลาผลิตรวม (ตัด → แพ็ค)" value={fmtDur(stats.totalProdMed)} sub={`จาก ${stats.totalProdN} ออเดอร์`} color="#C47E3A"
          icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
        <StatTile label="เวลาจัดส่ง (ลงออเดอร์ → ส่ง)" value={stats.shipMed != null ? `${Math.round((stats.shipMed / DAY) * 10) / 10} วัน` : '—'} sub={`จาก ${stats.shipN} ออเดอร์ที่จัดส่งแล้ว`} color="#6366F1"
          icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>} />
        <StatTile label="ส่งทันกำหนด" value={stats.onTimePct != null ? `${stats.onTimePct}%` : '—'} sub={`จาก ${stats.onTimeN} ออเดอร์ที่มีกำหนดส่ง`} color="#16A34A"
          icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
        <StatTile label="ยอดขายที่จัดส่งแล้ว" value={fmtBaht(stats.revenue)} sub={`${stats.shippedCount} ออเดอร์ · เคลม ${stats.claims.length} เคส (${stats.claimRate.toFixed(1)}%)`} color="#DC2626"
          icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
      </div>

      {/* เวลาเฉลี่ยแต่ละแผนก + กราฟรายเดือน */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 22 }}>
        <Card title="เวลาที่ใช้แต่ละแผนก" sub="นับจากขั้นก่อนหน้าเสร็จ → ขั้นนี้เสร็จ (จากสแกนผลิต + เปลี่ยนสถานะในเว็บ, ขั้นตัดนับจากวันลงออเดอร์)">
          {stats.stageMed.map(st => (
            <HBar key={st.status} label={st.label} value={st.med ?? 0} max={maxStage} color={st.color}
              valueText={fmtDur(st.med)} subText={`${st.n} งาน`} />
          ))}
          {stats.stageMed.every(s => s.n === 0) && !loading && (
            <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ยังไม่มีข้อมูลสแกนผลิตในช่วงนี้</p>
          )}
        </Card>
        <Card title="ออเดอร์ใหม่รายเดือน" sub="นับตามวันที่ลงออเดอร์ 6 เดือนล่าสุด">
          <MonthBars data={stats.monthOrders} fmt={v => v.toLocaleString()} />
        </Card>
        <Card title="เวลาจัดส่งรายเดือน (วัน)" sub="ค่ากลางของ ลงออเดอร์ → จัดส่งแล้ว ตามเดือนที่จัดส่ง">
          <MonthBars data={stats.monthShipDays} fmt={v => `${v}`} />
        </Card>
      </div>

      {/* พนักงานผลิต + เคลม + แพลตฟอร์ม */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        <Card title="ผลงานพนักงานผลิต" sub="จำนวนงานที่สแกนในช่วงที่เลือก แยกตามขั้น">
          {stats.techs.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ไม่มีข้อมูล</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ink-3)', fontWeight: 500, fontSize: 11.5 }}>ชื่อ</th>
                  {STAGES.map(st => (
                    <th key={st.status} style={{ textAlign: 'center', padding: '6px 8px', color: st.color, fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap' }}>{st.label.replace('แผนก', '').replace('สินค้า', '').replace('ผ้า', '')}</th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ink-3)', fontWeight: 500, fontSize: 11.5 }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {stats.techs.map(t => (
                  <tr key={t.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--ink)' }}>{t.name}</td>
                    {STAGES.map(st => (
                      <td key={st.status} style={{ textAlign: 'center', padding: '7px 8px', color: t.rec[st.status] ? 'var(--ink-2)' : 'var(--ink-4)' }}>{t.rec[st.status] ?? '-'}</td>
                    ))}
                    <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, color: 'var(--blue)' }}>{t.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="งานเคลม" sub={`เคลมที่เปิดในช่วงที่เลือก ${stats.claims.length} เคส · เงินคืนรวม ${fmtBaht(stats.refundSum)}`}>
          {stats.faults.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ไม่มีเคลมในช่วงนี้</p>
          ) : (
            <>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>แยกตามฝ่ายผิด</div>
              {stats.faults.map(([fault, n]) => (
                <HBar key={fault} label={fault} value={n} max={maxFault} color="#DC2626"
                  valueText={`${n} เคส`} subText={`${Math.round((n / stats.claims.length) * 100)}%`} />
              ))}
            </>
          )}
        </Card>
        <Card title="ออเดอร์แยกตามช่องทาง" sub="นับออเดอร์ที่ลงในช่วงที่เลือก">
          {stats.platforms.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ไม่มีข้อมูล</p>
          ) : stats.platforms.map(([plat, n]) => (
            <HBar key={plat} label={plat} value={n} max={maxPlat} color="var(--blue)"
              valueText={`${n}`} subText={stats.orders.length ? `${Math.round((n / stats.orders.length) * 100)}%` : undefined} />
          ))}
        </Card>
      </div>
    </div>
  )
}
