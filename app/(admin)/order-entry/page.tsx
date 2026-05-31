'use client'

import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

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
  is_dropoff: boolean
  installation_date: string
  notes: string
  price: number | null
  payment_status: string
  deposit: number | null
  order_assigned: string
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
  const result = Math.ceil(diff / 86400000)
  return isNaN(result) ? null : result
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
  is_dropoff: false,
  installation_date: '',
  notes: '',
  price: null,
  payment_status: 'ยังไม่ชำระ',
  deposit: null,
  order_assigned: 'รออัพเดท',
})

const STATUS_COLOR: Record<string, string> = {
  'อยู่ในกำหนด': '#34c759',
  'งานเสร็จแล้ว': 'var(--blue)',
}

const PROD_STATUSES = ['รอดำเนินการ', 'กำลังตัด', 'กำลังเย็บ', 'กำลังรีด', 'กำลังแพ็ค', 'รอจัดส่ง', 'จัดส่งแล้ว']
const INSTALL_STATUSES = ['รอดำเนินการ', 'กำลังตัด', 'กำลังเย็บ', 'กำลังรีด', 'กำลังแพ็ค', 'รอติดตั้ง']
const PROD_STATUS_COLOR: Record<string, string> = {
  'รอดำเนินการ': '#f59e0b',
  'กำลังตัด': '#10b981',
  'กำลังเย็บ': '#3b82f6',
  'กำลังรีด': '#8b5cf6',
  'กำลังแพ็ค': '#ef4444',
  'งานเสร็จ': '#22c55e',
  'รอจัดส่ง': '#6366f1',
  'จัดส่งแล้ว': '#22c55e',
  'รอติดตั้ง': '#f97316',
}

const OUTSIDE_PLATFORMS = [
  'Facebook','LineOA','Tiktok-Chat','Shopee-Chat','หน้าร้าน',
  'Lineส่วนตัวยุน','Lineส่วนตัวเฟิร์น','Lineส่วนตัวสู้',
  'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:LineOA','เคลม:หน้าร้าน',
  'เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวเฟิร์น','เคลม:Lineส่วนตัวสู้',
]
const OUTSIDE_STATUSES = ['รอดำเนินการ', 'เสร็จสิ้น', 'รอยอดปลายทาง', 'ยกเลิก']
const OUTSIDE_STATUS_COLOR: Record<string, string> = {
  'รอดำเนินการ': '#f59e0b',
  'เสร็จสิ้น': '#22c55e',
  'รอยอดปลายทาง': '#3b82f6',
  'ยกเลิก': '#ef4444',
}
const PAYMENT_STATUSES = ['ยังไม่ชำระ', 'มัดจำ', 'มัดจำ50%', 'ชำระครบ']
const PAYMENT_STATUS_COLOR: Record<string, string> = {
  'ยังไม่ชำระ': '#f59e0b',
  'มัดจำ': '#8b5cf6',
  'มัดจำ50%': '#3b82f6',
  'ชำระครบ': '#22c55e',
}
const ORDER_ASSIGNED = ['รออัพเดท', 'แจ้งลงหน้าร้าน', 'พี่ฟอง', 'ช่างเชียงใหม่']

export default function OrderEntryPage() {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const modalDownOnBackdrop = useRef(false)
  const tableCardRef = useRef<HTMLDivElement>(null)
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
  const [openFilter, setOpenFilter] = useState<'platform' | 'courier' | 'status' | 'admin' | 'tech' | 'shipping' | 'urgent' | 'install' | 'days' | 'updated' | 'out-days' | 'out-deadline' | 'out-platform' | 'out-payment' | 'out-assigned' | 'out-status' | 'out-done' | 'out-installed' | 'out-updated' | null>(null)
  const [daysSort, setDaysSort] = useState<'asc' | 'desc' | null>('asc')
  const [sortOrder, setSortOrder] = useState<string[]>([])
  const [updatedSort, setUpdatedSort] = useState<'asc' | 'desc' | null>(null)
  const [outDaysSort, setOutDaysSort] = useState<'asc' | 'desc' | null>('asc')
  const [outUpdatedSort, setOutUpdatedSort] = useState<'asc' | 'desc' | null>(null)
  const [outDeadlineFrom, setOutDeadlineFrom] = useState('')
  const [outDeadlineTo, setOutDeadlineTo] = useState('')
  const [outPlatformFilters, setOutPlatformFilters] = useState<string[]>([])
  const [outPaymentFilters, setOutPaymentFilters] = useState<string[]>([])
  const [outAssignedFilters, setOutAssignedFilters] = useState<string[]>([])
  const [outStatusFilters, setOutStatusFilters] = useState<string[]>([])
  const [outDoneFilter, setOutDoneFilter] = useState<boolean | null>(null)
  const [outInstalledFilter, setOutInstalledFilter] = useState<boolean | null>(null)
  const [outFilterPos, setOutFilterPos] = useState<{top: number; left: number} | null>(null)
  const [rowPlatformDropdown, setRowPlatformDropdown] = useState<{id: string; pos: {top: number; left: number}} | null>(null)
  const [modalTab, setModalTab] = useState<'form' | 'paste' | 'file'>('form')
  const [fileDragOver, setFileDragOver] = useState(false)
  const [fileParseError, setFileParseError] = useState('')
  const [pasteCol1, setPasteCol1] = useState('')
  const [pasteCol2, setPasteCol2] = useState('')
  const [pasteCol3, setPasteCol3] = useState('')
  const [pasteCol4, setPasteCol4] = useState('')
  const [pasteCol5, setPasteCol5] = useState('')
  const [pasteCol6, setPasteCol6] = useState('')
  const [pasteCol7, setPasteCol7] = useState('')
  const [pasteCol8, setPasteCol8] = useState('')
  const [pasteRows, setPasteRows] = useState<{ paymentDate: string; deadline: string; orderNumber: string; price: number; customerName: string; courier: string; orderStatus: string; isDuplicate: boolean; isDropoff: boolean }[]>([])
  const [pasteSaving, setPasteSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalItems, setModalItems] = useState<Item[]>([])
  const [itemsModal, setItemsModal] = useState<{ id: string; items: Item[] } | null>(null)
  const [itemsPasteText, setItemsPasteText] = useState('')
  const [itemsModalPasteText, setItemsModalPasteText] = useState('')
  const [itemsModalLoading, setItemsModalLoading] = useState(false)
  const [itemsModalError, setItemsModalError] = useState('')
  const [openAction, setOpenAction] = useState<string | null>(null)
  const [actionRect, setActionRect] = useState<DOMRect | null>(null)
  const [editCell, setEditCell] = useState<{id: string; field: string; val: string} | null>(null)
  const [printModal, setPrintModal] = useState(false)
  const [printMaxDays, setPrintMaxDays] = useState(3)
  const [quickFilter, setQuickFilter] = useState<'all' | 'platform' | 'outside' | 'install'>('all')
  const [addTypeModal, setAddTypeModal] = useState(false)
  const [incompleteFilter, setIncompleteFilter] = useState(false)
  const [allDaysSort, setAllDaysSort] = useState<'asc' | 'desc' | null>('asc')
  const [allUpdatedSort, setAllUpdatedSort] = useState<'asc' | 'desc' | null>(null)
  const [allDeadlineFrom, setAllDeadlineFrom] = useState('')
  const [allDeadlineTo, setAllDeadlineTo] = useState('')
  const [allPlatformFilters, setAllPlatformFilters] = useState<string[]>([])
  const [allStatusFilters, setAllStatusFilters] = useState<string[]>([])
  const [allDoneFilter, setAllDoneFilter] = useState<boolean | null>(null)
  const [allCourierFilters, setAllCourierFilters] = useState<string[]>([])
  const [openAllFilter, setOpenAllFilter] = useState<'days'|'deadline'|'platform'|'courier'|'status'|'done'|'updated'|null>(null)
  const [addType, setAddType] = useState<'platform' | 'outside' | 'install' | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formParseLoading, setFormParseLoading] = useState(false)
  const [formParseError, setFormParseError] = useState('')

  const computeSortOrder = (rs: Entry[], sort: 'asc' | 'desc' | null): string[] => {
    if (!sort) return rs.map(r => r.id)
    const parseD = (s: string | null | undefined) => {
      if (!s || s === '-') return null
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (m) {
        const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
        return isNaN(d.getTime()) ? null : d
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s)
        return isNaN(d.getTime()) ? null : d
      }
      return null
    }
    return [...rs].sort((a, b) => {
      if (a.is_urgent && b.is_urgent) return 0
      if (a.is_urgent) return 1
      if (b.is_urgent) return -1
      const aShipping = (a.is_dropoff && a.shipping_datetime) ? shiftShippingDatetime(a.shipping_datetime, 2) : a.shipping_datetime
      const bShipping = (b.is_dropoff && b.shipping_datetime) ? shiftShippingDatetime(b.shipping_datetime, 2) : b.shipping_datetime
      const da = parseD(aShipping), db = parseD(bShipping)
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
      payment_status: d.payment_status || 'ยังไม่ชำระ',
      deposit: d.deposit ? Number(d.deposit) : null,
      order_assigned: d.order_assigned || 'รออัพเดท',
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
    setAddType(null)
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
    const row = rows.find(r => r.id === id)
    const now = new Date().toISOString()
    const updates = checked
      ? { is_urgent: true, order_status: row?.is_installation ? 'รอติดตั้ง' : 'รอจัดส่ง', updated_at: now }
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
    const allSelected = activeDisplayed.every(r => selectedIds.has(r.id))
    if (allSelected) {
      setSelectedIds(prev => { const s = new Set(prev); activeDisplayed.forEach(r => s.delete(r.id)); return s })
    } else {
      setSelectedIds(prev => { const s = new Set(prev); activeDisplayed.forEach(r => s.add(r.id)); return s })
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

  function computePasteRowsFromCols(c1: string, c2: string, c3: string, c4: string, c5: string, c6: string, c7: string, c8: string) {
    const split = (s: string) => s.trimEnd().split('\n').map(x => x.trim())
    const orderNums = split(c1); const customers = split(c2); const payDates = split(c3); const couriers = split(c4)
    const deadlines = split(c5); const prices = split(c6); const statuses = split(c7); const dropoffs = split(c8)
    const existingNums = new Set(rows.map(r => r.order_number).filter(Boolean))
    const len = Math.max(orderNums.length, customers.length, payDates.length, couriers.length, deadlines.length, prices.length, statuses.length, dropoffs.length)
    const map = new Map<string, { paymentDate: string; deadline: string; orderNumber: string; price: number; customerName: string; courier: string; orderStatus: string; isDuplicate: boolean; isDropoff: boolean }>()
    for (let i = 0; i < len; i++) {
      const orderNumber = orderNums[i] ?? ''
      const price = parseFloat((prices[i] ?? '0').replace(/,/g, '')) || 0
      if (!orderNumber) continue
      if (map.has(orderNumber)) { map.get(orderNumber)!.price += price }
      else {
        const isDropoff = !!(dropoffs[i] ?? '').trim()
        map.set(orderNumber, { paymentDate: payDates[i] ?? '', deadline: deadlines[i] ?? '', orderNumber, price, customerName: customers[i] ?? '', courier: normalizeCourier(couriers[i] ?? ''), orderStatus: statuses[i] ?? '', isDuplicate: existingNums.has(orderNumber), isDropoff })
      }
    }
    setPasteRows(Array.from(map.values()))
  }

  function parsePasteData() {
    computePasteRowsFromCols(pasteCol1, pasteCol2, pasteCol3, pasteCol4, pasteCol5, pasteCol6, pasteCol7, pasteCol8)
  }

  const XLSX_COL_MAP: Record<string, number> = {
    'หมายเลขคำสั่งซื้อ': 0,      // col1 = เลขออเดอร์
    'ชื่อผู้ใช้ (ผู้ซื้อ)': 1,    // col2 = ชื่อลูกค้า
    'เวลาการชำระสินค้า': 2,       // col3 = วันชำระ
    'ตัวเลือกการจัดส่ง': 3,       // col4 = courier
    'วันที่คาดว่าจะทำการจัดส่งสินค้า': 4, // col5 = วันต้องส่ง
    'ราคาขายสุทธิ': 5,            // col6 = ราคา
    'สถานะการสั่งซื้อ': 6,        // col7 = สถานะ
    'วิธีการจัดส่ง': 7,           // col8 = Drop-off
  }

  function processRawRows(rawRows: string[][]) {
    if (rawRows.length === 0) { setFileParseError('ไฟล์ว่างเปล่า'); return }
    const headers = rawRows[0].map(h => h.toString().trim())
    const isNamedHeader = headers.some(h => Object.keys(XLSX_COL_MAP).includes(h))

    let cols: string[]
    if (isNamedHeader) {
      const colIdx = new Array(8).fill(-1)
      headers.forEach((h, i) => { if (XLSX_COL_MAP[h] !== undefined) colIdx[XLSX_COL_MAP[h]] = i })
      const data = rawRows.slice(1).filter(r => r.some(c => c.toString().trim()))
      if (data.length === 0) { setFileParseError('ไม่พบข้อมูล'); return }
      cols = colIdx.map(ci => data.map(r => ci >= 0 ? (r[ci] ?? '').toString().trim() : '').join('\n'))
    } else {
      const hasHeader = headers.some(c => isNaN(parseFloat(c.replace(/,/g, ''))) && c.length > 0 && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(c))
      const data = (hasHeader ? rawRows.slice(1) : rawRows).filter(r => r.some(c => c.toString().trim()))
      if (data.length === 0) { setFileParseError('ไม่พบข้อมูล'); return }
      cols = [0,1,2,3,4,5,6,7].map(i => data.map(r => (r[i] ?? '').toString().trim()).join('\n'))
    }

    const [c1,c2,c3,c4,c5,c6,c7,c8] = cols
    setPasteCol1(c1); setPasteCol2(c2); setPasteCol3(c3); setPasteCol4(c4)
    setPasteCol5(c5); setPasteCol6(c6); setPasteCol7(c7); setPasteCol8(c8)
    computePasteRowsFromCols(c1, c2, c3, c4, c5, c6, c7, c8)
    setModalTab('paste')
  }

  function processFileBuffer(buf: ArrayBuffer, filename: string) {
    setFileParseError('')
    try {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]
      processRawRows(rawRows)
    } catch {
      setFileParseError('อ่านไฟล์ไม่ได้: ' + filename)
    }
  }

  function processFileText(text: string, filename: string) {
    setFileParseError('')
    try {
      const firstLine = text.split('\n')[0] ?? ''
      const sep = firstLine.includes('\t') ? '\t' : ','
      const rawRows = text.trim().split('\n').map(row => {
        const cells: string[] = []; let inQ = false; let cur = ''
        for (const ch of row) {
          if (ch === '"') { inQ = !inQ; continue }
          if (ch === sep && !inQ) { cells.push(cur.trim()); cur = ''; continue }
          cur += ch
        }
        cells.push(cur.trim())
        return cells
      })
      processRawRows(rawRows)
    } catch {
      setFileParseError('อ่านไฟล์ไม่ได้: ' + filename)
    }
  }

  function handleFile(file: File) {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm')
    if (isExcel) {
      const reader = new FileReader()
      reader.onload = ev => processFileBuffer(ev.target?.result as ArrayBuffer, file.name)
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = ev => processFileText(ev.target?.result as string, file.name)
      reader.readAsText(file, 'utf-8')
    }
  }

  function isPasteRowSaveable(r: { orderStatus: string; isDuplicate: boolean }): boolean {
    if (r.isDuplicate) return false
    const s = r.orderStatus.trim()
    if (!s) return true
    return s.includes('ต้องจัดส่ง') || s.includes('จัดส่งแล้ว')
  }

  async function savePasteRows() {
    setPasteSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const resetCols = () => { setPasteRows([]); setPasteCol1(''); setPasteCol2(''); setPasteCol3(''); setPasteCol4(''); setPasteCol5(''); setPasteCol6(''); setPasteCol7(''); setPasteCol8('') }

    const newRows = pasteRows.filter(isPasteRowSaveable)
    const dropoffUpdateRows = pasteRows.filter(r => {
      if (!r.isDuplicate || !r.isDropoff) return false
      const existing = rows.find(row => row.order_number === r.orderNumber)
      return existing && !existing.is_dropoff
    })

    const insertPayload = newRows.map(r => ({
      entry_date: (r.paymentDate && r.paymentDate !== '-') ? (toIsoDate(r.paymentDate) || today) : null,
      deadline: toIsoDate(r.deadline) || null,
      shipping_datetime: (toIsoDate(r.deadline) && r.courier) ? calcShipping(toIsoDate(r.deadline)!, r.courier) : null,
      status: 'อยู่ในกำหนด',
      order_number: r.orderNumber || null,
      notes: null,
      price: r.price || null,
      order_status: 'รอดำเนินการ',
      is_urgent: false,
      is_installation: false,
      is_dropoff: r.isDropoff,
      admin_name: null, technician: null,
      customer_name: r.customerName || null,
      courier: r.courier || null,
      shipping_date: null, platform: 'Shopee', items: null, installation_date: null,
    }))

    let updatedIds: string[] = []
    for (const r of dropoffUpdateRows) {
      const existing = rows.find(row => row.order_number === r.orderNumber)
      if (!existing) continue
      const now = new Date().toISOString()
      const { error: err } = await supabase.from('order_entries').update({ is_dropoff: true, updated_at: now }).eq('id', existing.id)
      if (!err) updatedIds.push(existing.id)
    }

    if (insertPayload.length === 0 && updatedIds.length === 0) {
      setPasteSaving(false)
      setModal(null)
      resetCols()
      return
    }

    let insertedRows: Entry[] = []
    if (insertPayload.length > 0) {
      const res = await supabase.from('order_entries').insert(insertPayload).select()
      if (res.error) { setPasteSaving(false); setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      insertedRows = res.data as Entry[]
    }

    setPasteSaving(false)
    setRows(prev => [
      ...insertedRows,
      ...prev.map(r => updatedIds.includes(r.id) ? { ...r, is_dropoff: true } : r),
    ])
    setModal(null)
    resetCols()
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
    const p = r.platform ?? ''
    const matchQuick = quickFilter === 'all' ? true
      : quickFilter === 'platform' ? (p === 'Shopee' || p === 'Tiktok' || p === 'Lazada' || p === 'เคลม:Shopee' || p === 'เคลม:Tiktok' || p === 'เคลม:Lazada')
      : quickFilter === 'outside' ? (OUTSIDE_PLATFORMS.includes(p) && !r.is_installation)
      : r.is_installation === true
    const matchIncomplete = !incompleteFilter || (!r.items || r.items.length === 0 || !r.deadline || r.price == null || !r.customer_name || (OUTSIDE_PLATFORMS.includes(r.platform ?? '') && (!r.order_assigned || r.order_assigned === 'รออัพเดท')) || ((OUTSIDE_PLATFORMS.includes(r.platform ?? '') || r.is_installation) && (!r.payment_status || r.payment_status === 'ยังไม่ชำระ')))
    return matchSearch && matchStatus && matchPlatform && matchCourier && matchAdmin && matchTech && matchUrgent && matchInstall && matchShipping && matchQuick && matchIncomplete
  })

  if (updatedSort) {
    displayed.sort((a, b) => {
      const da = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const db = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return updatedSort === 'desc' ? db - da : da - db
    })
  } else if (daysSort && sortOrder.length > 0) {
    const orderMap = new Map(sortOrder.map((id, i) => [id, i]))
    displayed.sort((a, b) => (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999))
  }

  const displayedOut = (() => {
    let rs = displayed
    if (outPlatformFilters.length) rs = rs.filter(r => outPlatformFilters.includes(r.platform ?? ''))
    if (outPaymentFilters.length) rs = rs.filter(r => outPaymentFilters.includes(r.payment_status || 'ยังไม่ชำระ'))
    if (outAssignedFilters.length) rs = rs.filter(r => outAssignedFilters.includes(r.order_assigned || 'รออัพเดท'))
    if (outStatusFilters.length) rs = rs.filter(r => outStatusFilters.includes(r.order_status ?? ''))
    if (outDoneFilter !== null) rs = rs.filter(r => !!r.is_urgent === outDoneFilter)
    if (outInstalledFilter !== null) rs = rs.filter(r => !!r.is_dropoff === outInstalledFilter)
    if (outDeadlineFrom || outDeadlineTo) rs = rs.filter(r => {
      if (!r.deadline) return false
      const d = new Date(r.deadline)
      if (outDeadlineFrom && d < new Date(outDeadlineFrom)) return false
      if (outDeadlineTo && d > new Date(outDeadlineTo + 'T23:59:59')) return false
      return true
    })
    if (outUpdatedSort) {
      rs = [...rs].sort((a, b) => {
        const da = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const db = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return outUpdatedSort === 'desc' ? db - da : da - db
      })
    } else if (outDaysSort) {
      rs = [...rs].sort((a, b) => {
        const da = a.deadline ? new Date(a.deadline).getTime() : (outDaysSort === 'asc' ? Infinity : -Infinity)
        const db = b.deadline ? new Date(b.deadline).getTime() : (outDaysSort === 'asc' ? Infinity : -Infinity)
        return outDaysSort === 'asc' ? da - db : db - da
      })
    }
    return rs
  })()

  const displayedAll = (() => {
    let rs = displayed
    if (allPlatformFilters.length) rs = rs.filter(r => allPlatformFilters.includes(r.platform ?? ''))
    if (allCourierFilters.length) rs = rs.filter(r => r.is_installation ? allCourierFilters.includes('งานติดตั้ง') : allCourierFilters.includes(r.courier ?? ''))
    if (allStatusFilters.length) rs = rs.filter(r => allStatusFilters.includes(r.order_status ?? ''))
    if (allDoneFilter !== null) rs = rs.filter(r => !!r.is_urgent === allDoneFilter)
    if (allDeadlineFrom || allDeadlineTo) rs = rs.filter(r => {
      const d = r.deadline ? new Date(r.deadline) : null
      if (!d) return false
      if (allDeadlineFrom && d < new Date(allDeadlineFrom)) return false
      if (allDeadlineTo && d > new Date(allDeadlineTo + 'T23:59:59')) return false
      return true
    })
    if (allUpdatedSort) {
      rs = [...rs].sort((a, b) => {
        const da = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const db = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return allUpdatedSort === 'desc' ? db - da : da - db
      })
    } else if (allDaysSort) {
      rs = [...rs].sort((a, b) => {
        const getMs = (r: Entry) => {
          const isOut = OUTSIDE_PLATFORMS.includes(r.platform ?? '') || r.is_installation
          if (isOut) return r.deadline ? new Date(r.deadline).getTime() : null
          const eff = (r.is_dropoff && r.shipping_datetime) ? shiftShippingDatetime(r.shipping_datetime, 2) : r.shipping_datetime
          if (!eff || eff === '-') return null
          const m = eff.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
          return m ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime() : null
        }
        const da = getMs(a), db = getMs(b)
        if (da === null && db === null) return 0
        if (da === null) return 1
        if (db === null) return -1
        return allDaysSort === 'asc' ? da - db : db - da
      })
    }
    return rs
  })()

  const activeDisplayed = quickFilter === 'all' ? displayedAll
    : (quickFilter === 'outside' || quickFilter === 'install') ? displayedOut
    : displayed

  useEffect(() => {
    if (selectAllRef.current) {
      const some = activeDisplayed.some(r => selectedIds.has(r.id))
      const all = activeDisplayed.length > 0 && activeDisplayed.every(r => selectedIds.has(r.id))
      selectAllRef.current.indeterminate = some && !all
    }
  })

  const handleFormParseItems = async () => {
    if (!itemsPasteText.trim()) return
    setFormParseLoading(true)
    setFormParseError('')
    try {
      const res = await fetch('/api/parse-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: itemsPasteText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'แปลงไม่สำเร็จ')
      setModalItems(data.items)
    } catch (e: unknown) {
      setFormParseError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setFormParseLoading(false)
    }
  }

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
    } catch (e: unknown) {
      setItemsModalError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setItemsModalLoading(false)
    }
  }

  const saveTextCell = async (id: string, field: string, val: string) => {
    const now = new Date().toISOString()
    const { error: err } = await supabase.from('order_entries').update({ [field]: val || null, updated_at: now }).eq('id', id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val || null, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
    }
    setEditCell(null)
  }

  const handlePaymentStatus = async (r: Entry, val: string) => {
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { payment_status: val, updated_at: now }
    if (val === 'มัดจำ50%' && r.price) updates.deposit = r.price / 2
    else if (val === 'มัดจำ') updates.deposit = null
    const { error: err } = await supabase.from('order_entries').update(updates).eq('id', r.id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(row => row.id === r.id ? { ...row, ...updates, updated_at: now } as Entry : row)))
      window.scrollTo(window.scrollX, sy)
    }
  }

  const saveNumericCell = async (id: string, field: string, val: string) => {
    const num = val === '' ? null : parseFloat(val)
    const now = new Date().toISOString()
    const { error: err } = await supabase.from('order_entries').update({ [field]: num, updated_at: now }).eq('id', id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: num, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
    }
    setEditCell(null)
  }

  function getPrintRows(maxDays: number) {
    return rows.filter(r => {
      if (r.is_urgent) return false
      const es = (r.is_dropoff && r.shipping_datetime) ? shiftShippingDatetime(r.shipping_datetime, 2) : r.shipping_datetime
      const d = es ? daysRemaining(es) : null
      return d !== null && d < maxDays
    }).sort((a, b) => {
      const parseD = (r: Entry) => {
        const es = (r.is_dropoff && r.shipping_datetime) ? shiftShippingDatetime(r.shipping_datetime, 2) : r.shipping_datetime
        if (!es || es === '-') return null
        const m = es.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        return m ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])) : null
      }
      const da = parseD(a), db = parseD(b)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da.getTime() - db.getTime()
    })
  }

  function openPrintWindow(toPrint: Entry[], title: string) {
    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ปริ้นออเดอร์</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 12px; color: #000; margin: 0; padding: 16px; }
  h2 { font-size: 14px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #aaa; padding: 5px 8px; text-align: left; vertical-align: middle; }
  th { background: #f0f0f0; font-weight: 700; white-space: nowrap; }
  .dr { color: #c00; font-weight: 700; }
  .do { color: #b05000; font-weight: 700; }
  .dg { color: #006000; font-weight: 700; }
  @media print { body { padding: 6px; } }
</style>
</head>
<body>
<h2>${title} (${toPrint.length} รายการ)</h2>
<table>
<thead><tr>
  <th>#</th><th>วันที่เหลือ</th><th>ต้องจัดส่งภายใน</th><th>เลขคำสั่งซื้อ</th><th>ลูกค้า</th><th>ช่างที่รับผิดชอบ</th><th>แพลตฟอร์ม</th><th>สถานะงาน</th><th>บริษัทขนส่ง</th>
</tr></thead>
<tbody>
${toPrint.map((r, i) => {
  const es = (r.is_dropoff && r.shipping_datetime) ? shiftShippingDatetime(r.shipping_datetime, 2) : r.shipping_datetime
  const d = es ? daysRemaining(es) : null
  const cls = d !== null ? (d < 0 ? 'dr' : d <= 2 ? 'do' : 'dg') : ''
  const dtext = d !== null ? (d < 0 ? `เกิน ${Math.abs(d)} วัน` : `${d} วัน`) : '-'
  return `<tr><td>${i + 1}</td><td class="${cls}">${dtext}</td><td>${es || '-'}</td><td>${r.order_number || '-'}</td><td>${r.customer_name || '-'}</td><td>${r.technician || '-'}</td><td>${r.platform || '-'}</td><td>${r.order_status || '-'}</td><td>${r.courier || '-'}</td></tr>`
}).join('\n')}
</tbody>
</table>
</body>
</html>`
    const win = window.open('', '_blank', 'width=1200,height=750')
    if (win) { win.document.write(html); win.document.close(); win.focus(); win.print() }
  }

  function doPrint() {
    const toPrint = getPrintRows(printMaxDays)
    openPrintWindow(toPrint, `ออเดอร์ที่ต้องส่งใน ${printMaxDays} วัน — ${new Date().toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    setPrintModal(false)
  }

  const inp = (label: string, key: string, type = 'text') => {
    const rawVal = String(modal?.data[key as keyof typeof modal.data] ?? '')
    const displayVal = type === 'date'
      ? rawVal.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')
      : rawVal
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>{label}</label>
        {type === 'date' ? (
          <div style={{ position: 'relative' }}>
            <input
              type="date"
              value={/^\d{4}-\d{2}-\d{2}$/.test(rawVal) ? rawVal : ''}
              onChange={e => { if (e.target.value) set(key, e.target.value) }}
              onMouseDown={e => { e.preventDefault(); try { (e.target as HTMLInputElement).showPicker() } catch {} }}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: displayVal ? 'transparent' : 'var(--ink-3)' }}
            />
            {displayVal && (
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingLeft: 12, fontSize: 13, color: 'var(--ink)', pointerEvents: 'none' }}>
                {displayVal}
              </div>
            )}
          </div>
        ) : (
          <input type="text" value={rawVal} onChange={e => set(key, e.target.value)}
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        )}
      </div>
    )
  }

  const sel = (label: string, key: string, options: string[]) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>{label}</label>
      <select value={String(modal?.data[key as keyof typeof modal.data] ?? '')} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
        <option value="">— เลือก —</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )

  const openOutFilter = (e: React.MouseEvent, key: typeof openFilter) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cardR = tableCardRef.current?.getBoundingClientRect()
    if (openFilter === key) { setOpenFilter(null); setOutFilterPos(null) }
    else { setOpenFilter(key); setOutFilterPos(cardR ? { top: r.bottom - cardR.top, left: r.left - cardR.left } : { top: r.bottom, left: r.left }) }
  }

  return (
    <div>
      {(openFilter || openAction || rowPlatformDropdown || openAllFilter) && <div onClick={() => { setOpenFilter(null); setOutFilterPos(null); setOpenAction(null); setActionRect(null); setRowPlatformDropdown(null); setOpenAllFilter(null) }} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />}
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
          <button onClick={() => {
              if (selectedIds.size > 0) {
                openPrintWindow(rows.filter(r => selectedIds.has(r.id)), `ออเดอร์ที่เลือก ${selectedIds.size} รายการ — ${new Date().toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' })}`)
              } else { setPrintModal(true) }
            }}
            style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            🖨️ ปริ้น{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
          <button onClick={() => setAddTypeModal(true)}
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

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อลูกค้า / เลขคำสั่งซื้อ…"
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', paddingRight: search ? 36 : 14, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'var(--border)', color: 'var(--ink-3)', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {([['all', 'ทั้งหมด'], ['platform', 'งานแพลตฟอร์ม'], ['outside', 'งานนอก'], ['install', 'งานติดตั้ง']] as [typeof quickFilter, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setQuickFilter(val)}
            style={{ padding: '6px 16px', borderRadius: 20, border: quickFilter === val ? 'none' : '1px solid var(--border)', background: quickFilter === val ? 'var(--blue)' : 'var(--surface)', color: quickFilter === val ? '#fff' : 'var(--ink-3)', fontSize: 13, fontWeight: quickFilter === val ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        {(() => {
          const incompleteCount = rows.filter(r => {
            const p = r.platform ?? ''
            const matchQ = quickFilter === 'all' ? true
              : quickFilter === 'platform' ? (p === 'Shopee' || p === 'Tiktok' || p === 'Lazada' || p === 'เคลม:Shopee' || p === 'เคลม:Tiktok' || p === 'เคลม:Lazada')
              : quickFilter === 'outside' ? (OUTSIDE_PLATFORMS.includes(p) && !r.is_installation)
              : r.is_installation === true
            return matchQ && (!r.items || r.items.length === 0 || !r.deadline || r.price == null || !r.customer_name || (OUTSIDE_PLATFORMS.includes(r.platform ?? '') && (!r.order_assigned || r.order_assigned === 'รออัพเดท')) || ((OUTSIDE_PLATFORMS.includes(r.platform ?? '') || r.is_installation) && (!r.payment_status || r.payment_status === 'ยังไม่ชำระ')))
          }).length
          if (incompleteCount === 0) return null
          return (
            <button onClick={() => setIncompleteFilter(f => !f)}
              style={{ padding: '6px 14px', borderRadius: 20, border: incompleteFilter ? 'none' : '1px solid var(--border)', background: incompleteFilter ? '#ef4444' : 'var(--surface)', color: incompleteFilter ? '#fff' : '#ef4444', fontSize: 13, fontWeight: incompleteFilter ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              ข้อมูลไม่ครบ
              <span style={{ background: incompleteFilter ? 'rgba(255,255,255,0.3)' : '#ef444422', color: incompleteFilter ? '#fff' : '#ef4444', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                {incompleteCount}
              </span>
            </button>
          )
        })()}
      </div>

      <div ref={tableCardRef} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', position: 'relative' }}>
        {outFilterPos && openFilter && (() => {
          const dropStyle = { position: 'absolute' as const, top: outFilterPos.top + 4, left: outFilterPos.left, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0' }
          if (openFilter === 'out-days') return (
            <div style={{ ...dropStyle, minWidth: 140 }}>
              {([['น้อยไปมาก', 'asc'], ['มากไปน้อย', 'desc']] as [string, 'asc'|'desc'][]).map(([label, val]) => (
                <div key={label} onClick={() => { setOutDaysSort(val); setOutUpdatedSort(null); setOpenFilter(null); setOutFilterPos(null) }}
                  style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: outDaysSort === val ? 600 : 400, color: outDaysSort === val ? 'var(--blue)' : 'var(--ink)', background: outDaysSort === val ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
                  {label}
                </div>
              ))}
            </div>
          )
          if (openFilter === 'out-deadline') return (
            <div style={{ ...dropStyle, padding: '12px 14px', minWidth: 220 }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ตั้งแต่</label>
                <input type="date" lang="en-GB" value={outDeadlineFrom} onChange={e => setOutDeadlineFrom(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ถึงวันที่</label>
                <input type="date" lang="en-GB" value={outDeadlineTo} onChange={e => setOutDeadlineTo(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {(outDeadlineFrom || outDeadlineTo) && (
                <button onClick={() => { setOutDeadlineFrom(''); setOutDeadlineTo('') }} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>ล้าง</button>
              )}
            </div>
          )
          if (openFilter === 'out-platform') return (
            <div style={{ ...dropStyle, minWidth: 180, maxHeight: 260, overflowY: 'auto' }}>
              {OUTSIDE_PLATFORMS.map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: outPlatformFilters.includes(p) ? 'var(--blue-bg)' : 'transparent' }}>
                  <input type="checkbox" checked={outPlatformFilters.includes(p)} onChange={() => setOutPlatformFilters(toggleArr(outPlatformFilters, p))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                  {p}
                </label>
              ))}
            </div>
          )
          if (openFilter === 'out-payment') return (
            <div style={{ ...dropStyle, minWidth: 150 }}>
              {PAYMENT_STATUSES.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: outPaymentFilters.includes(s) ? 'var(--blue-bg)' : 'transparent' }}>
                  <input type="checkbox" checked={outPaymentFilters.includes(s)} onChange={() => setOutPaymentFilters(toggleArr(outPaymentFilters, s))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                  <span style={{ fontWeight: 600, color: PAYMENT_STATUS_COLOR[s] }}>{s}</span>
                </label>
              ))}
            </div>
          )
          if (openFilter === 'out-assigned') return (
            <div style={{ ...dropStyle, minWidth: 160 }}>
              {ORDER_ASSIGNED.map(o => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: outAssignedFilters.includes(o) ? 'var(--blue-bg)' : 'transparent' }}>
                  <input type="checkbox" checked={outAssignedFilters.includes(o)} onChange={() => setOutAssignedFilters(toggleArr(outAssignedFilters, o))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                  {o}
                </label>
              ))}
            </div>
          )
          if (openFilter === 'out-status') return (
            <div style={{ ...dropStyle, minWidth: 150 }}>
              {PROD_STATUSES.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: outStatusFilters.includes(s) ? 'var(--blue-bg)' : 'transparent' }}>
                  <input type="checkbox" checked={outStatusFilters.includes(s)} onChange={() => setOutStatusFilters(toggleArr(outStatusFilters, s))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PROD_STATUS_COLOR[s], flexShrink: 0, display: 'inline-block' }} />
                  {s}
                </label>
              ))}
            </div>
          )
          if (openFilter === 'out-done') return (
            <div style={{ ...dropStyle, minWidth: 150 }}>
              {([['ทั้งหมด', null], ['งานเสร็จเท่านั้น', true], ['ยังไม่เสร็จ', false]] as [string, boolean|null][]).map(([label, val]) => (
                <button key={String(label)} onClick={() => { setOutDoneFilter(val); setOpenFilter(null); setOutFilterPos(null) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: outDoneFilter === val ? 'var(--blue-bg)' : 'transparent', color: outDoneFilter === val ? 'var(--blue)' : 'var(--ink)', fontWeight: outDoneFilter === val ? 600 : 400 }}>
                  {label}
                </button>
              ))}
            </div>
          )
          if (openFilter === 'out-installed') return (
            <div style={{ ...dropStyle, minWidth: 150 }}>
              {([['ทั้งหมด', null], ['ติดตั้งแล้ว', true], ['ยังไม่ติดตั้ง', false]] as [string, boolean|null][]).map(([label, val]) => (
                <button key={String(label)} onClick={() => { setOutInstalledFilter(val); setOpenFilter(null); setOutFilterPos(null) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: outInstalledFilter === val ? 'var(--blue-bg)' : 'transparent', color: outInstalledFilter === val ? 'var(--blue)' : 'var(--ink)', fontWeight: outInstalledFilter === val ? 600 : 400 }}>
                  {label}
                </button>
              ))}
            </div>
          )
          if (openFilter === 'out-updated') return (
            <div style={{ ...dropStyle, minWidth: 160 }}>
              {([['ใหม่สุด-เก่าสุด', 'desc'], ['เก่าสุด-ใหม่สุด', 'asc']] as [string, 'asc'|'desc'][]).map(([label, val]) => (
                <div key={label} onClick={() => { setOutUpdatedSort(val); setOutDaysSort(null); setOpenFilter(null); setOutFilterPos(null) }}
                  style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: outUpdatedSort === val ? 600 : 400, color: outUpdatedSort === val ? 'var(--blue)' : 'var(--ink)', background: outUpdatedSort === val ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
                  {label}
                </div>
              ))}
            </div>
          )
          return null
        })()}
        {rowPlatformDropdown && (
          <div style={{ position: 'absolute', top: rowPlatformDropdown.pos.top + 4, left: rowPlatformDropdown.pos.left, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 160, maxHeight: 260, overflowY: 'auto', padding: '6px 0' }}>
            {OUTSIDE_PLATFORMS.map(p => (
              <div key={p} onClick={() => { updateField(rowPlatformDropdown.id, 'platform', p); setRowPlatformDropdown(null) }}
                style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--blue-bg)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                {p}
              </div>
            ))}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>ยังไม่มีรายการ
          </div>
        ) : (quickFilter === 'outside' || quickFilter === 'install') ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input type="checkbox" ref={selectAllRef}
                    checked={activeDisplayed.length > 0 && activeDisplayed.every(r => selectedIds.has(r.id))}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-days')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outDaysSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    วันที่เหลือ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-deadline')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: (outDeadlineFrom || outDeadlineTo) ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {quickFilter === 'install' ? 'วันที่ติดตั้ง' : 'ต้องส่งภายใน'} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-platform')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outPlatformFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แพลตฟอร์ม{outPlatformFilters.length > 0 && ` (${outPlatformFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>รายการ</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ยอดทั้งหมด</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-payment')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outPaymentFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ชำระ{outPaymentFilters.length > 0 && ` (${outPaymentFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{quickFilter === 'install' ? 'ยอดชำระหลังติดตั้ง' : 'ยอดชำระก่อนจัดส่ง'}</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-assigned')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outAssignedFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ลงออเดอร์{outAssignedFilters.length > 0 && ` (${outAssignedFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-status')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outStatusFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    สถานะงาน{outStatusFilters.length > 0 && ` (${outStatusFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-done')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outDoneFilter !== null ? '#22c55e' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    งานเสร็จ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                {quickFilter === 'install' && (
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <button onClick={e => openOutFilter(e, 'out-installed')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outInstalledFilter !== null ? '#22c55e' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      ติดตั้ง <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                  </th>
                )}
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>วันที่สร้าง</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-updated')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outUpdatedSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แก้ไขล่าสุด <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                <th style={{ padding: '10px 14px' }} />
              </tr>
            </thead>
            <tbody>
              {displayedOut.map(r => {
                const isEditing = (f: string) => editCell?.id === r.id && editCell.field === f
                const numCell = (field: 'price' | 'deposit') => {
                  const val = r[field]
                  return isEditing(field) ? (
                    <input type="number" autoFocus value={editCell!.val}
                      onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                      onBlur={() => saveNumericCell(r.id, field, editCell!.val)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: 90, outline: 'none', textAlign: 'right', padding: '2px 0' }} />
                  ) : (
                    <div onClick={() => setEditCell({ id: r.id, field, val: String(val ?? '') })}
                      style={{ cursor: 'text', textAlign: 'right', color: val != null ? 'var(--ink)' : 'var(--ink-4)', fontWeight: val != null ? 600 : 400 }}>
                      {val != null ? Number(val).toLocaleString('th-TH') : '—'}
                    </div>
                  )
                }
                const textCell = (field: 'customer_name' | 'notes', placeholder = '—') => {
                  const val = r[field] ?? ''
                  return isEditing(field) ? (
                    <input type="text" autoFocus value={editCell!.val}
                      onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                      onBlur={() => saveTextCell(r.id, field, editCell!.val)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', minWidth: 100, outline: 'none', padding: '2px 0' }} />
                  ) : (
                    <div onClick={() => setEditCell({ id: r.id, field, val })}
                      style={{ cursor: 'text', color: val ? 'var(--ink)' : 'var(--ink-4)', maxWidth: field === 'notes' ? 160 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {val || placeholder}
                    </div>
                  )
                }
                const dateCell = (field: 'entry_date' | 'deadline') => {
                  const val = r[field] ?? ''
                  const display = val ? new Date(val).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
                  return isEditing(field) ? (
                    <input type="date" autoFocus value={editCell!.val}
                      onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                      onBlur={() => saveTextCell(r.id, field, editCell!.val)}
                      style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, outline: 'none', padding: '2px 0' }} />
                  ) : (
                    <div onClick={() => setEditCell({ id: r.id, field, val })}
                      style={{ cursor: 'text', whiteSpace: 'nowrap', color: field === 'deadline' ? (val ? '#bf5af2' : 'var(--ink-4)') : (val ? 'var(--ink-3)' : 'var(--ink-4)') }}>
                      {display}
                    </div>
                  )
                }
                const autoDeposit = r.payment_status === 'มัดจำ50%' && r.price ? r.price / 2 : null
                const outDays = r.deadline ? daysRemaining(r.deadline) : null
                const isDone = r.order_status === 'เสร็จสิ้น'
                const isCancelled = r.order_status === 'ยกเลิก'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                    </td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {isCancelled ? (
                        <span style={{ fontWeight: 700, color: '#ef4444' }}>ยกเลิก</span>
                      ) : r.is_urgent ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จ</span>
                      ) : isDone ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>เสร็จสิ้น</span>
                      ) : outDays !== null ? (
                        <span style={{ fontWeight: 700, color: outDays < 0 ? 'var(--red)' : outDays <= 2 ? '#ff9f0a' : '#34c759' }}>
                          {outDays < 0 ? `เกิน ${Math.abs(outDays)}` : outDays} วัน
                        </span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      {isCancelled ? <span style={{ color: 'var(--ink-4)' }}>-</span>
                        : r.order_status === 'จัดส่งแล้ว' ? <span style={{ fontWeight: 700, color: '#22c55e' }}>จัดส่งแล้ว</span>
                        : (quickFilter === 'install' && r.is_dropoff) ? <span style={{ fontWeight: 700, color: '#22c55e' }}>ติดตั้งแล้ว</span>
                        : dateCell('deadline')}
                    </td>
                    <td style={{ padding: '8px 14px', minWidth: 100 }}>{textCell('customer_name')}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <button onClick={e => {
                        const cardR = tableCardRef.current?.getBoundingClientRect()
                        const btnR = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        const pos = { top: btnR.bottom - (cardR?.top ?? 0), left: btnR.left - (cardR?.left ?? 0) }
                        setRowPlatformDropdown(d => d?.id === r.id ? null : { id: r.id, pos })
                      }} style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.platform ? 'var(--ink-3)' : 'var(--ink-4)', padding: 0, maxWidth: 140, textAlign: 'left' }}>
                        {r.platform || '—'}
                      </button>
                    </td>
                    <td style={{ padding: '6px 14px', maxWidth: 200 }}>
                      <button onClick={() => { setItemsModal({ id: r.id, items: Array.isArray(r.items) ? r.items : [] }); setItemsModalPasteText('') }}
                        style={{ border: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', padding: 0, color: r.items?.length ? 'var(--ink)' : 'var(--ink-4)', textAlign: 'left', display: 'block', width: '100%' }}>
                        {r.items?.length ? (
                          <div>
                            {formatItemLines(r.items).map((line, i) => (
                              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190, lineHeight: '1.6', color: i === 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{line}</div>
                            ))}
                          </div>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </button>
                    </td>
                    <td style={{ padding: '8px 14px' }}>{numCell('price')}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.payment_status || 'ยังไม่ชำระ'} onChange={e => handlePaymentStatus(r, e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: PAYMENT_STATUS_COLOR[r.payment_status] ?? '#f59e0b', padding: 0 }}>
                        {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      {(r.payment_status === 'ชำระครบ' || !r.payment_status || r.payment_status === 'ยังไม่ชำระ') ? (
                        <div style={{ textAlign: 'right', color: 'var(--ink-4)' }}>-</div>
                      ) : autoDeposit != null ? (
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>{autoDeposit.toLocaleString('th-TH')}</div>
                      ) : numCell('deposit')}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.order_assigned || 'รออัพเดท'} onChange={e => updateField(r.id, 'order_assigned', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.order_assigned && r.order_assigned !== 'รออัพเดท' ? 'var(--ink)' : 'var(--ink-4)', fontWeight: r.order_assigned && r.order_assigned !== 'รออัพเดท' ? 600 : 400, padding: 0 }}>
                        {ORDER_ASSIGNED.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.order_status || ''} onChange={e => updateField(r.id, 'order_status', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: PROD_STATUS_COLOR[r.order_status] ?? 'var(--ink-4)', padding: 0 }}>
                        <option value="">—</option>
                        {(r.is_installation ? INSTALL_STATUSES : PROD_STATUSES).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.is_urgent} onChange={e => toggleDone(r.id, e.target.checked)}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                    </td>
                    {quickFilter === 'install' && (
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input type="checkbox" checked={!!r.is_dropoff} onChange={e => updateField(r.id, 'is_dropoff', e.target.checked)}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                      </td>
                    )}
                    <td style={{ padding: '8px 14px' }}>{dateCell('entry_date')}</td>
                    <td style={{ padding: '8px 14px', minWidth: 120 }}>{textCell('notes', '—')}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <button onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (openAction === r.id) { setOpenAction(null); setActionRect(null) } else { setOpenAction(r.id); setActionRect(rect) } }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openAction === r.id ? 'var(--bg)' : '#fff', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1 }}>
                        ···
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : quickFilter === 'all' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input type="checkbox" ref={selectAllRef}
                    checked={activeDisplayed.length > 0 && activeDisplayed.every(r => selectedIds.has(r.id))}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenAllFilter(openAllFilter === 'days' ? null : 'days')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: allDaysSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    วันที่เหลือ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openAllFilter === 'days' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 140 }}>
                      {([['น้อยไปมาก', 'asc'], ['มากไปน้อย', 'desc']] as [string, 'asc'|'desc'][]).map(([label, val]) => (
                        <div key={val} onClick={() => { setAllDaysSort(val); setAllUpdatedSort(null); setOpenAllFilter(null) }}
                          style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: allDaysSort === val ? 600 : 400, color: allDaysSort === val ? 'var(--blue)' : 'var(--ink)', background: allDaysSort === val ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenAllFilter(openAllFilter === 'deadline' ? null : 'deadline')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: (allDeadlineFrom || allDeadlineTo) ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ต้องส่งภายใน <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openAllFilter === 'deadline' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '12px 14px', minWidth: 220 }}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ตั้งแต่</label>
                        <input type="date" value={allDeadlineFrom} onChange={e => setAllDeadlineFrom(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ถึงวันที่</label>
                        <input type="date" value={allDeadlineTo} onChange={e => setAllDeadlineTo(e.target.value)} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
                      </div>
                      {(allDeadlineFrom || allDeadlineTo) && (
                        <button onClick={() => { setAllDeadlineFrom(''); setAllDeadlineTo('') }} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>ล้าง</button>
                      )}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenAllFilter(openAllFilter === 'platform' ? null : 'platform')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: allPlatformFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แพลตฟอร์ม{allPlatformFilters.length > 0 && ` (${allPlatformFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openAllFilter === 'platform' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 180, maxHeight: 280, overflowY: 'auto', padding: '6px 0' }}>
                      {PLATFORMS.concat(OUTSIDE_PLATFORMS.filter(p => !PLATFORMS.includes(p))).map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: allPlatformFilters.includes(p) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={allPlatformFilters.includes(p)} onChange={() => setAllPlatformFilters(toggleArr(allPlatformFilters, p))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          {p}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenAllFilter(openAllFilter === 'courier' ? null : 'courier')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: allCourierFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    บริษัทจัดส่ง{allCourierFilters.length > 0 && ` (${allCourierFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openAllFilter === 'courier' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 200, maxHeight: 260, overflowY: 'auto', padding: '6px 0' }}>
                      {['งานติดตั้ง', ...new Set(rows.map(r => r.courier).filter(Boolean))].map(c => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: allCourierFilters.includes(c!) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={allCourierFilters.includes(c!)} onChange={() => setAllCourierFilters(toggleArr(allCourierFilters, c!))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          {c === 'งานติดตั้ง' ? <span style={{ color: '#f97316', fontWeight: 600 }}>งานติดตั้ง</span> : c}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenAllFilter(openAllFilter === 'status' ? null : 'status')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: allStatusFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    สถานะงาน{allStatusFilters.length > 0 && ` (${allStatusFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openAllFilter === 'status' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 160, padding: '6px 0' }}>
                      {[...PROD_STATUSES, ...INSTALL_STATUSES.filter(s => !PROD_STATUSES.includes(s))].map(s => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: allStatusFilters.includes(s) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={allStatusFilters.includes(s)} onChange={() => setAllStatusFilters(toggleArr(allStatusFilters, s))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PROD_STATUS_COLOR[s] ?? '#ccc', flexShrink: 0, display: 'inline-block' }} />
                          {s}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenAllFilter(openAllFilter === 'done' ? null : 'done')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: allDoneFilter !== null ? '#22c55e' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    งานเสร็จ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openAllFilter === 'done' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 150, padding: '6px 0' }}>
                      {([['ทั้งหมด', null], ['งานเสร็จเท่านั้น', true], ['ยังไม่เสร็จ', false]] as [string, boolean|null][]).map(([label, val]) => (
                        <button key={String(label)} onClick={() => { setAllDoneFilter(val); setOpenAllFilter(null) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: allDoneFilter === val ? 'var(--blue-bg)' : 'transparent', color: allDoneFilter === val ? 'var(--blue)' : 'var(--ink)', fontWeight: allDoneFilter === val ? 600 : 400 }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenAllFilter(openAllFilter === 'updated' ? null : 'updated')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: allUpdatedSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แก้ไขล่าสุด <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openAllFilter === 'updated' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 160 }}>
                      {([['ใหม่สุด-เก่าสุด', 'desc'], ['เก่าสุด-ใหม่สุด', 'asc']] as [string, 'asc'|'desc'][]).map(([label, val]) => (
                        <div key={val} onClick={() => { setAllUpdatedSort(val); setAllDaysSort(null); setOpenAllFilter(null) }}
                          style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: allUpdatedSort === val ? 600 : 400, color: allUpdatedSort === val ? 'var(--blue)' : 'var(--ink)', background: allUpdatedSort === val ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ padding: '10px 14px' }} />
              </tr>
            </thead>
            <tbody>
              {displayedAll.map(r => {
                const isOutsideRow = OUTSIDE_PLATFORMS.includes(r.platform ?? '') || r.is_installation
                const allEffective = isOutsideRow
                  ? r.deadline
                  : (r.is_dropoff && r.shipping_datetime) ? shiftShippingDatetime(r.shipping_datetime, 2) : r.shipping_datetime
                const allDays = allEffective ? daysRemaining(allEffective) : null
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {r.order_status === 'จัดส่งแล้ว' ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จแล้ว</span>
                      ) : r.is_urgent ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จ</span>
                      ) : allDays !== null ? (
                        <span style={{ fontWeight: 700, color: allDays < 0 ? 'var(--red)' : allDays <= 2 ? '#ff9f0a' : '#34c759' }}>
                          {allDays < 0 ? `เกิน ${Math.abs(allDays)}` : allDays} วัน
                        </span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 500, color: '#bf5af2' }}>
                      {!isOutsideRow ? (
                        r.order_status === 'จัดส่งแล้ว' ? <span style={{ color: '#22c55e', fontWeight: 700 }}>จัดส่งแล้ว</span>
                        : allEffective ? allEffective : <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>
                      ) : (
                        r.order_status === 'จัดส่งแล้ว' ? <span style={{ color: '#22c55e', fontWeight: 700 }}>จัดส่งแล้ว</span>
                        : r.deadline ? new Date(r.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>{r.customer_name || '-'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{r.platform || '-'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {r.is_installation ? <span style={{ color: '#f97316', fontWeight: 600 }}>งานติดตั้ง</span> : r.courier || <span style={{ color: 'var(--ink-4)' }}>-</span>}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.order_status || ''} onChange={e => updateField(r.id, 'order_status', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: PROD_STATUS_COLOR[r.order_status] ?? 'var(--ink-4)', padding: 0 }}>
                        <option value="">—</option>
                        {PROD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.is_urgent} onChange={e => toggleDone(r.id, e.target.checked)}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                    </td>
                    <td style={{ padding: '8px 14px', maxWidth: 200 }}>
                      {editCell?.id === r.id && editCell.field === 'notes' ? (
                        <input type="text" autoFocus value={editCell.val}
                          onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                          onBlur={() => saveTextCell(r.id, 'notes', editCell.val)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', outline: 'none', padding: '2px 0' }} />
                      ) : (
                        <div onClick={() => setEditCell({ id: r.id, field: 'notes', val: r.notes ?? '' })}
                          style={{ cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.notes ? 'var(--ink-3)' : 'var(--ink-4)', minWidth: 60 }}>
                          {r.notes || '—'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <button onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (openAction === r.id) { setOpenAction(null); setActionRect(null) } else { setOpenAction(r.id); setActionRect(rect) } }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openAction === r.id ? 'var(--bg)' : '#fff', cursor: 'pointer', fontSize: 16, color: copiedId === r.id ? '#34c759' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1, transition: 'color 0.2s' }}>
                        {copiedId === r.id ? '✓' : '···'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input type="checkbox"
                    ref={selectAllRef}
                    checked={activeDisplayed.length > 0 && activeDisplayed.every(r => selectedIds.has(r.id))}
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
                      {([['น้อยไปมาก', 'asc'], ['มากไปน้อย', 'desc']] as [string, 'asc' | 'desc'][]).map(([label, val]) => (
                        <div key={label} onClick={() => { setSortOrder(computeSortOrder(rows, val)); setDaysSort(val); setUpdatedSort(null); setOpenFilter(null) }}
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
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>Drop-off</th>
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
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'updated' ? null : 'updated')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: updatedSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    เวลาที่แก้ไข <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'updated' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 150 }}>
                      {([['ใหม่สุด-เก่าสุด', 'desc'], ['เก่าสุด-ใหม่สุด', 'asc']] as [string, 'asc' | 'desc'][]).map(([label, val]) => (
                        <div key={label} onClick={() => { setUpdatedSort(val); setDaysSort(null); setOpenFilter(null) }}
                          style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: updatedSort === val ? 600 : 400, color: updatedSort === val ? 'var(--blue)' : 'var(--ink)', background: updatedSort === val ? 'rgba(196,126,58,0.08)' : 'transparent' }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{ padding: '10px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => {
                const effectiveShipping = (r.is_dropoff && r.shipping_datetime) ? shiftShippingDatetime(r.shipping_datetime, 2) : r.shipping_datetime
                const days = effectiveShipping ? daysRemaining(effectiveShipping) : null
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {r.order_status === 'จัดส่งแล้ว' ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จแล้ว</span>
                      ) : r.is_urgent ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จ</span>
                      ) : days !== null ? (
                        <span style={{ fontWeight: 700, color: days < 0 ? 'var(--red)' : days <= 2 ? '#ff9f0a' : '#34c759' }}>
                          {days < 0 ? `เกิน ${Math.abs(days)}` : days} วัน
                        </span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 500, color: '#bf5af2' }}>
                      {r.order_status === 'จัดส่งแล้ว' ? (
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>จัดส่งแล้ว</span>
                      ) : effectiveShipping ? effectiveShipping : <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>}
                    </td>
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
                      {r.entry_date ? new Date(r.entry_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span style={{ color: '#f59e0b', fontWeight: 500 }}>ยังไม่ชำระ</span>}
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
                      <select value={r.order_status || ''} onChange={e => updateField(r.id, 'order_status', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: PROD_STATUS_COLOR[r.order_status] ?? 'var(--ink-4)', padding: 0, maxWidth: 100 }}>
                        <option value="">—</option>
                        {PROD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.is_dropoff} onChange={e => updateField(r.id, 'is_dropoff', e.target.checked)}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#6366f1' }} />
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.is_urgent} onChange={e => toggleDone(r.id, e.target.checked)}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                    </td>
                    <td style={{ padding: '8px 14px', maxWidth: 200 }}>
                      {editCell?.id === r.id && editCell.field === 'notes' ? (
                        <input type="text" autoFocus value={editCell.val}
                          onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                          onBlur={() => saveTextCell(r.id, 'notes', editCell.val)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', outline: 'none', padding: '2px 0' }} />
                      ) : (
                        <div onClick={() => setEditCell({ id: r.id, field: 'notes', val: r.notes ?? '' })}
                          style={{ cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.notes ? 'var(--ink-3)' : 'var(--ink-4)', minWidth: 60 }}>
                          {r.notes || '—'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <button onClick={e => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (openAction === r.id) { setOpenAction(null); setActionRect(null) } else { setOpenAction(r.id); setActionRect(rect) } }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: openAction === r.id ? 'var(--bg)' : '#fff', cursor: 'pointer', fontSize: 16, color: copiedId === r.id ? '#34c759' : 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1, transition: 'color 0.2s' }}>
                        {copiedId === r.id ? '✓' : '···'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* Global action dropdown */}
      {openAction && actionRect && (() => {
        const r = rows.find(row => row.id === openAction)
        if (!r) return null
        return (
          <div style={{ position: 'fixed', top: actionRect.bottom + 2, right: window.innerWidth - actionRect.right, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 9999, minWidth: 130, padding: '4px 0' }}>
            <button onClick={() => copyOrderText(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: copiedId === r.id ? '#34c759' : 'var(--ink)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              {copiedId === r.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </button>
            <button onClick={() => { setOpenAction(null); setActionRect(null); openPrintWindow([r], `ออเดอร์ ${r.customer_name || r.order_number || ''} — ${new Date().toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' })}`) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/></svg>
              ปริ้น
            </button>
            <button onClick={() => { setOpenAction(null); setActionRect(null); setModal({ mode: 'edit', data: { ...r, items: null } }); setModalItems(Array.isArray(r.items) ? [...(r.items as Item[])] : []); setItemsPasteText('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
              แก้ไข
            </button>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button onClick={() => { setOpenAction(null); setActionRect(null); del(r.id) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--red)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
              ลบ
            </button>
          </div>
        )
      })()}

      {/* Modal form */}
      {modal && (
        <div
          onMouseDown={e => { modalDownOnBackdrop.current = e.target === e.currentTarget }}
          onClick={e => { if (e.target === e.currentTarget && modalDownOnBackdrop.current) setModal(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Tabs (add) / Title (edit) */}
            {modal.mode === 'edit' ? (
              <div style={{ padding: '24px 32px 0' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>แก้ไขออเดอร์</h2>
              </div>
            ) : (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {(['form', ...(addType === 'platform' ? ['paste', 'file'] : [])] as ('form'|'paste'|'file')[]).map(t => (
                  <button key={t} onClick={() => { setModalTab(t); setPasteRows([]); setFileParseError('') }}
                    style={{ flex: 1, padding: '16px 0', fontSize: 14, fontWeight: modalTab === t ? 600 : 400, border: 'none', borderBottom: modalTab === t ? '2px solid var(--blue)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', color: modalTab === t ? 'var(--blue)' : 'var(--ink-3)', transition: 'all 0.15s' }}>
                    {t === 'form' ? 'กรอกฟอร์ม' : t === 'paste' ? 'วาง Copy' : 'Drop ไฟล์'}
                  </button>
                ))}
              </div>
            )}

            <div style={{ padding: '24px 32px 32px' }}>

            {/* ---- File drop tab ---- */}
            {modal.mode === 'add' && modalTab === 'file' && (
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setFileDragOver(true) }}
                  onDragLeave={() => setFileDragOver(false)}
                  onDrop={e => {
                    e.preventDefault(); setFileDragOver(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleFile(file)
                  }}
                  style={{ border: `2px dashed ${fileDragOver ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 12, padding: '48px 24px', textAlign: 'center', background: fileDragOver ? 'var(--blue-bg)' : 'var(--bg)', transition: 'all 0.15s', marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>วางไฟล์ที่นี่</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>รองรับ .xlsx, .csv, .txt</div>
                  <label style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink)' }}>
                    เลือกไฟล์
                    <input type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt,.tsv" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleFile(file)
                      e.target.value = ''
                    }} />
                  </label>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                  <strong>ลำดับคอลัมน์ที่รองรับ:</strong> เลขออเดอร์ · ชื่อลูกค้า · วันชำระ · บริษัทขนส่ง · วันต้องส่ง · ราคา · สถานะ · Drop-off
                </div>
                {fileParseError && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{fileParseError}</div>}
              </div>
            )}

            {/* ---- Paste tab ---- */}
            {modal.mode === 'add' && modalTab === 'paste' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {([
                    ['เลขออเดอร์ลูกค้า', pasteCol1, setPasteCol1],
                    ['สถานะการสั่งซื้อ', pasteCol7, setPasteCol7],
                    ['ชื่อลูกค้า', pasteCol2, setPasteCol2],
                    ['เวลาชำระสินค้า', pasteCol3, setPasteCol3],
                    ['ตัวเลือกการจัดส่ง', pasteCol4, setPasteCol4],
                    ['วันที่คาดว่าจะจัดส่ง', pasteCol5, setPasteCol5],
                    ['ราคาสุทธิ', pasteCol6, setPasteCol6],
                    ['Drop-off', pasteCol8, setPasteCol8],
                  ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                    <div key={label}>
                      <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>{label}</label>
                      <textarea value={val} onChange={e => { setter(e.target.value); setPasteRows([]) }} rows={8}
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
                    {(() => {
                      const saveCount = pasteRows.filter(isPasteRowSaveable).length
                      const dropoffCount = pasteRows.filter(r => r.isDuplicate && r.isDropoff && !rows.find(row => row.order_number === r.orderNumber)?.is_dropoff).length
                      const skipCount = pasteRows.length - saveCount - dropoffCount
                      return (
                        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                          พบ {pasteRows.length} ออเดอร์ — บันทึกใหม่ <strong style={{ color: 'var(--ink)' }}>{saveCount}</strong>{dropoffCount > 0 && <> · อัพเดท Drop-off <strong style={{ color: '#6366f1' }}>{dropoffCount}</strong></>}{skipCount > 0 && <> · ข้าม <strong style={{ color: 'var(--red)' }}>{skipCount}</strong></>} รายการ
                        </p>
                      )
                    })()}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                            {['สถานะ', 'วันชำระ', 'วันต้องส่ง', 'เลขออเดอร์', 'ราคาสุทธิ', 'ชื่อลูกค้า', 'การจัดส่ง'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pasteRows.map((r, i) => {
                            const isCancelled = r.orderStatus.includes('ยกเลิก')
                            const saveable = isPasteRowSaveable(r)
                            const isDropoffUpdate = r.isDuplicate && r.isDropoff && !rows.find(row => row.order_number === r.orderNumber)?.is_dropoff
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: (saveable || isDropoffUpdate) ? 1 : 0.55 }}>
                                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                                  {isDropoffUpdate ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', background: '#ede9fe', borderRadius: 4, padding: '2px 6px' }}>อัพเดท Drop-off</span>
                                  ) : r.isDuplicate ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: '#fef3c7', borderRadius: 4, padding: '2px 6px' }}>มีออเดอร์นี้แล้ว</span>
                                  ) : isCancelled ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', background: '#fee2e2', borderRadius: 4, padding: '2px 6px' }}>ยกเลิก</span>
                                  ) : r.orderStatus ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', background: '#dcfce7', borderRadius: 4, padding: '2px 6px' }}>{r.orderStatus}</span>
                                  ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                                </td>
                                <td style={{ padding: '7px 10px', color: (!r.paymentDate || r.paymentDate === '-') ? '#f59e0b' : undefined, fontWeight: (!r.paymentDate || r.paymentDate === '-') ? 500 : undefined }}>
                                  {(!r.paymentDate || r.paymentDate === '-') ? 'ยังไม่ชำระ' : r.paymentDate}
                                </td>
                                <td style={{ padding: '7px 10px' }}>{r.deadline || '-'}</td>
                                <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--blue)' }}>{r.orderNumber}</td>
                                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{r.price.toLocaleString()} บาท</td>
                                <td style={{ padding: '7px 10px' }}>{r.customerName || '-'}</td>
                                <td style={{ padding: '7px 10px', color: 'var(--ink-3)', fontSize: 11 }}>{r.courier || '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setModal(null)}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
                      <button onClick={savePasteRows} disabled={pasteSaving}
                        style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                        {pasteSaving ? 'กำลังบันทึก…' : (() => {
                          const n = pasteRows.filter(isPasteRowSaveable).length
                          const d = pasteRows.filter(r => r.isDuplicate && r.isDropoff && !rows.find(row => row.order_number === r.orderNumber)?.is_dropoff).length
                          if (n > 0 && d > 0) return `บันทึก ${n} ใหม่ · อัพเดท Drop-off ${d}`
                          if (d > 0) return `อัพเดท Drop-off ${d} ออเดอร์`
                          return `บันทึก ${n} รายการ`
                        })()}
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
            {(() => {
              const ft = modal.mode === 'add' ? addType
                : modal.data.is_installation ? 'install'
                : OUTSIDE_PLATFORMS.includes(modal.data.platform ?? '') ? 'outside' : 'platform'
              const isOutside = ft === 'outside' || ft === 'install'
              const isInstall = ft === 'install'
              return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {inp('ชื่อลูกค้าซื้อ', 'customer_name')}
              {sel('จากแพลตฟอร์ม', 'platform', isOutside ? OUTSIDE_PLATFORMS : PLATFORMS)}
              {!isOutside && inp('เลขคำสั่งซื้อ', 'order_number')}
              {inp('วันที่สร้าง', 'entry_date', 'date')}
              {inp(isInstall ? 'กำหนดติดตั้ง' : 'กำหนดส่งงาน', 'deadline', 'date')}
              {!isInstall && !isOutside && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>วันและเวลาที่ต้องส่ง</label>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: 'var(--bg)', color: '#bf5af2', fontWeight: 600 }}>
                    {modal.data.shipping_datetime || calcShipping(modal.data.deadline ?? '', modal.data.courier ?? '') || '— เลือกกำหนดส่ง + บริษัท'}
                  </div>
                </div>
              )}
              {sel('แอดมิน', 'admin_name', ADMINS)}
              {sel('ช่างที่รับผิดชอบ', 'technician', TECHS)}
              {!isInstall && sel('บริษัทจัดส่ง', 'courier', COURIERS)}
            </div>
              )
            })()}

            {/* ---- Items ---- */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>รายการสินค้า</label>
                <button type="button" onClick={() => setModalItems(prev => [...prev, emptyItem()])}
                  style={{ fontSize: 12, padding: '3px 10px', border: '1px solid var(--blue)', borderRadius: 6, color: 'var(--blue)', background: 'var(--blue-bg)', cursor: 'pointer' }}>
                  + เพิ่มรายการ
                </button>
              </div>
              <textarea
                value={itemsPasteText}
                onChange={e => { setItemsPasteText(e.target.value); setFormParseError('') }}
                rows={6}
                placeholder={"วางข้อความรายการสินค้า — กด ✦ แปลงรายการ ให้ AI แปลงให้อัตโนมัติ"}
                style={{ width: '100%', border: '1px dashed var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'monospace', background: 'var(--bg)', color: 'var(--ink)', marginBottom: 6 }}
              />
              {formParseError && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 6 }}>{formParseError}</div>
              )}
              <button
                type="button"
                onClick={handleFormParseItems}
                disabled={!itemsPasteText.trim() || formParseLoading}
                style={{ marginBottom: 8, padding: '6px 16px', borderRadius: 7, border: 'none', background: formParseLoading || !itemsPasteText.trim() ? 'var(--border)' : 'var(--blue)', color: formParseLoading || !itemsPasteText.trim() ? 'var(--ink-3)' : '#fff', fontSize: 12, fontWeight: 600, cursor: formParseLoading || !itemsPasteText.trim() ? 'default' : 'pointer' }}>
                {formParseLoading ? 'กำลังแปลง…' : '✦ แปลงรายการ'}
              </button>
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

            {(() => {
              const ft = modal.mode === 'add' ? addType
                : modal.data.is_installation ? 'install'
                : OUTSIDE_PLATFORMS.includes(modal.data.platform ?? '') ? 'outside' : 'platform'
              const isOutside = ft === 'outside' || ft === 'install'
              return isOutside ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>ยอดทั้งหมด (บาท)</label>
                    <input type="number" step="0.01" value={modal.data.price ?? ''} onChange={e => set('price', e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>ชำระ</label>
                    <select value={modal.data.payment_status || 'ยังไม่ชำระ'} onChange={e => set('payment_status', e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', fontWeight: 600, color: PAYMENT_STATUS_COLOR[modal.data.payment_status ?? ''] ?? '#f59e0b' }}>
                      {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {(modal.data.payment_status === 'มัดจำ' || modal.data.payment_status === 'มัดจำ50%') && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>ยอดชำระก่อนจัดส่ง (บาท)</label>
                      <input type="number" step="0.01"
                        value={modal.data.deposit ?? (modal.data.payment_status === 'มัดจำ50%' && modal.data.price ? Number(modal.data.price) / 2 : '')}
                        onChange={e => set('deposit', e.target.value)}
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>ราคาสุทธิ (บาท)</label>
                  <input type="number" step="0.01" value={modal.data.price ?? ''} onChange={e => set('price', e.target.value)}
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )
            })()}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>หมายเหตุ</label>
              <textarea value={modal.data.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setModal(null); setAddType(null) }}
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

      {/* Add type picker */}
      {addTypeModal && (
        <div onClick={() => setAddTypeModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 400, padding: '28px 32px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>เพิ่มรายการ</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>เลือกประเภทงาน</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                ['งานแพลตฟอร์ม', '🛍️', 'Shopee / Tiktok / Lazada', 'platform', {}],
                ['งานนอก', '💬', 'Facebook / Line / หน้าร้าน', 'outside', {}],
                ['งานติดตั้ง', '🔨', 'สั่งพร้อมติดตั้ง', 'install', { is_installation: true }],
              ] as [string, string, string, 'platform'|'outside'|'install', object][]).map(([label, icon, desc, type, extra]) => (
                <button key={label} onClick={() => {
                  setAddTypeModal(false)
                  setAddType(type)
                  setModalTab('form')
                  setModal({ mode: 'add', data: { ...emptyForm(), shipping_datetime: '', ...extra } })
                  setModalItems([])
                  setItemsPasteText('')
                }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setAddTypeModal(false)}
              style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--ink-3)' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Print modal */}
      {printModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 380, padding: '28px 32px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>ปริ้นออเดอร์</h3>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, display: 'block', marginBottom: 10 }}>วันที่เหลือน้อยกว่า</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" min={0} max={99} value={printMaxDays}
                  onChange={e => setPrintMaxDays(Number(e.target.value))}
                  style={{ width: 80, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 20, fontWeight: 700, outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>วัน</span>
              </div>
              {(() => {
                const count = getPrintRows(printMaxDays).length
                return <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 12 }}>พบ <strong style={{ color: 'var(--ink)' }}>{count}</strong> รายการ จากออเดอร์ทั้งหมด {rows.length} รายการ</p>
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPrintModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={doPrint}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>🖨️ ปริ้น</button>
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
                    {['#', 'ประเภท', 'ชั้น', 'หัวราง', 'รหัสสี', 'ชื่อสี', 'กว้าง (ม.)', 'สูง (ม.)', 'จำนวน', 'หน่วย', 'กระดูม', 'หมายเหตุ'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ padding: '8px 10px', position: 'sticky', right: 0, background: '#FAFAFA', zIndex: 1 }} />
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
                      <td style={{ padding: '4px 8px', position: 'sticky', right: 0, background: 'var(--surface)', boxShadow: '-2px 0 4px rgba(0,0,0,0.04)' }}>
                        <button onClick={() => setItemsModal(m => m ? { ...m, items: m.items.filter((_, i) => i !== idx) } : null)}
                          style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', whiteSpace: 'nowrap' }}>ลบ</button>
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
