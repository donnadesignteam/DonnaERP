'use client'

import NotifyBell from '@/components/NotifyBell'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { syncRows, byCreatedAsc } from '@/lib/rowCache'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { PlatformIcon } from '@/components/BrandMark'
import { KpiCard, Donut, StatusTile, TopProducts, RankList, MiniStats, DeptCards } from './report'

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
  customer_name: string | null
  items: { type?: string; quantity?: number | string }[] | null
}
type ScanRow = { order_number: string; status: string; tech_name: string | null; scanned_at: string }
type ClaimRow = { id: string; created_at: string; status: string | null; fault: string | null; refund_amount: number | null; claim_type: string | null }

type AllData = { orders: OrderRow[]; scans: ScanRow[]; claims: ClaimRow[] }

// ลำดับขั้นผลิต + สีตามชุดเดียวกับหน้าออเดอร์/dashboard (PROD_STATUS_COLOR)
const STAGES = [
  // สีแท่งของแต่ละขั้น — ไล่โทนแบรนด์จากเข้มไปอ่อน (เดิมเป็นฟ้า/ม่วง/ชมพู/เขียว คนละโทนกับทั้งเว็บ)
  { status: 'ตัดผ้าแล้ว', label: 'แผนกตัดผ้า', color: '#8A5A38' },
  { status: 'เย็บแล้ว',   label: 'แผนกเย็บผ้า', color: '#A87452' },
  { status: 'ตรวจสอบแล้ว', label: 'ผู้ช่วยช่าง', color: '#BE8A63' },
  { status: 'รีดแล้ว',    label: 'แผนกรีดผ้า',  color: '#D0A57F' },
  { status: 'แพ็คแล้ว',   label: 'แผนกแพ็คสินค้า', color: '#E0BE9C' },
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

// หัวข้อคั่นแต่ละส่วนของหน้า — เลขลำดับ + ชื่อ + คำอธิบายว่าส่วนนี้ตอบคำถามอะไร
function Section({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, margin: '30px 0 14px' }}>
      <span style={{ width: 28, height: 28, borderRadius: 10, background: 'var(--brand)', color: '#FFF8F0',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
        flexShrink: 0, boxShadow: '0 4px 10px rgba(158,106,73,0.25)' }}>{n}</span>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#74401E', lineHeight: 1.25 }}>{title}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</p>
      </div>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 4px 16px rgba(120,86,58,0.10)', padding: '20px 22px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>}
      </div>
      {children}
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
        // ออเดอร์: จำไว้ในเครื่อง ขอเฉพาะใบที่เปลี่ยน (lib/rowCache.ts) — มี status_history ก้อนใหญ่
        syncRows<OrderRow>({
          key: 'analytics2', table: 'order_entries', sort: byCreatedAsc,
          select: 'id,order_number,order_status,created_at,shipped_at,deadline,price,platform,is_installation,status_history,customer_name,items',
          full: () => supabase.from('order_entries').select('id,order_number,order_status,created_at,shipped_at,deadline,price,platform,is_installation,status_history,customer_name,items').order('created_at', { ascending: true }).order('id', { ascending: true }),
        }),
        fetchAllRows<ScanRow>(() => supabase.from('production_scans').select('order_number,status,tech_name,scanned_at').order('scanned_at', { ascending: true }).order('id', { ascending: true })),
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

    // ‼️ ใบที่ยกเลิกแล้วไม่ใช่ยอดขาย/ไม่ใช่ผลงาน — ตัดออกก่อนคิดทุกตัวเลขในหน้านี้
    // (กติกาเดียวกับหน้าภาพรวม) ไม่งั้นยอดขาย/จำนวนออเดอร์/%เคลม/สัดส่วนแพลตฟอร์ม จะบวมเกินจริง
    const liveOrders = data.orders.filter(o => o.order_status !== 'ยกเลิก')

    const orders = liveOrders.filter(o => inRange(o.created_at))
    const claims = data.claims.filter(c => inRange(c.created_at))

    // --- เวลาแต่ละแผนก: รวม 2 แหล่ง — สแกนผลิต + ประวัติเปลี่ยนสถานะในเว็บ (status_history)
    // เก็บเวลาแรกสุดของแต่ละขั้นต่อออเดอร์ แล้วดูส่วนต่างขั้นก่อนหน้า → ขั้นนี้
    const orderByNumber = new Map<string, OrderRow>()
    liveOrders.forEach(o => { if (o.order_number) orderByNumber.set(o.order_number, o) })
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

    // ‼️ สแกนของใบที่ยกเลิกไม่เอามาคิดเวลาผลิต (มักหยุดกลางคัน ค่ากลางจะเพี้ยน)
    //    แต่ตาราง "ผลงานพนักงาน" ด้านล่างยังนับทุกสแกน เพราะงานนั้นพนักงานลงมือทำไปจริง
    const cancelledNos = new Set(data.orders.filter(o => o.order_status === 'ยกเลิก' && o.order_number).map(o => o.order_number))
    for (const s of data.scans) {
      if (!s.order_number || !s.scanned_at || !STAGE_SET.has(s.status)) continue
      if (cancelledNos.has(s.order_number)) continue
      const e = entryFor(s.order_number, orderByNumber.get(s.order_number)?.created_at ?? null)
      setEarliest(e.times, s.status, s.scanned_at)
    }
    for (const o of liveOrders) {
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
    const monthOrders = months.map(m => ({ label: m.label, value: liveOrders.filter(o => o.created_at.startsWith(m.key)).length as number | null }))
    const monthShipDays = months.map(m => {
      const durs = liveOrders
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

    // คอลัมน์ของตารางผลงาน = 5 ขั้นผลิต + สถานะอื่นที่มีคนสแกนจริง (เช่น รอจัดส่ง/จัดส่งแล้ว/งานเคลม)
    // ‼️ เดิมโชว์แค่ 5 ขั้น แต่ช่อง "รวม" นับทุกสถานะ เลยมีตัวเลขหายไปจากตาราง
    const extraCount = new Map<string, number>()
    for (const t of techs) {
      for (const [st, n2] of Object.entries(t.rec)) {
        if (STAGE_SET.has(st)) continue
        extraCount.set(st, (extraCount.get(st) ?? 0) + n2)
      }
    }
    const techCols = [
      ...STAGES.map(st => ({ status: st.status, label: st.label.replace('แผนก', '').replace('สินค้า', '').replace('ผ้า', ''), color: st.color })),
      ...[...extraCount.entries()].sort((a, b) => b[1] - a[1])
        .map(([st]) => ({ status: st, label: st.replace('แล้ว', ''), color: 'var(--ink-2)' })),
    ]

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

    // ══ ส่วนรายงาน (การ์ดตัวเลข / กราฟแนวโน้ม / โดนัท / สถานะ / สินค้า / ออเดอร์ล่าสุด) ══
    const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const latest = [...liveOrders].reverse().find(o => o.created_at)?.created_at?.slice(0, 7)
    const curKey = month || latest || ymOf(new Date())
    const [cy, cm] = curKey.split('-').map(Number)
    const prevKey = ymOf(new Date(cy, cm - 2, 1))

    const inMonth = (o: OrderRow, key: string) => o.created_at?.startsWith(key)
    const curOrders = liveOrders.filter(o => inMonth(o, curKey))
    const prevOrders = liveOrders.filter(o => inMonth(o, prevKey))
    const sumPrice = (arr: OrderRow[]) => arr.reduce((t, o) => t + (o.price ?? 0), 0)
    const pctChange = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null)

    // ลูกค้าใหม่ = ชื่อที่เพิ่งมีออเดอร์ใบแรกในเดือนนั้น (ดูจากออเดอร์ทั้งหมดที่มี)
    const firstSeen = new Map<string, string>()
    for (const o of liveOrders) {
      const name = (o.customer_name ?? '').trim()
      if (!name || !o.created_at) continue
      const prev2 = firstSeen.get(name)
      if (!prev2 || o.created_at < prev2) firstSeen.set(name, o.created_at)
    }
    const newCustIn = (key: string) => [...firstSeen.values()].filter(t => t.startsWith(key)).length

    // การ์ดตัวเลข: ค่าใช้ตามช่วงที่เลือก · % เทียบเดือนก่อน (เฉพาะตอนเลือกเดือนเจาะจง)
    const scopeShipped = orders.filter(o => o.order_status === 'จัดส่งแล้ว')
    const kpi = {
      revenue: sumPrice(orders),
      orderCount: orders.length,
      shippedCount2: scopeShipped.length,
      newCustomers: month ? newCustIn(month) : firstSeen.size,
      dRevenue: month ? pctChange(sumPrice(curOrders), sumPrice(prevOrders)) : null,
      dOrders: month ? pctChange(curOrders.length, prevOrders.length) : null,
      dShipped: month ? pctChange(curOrders.filter(o => o.order_status === 'จัดส่งแล้ว').length, prevOrders.filter(o => o.order_status === 'จัดส่งแล้ว').length) : null,
      dCustomers: month ? pctChange(newCustIn(curKey), newCustIn(prevKey)) : null,
    }

    const monthName = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
      .toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

    // โดนัท: ยอดขายแยกตามแพลตฟอร์ม
    const DONUT_COLORS = ['#8A5A38', '#A87452', '#BE8A63', '#D0A57F', '#E0BE9C', '#EAD3BB']
    const platRevMap = new Map<string, number>()
    for (const o of orders) {
      const k = o.is_installation ? 'งานติดตั้ง' : (o.platform || 'ไม่ระบุ')
      platRevMap.set(k, (platRevMap.get(k) ?? 0) + (o.price ?? 0))
    }
    const platRevSorted = [...platRevMap.entries()].sort((a, b) => b[1] - a[1])
    const platTop = platRevSorted.slice(0, 5)
    const platRest = platRevSorted.slice(5).reduce((t, [, v]) => t + v, 0)
    const platRevenue = [
      ...platTop.map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i] })),
      ...(platRest > 0 ? [{ label: 'อื่นๆ', value: platRest, color: DONUT_COLORS[5] }] : []),
    ]
    const platRevTotal = platRevenue.reduce((t, p) => t + p.value, 0)

    // สถานะออเดอร์ (นับใบที่ยกเลิกแยกต่างหาก เพราะตัดออกจาก liveOrders ไปแล้ว)
    const cancelled = data.orders.filter(o => o.order_status === 'ยกเลิก' && inRange(o.created_at)).length
    const countBy = (st: string) => orders.filter(o => o.order_status === st).length
    const statusTiles = [
      { key: 'รอดำเนินการ', label: 'รอดำเนินการ', n: countBy('รอดำเนินการ'), bg: '#FBEEDC' },
      { key: 'ตัดผ้าแล้ว', label: 'ตัดผ้าแล้ว', n: countBy('ตัดผ้าแล้ว'), bg: '#E7EEF3' },
      { key: 'เย็บแล้ว', label: 'เย็บแล้ว', n: countBy('เย็บแล้ว'), bg: '#EDE7F2' },
      { key: 'รีดแล้ว', label: 'รีดแล้ว', n: countBy('รีดแล้ว'), bg: '#F5E9EB' },
      { key: 'แพ็คแล้ว', label: 'แพ็คแล้ว', n: countBy('แพ็คแล้ว'), bg: '#E6F0EE' },
      { key: 'จัดส่งแล้ว', label: 'จัดส่งแล้ว', n: countBy('จัดส่งแล้ว'), bg: '#E3F3E0' },
      { key: 'ยกเลิก', label: 'ยกเลิก', n: cancelled, bg: '#FBEDE8' },
    ]
    const statusTotal = orders.length + cancelled

    // สินค้ายอดนิยม — นับจำนวน "ใบ" ที่มีสินค้าชนิดนั้น
    const prodMap = new Map<string, number>()
    for (const o of orders) {
      if (!Array.isArray(o.items)) continue
      const types = new Set(o.items.map(it => (it?.type ?? '').trim()).filter(Boolean))
      types.forEach(t => prodMap.set(t, (prodMap.get(t) ?? 0) + 1))
    }
    const topProducts = [...prodMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }))
    const withItems = orders.filter(o => Array.isArray(o.items) && o.items.length > 0).length

    // ผลงานแยกตามแผนก (ดูง่ายกว่าแยกตามคน — คนหนึ่งมักทำแค่ 1-2 ขั้น)
    const depts = techCols.map(c => {
      const people = techs.map(t => ({ name: t.name, n: t.rec[c.status] ?? 0 })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)
      return { label: c.label, color: c.color === 'var(--ink-2)' ? '#B39B84' : c.color, total: people.reduce((t, x) => t + x.n, 0), people }
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total)

    // ออเดอร์ล่าสุด 5 ใบ
    const recent = [...orders].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5)

    return {
      curKey, prevKey, monthNameCur: monthName(curKey), monthNamePrev: monthName(prevKey),
      kpi,
      platRevenue, platRevTotal, statusTiles, statusTotal, cancelled,
      topProducts, withItems, recent, depts,
      orders, claims, stageMed, totalProdMed: median(totalProd), totalProdN: totalProd.length,
      shipMed: median(shipDur), shipN: shipDur.length,
      onTimePct: withDeadline.length > 0 ? Math.round((onTime.length / withDeadline.length) * 100) : null,
      onTimeN: withDeadline.length,
      monthOrders, monthShipDays, techs, techCols, faults, claimRate, refundSum, platforms, revenue, shippedCount: shipped.length,
    }
  }, [data, month])

  // ขั้นที่กินเวลามากที่สุด — ติดป้าย "ช้าสุด" ไว้ให้เห็นทันทีว่าคอขวดอยู่ตรงไหน
  const slowestStage = stats.stageMed.some(s => s.n > 0)
    ? stats.stageMed.reduce((a, b) => ((b.med ?? 0) > (a.med ?? 0) ? b : a)).status
    : null

  // ดาวน์โหลดรายงานเป็นไฟล์ CSV (เปิดใน Excel ได้เลย — ใส่ BOM กันภาษาไทยเพี้ยน)
  const downloadReport = () => {
    const rows: (string | number)[][] = [
      ['รายงานร้าน Donna Design'],
      ['ช่วงเวลา', month ? stats.monthNameCur : 'ทั้งหมด'],
      [],
      ['ภาพรวม'],
      ['ยอดขายรวม (บาท)', stats.kpi.revenue],
      ['จำนวนออเดอร์', stats.kpi.orderCount],
      ['จัดส่งสำเร็จ', stats.kpi.shippedCount2],
      ['ลูกค้าใหม่', stats.kpi.newCustomers],
      [],
      ['สถานะออเดอร์', 'จำนวน'],
      ['ทั้งหมด', stats.statusTotal],
      ...stats.statusTiles.map(t => [t.label, t.n]),
      [],
      ['ยอดขายตามแพลตฟอร์ม', 'บาท'],
      ...stats.platRevenue.map(pl => [pl.label, pl.value]),
      [],
      ['สินค้ายอดนิยม', 'จำนวนออเดอร์'],
      ...stats.topProducts.map(r => [r.name, r.count]),
    ]
    const csv = rows.map(r => r.map(c => (typeof c === 'string' && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `รายงาน-${month || 'ทั้งหมด'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* หัวเรื่อง + ตัวเลือกช่วงเวลา */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 className="sc-title" style={{ margin: 0 }}>รายงานและข้อมูล</h1>
          <p className="sc-sub" style={{ margin: '4px 0 0' }}>
            ภาพรวมยอดขาย สถานะออเดอร์ และสถิติสำคัญของร้าน
          </p>
        </div>
        {/* dropdown เดียว: ทั้งหมด + เดือนที่มีออเดอร์ */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <NotifyBell />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 999, padding: '9px 16px', boxShadow: 'var(--shadow)' }}>
            <svg width="15" height="15" fill="none" stroke="var(--brand)" strokeWidth="1.6" viewBox="0 0 24 24">
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
        <button onClick={downloadReport} className="sc-btn-main"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
          </svg>
          ดาวน์โหลดรายงาน
        </button>
      </div>

      {loading && <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>กำลังโหลดข้อมูล...</p>}

      <Section n={1} title="ภาพรวม" sub={month ? `ตัวเลขของ ${stats.monthNameCur} · เทียบกับ ${stats.monthNamePrev}` : 'ตัวเลขรวมทุกเดือน — เลือกเดือนมุมขวาบนเพื่อดูการเปลี่ยนแปลงเทียบเดือนก่อน'} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}>
        <KpiCard label="ยอดขายรวม" value={stats.kpi.revenue.toLocaleString('th-TH', { maximumFractionDigits: 0 })} unit="฿"
          delta={stats.kpi.dRevenue}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l-1 12H7zM9.2 7V5.6a2.8 2.8 0 015.6 0V7"/></svg>} />
        <KpiCard label="จำนวนออเดอร์" value={stats.kpi.orderCount.toLocaleString('th-TH')} unit="ใบ"
          delta={stats.kpi.dOrders}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h4"/></svg>} />
        <KpiCard label="จัดส่งสำเร็จ" value={stats.kpi.shippedCount2.toLocaleString('th-TH')} unit="ใบ"
          delta={stats.kpi.dShipped}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h10v9H3zM13 10.5h4l3 3v3h-7zM6.5 19.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm11 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>} />
        <KpiCard label="ลูกค้าใหม่" value={stats.kpi.newCustomers.toLocaleString('th-TH')} unit="ราย"
          delta={stats.kpi.dCustomers}
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0"/></svg>} />
      </div>

      <Section n={2} title="แพลตฟอร์ม" sub="เงินมาจากช่องทางไหนมากที่สุด และลูกค้าสั่งสินค้าชนิดไหนมากที่สุด" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14, alignItems: 'start' }}>
        <Card title="ยอดขายแยกตามแพลตฟอร์ม" sub="รวมยอดเงินของออเดอร์ในช่วงที่เลือก">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <Donut parts={stats.platRevenue} total={stats.platRevTotal} />
            <div style={{ flex: 1, minWidth: 220 }}>
              {stats.platRevenue.map(pl => (
                <div key={pl.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
                  {['อื่นๆ', 'งานติดตั้ง', 'ไม่ระบุ'].includes(pl.label)
                    ? <span style={{ width: 20, height: 20, borderRadius: '50%', background: pl.color, flexShrink: 0, display: 'inline-block' }} />
                    : <PlatformIcon name={pl.label} size={20} />}
                  {/* ❗ ชื่อกว้างตามข้อความ แล้วดัน % / ยอดเงินมาชิดกัน — ไม่งั้นกลางจะโหว่ */}
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.label}</span>
                  <span style={{ width: 44, textAlign: 'right', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                    {stats.platRevTotal ? `${((pl.value / stats.platRevTotal) * 100).toFixed(1)}%` : '—'}
                  </span>
                  <span style={{ width: 86, textAlign: 'right', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {pl.value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                  </span>
                  <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>฿</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="สินค้ายอดนิยม" sub={`5 อันดับชนิดสินค้าที่ถูกสั่งมากที่สุด · จาก ${stats.withItems.toLocaleString('th-TH')} ใบที่กรอกรายการไว้`}>
          <TopProducts rows={stats.topProducts} total={stats.withItems} />
        </Card>
      </div>

      <Section n={3} title="สถานะงานตอนนี้" sub="ออเดอร์ในช่วงที่เลือกค้างอยู่ขั้นไหนบ้าง" />
      <Card title="สถานะออเดอร์" sub="จำนวนออเดอร์ในแต่ละสถานะ (นับใบที่ลงในช่วงที่เลือก)">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusTile label="ทั้งหมด" count={stats.statusTotal} bg="var(--cream)" active
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path strokeLinecap="round" d="M12 7.5V12l3 2" /></svg>} />
          {stats.statusTiles.map(t => (
            <StatusTile key={t.key} label={t.label} count={t.n} bg={t.bg}
              pct={stats.statusTotal ? `${((t.n / stats.statusTotal) * 100).toFixed(1)}%` : undefined}
              icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /></svg>} />
          ))}
        </div>
      </Card>

      <Section n={4} title="ความเร็วการทำงาน" sub="งานหนึ่งใบค้างที่ขั้นไหนนานที่สุด และส่งถึงมือลูกค้าเร็วขึ้นหรือช้าลง — ทุกตัวเลขเป็นค่ากลาง (median)" />
      <Card title="เวลาที่ใช้แต่ละขั้น และเวลาส่งรายเดือน" sub="ซ้าย = เรียงตามลำดับขั้นงาน · ขวา = ลงออเดอร์ → จัดส่งแล้ว (น้อยวันกว่า = ดีกว่า)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4 }}>งานค้างที่แผนกไหนนานสุด</div>
            <RankList rows={[...stats.stageMed].sort((a, b) => (b.med ?? 0) - (a.med ?? 0)).map(st => ({
              name: st.label, value: fmtDur(st.med), note: `${st.n.toLocaleString('th-TH')} งาน`,
              tag: slowestStage && st.status === slowestStage ? 'ช้าสุด' : undefined,
            }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4 }}>ส่งถึงมือลูกค้า (วัน) — 6 เดือนล่าสุด</div>
            <MiniStats items={stats.monthShipDays.map(m => ({ label: m.label, value: m.value == null ? '—' : `${m.value}`, sub: m.value == null ? 'ไม่มีข้อมูล' : 'วัน' }))} />
          </div>
        </div>
      </Card>

      <Section n={5} title="ปริมาณงานและคุณภาพงาน" sub="งานเข้ามาเดือนละกี่ใบ และเคลมมาจากฝั่งไหนมากที่สุด" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, alignItems: 'start' }}>
        <Card title="ออเดอร์ใหม่รายเดือน" sub="นับตามวันที่ลงออเดอร์ 6 เดือนล่าสุด">
          <MiniStats items={stats.monthOrders.map(m => ({ label: m.label, value: (m.value ?? 0).toLocaleString('th-TH'), sub: 'ใบ' }))} />
        </Card>
        <Card title="งานเคลม แยกตามฝ่ายผิด" sub={`เคลมที่เปิดในช่วงที่เลือก ${stats.claims.length} เคส · เงินคืนรวม ${fmtBaht(stats.refundSum)}`}>
          {stats.faults.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ไม่มีเคลมในช่วงนี้</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stats.faults.map(([fault, n]) => (
                <div key={fault} style={{ flex: '1 1 120px', minWidth: 120, background: '#FBEDE8', border: '1px solid var(--hairline)',
                  borderRadius: 14, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{fault}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#C0563F', lineHeight: 1.3 }}>{n.toLocaleString('th-TH')}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>
                    {stats.claims.length ? `${Math.round((n / stats.claims.length) * 100)}% ของเคลมทั้งหมด` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Section n={6} title="ผลงานผลิต แยกตามแผนก" sub="แต่ละแผนกสแกนไปกี่ใบ และใครเป็นคนทำ" />
      <Card title="จำนวนงานที่สแกน แยกตามแผนก" sub="ตัวเลขขวาบน = ยอดรวมของแผนก · ด้านล่างคือคนที่ทำ เรียงจากมากไปน้อย">
        <DeptCards depts={stats.depts} />
      </Card>
    </div>
  )
}
