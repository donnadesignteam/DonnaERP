'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Order = {
  id: string
  order_number: string
  customer_name: string
  order_status: string
  deadline: string | null
  created_at: string
  platform: string | null
  courier: string | null
  is_installation: boolean
  is_urgent: boolean
  is_dropoff: boolean
  shipping_datetime: string | null
  notes: string | null
  updated_at: string | null
}

const OUTSIDE_PLATFORMS = [
  'Facebook','LineOA','Tiktok-Chat','Shopee-Chat','หน้าร้าน',
  'Lineส่วนตัวยุน','Lineส่วนตัวเฟิร์น','Lineส่วนตัวสู้',
  'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:LineOA','เคลม:หน้าร้าน',
  'เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวเฟิร์น','เคลม:Lineส่วนตัวสู้',
]

function shiftShippingDatetime(s: string, days: number): string {
  if (!s || s === '-') return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),(.+)$/)
  if (!m) return s
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
  d.setDate(d.getDate() + days)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()},${m[4]}`
}

function daysRemaining(dateStr: string): number | null {
  if (!dateStr) return null
  let target: Date
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    target = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
  } else {
    target = new Date(dateStr)
  }
  const diff = target.getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

const STATUS_COLOR: Record<string, string> = {
  'รอดำเนินการ': '#f59e0b',
  'ตัดผ้าแล้ว': '#f59e0b',
  'เย็บแล้ว': '#f59e0b',
  'รีดแล้ว': '#f59e0b',
  'แพ็คแล้ว': '#f59e0b',
  'กำลังตัด': '#f59e0b',
  'กำลังเย็บ': '#f59e0b',
  'กำลังรีด': '#f59e0b',
  'กำลังแพ็ค': '#f59e0b',
  'งานเสร็จ': '#22c55e',
  'รอจัดส่ง': '#6366f1',
  'จัดส่งแล้ว': '#22c55e',
  'รอติดตั้ง': '#f97316',
}

const STATS_META = [
  {
    key: 'total',
    label: 'ออเดอร์ทั้งหมด',
    color: '#2563EB',
    gradLight: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
    gradDark: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af30 100%)',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.101-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>
      </svg>
    ),
  },
  {
    key: 'pending',
    label: 'ออเดอร์ค้างส่ง',
    color: '#D97706',
    gradLight: 'linear-gradient(135deg, #FFFBEB 0%, #FDE68A 100%)',
    gradDark: 'linear-gradient(135deg, #3d2a00 0%, #92400e30 100%)',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
  },
  {
    key: 'today',
    label: 'กำหนดส่งวันนี้',
    color: '#16A34A',
    gradLight: 'linear-gradient(135deg, #F0FDF4 0%, #BBF7D0 100%)',
    gradDark: 'linear-gradient(135deg, #052e16 0%, #14532d30 100%)',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"/>
      </svg>
    ),
  },
  {
    key: 'overdue',
    label: 'เกินกำหนดส่ง',
    color: '#DC2626',
    gradLight: 'linear-gradient(135deg, #FFF1F2 0%, #FECDD3 100%)',
    gradDark: 'linear-gradient(135deg, #3b0a0a 0%, #7f1d1d30 100%)',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
      </svg>
    ),
  },
]

const DEPTS = [
  { label: 'แผนกตัดผ้า', status: 'ตัดผ้าแล้ว', color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path strokeLinecap="round" d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg> },
  { label: 'แผนกเย็บผ้า', status: 'เย็บแล้ว', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></svg> },
  { label: 'แผนกรีดผ้า', status: 'รีดแล้ว', color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.18)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg> },
  { label: 'แผนกแพ็คสินค้า', status: 'แพ็คแล้ว', color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.18)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg> },
]

type ModalData = { title: string; orders: Order[]; showPrint?: boolean } | null

function OrderTable({ orders, today }: { orders: Order[]; today: string }) {
  if (orders.length === 0) return (
    <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>ไม่มีข้อมูล</p>
  )
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
          {['เลขที่', 'ลูกค้า', 'สถานะ', 'กำหนดส่ง', 'วันที่สั่ง'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, fontSize: 12 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => {
          const dl = o.deadline?.split('T')[0] ?? ''
          const over = dl && dl < today && !['งานเสร็จ', 'จัดส่งแล้ว'].includes(o.order_status)
          return (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 14px', color: 'var(--blue)', fontWeight: 500 }}>{o.order_number}</td>
              <td style={{ padding: '10px 14px', color: 'var(--ink)' }}>{o.customer_name}</td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{ background: (STATUS_COLOR[o.order_status] ?? '#8E8E93') + '18', color: STATUS_COLOR[o.order_status] ?? '#8E8E93', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500 }}>
                  {o.order_status}
                </span>
              </td>
              <td style={{ padding: '10px 14px', color: over ? 'var(--red)' : 'var(--ink)', fontWeight: over ? 600 : 400 }}>
                {dl ? new Date(o.deadline!).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{new Date(o.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function DashboardPage() {
  const [all, setAll] = useState<Order[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  const [modal, setModal] = useState<ModalData>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [daysSort, setDaysSort] = useState<'asc'|'desc'|null>('asc')
  const [deadlineFrom, setDeadlineFrom] = useState('')
  const [deadlineTo, setDeadlineTo] = useState('')
  const [platformFilters, setPlatformFilters] = useState<string[]>([])
  const [courierFilters, setCourierFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [openColFilter, setOpenColFilter] = useState<string|null>(null)

  const today = new Date().toISOString().split('T')[0]

  function isoToDmy(iso: string) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('order_entries').select('id,order_number,customer_name,order_status,deadline,created_at,platform,courier,is_installation,is_urgent,is_dropoff,shipping_datetime,notes,updated_at').order('created_at', { ascending: true })
      const rows = (data ?? []) as Order[]
      setAll(rows)
      if (rows.length > 0) {
        setDateFrom(rows[0].created_at.split('T')[0])
        setDateTo(rows[rows.length - 1].created_at.split('T')[0])
      }
      setLoading(false)
    })()
  }, [])

  const filtered = all.filter(o => {
    const d = o.created_at.split('T')[0]
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
  })

  const DONE_STATUSES = ['งานเสร็จ', 'จัดส่งแล้ว']
  const pending = filtered.filter(o => !DONE_STATUSES.includes(o.order_status))

  function effectiveISODate(o: Order): string | null {
    const isOut = OUTSIDE_PLATFORMS.includes(o.platform ?? '') || o.is_installation
    if (isOut) return o.deadline ? o.deadline.split('T')[0] : null
    const sd = (o.is_dropoff && o.shipping_datetime)
      ? shiftShippingDatetime(o.shipping_datetime, 2)
      : o.shipping_datetime
    if (!sd) return null
    const m = sd.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (!m) return null
    return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  }

  const PLATFORMS = ['Tiktok','Tiktok-Chat','Shopee','Shopee-Chat','Lazada','Facebook','LineOA',
    'Lineส่วนตัวยุน','Lineส่วนตัวสู้','Lineส่วนตัวเฟิร์น','หน้าร้าน',
    'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:หน้าร้าน',
    'เคลม:LineOA','เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวเฟิร์น','เคลม:Lineส่วนตัวสู้']
  const platformOptions = PLATFORMS.concat(OUTSIDE_PLATFORMS.filter(p => !PLATFORMS.includes(p)))
  const courierOptions = ['งานติดตั้ง', ...new Set(all.map(r => r.courier).filter(Boolean))] as string[]

  const ordersListBase = [...filtered].reverse()
  let ordersList = ordersListBase as Order[]
  if (deadlineFrom || deadlineTo) {
    ordersList = ordersList.filter(o => {
      const iso = effectiveISODate(o)
      if (!iso) return false
      return (!deadlineFrom || iso >= deadlineFrom) && (!deadlineTo || iso <= deadlineTo)
    })
  }
  if (platformFilters.length) ordersList = ordersList.filter(o => platformFilters.includes(o.platform ?? ''))
  if (courierFilters.length) ordersList = ordersList.filter(o => courierFilters.includes(o.is_installation ? 'งานติดตั้ง' : o.courier ?? ''))
  if (statusFilters.length) ordersList = ordersList.filter(o => statusFilters.includes(o.order_status))
  if (orderSearch) {
    const q = orderSearch.toLowerCase()
    ordersList = ordersList.filter(o => o.order_number?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q))
  }
  if (daysSort) {
    ordersList = [...ordersList].sort((a, b) => {
      const da = daysRemaining(effectiveISODate(a) ?? '') ?? (daysSort === 'asc' ? Infinity : -Infinity)
      const db = daysRemaining(effectiveISODate(b) ?? '') ?? (daysSort === 'asc' ? Infinity : -Infinity)
      return daysSort === 'asc' ? da - db : db - da
    })
  }
  const todayDue = filtered.filter(o => effectiveISODate(o) === today)
  const overdue = filtered.filter(o => { const iso = effectiveISODate(o); return iso && iso < today && !DONE_STATUSES.includes(o.order_status) })

  const now = new Date()
  const last7 = all.filter(o => (now.getTime() - new Date(o.created_at).getTime()) <= 7 * 864e5).length
  const prev7 = all.filter(o => { const age = (now.getTime() - new Date(o.created_at).getTime()) / 864e5; return age > 7 && age <= 14 }).length
  const totalTrend = prev7 === 0 ? null : Math.round((last7 - prev7) / prev7 * 100)

  const statCounts = [filtered.length, pending.length, todayDue.length, overdue.length]
  const statOrders = [filtered, pending, todayDue, overdue]
  const statPrint = [true, true, true, true]
  const statTrends: (number | null)[] = [
    totalTrend,
    filtered.length > 0 ? Math.round(pending.length / filtered.length * 100) : null,
    null,
    pending.length > 0 ? Math.round(overdue.length / pending.length * 100) : null,
  ]
  const statTrendLabels = ['vs สัปดาห์ที่แล้ว', '% ของทั้งหมด', null, '% ของค้างส่ง']

  return (
    <div>

      {/* Date filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '11px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ช่วงวันที่</span>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <div onClick={() => fromRef.current?.showPicker()}
          style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 9px', fontSize: 12, color: dateFrom ? 'var(--ink)' : 'var(--ink-4)', minWidth: 90, cursor: 'pointer', userSelect: 'none' }}>
          {dateFrom ? isoToDmy(dateFrom) : 'DD/MM/YYYY'}
          <input ref={fromRef} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 'none', padding: 0 }} />
        </div>
        <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>ถึง</span>
        <div onClick={() => toRef.current?.showPicker()}
          style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 9px', fontSize: 12, color: dateTo ? 'var(--ink)' : 'var(--ink-4)', minWidth: 90, cursor: 'pointer', userSelect: 'none' }}>
          {dateTo ? isoToDmy(dateTo) : 'DD/MM/YYYY'}
          <input ref={toRef} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 'none', padding: 0 }} />
        </div>
        <button onClick={() => { setDateFrom(''); setDateTo('') }}
          style={{ marginLeft: 4, padding: '4px 11px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)' }}>
          รีเซ็ต
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {STATS_META.map((s, i) => {
          const trend = statTrends[i]
          const trendLabel = statTrendLabels[i]
          const isPositiveTrend = i === 0 ? (trend !== null && trend >= 0) : false
          const isBadTrend = i === 3

          return (
            <button key={s.key}
              onClick={() => setModal({ title: s.label, orders: statOrders[i], showPrint: statPrint[i] })}
              style={{
                background: isDark ? s.gradDark : s.gradLight,
                border: `1px solid ${s.color}22`,
                borderRadius: 16,
                padding: '22px 22px 20px',
                textAlign: 'left',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: `0 2px 12px ${s.color}12`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${s.color}25`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = ''
                ;(e.currentTarget as HTMLElement).style.boxShadow = `0 2px 12px ${s.color}12`
              }}
            >
              {/* Top row: icon + trend badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${s.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.color,
                }}>
                  {s.icon}
                </div>
                {trend !== null && trendLabel && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: i === 0
                      ? (trend >= 0 ? '#16A34A' : '#DC2626')
                      : (isBadTrend ? '#DC2626' : '#71717A'),
                    background: i === 0
                      ? (trend >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)')
                      : (isBadTrend ? 'rgba(220,38,38,0.1)' : 'rgba(113,113,122,0.1)'),
                    padding: '3px 8px', borderRadius: 20,
                    whiteSpace: 'nowrap',
                  }}>
                    {i === 0
                      ? `${trend >= 0 ? '+' : ''}${trend}% ${trend >= 0 ? '↑' : '↓'}`
                      : `${trend}%`}
                  </span>
                )}
              </div>
              {/* Number */}
              <div style={{ fontSize: 44, fontWeight: 800, color: s.color, letterSpacing: '-2px', lineHeight: 1 }}>
                {loading ? '—' : statCounts[i]}
              </div>
              {/* Label */}
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, fontWeight: 500 }}>{s.label}</div>
              {trendLabel && trend !== null && (
                <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>{trendLabel}</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Dept section header */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>สถานะงานแผนก</h2>
      </div>

      {/* Department cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {DEPTS.map(dept => {
          const rows = filtered.filter(o => o.order_status === dept.status)
          const active = statusFilters.length === 1 && statusFilters[0] === dept.status
          return (
            <div key={dept.label}
              onClick={() => setStatusFilters(active ? [] : [dept.status])}
              style={{
              background: 'var(--surface)',
              border: `1px solid ${active ? dept.color : dept.border}`,
              borderRadius: 20,
              boxShadow: active ? `0 6px 24px ${dept.color}28` : `0 4px 20px ${dept.color}0a, 0 1px 4px rgba(0,0,0,0.04)`,
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}>
              {/* Card header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 20px',
                background: dept.bg,
                borderBottom: `1px solid ${dept.border}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: `${dept.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: dept.color,
                }}>
                  {dept.icon}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{dept.label}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: dept.color,
                  background: `${dept.color}18`,
                  borderRadius: 20, padding: '3px 10px',
                  border: `1px solid ${dept.color}25`,
                }}>
                  {rows.length} งาน
                </span>
              </div>

              {/* Card body */}
              <div style={{ padding: '10px 20px 16px' }}>
                {rows.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--ink-4)', padding: '12px 0', textAlign: 'center' }}>ไม่มีงานในขณะนี้</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {rows.slice(0, 5).map((o, idx) => {
                      const days = daysRemaining(effectiveISODate(o) ?? '')
                      return (
                        <div key={o.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 0',
                          borderBottom: idx < Math.min(rows.length, 5) - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <span style={{ fontWeight: 600, color: 'var(--blue)', fontSize: 12, minWidth: 80 }}>{o.order_number}</span>
                          <span style={{ color: 'var(--ink)', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                            color: days === null ? 'var(--ink-4)' : days < 0 ? 'var(--red)' : days <= 2 ? '#ff9f0a' : '#34c759' }}>
                            {days === null ? 'รอกำหนด' : days < 0 ? `เกิน ${Math.abs(days)} วัน` : `${days} วัน`}
                          </span>
                        </div>
                      )
                    })}
                    {rows.length > 5 && (
                      <p style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'right', paddingTop: 6 }}>+{rows.length - 5} รายการเพิ่มเติม</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Orders list */}
      <div style={{ marginTop: 36 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>รายการออเดอร์ทั้งหมด</h2>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 14 }}>
          <input
            value={orderSearch}
            onChange={e => setOrderSearch(e.target.value)}
            placeholder="ค้นหาเลขที่ / ลูกค้า…"
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12, outline: 'none', width: 220 }}
          />
        </div>

        {openColFilter && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenColFilter(null)} />}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
          ) : ordersList.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>ไม่มีออเดอร์</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                  {/* วันที่เหลือ */}
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'days' ? null : 'days')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: daysSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      วันที่เหลือ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                    {openColFilter === 'days' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200, padding: '6px 0', minWidth: 150 }}>
                        {([['น้อยไปมาก','asc'],['มากไปน้อย','desc']] as [string,'asc'|'desc'][]).map(([label,val]) => (
                          <div key={val} onClick={() => { setDaysSort(daysSort === val ? null : val); setOpenColFilter(null) }}
                            style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: daysSort === val ? 600 : 400, color: daysSort === val ? 'var(--blue)' : 'var(--ink)', background: daysSort === val ? 'var(--blue-bg)' : 'transparent' }}>
                            {label}
                          </div>
                        ))}
                        {daysSort && <div onClick={() => { setDaysSort(null); setOpenColFilter(null) }} style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 11, color: 'var(--ink-4)', borderTop: '1px solid var(--border)', marginTop: 4 }}>ล้าง</div>}
                      </div>
                    )}
                  </th>
                  {/* ต้องส่งภายใน */}
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'deadline' ? null : 'deadline')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: (deadlineFrom || deadlineTo) ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      ต้องส่งภายใน <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                    {openColFilter === 'deadline' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200, padding: '12px 14px', minWidth: 220 }}>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ตั้งแต่</label>
                          <input type="date" value={deadlineFrom} onChange={e => setDeadlineFrom(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ถึงวันที่</label>
                          <input type="date" value={deadlineTo} onChange={e => setDeadlineTo(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        {(deadlineFrom || deadlineTo) && <button onClick={() => { setDeadlineFrom(''); setDeadlineTo('') }} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>ล้าง</button>}
                      </div>
                    )}
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                  {/* แพลตฟอร์ม */}
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'platform' ? null : 'platform')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: platformFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      แพลตฟอร์ม{platformFilters.length > 0 && ` (${platformFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                    {openColFilter === 'platform' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 180, maxHeight: 280, overflowY: 'auto', padding: '6px 0' }}>
                        {platformOptions.map(p => (
                          <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: platformFilters.includes(p) ? 'var(--blue-bg)' : 'transparent' }}>
                            <input type="checkbox" checked={platformFilters.includes(p)} onChange={() => setPlatformFilters(platformFilters.includes(p) ? platformFilters.filter(x => x !== p) : [...platformFilters, p])} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                            {p}
                          </label>
                        ))}
                        {platformFilters.length > 0 && <div onClick={() => setPlatformFilters([])} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 11, color: 'var(--ink-4)', borderTop: '1px solid var(--border)', marginTop: 4 }}>ล้าง</div>}
                      </div>
                    )}
                  </th>
                  {/* บริษัทจัดส่ง */}
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'courier' ? null : 'courier')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: courierFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      บริษัทจัดส่ง{courierFilters.length > 0 && ` (${courierFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                    {openColFilter === 'courier' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 200, maxHeight: 260, overflowY: 'auto', padding: '6px 0' }}>
                        {courierOptions.map(c => (
                          <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: courierFilters.includes(c) ? 'var(--blue-bg)' : 'transparent' }}>
                            <input type="checkbox" checked={courierFilters.includes(c)} onChange={() => setCourierFilters(courierFilters.includes(c) ? courierFilters.filter(x => x !== c) : [...courierFilters, c])} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                            {c === 'งานติดตั้ง' ? <span style={{ color: '#f97316', fontWeight: 600 }}>งานติดตั้ง</span> : c}
                          </label>
                        ))}
                        {courierFilters.length > 0 && <div onClick={() => setCourierFilters([])} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 11, color: 'var(--ink-4)', borderTop: '1px solid var(--border)', marginTop: 4 }}>ล้าง</div>}
                      </div>
                    )}
                  </th>
                  {/* สถานะงาน */}
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'status' ? null : 'status')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: statusFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      สถานะงาน{statusFilters.length > 0 && ` (${statusFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                    {openColFilter === 'status' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 160, padding: '6px 0' }}>
                        {Object.keys(STATUS_COLOR).map(s => (
                          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: statusFilters.includes(s) ? 'var(--blue-bg)' : 'transparent' }}>
                            <input type="checkbox" checked={statusFilters.includes(s)} onChange={() => setStatusFilters(statusFilters.includes(s) ? statusFilters.filter(x => x !== s) : [...statusFilters, s])} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s], flexShrink: 0, display: 'inline-block' }} />
                            {s}
                          </label>
                        ))}
                        {statusFilters.length > 0 && <div onClick={() => setStatusFilters([])} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 11, color: 'var(--ink-4)', borderTop: '1px solid var(--border)', marginTop: 4 }}>ล้าง</div>}
                      </div>
                    )}
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {ordersList.map(o => {
                  const isOutside = OUTSIDE_PLATFORMS.includes(o.platform ?? '') || o.is_installation
                  const effective = isOutside
                    ? o.deadline
                    : (o.is_dropoff && o.shipping_datetime) ? shiftShippingDatetime(o.shipping_datetime, 2) : o.shipping_datetime
                  const days = effective ? daysRemaining(effective) : null
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {o.order_status === 'จัดส่งแล้ว' ? (
                          <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จแล้ว</span>
                        ) : o.is_urgent ? (
                          <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จ</span>
                        ) : days !== null ? (
                          <span style={{ fontWeight: 700, color: days < 0 ? 'var(--red)' : days <= 2 ? '#ff9f0a' : '#34c759' }}>
                            {days < 0 ? `เกิน ${Math.abs(days)}` : days} วัน
                          </span>
                        ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 500, color: '#bf5af2' }}>
                        {o.order_status === 'จัดส่งแล้ว' ? (
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>จัดส่งแล้ว</span>
                        ) : isOutside ? (
                          o.deadline ? new Date(o.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>
                        ) : (
                          effective ?? <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{o.customer_name || '-'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{o.platform || '-'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                        {o.is_installation ? <span style={{ color: '#f97316', fontWeight: 600 }}>งานติดตั้ง</span> : o.courier || <span style={{ color: 'var(--ink-4)' }}>-</span>}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ fontWeight: 600, color: STATUS_COLOR[o.order_status] ?? 'var(--ink-4)', fontSize: 12 }}>
                          {o.order_status || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: o.notes ? 'var(--ink-3)' : 'var(--ink-4)' }}>
                        {o.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '24px 28px', width: '100%', maxWidth: 860, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{modal.title}</h2>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{modal.orders.length} รายการ</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {modal.showPrint && (
                  <button onClick={() => window.print()} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>
                    ปริ้น
                  </button>
                )}
                <button onClick={() => setModal(null)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>
                  ปิด
                </button>
              </div>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <OrderTable orders={modal.orders} today={today} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
