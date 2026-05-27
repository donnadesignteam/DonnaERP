'use client'

import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from '@/lib/supabase'

type Item = {
  type: string
  floors: number | null
  rail_head: string
  color_code: string
  color_name: string
  width: number | string
  height: number | string
  quantity: number | string
  unit: string
  hooks: string
  note: string
}

type Entry = {
  id: string
  entry_date: string
  deadline: string
  shipping_datetime: string
  status: string
  admin_name: string
  technician: string
  customer_name: string
  order_number: string
  shipping_date: string
  is_urgent: boolean
  platform: string
  items: Item[] | null
  order_status: string
  courier: string
  is_installation: boolean
  installation_date: string
  notes: string
  price: number | null
  created_at: string
  updated_at: string
}

const emptyItem = (): Item => ({ type: '', floors: null, rail_head: '', color_code: '', color_name: '', width: '', height: '', quantity: 1, unit: 'ชุด', hooks: '', note: '' })

const PLATFORMS = ['Tiktok','Tiktok-Chat','Shopee','Shopee-Chat','Lazada','Facebook','LineOA',
  'Lineส่วนตัวยุน','Lineส่วนตัวสู้','Lineส่วนตัวเฟิร์น','หน้าร้าน',
  'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:หน้าร้าน',
  'เคลม:LineOA','เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวสู้','เคลม:Lineส่วนตัวเฟิร์น']

const COURIERS = [
  'J&T Express',
  'LEX TH',
  'Standard Delivery - ส่งธรรมดาในประเทศ-SPX Express',
  'Standard Delivery - ส่งธรรมดาในประเทศ-Flash Express',
  'Standard Delivery - ส่งธรรมดาในประเทศ',
  'Standard Delivery Bulky - ส่งสินค้าขนาดใหญ่-Flash Express Bulky',
]

const ADMINS = ['กาย', 'แพท', 'หนูนา']
const TECHS = ['ช่างดอนน่า', 'ช่างพี่ฟอง', 'ช่างเชียงใหม่']

function calcShipping(deadline: string, courier: string): string {
  if (!deadline || !courier) return '-'
  const d = new Date(deadline)
  const isFlash = courier.includes('Flash')
  d.setDate(d.getDate() - (isFlash ? 2 : 1))
  let time = '13:00:00'
  if (courier.includes('SPX Express') || courier === 'J&T Express' || courier === 'LEX TH') time = '15:00:00'
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()},${time}`
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

const emptyForm = (): Omit<Entry, 'id' | 'created_at' | 'updated_at' | 'shipping_datetime'> => ({
  entry_date: new Date().toISOString().split('T')[0],
  deadline: '',
  status: 'อยู่ในกำหนด',
  admin_name: '',
  technician: '',
  customer_name: '',
  order_number: '',
  shipping_date: '',
  is_urgent: false,
  platform: '',
  items: null,
  order_status: 'รอดำเนินการ',
  courier: '',
  is_installation: false,
  installation_date: '',
  notes: '',
  price: null,
})

const STATUS_COLOR: Record<string, string> = {
  'อยู่ในกำหนด': '#34c759',
  'งานเสร็จแล้ว': 'var(--blue)',
}

const PROD_STATUSES = ['รอดำเนินการ', 'กำลังตัด', 'กำลังเย็บ', 'กำลังรีด', 'กำลังแพ็ค']
const PROD_STATUS_COLOR: Record<string, string> = {
  'รอดำเนินการ': '#f59e0b',
  'กำลังตัด': '#10b981',
  'กำลังเย็บ': '#3b82f6',
  'กำลังรีด': '#8b5cf6',
  'กำลังแพ็ค': '#ef4444',
  'งานเสร็จ': '#22c55e',
}

export default function OrderEntryPage() {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<Entry> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [error, setError] = useState('')
  const [platformFilters, setPlatformFilters] = useState<string[]>([])
  const [courierFilters, setCourierFilters] = useState<string[]>([])
  const [urgentFilter, setUrgentFilter] = useState<boolean | null>(null)
  const [installFilter, setInstallFilter] = useState<boolean | null>(null)
  const [adminFilters, setAdminFilters] = useState<string[]>([])
  const [techFilters, setTechFilters] = useState<string[]>([])
  const [shippingDateFrom, setShippingDateFrom] = useState('')
  const [shippingDateTo, setShippingDateTo] = useState('')
  const [openFilter, setOpenFilter] = useState<'platform' | 'courier' | 'status' | 'admin' | 'tech' | 'shipping' | 'urgent' | 'install' | 'days' | null>(null)
  const [daysSort, setDaysSort] = useState<'asc' | 'desc' | null>('asc')
  const [sortOrder, setSortOrder] = useState<string[]>([])
  const [modalTab, setModalTab] = useState<'form' | 'paste'>('form')
  const [pasteCol1, setPasteCol1] = useState('')
  const [pasteCol2, setPasteCol2] = useState('')
  const [pasteCol3, setPasteCol3] = useState('')
  const [pasteCol4, setPasteCol4] = useState('')
  const [pasteCol5, setPasteCol5] = useState('')
  const [pasteCol6, setPasteCol6] = useState('')
  const [pasteRows, setPasteRows] = useState<{ paymentDate: string; deadline: string; orderNumber: string; price: number; customerName: string; courier: string }[]>([])
  const [pasteSaving, setPasteSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalItems, setModalItems] = useState<Item[]>([])
  const [itemsModal, setItemsModal] = useState<{ id: string; items: Item[] } | null>(null)
  const [itemsPasteText, setItemsPasteText] = useState('')
  const [itemsModalPasteText, setItemsModalPasteText] = useState('')
  const [itemsModalLoading, setItemsModalLoading] = useState(false)
  const [itemsModalError, setItemsModalError] = useState('')
  const [openAction, setOpenAction] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const computeSortOrder = (rs: Entry[], sort: 'asc' | 'desc' | null): string[] => {
    if (!sort) return rs.map(r => r.id)
    const parseD = (s: string | null | undefined) => {
      if (!s) return null
      if (s.includes('-')) return new Date(s)
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (!m) return null
      return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    }
    return [...rs].sort((a, b) => {
      if (a.is_urgent && b.is_urgent) return 0
      if (a.is_urgent) return 1
      if (b.is_urgent) return -1
      const da = parseD(a.shipping_datetime), db = parseD(b.shipping_datetime)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return sort === 'asc' ? da.getTime() - db.getTime() : db.getTime() - da.getTime()
    }).map(r => r.id)
  }

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('order_entries').select('*').order('entry_date', { ascending: false, nullsFirst: false }).order('id', { ascending: true })
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    const entries = (data ?? []) as Entry[]
    setRows(entries)
    setSortOrder(computeSortOrder(entries, daysSort))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const set = (k: string, v: string | boolean) =>
    setModal(m => {
      if (!m) return null
      const updated = { ...m.data, [k]: v }
      if (k === 'deadline' || k === 'courier') {
        updated.shipping_datetime = calcShipping(
          k === 'deadline' ? String(v) : (m.data.deadline ?? ''),
          k === 'courier' ? String(v) : (m.data.courier ?? '')
        )
      }
      return { ...m, data: updated }
    })

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const d = modal.data
    const now = new Date().toISOString()
    const payload = {
      entry_date: d.entry_date || null,
      deadline: d.deadline || null,
      shipping_datetime: (d.shipping_datetime && d.shipping_datetime !== '-') ? d.shipping_datetime : calcShipping(d.deadline ?? '', d.courier ?? ''),
      status: d.status || 'อยู่ในกำหนด',
      admin_name: d.admin_name || null,
      technician: d.technician || null,
      customer_name: d.customer_name || null,
      order_number: d.order_number || null,
      shipping_date: d.shipping_date || null,
      is_urgent: !!d.is_urgent,
      platform: d.platform || null,
      items: modalItems.length > 0 ? modalItems : null,
      order_status: d.order_status || 'รอดำเนินการ',
      courier: d.courier || null,
      is_installation: !!d.is_installation,
      installation_date: d.is_installation ? (d.installation_date || null) : null,
      notes: d.notes || null,
      price: d.price ? Number(d.price) : null,
      updated_at: now,
    }
    if (modal.mode === 'add') {
      const res = await supabase.from('order_entries').insert(payload).select().single()
      setSaving(false)
      if (res.error) { setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      setRows(prev => [res.data as Entry, ...prev])
    } else {
      const res = await supabase.from('order_entries').update(payload).eq('id', d.id).select().single()
      setSaving(false)
      if (res.error) { setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      setRows(prev => prev.map(r => r.id === d.id ? res.data as Entry : r))
    }
    setModal(null)
  }

  const del = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    const { error: err } = await supabase.from('order_entries').delete().eq('id', id)
    if (!err) {
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
      setRows(prev => prev.filter(r => r.id !== id))
    }
  }

  function formatOrderText(r: Entry): string {
    const lines: string[] = []

    if (r.entry_date) {
      lines.push(new Date(r.entry_date).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }))
    }

    const platformLine = [r.platform, r.customer_name].filter(Boolean).join(': ')
    if (platformLine) lines.push(platformLine)
    if (r.order_number) lines.push(r.order_number)

    lines.push('')

    if (r.items && r.items.length > 0) {
      r.items.forEach((item, idx) => {
        if (idx > 0) lines.push('')
        const isRail = item.type.startsWith('ราง')
        if (isRail) {
          const typeParts = ['(สั่งตัด)', item.type, item.floors ? `${item.floors}ชั้น` : '', item.rail_head || '', item.color_name || ''].filter(Boolean)
          lines.push(typeParts.join(' '))
        } else {
          const typeParts = ['(สั่งตัด)', item.type, item.floors ? `${item.floors}ชั้น` : ''].filter(Boolean)
          lines.push(typeParts.join(' '))
          const colorParts = [item.color_code, item.color_name].filter(Boolean)
          if (colorParts.length) lines.push(`${colorParts.join(' ')} ·`)
        }
        const w = Number(item.width), h = Number(item.height)
        const wStr = w > 0 ? w.toFixed(2) : ''
        const hStr = h > 0 ? h.toFixed(2) : ''
        const dim = wStr && hStr ? `ก${wStr}*สูง${hStr}` : wStr ? `ก${wStr}` : ''
        if (dim) lines.push(` ${dim} =${item.quantity}${item.unit}${item.note ? ` (${item.note})` : ''}`)
        else lines.push(` =${item.quantity}${item.unit}${item.note ? ` (${item.note})` : ''}`)
      })
    }

    lines.push('')

    if (r.shipping_datetime && r.shipping_datetime !== '-') {
      lines.push(`ส่งก่อน ${r.shipping_datetime}`)
    }
    if (r.courier) lines.push(r.courier)

    return lines.join('\n')
  }

  const copyOrderText = async (r: Entry) => {
    setOpenAction(null)
    await navigator.clipboard.writeText(formatOrderText(r))
    setCopiedId(r.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const bulkDelete = async () => {
    if (!confirm(`ลบ ${selectedIds.size} รายการที่เลือก?`)) return
    const ids = Array.from(selectedIds)
    const { error: err } = await supabase.from('order_entries').delete().in('id', ids)
    if (!err) {
      setSelectedIds(new Set())
      setRows(prev => prev.filter(r => !ids.includes(r.id)))
    }
  }

  const updateField = async (id: string, field: string, value: string | boolean) => {
    const now = new Date().toISOString()
    const { error: err } = await supabase.from('order_entries').update({ [field]: value, updated_at: now }).eq('id', id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
    }
  }

  const toggleDone = async (id: string, checked: boolean) => {
    const now = new Date().toISOString()
    const updates = checked
      ? { is_urgent: true, order_status: 'งานเสร็จ', updated_at: now }
      : { is_urgent: false, order_status: 'รอดำเนินการ', updated_at: now }
    const { error: err } = await supabase.from('order_entries').update(updates).eq('id', id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleSelectAll() {
    const allSelected = displayed.every(r => selectedIds.has(r.id))
    if (allSelected) {
      setSelectedIds(prev => { const s = new Set(prev); displayed.forEach(r => s.delete(r.id)); return s })
    } else {
      setSelectedIds(prev => { const s = new Set(prev); displayed.forEach(r => s.add(r.id)); return s })
    }
  }

  function formatItemLines(items: Item[] | null): string[] {
    if (!items || items.length === 0) return []
    return items.map(it => {
      const parts: string[] = []
      if (it.type) parts.push(it.type)
      if (it.floors) parts.push(`${it.floors}ชั้น`)
      if (it.rail_head) parts.push(it.rail_head)
      if (it.color_code) parts.push(it.color_code)
      if (it.color_name) parts.push(it.color_name)
      const w = Number(it.width), h = Number(it.height)
      if (w > 0 && h > 0) parts.push(`${w}×${h}`)
      else if (w > 0) parts.push(`${w}`)
      if (it.quantity) parts.push(`×${it.quantity}${it.unit}`)
      return parts.join(' ')
    })
  }

  function normalizeCourier(s: string): string {
    const t = s.trim()
    if (t === 'Standard Delivery - ส่งธรรมดาในประเทศ-SPX Express') return 'SPX Express'
    if (t === 'Standard Delivery - ส่งธรรมดาในประเทศ') return 'SPX Express'
    if (t === 'Standard Delivery - ส่งธรรมดาในประเทศ-Flash Express') return 'Flash Express'
    if (t === 'Standard Delivery Bulky - ส่งสินค้าขนาดใหญ่-Flash Express Bulky') return 'Flash Express Bulky'
    return t
  }

  function toIsoDate(s: string): string | null {
    if (!s) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (m) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3]
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }

  function parsePasteData() {
    const split = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
    const orderNums  = split(pasteCol1)  // เลขออเดอร์ลูกค้า
    const customers  = split(pasteCol2)  // ชื่อลูกค้า
    const payDates   = split(pasteCol3)  // เวลาชำระสินค้า
    const couriers   = split(pasteCol4)  // ตัวเลือกการจัดส่ง
    const deadlines  = split(pasteCol5)  // วันที่คาดว่าจะจัดส่ง
    const prices     = split(pasteCol6)  // ราคาสุทธิ
    const len = Math.max(orderNums.length, customers.length, payDates.length, couriers.length, deadlines.length, prices.length)
    const map = new Map<string, { paymentDate: string; deadline: string; orderNumber: string; price: number; customerName: string; courier: string }>()
    for (let i = 0; i < len; i++) {
      const orderNumber = orderNums[i] ?? ''
      const price = parseFloat((prices[i] ?? '0').replace(/,/g, '')) || 0
      if (!orderNumber) continue
      if (map.has(orderNumber)) {
        map.get(orderNumber)!.price += price
      } else {
        map.set(orderNumber, { paymentDate: payDates[i] ?? '', deadline: deadlines[i] ?? '', orderNumber, price, customerName: customers[i] ?? '', courier: normalizeCourier(couriers[i] ?? '') })
      }
    }
    setPasteRows(Array.from(map.values()))
  }

  async function savePasteRows() {
    setPasteSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const payload = pasteRows.map(r => ({
      entry_date: toIsoDate(r.paymentDate) || today,
      deadline: toIsoDate(r.deadline) || null,
      shipping_datetime: (toIsoDate(r.deadline) && r.courier) ? calcShipping(toIsoDate(r.deadline)!, r.courier) : null,
      status: 'อยู่ในกำหนด',
      order_number: r.orderNumber || null,
      notes: null,
      price: r.price || null,
      order_status: 'รอดำเนินการ',
      is_urgent: false,
      is_installation: false,
      admin_name: null, technician: null,
      customer_name: r.customerName || null,
      courier: r.courier || null,
      shipping_date: null, platform: 'Shopee', items: null, installation_date: null,
    }))
    const res = await supabase.from('order_entries').insert(payload).select()
    setPasteSaving(false)
    if (res.error) {
      setError(`บันทึกไม่สำเร็จ: ${res.error.message}`)
    } else {
      setRows(prev => [...(res.data as Entry[]), ...prev])
      setModal(null)
      setPasteRows([]); setPasteCol1(''); setPasteCol2(''); setPasteCol3(''); setPasteCol4(''); setPasteCol5(''); setPasteCol6('')
    }
  }

  function toggleArr(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  function parsePasteItems(text: string): Item[] {
    return text.trim().split('\n')
      .map(l => l.trim()).filter(Boolean)
      .map(line => {
        const c = line.split('\t')
        return {
          type: c[0]?.trim() || '',
          floors: null,
          rail_head: '',
          color_code: c[1]?.trim() || '',
          color_name: c[2]?.trim() || '',
          width: c[3]?.trim() || '',
          height: c[4]?.trim() || '',
          quantity: c[5]?.trim() || 1,
          unit: c[6]?.trim() || 'ชุด',
          hooks: '',
          note: c[7]?.trim() || '',
        }
      })
  }

  function parseShippingDate(s: string): Date | null {
    if (!s || s === '-') return null
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (!m) return null
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
  }

  const displayed = rows.filter(r => {
    const matchSearch = (r.customer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.order_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilters.length === 0 || statusFilters.includes(r.order_status ?? '')
    const matchPlatform = platformFilters.length === 0 || platformFilters.includes(r.platform ?? '')
    const matchCourier = courierFilters.length === 0 || courierFilters.includes(r.courier ?? '')
    const matchAdmin = adminFilters.length === 0 || adminFilters.includes(r.admin_name ?? '')
    const matchTech = techFilters.length === 0 || techFilters.includes(r.technician ?? '')
    const matchUrgent = urgentFilter === null || r.is_urgent === urgentFilter
    const matchInstall = installFilter === null || r.is_installation === installFilter
    const matchShipping = (() => {
      if (!shippingDateFrom && !shippingDateTo) return true
      const d = parseShippingDate(r.shipping_datetime)
      if (!d) return false
      if (shippingDateFrom && d < new Date(shippingDateFrom)) return false
      if (shippingDateTo && d > new Date(shippingDateTo + 'T23:59:59')) return false
      return true
    })()
    return matchSearch && matchStatus && matchPlatform && matchCourier && matchAdmin && matchTech && matchUrgent && matchInstall && matchShipping
  })

  if (daysSort && sortOrder.length > 0) {
    const orderMap = new Map(sortOrder.map((id, i) => [id, i]))
    displayed.sort((a, b) => (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999))
  }

  useEffect(() => {
    if (selectAllRef.current) {
      const some = displayed.some(r => selectedIds.has(r.id))
      const all = displayed.length > 0 && displayed.every(r => selectedIds.has(r.id))
      selectAllRef.current.indeterminate = some && !all
    }
  })

  const handleParseItems = async () => {
    if (!itemsModalPasteText.trim()) return
    setItemsModalLoading(true)
    setItemsModalError('')
    try {
      const res = await fetch('/api/parse-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: itemsModalPasteText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'แปลงไม่สำเร็จ')
      setItemsModal(m => m ? { ...m, items: data.items } : null)
      setItemsModalPasteText('')
    } catch (e: unknown) {
      setItemsModalError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setItemsModalLoading(false)
    }
  }

  const inp = (label: string, key: string, type = 'text') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={String(modal?.data[key as keyof typeof modal.data] ?? '')}
        onChange={e => set(key, e.target.value)}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )

  const sel = (label: string, key: string, options: string[]) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>{label}</label>
      <select value={String(modal?.data[key as keyof typeof modal.data] ?? '')} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
        <option value="">— เลือก —</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      {(openFilter || openAction) && <div onClick={() => { setOpenFilter(null); setOpenAction(null) }} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>ออเดอร์</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{rows.length} รายการ</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {selectedIds.size > 0 && (
            <button onClick={bulkDelete}
              style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ลบที่เลือก ({selectedIds.size})
            </button>
          )}
          <button onClick={() => { setModal({ mode: 'add', data: { ...emptyForm(), shipping_datetime: '' } }); setModalItems([]); setItemsPasteText('') }}
            style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3)' }}>
            + เพิ่มรายการ
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#ff375f11', border: '1px solid #ff375f44', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}>✕</button>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อลูกค้า / เลขคำสั่งซื้อ…"
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }} />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>ยังไม่มีรายการ
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input type="checkbox"
                    ref={selectAllRef}
                    checked={displayed.length > 0 && displayed.every(r => selectedIds.has(r.id))}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'days' ? null : 'days')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: daysSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    วันที่เหลือ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'days' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 140 }}>
                      {([['ตามลำดับ', null], ['น้อยไปมาก', 'asc'], ['มากไปน้อย', 'desc']] as [string, 'asc' | 'desc' | null][]).map(([label, val]) => (
                        <div key={label} onClick={() => { setSortOrder(computeSortOrder(rows, val)); setDaysSort(val); setOpenFilter(null) }}
                          style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: daysSort === val ? 600 : 400, color: daysSort === val ? 'var(--blue)' : 'var(--ink)', background: daysSort === val ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'shipping' ? null : 'shipping')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: (shippingDateFrom || shippingDateTo) ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ต้องส่งภายใน <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'shipping' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '12px 14px', minWidth: 220 }}>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ตั้งแต่วันที่</label>
                        <input type="date" value={shippingDateFrom} onChange={e => setShippingDateFrom(e.target.value)}
                          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ถึงวันที่</label>
                        <input type="date" value={shippingDateTo} onChange={e => setShippingDateTo(e.target.value)}
                          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      {(shippingDateFrom || shippingDateTo) && (
                        <button onClick={() => { setShippingDateFrom(''); setShippingDateTo('') }}
                          style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>
                          ล้าง
                        </button>
                      )}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>เลขคำสั่งซื้อ</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ราคาสุทธิ</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>รายการ</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'platform' ? null : 'platform')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: platformFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แพลตฟอร์ม{platformFilters.length > 0 && ` (${platformFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'platform' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 180, maxHeight: 280, overflowY: 'auto', padding: '6px 0' }}>
                      {PLATFORMS.map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 400, background: platformFilters.includes(p) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={platformFilters.includes(p)} onChange={() => setPlatformFilters(toggleArr(platformFilters, p))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          {p}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'courier' ? null : 'courier')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: courierFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    บริษัทส่ง{courierFilters.length > 0 && ` (${courierFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'courier' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 260, maxHeight: 280, overflowY: 'auto', padding: '6px 0' }}>
                      {[...new Set([...rows.map(r => r.courier).filter(Boolean), 'Flash Express Bulky', 'LEX TH', 'J&T Express'])].sort().map(c => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 400, background: courierFilters.includes(c!) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={courierFilters.includes(c!)} onChange={() => setCourierFilters(toggleArr(courierFilters, c!))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          {c}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>วันที่ชำระ</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>วันที่ต้องส่ง</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'admin' ? null : 'admin')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: adminFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แอดมิน{adminFilters.length > 0 && ` (${adminFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'admin' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 140, padding: '6px 0' }}>
                      {ADMINS.map(a => (
                        <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 400, background: adminFilters.includes(a) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={adminFilters.includes(a)} onChange={() => setAdminFilters(toggleArr(adminFilters, a))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          {a}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'tech' ? null : 'tech')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: techFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ช่าง{techFilters.length > 0 && ` (${techFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'tech' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 160, padding: '6px 0' }}>
                      {TECHS.map(t => (
                        <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 400, background: techFilters.includes(t) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={techFilters.includes(t)} onChange={() => setTechFilters(toggleArr(techFilters, t))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          {t}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: statusFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    สถานะงาน{statusFilters.length > 0 && ` (${statusFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'status' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 160, padding: '6px 0' }}>
                      {PROD_STATUSES.map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 400, background: statusFilters.includes(s) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={statusFilters.includes(s)} onChange={() => setStatusFilters(toggleArr(statusFilters, s))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PROD_STATUS_COLOR[s], flexShrink: 0 }} />
                          {s}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'urgent' ? null : 'urgent')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: urgentFilter ? '#22c55e' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    งานเสร็จ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'urgent' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 150, padding: '6px 0' }}>
                      {[['ทั้งหมด', null], ['งานเสร็จเท่านั้น', true], ['ยังไม่เสร็จ', false]].map(([label, val]) => (
                        <button key={String(label)} onClick={() => { setUrgentFilter(val as boolean); setOpenFilter(null) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: urgentFilter === val ? 'var(--blue-bg)' : 'transparent', color: urgentFilter === val ? 'var(--blue)' : 'var(--ink)', fontWeight: urgentFilter === val ? 600 : 400 }}>
                          {label as string}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'install' ? null : 'install')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: installFilter ? '#f59e0b' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ติดตั้ง <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'install' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 150, padding: '6px 0' }}>
                      {[['ทั้งหมด', null], ['มีติดตั้ง', true], ['ไม่มีติดตั้ง', false]].map(([label, val]) => (
                        <button key={String(label)} onClick={() => { setInstallFilter(val as boolean); setOpenFilter(null) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: installFilter === val ? 'var(--blue-bg)' : 'transparent', color: installFilter === val ? 'var(--blue)' : 'var(--ink)', fontWeight: installFilter === val ? 600 : 400 }}>
                          {label as string}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>แก้ไขล่าสุด</th>
                <th style={{ padding: '10px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => {
                const days = r.shipping_datetime ? daysRemaining(r.shipping_datetime) : null
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {r.is_urgent ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จแล้ว</span>
                      ) : days !== null ? (
                        <span style={{ fontWeight: 700, color: days < 0 ? 'var(--red)' : days <= 2 ? '#ff9f0a' : '#34c759' }}>
                          {days < 0 ? `เกิน ${Math.abs(days)}` : days} วัน
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 500, color: '#bf5af2' }}>{r.is_urgent ? '-' : (r.shipping_datetime || '-')}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--blue)', fontWeight: 600 }}>{r.order_number || '-'}</td>
                    <td style={{ padding: '12px 14px' }}>{r.customer_name || '-'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: r.price ? 600 : 400, color: r.price ? 'var(--ink)' : 'var(--ink-4)' }}>
                      {r.price ? `${r.price.toLocaleString('th-TH')} ฿` : '-'}
                    </td>
                    <td style={{ padding: '6px 14px', maxWidth: 240 }}>
                      <button onClick={() => { setItemsModal({ id: r.id, items: Array.isArray(r.items) ? r.items : [] }); setItemsModalPasteText('') }}
                        style={{ border: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', padding: 0, color: r.items?.length ? 'var(--ink)' : 'var(--ink-4)', textAlign: 'left', display: 'block', width: '100%' }}>
                        {r.items?.length ? (
                          <div>
                            {formatItemLines(r.items).map((line, i) => (
                              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 230, lineHeight: '1.6', color: i === 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{line}</div>
                            ))}
                          </div>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </button>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{r.platform || '-'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)', maxWidth: 140 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.courier || '-'}</div>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>
                      {r.entry_date ? new Date(r.entry_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>
                      {r.deadline ? new Date(r.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.admin_name || ''} onChange={e => updateField(r.id, 'admin_name', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.admin_name ? 'var(--ink)' : 'var(--ink-4)', padding: 0, maxWidth: 80 }}>
                        <option value="">—</option>
                        {ADMINS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.technician || ''} onChange={e => updateField(r.id, 'technician', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.technician ? 'var(--ink)' : 'var(--ink-4)', padding: 0, maxWidth: 100 }}>
                        <option value="">—</option>
                        {TECHS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      {r.is_urgent ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: PROD_STATUS_COLOR['งานเสร็จ'] }}>งานเสร็จ</span>
                      ) : (
                        <select value={r.order_status || ''} onChange={e => updateField(r.id, 'order_status', e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: PROD_STATUS_COLOR[r.order_status] ?? 'var(--ink-4)', padding: 0, maxWidth: 100 }}>
                          <option value="">—</option>
                          {PROD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.is_urgent} onChange={e => toggleDone(r.id, e.target.checked)}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.is_installation} onChange={e => updateField(r.id, 'is_installation', e.target.checked)}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#f59e0b' }} />
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 14px', position: 'relative' }}>
                      <button onClick={() => setOpenAction(openAction === r.id ? null : r.id)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openAction === r.id ? 'var(--bg)' : '#fff', cursor: 'pointer', fontSize: 16, color: copiedId === r.id ? '#34c759' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1, transition: 'color 0.2s' }}>
                        {copiedId === r.id ? '✓' : '···'}
                      </button>
                      {openAction === r.id && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 130, padding: '4px 0', marginTop: 2 }}>
                          <button onClick={() => { copyOrderText(r) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                            คัดลอก
                          </button>
                          <button onClick={() => { setOpenAction(null); setModal({ mode: 'edit', data: { ...r, items: null } }); setModalItems(Array.isArray(r.items) ? [...(r.items as Item[])] : []); setItemsPasteText('') }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L18 8.625"/></svg>
                            แก้ไข
                          </button>
                          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                          <button onClick={() => { setOpenAction(null); del(r.id) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--red)' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                            ลบ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal form */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Tabs (add) / Title (edit) */}
            {modal.mode === 'edit' ? (
              <div style={{ padding: '24px 32px 0' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>แก้ไขออเดอร์</h2>
              </div>
            ) : (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {(['form', 'paste'] as const).map(t => (
                  <button key={t} onClick={() => { setModalTab(t); setPasteRows([]) }}
                    style={{ flex: 1, padding: '16px 0', fontSize: 14, fontWeight: modalTab === t ? 600 : 400, border: 'none', borderBottom: modalTab === t ? '2px solid var(--blue)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', color: modalTab === t ? 'var(--blue)' : 'var(--ink-3)', transition: 'all 0.15s' }}>
                    {t === 'form' ? 'กรอกฟอร์ม' : 'วาง Copy'}
                  </button>
                ))}
              </div>
            )}

            <div style={{ padding: '24px 32px 32px' }}>

            {/* ---- Paste tab ---- */}
            {modal.mode === 'add' && modalTab === 'paste' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {([
                    ['เลขออเดอร์ลูกค้า', pasteCol1, setPasteCol1],
                    ['ชื่อลูกค้า', pasteCol2, setPasteCol2],
                    ['เวลาชำระสินค้า', pasteCol3, setPasteCol3],
                    ['ตัวเลือกการจัดส่ง', pasteCol4, setPasteCol4],
                    ['วันที่คาดว่าจะจัดส่ง', pasteCol5, setPasteCol5],
                    ['ราคาสุทธิ', pasteCol6, setPasteCol6],
                  ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                    <div key={label}>
                      <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>{label}</label>
                      <textarea value={val} onChange={e => { setter(e.target.value); setPasteRows([]) }} rows={8}
                        placeholder={`วาง ${label} ทีละบรรทัด…`}
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                  ))}
                </div>

                <button onClick={parsePasteData}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                  ประมวลผล
                </button>

                {pasteRows.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>พบ {pasteRows.length} ออเดอร์ (รวมที่ซ้ำแล้ว)</p>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                            {['วันชำระ', 'วันต้องส่ง', 'เลขออเดอร์', 'ราคาสุทธิ', 'ชื่อลูกค้า', 'การจัดส่ง'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pasteRows.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '7px 10px' }}>{r.paymentDate || '-'}</td>
                              <td style={{ padding: '7px 10px' }}>{r.deadline || '-'}</td>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--blue)' }}>{r.orderNumber}</td>
                              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{r.price.toLocaleString()} บาท</td>
                              <td style={{ padding: '7px 10px' }}>{r.customerName || '-'}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--ink-3)', fontSize: 11 }}>{r.courier || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setModal(null)}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
                      <button onClick={savePasteRows} disabled={pasteSaving}
                        style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                        {pasteSaving ? 'กำลังบันทึก…' : `บันทึกทั้งหมด ${pasteRows.length} รายการ`}
                      </button>
                    </div>
                  </div>
                )}

                {pasteRows.length === 0 && (
                  <button onClick={() => setModal(null)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
                )}
              </div>
            )}

            {/* ---- Form tab ---- */}
            {(modal.mode === 'edit' || modalTab === 'form') && (
            <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {inp('ชื่อลูกค้าซื้อ', 'customer_name')}
              {inp('เลขคำสั่งซื้อ', 'order_number')}
              {inp('วันที่สร้าง', 'entry_date', 'date')}
              {inp('กำหนดส่งงาน', 'deadline', 'date')}

              {/* Shipping datetime (calculated) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>วันและเวลาที่ต้องส่ง</label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: 'var(--bg)', color: '#bf5af2', fontWeight: 600 }}>
                  {modal.data.shipping_datetime || calcShipping(modal.data.deadline ?? '', modal.data.courier ?? '') || '— เลือกกำหนดส่ง + บริษัท'}
                </div>
              </div>

              {inp('วันที่ส่ง', 'shipping_date', 'date')}
              {sel('แอดมิน', 'admin_name', ADMINS)}
              {sel('ช่างที่รับผิดชอบ', 'technician', TECHS)}
              {sel('จากแพลตฟอร์ม', 'platform', PLATFORMS)}
              {sel('บริษัทจัดส่ง', 'courier', COURIERS)}
              {sel('สถานะงาน', 'order_status', PROD_STATUSES)}
              {sel('สถานะงาน', 'status', ['อยู่ในกำหนด', 'งานเสร็จแล้ว'])}
            </div>

            {/* ---- Items ---- */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>รายการสินค้า</label>
                <button type="button" onClick={() => setModalItems(prev => [...prev, emptyItem()])}
                  style={{ fontSize: 12, padding: '3px 10px', border: '1px solid var(--blue)', borderRadius: 6, color: 'var(--blue)', background: 'var(--blue-bg)', cursor: 'pointer' }}>
                  + เพิ่มรายการ
                </button>
              </div>
              <textarea
                value={itemsPasteText}
                onChange={e => setItemsPasteText(e.target.value)}
                onPaste={e => setTimeout(() => {
                  const v = (e.target as HTMLTextAreaElement).value
                  if (v.trim()) { setModalItems(parsePasteItems(v)); setItemsPasteText('') }
                }, 0)}
                rows={2}
                placeholder={"วางข้อความจาก Excel ที่นี่ — แปลงอัตโนมัติ\nลำดับ: ประเภทม่าน  รหัสสี  ชื่อสี  กว้าง  สูง  จำนวน  หน่วย  หมายเหตุ"}
                style={{ width: '100%', border: '1px dashed var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'monospace', background: 'var(--bg)', color: 'var(--ink)', marginBottom: 8 }}
              />
              {modalItems.length === 0 && !itemsPasteText && (
                <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: '12px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
                  ยังไม่มีรายการ
                </div>
              )}
              {modalItems.map((item, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500 }}>รายการที่ {idx + 1}</span>
                    <button type="button" onClick={() => setModalItems(prev => prev.filter((_, i) => i !== idx))}
                      style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: 0 }}>ลบ</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 2fr 2fr 2fr', gap: '6px 8px', marginBottom: 6 }}>
                    {([['ประเภท', 'type', 'text'], ['ชั้น', 'floors', 'number'], ['หัวราง', 'rail_head', 'text'], ['รหัสสี', 'color_code', 'text'], ['ชื่อสี', 'color_name', 'text']] as [string, keyof Item, string][]).map(([lbl, key, type]) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, color: 'var(--ink-4)', display: 'block', marginBottom: 2 }}>{lbl}</label>
                        <input type={type} step={type === 'number' ? '1' : undefined}
                          value={item[key] === null ? '' : String(item[key])}
                          onChange={e => {
                            const val = key === 'floors' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value
                            setModalItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
                          }}
                          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 2fr', gap: '6px 8px' }}>
                    {([['กว้าง (ม.)', 'width', 'number'], ['สูง (ม.)', 'height', 'number'], ['จำนวน', 'quantity', 'number'], ['หน่วย', 'unit', 'text'], ['กระดูม', 'hooks', 'text'], ['หมายเหตุ', 'note', 'text']] as [string, keyof Item, string][]).map(([lbl, key, type]) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, color: 'var(--ink-4)', display: 'block', marginBottom: 2 }}>{lbl}</label>
                        <input type={type} step={type === 'number' ? '0.01' : undefined}
                          value={item[key] === null ? '' : String(item[key])}
                          onChange={e => setModalItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: e.target.value } : it))}
                          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>ราคาสุทธิ (บาท)</label>
              <input type="number" step="0.01" value={modal.data.price ?? ''} onChange={e => set('price', e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>หมายเหตุ</label>
              <textarea value={modal.data.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={!!modal.data.is_urgent} onChange={e => set('is_urgent', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#22c55e' }} />
                ✅ งานเสร็จ
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={!!modal.data.is_installation} onChange={e => set('is_installation', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                🔨 งานติดตั้ง
              </label>
            </div>

            {modal.data.is_installation && (
              <div style={{ marginBottom: 14, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>วันที่ติดตั้ง</label>
                <input type="date" lang="en-GB" value={modal.data.installation_date ?? ''} onChange={e => set('installation_date', e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
            </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Items modal */}
      {itemsModal && (
        <div onClick={() => { setItemsModal(null); setItemsModalError('') }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px' }}>

            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>รายการสินค้า</h3>

            {/* AI Paste zone */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6, fontWeight: 500 }}>วางข้อความรายการสินค้า — AI จะแปลงให้อัตโนมัติ</label>
              <textarea
                value={itemsModalPasteText}
                onChange={e => { setItemsModalPasteText(e.target.value); setItemsModalError('') }}
                rows={4}
                placeholder={'ตัวอย่าง:\nม่านจีบ CC-101 ขาวนวล กว้าง 2.5 สูง 2.2 จำนวน 1 ชุด\nม่านโปร่ง BB-202 ครีม 1.8x2.0 2 ชุด'}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}
              />
              {itemsModalError && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{itemsModalError}</div>
              )}
              <button
                onClick={handleParseItems}
                disabled={!itemsModalPasteText.trim() || itemsModalLoading}
                style={{ marginTop: 8, padding: '7px 18px', borderRadius: 7, border: 'none', background: itemsModalLoading || !itemsModalPasteText.trim() ? 'var(--border)' : 'var(--blue)', color: itemsModalLoading || !itemsModalPasteText.trim() ? 'var(--ink-3)' : '#fff', fontSize: 13, fontWeight: 600, cursor: itemsModalLoading || !itemsModalPasteText.trim() ? 'default' : 'pointer' }}>
                {itemsModalLoading ? 'กำลังแปลง…' : '✦ แปลงรายการ'}
              </button>
            </div>

            {/* Editable table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border)' }}>
                    {['#', 'ประเภท', 'ชั้น', 'หัวราง', 'รหัสสี', 'ชื่อสี', 'กว้าง (ม.)', 'สูง (ม.)', 'จำนวน', 'หน่วย', 'กระดูม', 'หมายเหตุ', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemsModal.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--ink-4)', fontWeight: 500, width: 28 }}>{idx + 1}</td>
                      {([
                        ['type', 'text', 100],
                        ['floors', 'number', 44],
                        ['rail_head', 'text', 64],
                        ['color_code', 'text', 60],
                        ['color_name', 'text', 90],
                        ['width', 'number', 56],
                        ['height', 'number', 56],
                        ['quantity', 'number', 50],
                        ['unit', 'text', 46],
                        ['hooks', 'text', 60],
                        ['note', 'text', 90],
                      ] as [keyof Item, string, number][]).map(([key, type, w]) => (
                        <td key={key} style={{ padding: '4px 6px' }}>
                          <input
                            type={type}
                            step={type === 'number' ? '0.01' : undefined}
                            value={item[key] === null ? '' : String(item[key])}
                            onChange={e => {
                              const val = key === 'floors'
                                ? (e.target.value === '' ? null : Number(e.target.value))
                                : e.target.value
                              setItemsModal(m => m ? { ...m, items: m.items.map((it, i) => i === idx ? { ...it, [key]: val } : it) } : null)
                            }}
                            style={{ width: w, border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '4px 8px' }}>
                        <button onClick={() => setItemsModal(m => m ? { ...m, items: m.items.filter((_, i) => i !== idx) } : null)}
                          style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                  {itemsModal.items.length === 0 && (
                    <tr>
                      <td colSpan={13} style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
                        ยังไม่มีรายการ — วางข้อความด้านบนแล้วกดแปลง หรือกดเพิ่มแถว
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={() => setItemsModal(m => m ? { ...m, items: [...m.items, emptyItem()] } : null)}
              style={{ fontSize: 12, padding: '4px 12px', border: '1px solid var(--blue)', borderRadius: 6, color: 'var(--blue)', background: 'var(--blue-bg)', cursor: 'pointer', marginBottom: 16 }}>
              + เพิ่มแถว
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setItemsModal(null); setItemsModalError('') }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>
                ยกเลิก
              </button>
              <button onClick={async () => {
                const newItems = itemsModal.items.length > 0 ? itemsModal.items : null
                const now = new Date().toISOString()
                const { error: err } = await supabase.from('order_entries').update({ items: newItems, updated_at: now }).eq('id', itemsModal.id)
                if (!err) {
                  setRows(prev => prev.map(r => r.id === itemsModal.id ? { ...r, items: newItems, updated_at: now } as Entry : r))
                  setItemsModal(null)
                  setItemsModalError('')
                }
              }}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
