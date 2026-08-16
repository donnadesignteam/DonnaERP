'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useInstallPhotos, photoSaveError, type InstallPhoto } from '@/components/InstallPhotos'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { HOLIDAYS } from '@/lib/holidays'
import { formatItemLines, autoTapeHooks, type RawItem } from '@/lib/itemFormat'
import { syncOutsourcePO } from '@/lib/outsourceSync'
import { recordAction } from '@/lib/history'
import { prevOf } from '@/lib/trackedDb'
import { useStableView } from '@/lib/useStableView'
import { oeUpdate, instUpdate, instInsert } from '@/lib/adminActor'
import { useConfirm } from '@/components/ConfirmDialog'
import { createOrderForInstall, orderPatchFromInstall } from '@/lib/installOrderSync'
import { formatOrderLines, linesToHtml, openFormPrintWindow, type PrintLine, type PrintableOrder } from '@/lib/orderPrint'
import QRCode from 'qrcode'
import { WORK_TYPES, WORK_TYPE_OPTIONS, normStatus, statusLabel, statusOptions, STATUS_COLOR, WORK_COLOR } from '@/lib/installMeta'


type Installation = {
  id: string
  serial_no: string
  appointment_datetime: string
  work_type: string
  platform: string
  customer_id: string
  customer_real_name: string
  province: string
  install_zone: string
  technician_type: string   // ช่างร้าน / ช่างนอก — โซนกทมเติม "ช่างนอก" ให้เอง
  phone: string
  work_details: string
  location_link: string
  price: number
  notes: string
  payment_status: string
  appointment_status: string
  production_status: string
  send_to_technician: string
  installation_status: string
  entered_by: string
  created_at: string
  updated_at: string
  source_order_id?: string | null   // ผูกกับ order_entries ถ้าแถวนี้ sync มาจากหมวดออเดอร์
  photos?: InstallPhoto[]           // รูปหน้างาน (ยังไม่ได้รัน migrations/add_installation_photos.sql = ไม่มีคอลัมน์นี้)
}

const PLATFORMS = ['Tiktok','Tiktok-Chat','Shopee','Shopee-Chat','Lazada','Facebook','LineOA',
  'Lineส่วนตัวยุน','Lineส่วนตัวสู้','Lineส่วนตัวเฟิร์น','Lineส่วนตัวน็อต','หน้าร้าน',
  'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:หน้าร้าน',
  'เคลม:LineOA','เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวสู้','เคลม:Lineส่วนตัวเฟิร์น','เคลม:Lineส่วนตัวน็อต']
const TIMES = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']
const ENTERED_BY = ['เก๋','หนูนา','สู้','ยุน']
const ZONES = ['เชียงราย','เชียงใหม่','กทม']
const TECHS = ['ช่างร้าน','ช่างนอก','ช่างกทม','ช่างบัวบาน']
// โซนที่รู้ชนิดช่างอยู่แล้ว → เติมให้อัตโนมัติ (เชียงราย/เชียงใหม่ เว้นไว้ให้เลือกเอง)
const TECH_BY_ZONE: Record<string, string> = { 'กทม': 'ช่างนอก' }

// สถานะตั้งต้นตามลักษณะงาน (ช่องสถานะถูกเอาออกจากฟอร์ม จึงกำหนดอัตโนมัติ)
const STATUS_BY_TYPE: Record<string, string> = {
  'งานติดตั้ง': 'รอนัดหมาย',
  'งานวัดหน้างาน': 'รอนัดหมาย',
  'งานแก้': 'รอแก้',
}
const INITIAL_STATUSES = ['ติดตั้ง', 'วัดหน้างาน', 'รอนัดหมาย', 'รอแก้']

const rowColor = (ins: { installation_status: string; work_type?: string }) => {
  const s = normStatus(ins.installation_status)
  if (s === 'รอนัดหมาย' || s === 'นัดหมายแล้ว') return WORK_COLOR[ins.work_type ?? ''] ?? '#8e8e93'
  return STATUS_COLOR[s] ?? 'var(--ink-3)'
}

const emptyItem = (): RawItem => ({ type: '', floors: null, rail_head: '', hook_type: '', eyelet_color: '', fabric_type: '', color_code: '', color_name: '', color_desc: '', width: '', height: '', quantity: 1, unit: 'ชุด', hooks: '', orientation: '', fabric_split: '', chemical: '', weight_chain: '', pull_side: '', note: '', outsource: '' })

// เติมกระดูมม่านลอนเทปที่ยังว่างให้อัตโนมัติ — ใช้ตอนเปิดโมดัล (ออเดอร์เก่าที่บันทึกกระดูมว่างไว้ก็โชว์ให้)
const withAutoHooks = (items: RawItem[]): RawItem[] =>
  items.map(it => (it.hooks ?? '').trim() ? it : { ...it, hooks: autoTapeHooks(it) })

// รวมข้อความสั่งนอกจากทุกรายการ → ไว้ลงคอลัมน์สั่งนอกของออเดอร์ต้นทาง
const itemsOutsourceText = (items: RawItem[]): string =>
  items.map(it => (it.outsource ?? '').trim()).filter(Boolean).join(', ')

const DAYS = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function pad(n: number) { return String(n).padStart(4, '0') }

function Calendar({ year, month, installs, onDayClick }: {
  year: number; month: number; installs: Installation[]; onDayClick: (day: number) => void
}) {
  const dim = new Date(year, month + 1, 0).getDate()
  const first = (new Date(year, month, 1).getDay() + 6) % 7
  const cellCount = Math.ceil((first + dim) / 7) * 7
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const d = i - first + 1
    return d > 0 && d <= dim ? d : null
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '6px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          const dayInstalls = day ? installs.filter(ins => {
            const dt = new Date(ins.appointment_datetime)
            return dt.getDate() === day && dt.getMonth() === month && dt.getFullYear() === year
          }) : []
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
          const holiday = day ? HOLIDAYS[`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`] : undefined
          const isSunday = day ? new Date(year, month, day).getDay() === 0 : false
          return (
            <div key={i} onClick={() => day && onDayClick(day)}
              style={{ minHeight: 90, background: day ? (holiday ? '#fff9e6' : isSunday ? '#f4f4f5' : '#fff') : 'transparent', borderRadius: 8, padding: '6px 8px', cursor: day ? 'pointer' : 'default', border: isToday ? '2px solid var(--blue)' : '1px solid rgba(0,0,0,0.06)', transition: 'background 0.1s' }}>
              {day && (
                <>
                  <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--blue)' : 'var(--ink)', marginBottom: 4 }}>{day}</div>
                  {isSunday && <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>ร้านปิด</div>}
                  {holiday && <div style={{ fontSize: 9, color: '#b45309', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{holiday}</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayInstalls.slice(0, 3).map(ins => {
                      const t = new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                      const bg = rowColor(ins)
                      return (
                        <div key={ins.id} style={{ background: bg + '22', borderLeft: `3px solid ${bg}`, borderRadius: 3, padding: '2px 5px', fontSize: 10, color: bg, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t} {ins.customer_real_name || ins.customer_id}
                        </div>
                      )
                    })}
                    {dayInstalls.length > 3 && <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>+{dayInstalls.length - 3}</div>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const emptyForm = (): Omit<Installation, 'id' | 'created_at' | 'updated_at' | 'serial_no'> => ({
  appointment_datetime: '', work_type: 'งานวัดหน้างาน', platform: '', customer_id: '',
  customer_real_name: '', province: '', install_zone: '', technician_type: '', phone: '', work_details: '', location_link: '',
  price: 0, notes: '', payment_status: 'รอมัดจำ', appointment_status: 'นัดหมายแล้ว',
  production_status: 'กำลังผลิต', send_to_technician: 'หน้าร้าน',
  installation_status: 'รอนัดหมาย', entered_by: '', photos: [],
})

export default function InstallationsPage() {
  // เปิดหน้าซ้ำ → โชว์ข้อมูลรอบก่อนทันที แล้ว load() ดึงของใหม่เบื้องหลัง (stale-while-revalidate)
  const cached = getPageCache<Installation[]>('installations')
  const [installs, setInstalls] = useState<Installation[]>(cached ?? [])
  // งานไม่หายจากปฏิทิน/รายการทันทีตอนเปลี่ยนสถานะ — กรองด้วย stable() แสดงผลด้วย live() (ดู lib/useStableView.ts)
  const { snapshot, stable, live } = useStableView<Installation>(installs)
  const [loading, setLoading] = useState(!cached)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<Installation> } | null>(null)
  const [dayModal, setDayModal] = useState<{ day: number; items: Installation[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('9:00')
  const [listFilter, setListFilter] = useState<'all' | string>('all')
  const [zoneFilter, setZoneFilter] = useState<string | null>(null)  // โซนติดตั้ง — ชิปชุดเดียวคุมทั้งปฏิทินและรายการด้านล่าง
  const [bonusZones, setBonusZones] = useState<string[]>([])      // filter ยอดติดตั้งตามโซน — เลือกพร้อมกันได้หลายโซน ([] = ทุกโซน)
  const [bonusTech, setBonusTech] = useState<string | null>(null)  // filter ยอดติดตั้งตามชนิดช่าง (null = ทุกช่าง)
  const [search, setSearch] = useState('')
  const [nameSugOpen, setNameSugOpen] = useState(false)   // เปิดรายการเดาชื่อลูกค้าในกล่องเพิ่มรายการ
  const [error, setError] = useState('')
  // กล่องยืนยันของเว็บเอง (ไม่ใช้ window.confirm — ดูเหตุผลใน components/ConfirmDialog.tsx)
  const { ask, confirmDialog } = useConfirm()
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [quoteDragOver, setQuoteDragOver] = useState(false)   // ลาก PDF ใบเสนอราคามาวางในกล่องเพิ่มรายการติดตั้ง
  const [parseError, setParseError] = useState('')
  const [actionMenu, setActionMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  const [editNote, setEditNote] = useState<{ id: string; value: string } | null>(null)
  const [editAppt, setEditAppt] = useState<{ id: string; date: string; time: string } | null>(null)
  // รายการสินค้าของออเดอร์ต้นทาง (เฉพาะแถวที่ sync มาจากหมวดออเดอร์) — key = source_order_id
  const [orderItems, setOrderItems] = useState<Record<string, RawItem[]>>({})
  // popup แก้รายการสินค้า (แบบเดียวกับหมวดออเดอร์) — บันทึกกลับไปที่ order_entries ต้นทาง
  const [itemsModal, setItemsModal] = useState<{ orderId: string; items: RawItem[]; instId: string } | null>(null)
  const [itemsPasteText, setItemsPasteText] = useState('')
  const [itemsParsing, setItemsParsing] = useState(false)
  const [itemsError, setItemsError] = useState('')
  const [editWork, setEditWork] = useState<{ id: string; value: string } | null>(null)  // แก้รายละเอียดงานของแถวที่เพิ่มเอง
  // หน้ายอดติดตั้ง — สรุปยอด+โบนัสช่างรายเดือน (สูตรเดียวกับชีท "ยอดติดตั้ง")
  const [bonusModal, setBonusModal] = useState(false)
  const [bonusMonth, setBonusMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [techCount, setTechCount] = useState(3)
  useEffect(() => {
    const saved = parseInt(localStorage.getItem('install_tech_count') ?? '', 10)
    if (saved > 0) setTechCount(saved)
  }, [])
  // สรุปงานติดตั้ง — ข้อความอัพเดตงานล่วงหน้าไว้ส่งไลน์ทีมช่าง (แก้ในกล่องก่อนคัดลอกได้)
  const [summaryModal, setSummaryModal] = useState(false)
  const [summaryZone, setSummaryZone] = useState<string | null>(null)
  const [summaryText, setSummaryText] = useState('')
  const [summaryCopied, setSummaryCopied] = useState(false)

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Installation>(() =>
      supabase.from('installations').select('*').order('appointment_datetime', { ascending: false }).order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    let rows = data
    // งานวัดหน้างานที่เลยวันนัดไปแล้ว → เลื่อนสถานะเป็น "วัดหน้างานแล้ว" อัตโนมัติ
    const now = Date.now()
    const overdue = rows.filter(r =>
      (r.installation_status === 'วัดหน้างาน' ||
        (r.work_type === 'งานวัดหน้างาน' && ['รอนัดหมาย', 'นัดหมายแล้ว'].includes(r.installation_status)))
      && r.appointment_datetime && new Date(r.appointment_datetime).getTime() < now)
    if (overdue.length) {
      const ids = overdue.map(r => r.id)
      await instUpdate({ installation_status: 'วัดหน้างานแล้ว' }).in('id', ids)
      rows = rows.map(r => ids.includes(r.id) ? { ...r, installation_status: 'วัดหน้างานแล้ว' } : r)
    }
    setPageCache('installations', rows)
    setInstalls(rows)
    snapshot(rows)   // ตั้งจุดอ้างอิงใหม่ → งานที่เพิ่งเปลี่ยนสถานะค้างไว้ ออกจากปฏิทิน/รายการตอนนี้
    setLoading(false)
    // ดึงรายการสินค้าจากออเดอร์ต้นทางมาโชว์ในคอลัมน์ "รายการ"
    const orderIds = rows.map(r => r.source_order_id).filter((v): v is string => !!v)
    if (orderIds.length) {
      const { data: oes } = await supabase.from('order_entries').select('id, items').in('id', orderIds)
      const map: Record<string, RawItem[]> = {}
      for (const oe of (oes ?? []) as { id: string; items: RawItem[] | null }[]) {
        if (Array.isArray(oe.items) && oe.items.length) map[oe.id] = oe.items
      }
      setOrderItems(map)
    }
  }

  useEffect(() => { load() }, [])

  // รัน serial ต่อจากเลขสูงสุดที่มี (กันชนกับเลขที่ sync มาจากออเดอร์)
  const nextSerial = () => pad(installs.reduce((mx, r) => Math.max(mx, parseInt(r.serial_no, 10) || 0), 0) + 1)

  const openAdd = () => {
    setApptDate('')
    setApptTime('9:00')
    setPasteText('')
    setParseError('')
    setNameSugOpen(false)
    ph.begin([], null)
    setModal({ mode: 'add', data: emptyForm() })
  }

  const set = (k: string, v: string | number) => setModal(m => {
    if (!m) return null
    // เลือกโซนกทม → เติมช่อง "ช่าง" เป็นช่างนอกให้เลย (ถ้ายังไม่ได้เลือกไว้)
    const auto = k === 'install_zone' && TECH_BY_ZONE[String(v)] && !m.data.technician_type
      ? { technician_type: TECH_BY_ZONE[String(v)] } : null
    return { ...m, data: { ...m.data, [k]: v, ...auto } }
  })

  // รูปหน้างาน — ตรรกะทั้งหมดอยู่ในคอมโพเนนต์กลาง components/InstallPhotos.tsx (ใช้ร่วมกับหมวดออเดอร์)
  const ph = useInstallPhotos()

  const closeModal = () => { setModal(null); ph.cancel() }
  const closeItemsModal = () => { setItemsModal(null); setItemsError(''); ph.cancel() }

  // ดรอป PDF ใบเสนอราคา → ดึงข้อความใส่ช่องวางข้อความ แล้วแปลงกรอกฟอร์มให้เลย
  const handleQuotePdf = async (file: File) => {
    if (!/\.pdf$/i.test(file.name)) { setParseError('รองรับเฉพาะไฟล์ .pdf'); return }
    setParsing(true)
    setParseError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'อ่านไฟล์ไม่สำเร็จ')
      setPasteText(json.text)
      await parseText(json.text)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setParsing(false)
    }
  }

  const parseFromLine = async () => {
    if (!pasteText.trim()) return
    setParsing(true)
    setParseError('')
    try {
      await parseText(pasteText)
    } finally {
      setParsing(false)
    }
  }

  const parseText = async (text: string) => {
    try {
      const res = await fetch('/api/parse-installation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'แปลงข้อมูลไม่สำเร็จ')
      const inst = json.inst as Record<string, string | null>
      setModal(m => {
        if (!m) return m
        const next = { ...m.data }
        const fields = ['work_type', 'platform', 'customer_id', 'customer_real_name', 'province', 'phone', 'location_link', 'work_details', 'notes'] as const
        for (const f of fields) {
          if (inst[f]) next[f] = inst[f] as string
        }
        return { ...m, data: next }
      })
      if (inst.appointment_date && /^\d{4}-\d{2}-\d{2}$/.test(inst.appointment_date)) setApptDate(inst.appointment_date)
      if (inst.appointment_time && TIMES.includes(inst.appointment_time)) setApptTime(inst.appointment_time)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'แปลงข้อมูลไม่สำเร็จ')
    }
  }

  // บันทึกการแก้ช่องเดียวของงานติดตั้งเข้ากองประวัติ (undo/redo → reload)
  const trackInst = (id: string, patch: Record<string, any>, prev: Record<string, any>, label: string) => {
    recordAction({
      label,
      undo: async () => { await instUpdate(prev).eq('id', id); await load() },
      redo: async () => { await instUpdate(patch).eq('id', id); await load() },
    })
  }

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const dt = apptDate && apptTime ? `${apptDate}T${apptTime.padStart(5, '0')}:00+07:00` : modal.data.appointment_datetime
    const d = modal.data
    const instStatus = (modal.mode === 'add' || INITIAL_STATUSES.includes(d.installation_status ?? ''))
      ? (STATUS_BY_TYPE[d.work_type ?? ''] ?? d.installation_status)
      : d.installation_status
    const payload: Partial<Installation> = { ...d, appointment_datetime: dt, installation_status: instStatus, serial_no: modal.mode === 'add' ? nextSerial() : d.serial_no, updated_at: new Date().toISOString(), photos: ph.photos }
    // ยังไม่เคยใช้รูปกับรายการนี้ → ไม่ต้องส่งคอลัมน์ photos (เว็บทำงานได้ตามปกติแม้ยังไม่ได้รัน SQL เพิ่มคอลัมน์)
    const hadPhotos = !!installs.find(i => i.id === d.id)?.photos?.length
    if (!ph.photos.length && !hadPhotos) delete payload.photos
    const name = (d.customer_real_name || d.customer_id || d.serial_no || '').toString()
    let err
    let savedRow: Installation | null = null
    if (modal.mode === 'add') {
      const res = await instInsert(payload).select().single()
      err = res.error
      if (!err && res.data) {
        const saved = res.data
        savedRow = saved as Installation
        recordAction({
          label: `เพิ่มงานติดตั้ง ${name}`,
          undo: async () => { await supabase.from('installations').delete().eq('id', saved.id); await load() },
          redo: async () => { await instInsert(saved); await load() },
        })
      }
    } else {
      const res = await instUpdate(payload).eq('id', d.id)
      err = res.error
      if (!err) {
        const orig = installs.find(i => i.id === d.id)
        savedRow = { ...(orig ?? {}), ...payload } as Installation
        trackInst(d.id as string, payload, prevOf(orig ?? {}, payload), `แก้งานติดตั้ง ${name}`)
      }
    }
    setSaving(false)
    if (err) {
      setError(/photos/.test(err.message) ? photoSaveError(err.message) : `บันทึกไม่สำเร็จ: ${err.message}`)
    } else {
      ph.commit()   // บันทึกผ่านแล้วค่อยลบไฟล์ของรูปที่กดเอาออก (กดยกเลิกกลางทางรูปเดิมจะไม่หาย)
      setModal(null)
      if (savedRow) await linkOrder(savedRow)   // งานติดตั้ง → สร้างใบออเดอร์ให้ฝ่ายผลิต
      if (modal.mode === 'edit' && d.id) await pushToOrder(d.id, payload)   // แก้ในปฏิทิน → sync ไปใบออเดอร์
      load()
    }
  }

  const saveAppt = async (id: string, date: string, time: string) => {
    if (!date) return
    const dt = `${date}T${time.padStart(5, '0')}:00+07:00`
    const now = new Date().toISOString()
    const old = installs.find(i => i.id === id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, appointment_datetime: dt, updated_at: now } : i))
    const { error: err } = await instUpdate({ appointment_datetime: dt, updated_at: now }).eq('id', id)
    if (err) { setError(`บันทึกวันนัดไม่สำเร็จ: ${err.message}`); load() }
    else trackInst(id, { appointment_datetime: dt, updated_at: now }, { appointment_datetime: old?.appointment_datetime ?? null, updated_at: old?.updated_at ?? null }, `แก้วันนัดติดตั้ง ${old?.customer_real_name || ''}`)
    if (!err) await pushToOrder(id, { appointment_datetime: dt })   // sync ไปใบออเดอร์ที่ผูกไว้
  }

  // แปลงข้อความที่วางเป็นรายการสินค้าด้วย AI (endpoint เดียวกับหมวดออเดอร์)
  const parseItems = async () => {
    if (!itemsPasteText.trim()) return
    setItemsParsing(true)
    setItemsError('')
    try {
      const res = await fetch('/api/parse-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: itemsPasteText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'แปลงไม่สำเร็จ')
      setItemsModal(m => m ? { ...m, items: data.items } : null)
    } catch (e: unknown) {
      setItemsError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setItemsParsing(false)
    }
  }

  const saveItems = async () => {
    if (!itemsModal) return
    // เก็บกระดูมที่คำนวณได้ (ม่านลอนเทป) ลงฐานด้วย ให้ตรงกับที่โชว์ในตาราง
    const newItems = itemsModal.items.length > 0 ? withAutoHooks(itemsModal.items) : null
    const now = new Date().toISOString()
    // สั่งนอกในรายการ → ลงคอลัมน์สั่งนอกของออเดอร์ต้นทาง + ประทับเวลาเมื่อข้อความเปลี่ยน
    const itemsOut = itemsOutsourceText(itemsModal.items)
    let outUpdates = {}
    let outChanged = false
    if (itemsOut) {
      const { data: cur } = await supabase.from('order_entries').select('outsource').eq('id', itemsModal.orderId).single()
      if (itemsOut !== (cur?.outsource ?? '')) { outUpdates = { outsource: itemsOut, outsource_at: now }; outChanged = true }
    }
    const { error: err } = await oeUpdate({ items: newItems, updated_at: now, ...outUpdates }).eq('id', itemsModal.orderId)
    if (err) { setError(`บันทึกรายการไม่สำเร็จ: ${err.message}`); return }
    // รูปหน้างานผูกกับแถวงานติดตั้ง (ตาราง installations) ไม่ใช่ตัวออเดอร์ — บันทึกพร้อมกันตอนกดบันทึกรายการ
    const hadPhotos = !!installs.find(i => i.id === itemsModal.instId)?.photos?.length
    if (ph.photos.length || hadPhotos) {
      const { error: pErr } = await instUpdate({ photos: ph.photos, updated_at: now }).eq('id', itemsModal.instId)
      if (pErr) { setError(photoSaveError(pErr.message)); return }
      setInstalls(prev => prev.map(i => i.id === itemsModal.instId ? { ...i, photos: ph.photos } : i))
    }
    ph.commit()   // ลบไฟล์ของรูปที่เอาออก หลังบันทึกผ่านแล้ว
    // สั่งนอกเปลี่ยน → sync ไปหมวดสั่งซื้อด้วย
    if (outChanged) {
      const { data: oe } = await supabase.from('order_entries').select('customer_name, order_number').eq('id', itemsModal.orderId).single()
      await syncOutsourcePO(itemsModal.orderId, oe?.customer_name, oe?.order_number, itemsOut, itemsModal.items)
    }
    setOrderItems(prev => {
      const next = { ...prev }
      if (newItems) next[itemsModal.orderId] = newItems
      else delete next[itemsModal.orderId]
      return next
    })
    setItemsModal(null)
    setItemsError('')
  }

  // แถวที่เพิ่มเองไม่มีออเดอร์ต้นทาง → แก้รายละเอียดงานตรงคอลัมน์รายการ
  const saveWork = async (id: string, value: string) => {
    setEditWork(null)
    const now = new Date().toISOString()
    const old = installs.find(i => i.id === id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, work_details: value, updated_at: now } : i))
    const { error: err } = await instUpdate({ work_details: value, updated_at: now }).eq('id', id)
    if (err) { setError(`บันทึกรายละเอียดงานไม่สำเร็จ: ${err.message}`); load() }
    else trackInst(id, { work_details: value, updated_at: now }, { work_details: old?.work_details ?? null, updated_at: old?.updated_at ?? null }, `แก้รายละเอียดงานติดตั้ง ${old?.customer_real_name || ''}`)
    if (!err) await pushToOrder(id, { work_details: value })   // sync ไปใบออเดอร์ที่ผูกไว้
  }

  const saveNote = async (id: string, value: string) => {
    setEditNote(null)
    const now = new Date().toISOString()
    const old = installs.find(i => i.id === id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, notes: value, updated_at: now } : i))
    const { error: err } = await instUpdate({ notes: value, updated_at: now }).eq('id', id)
    if (err) { setError(`บันทึกหมายเหตุไม่สำเร็จ: ${err.message}`); load() }
    else trackInst(id, { notes: value, updated_at: now }, { notes: old?.notes ?? null, updated_at: old?.updated_at ?? null }, `แก้หมายเหตุติดตั้ง ${old?.customer_real_name || ''}`)
    if (!err) await pushToOrder(id, { notes: value })   // sync ไปใบออเดอร์ที่ผูกไว้
  }

  const updateStatus = async (id: string, status: string) => {
    const now = new Date().toISOString()
    const old = installs.find(i => i.id === id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, installation_status: status, updated_at: now } : i))
    const { error: err } = await instUpdate({ installation_status: status, updated_at: now }).eq('id', id)
    if (err) { setError(`อัพเดทสถานะไม่สำเร็จ: ${err.message}`); load() }
    else trackInst(id, { installation_status: status, updated_at: now }, { installation_status: old?.installation_status ?? null, updated_at: old?.updated_at ?? null }, `แก้สถานะติดตั้ง ${old?.customer_real_name || ''}`)
    if (!err) await pushToOrder(id, { installation_status: status })   // sync ไปใบออเดอร์ที่ผูกไว้
  }

  // คอลัมน์ "งาน" — เปลี่ยนลักษณะงานตรงตาราง สถานะที่ใช้ไม่ได้กับงานใหม่จะรีเซ็ตให้เป็นสถานะตั้งต้น
  const updateWorkType = async (id: string, wt: string) => {
    const now = new Date().toISOString()
    const old = installs.find(i => i.id === id)
    const cur = normStatus(old?.installation_status)
    const patch: { work_type: string; updated_at: string; installation_status?: string } = { work_type: wt, updated_at: now }
    if (!statusOptions(wt).includes(cur)) patch.installation_status = STATUS_BY_TYPE[wt] ?? 'รอนัดหมาย'
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    const { error: err } = await instUpdate(patch).eq('id', id)
    if (err) { setError(`อัพเดทลักษณะงานไม่สำเร็จ: ${err.message}`); load(); return }
    trackInst(id, patch, prevOf(old ?? {}, patch), `แก้ลักษณะงานติดตั้ง ${old?.customer_real_name || old?.customer_id || ''}`)
    if (old) await linkOrder({ ...old, ...patch })
  }

  // แก้ช่องไหนในปฏิทิน → แก้ช่องเดียวกันในใบออเดอร์ที่ผูกกันไว้ (sync สองทาง)
  const pushToOrder = async (id: string, patch: Record<string, unknown>) => {
    const row = installs.find(i => i.id === id)
    if (!row?.source_order_id) return
    const orderPatch = orderPatchFromInstall(patch, { ...row, ...patch } as Installation)
    if (!Object.keys(orderPatch).length) return
    const { error: err } = await oeUpdate({ ...orderPatch, updated_at: new Date().toISOString() }).eq('id', row.source_order_id)
    if (err) setError(`อัพเดทใบออเดอร์ที่ผูกไว้ไม่สำเร็จ: ${err.message}`)
  }

  // เปลี่ยนเป็น "งานติดตั้ง" แล้วยังไม่มีใบออเดอร์ → สร้างใบให้ ฝ่ายผลิตถึงจะเห็นในหมวดออเดอร์
  const linkOrder = async (ins: Installation) => {
    if (ins.work_type !== 'งานติดตั้ง' || ins.source_order_id) return
    const { orderId, error: oErr } = await createOrderForInstall(ins)
    if (oErr) { setError(`สร้างใบออเดอร์ให้งานติดตั้งไม่สำเร็จ: ${oErr}`); return }
    if (!orderId) return
    const { error: lErr } = await instUpdate({ source_order_id: orderId }).eq('id', ins.id)
    if (lErr) { setError(`ผูกใบออเดอร์กับงานติดตั้งไม่สำเร็จ: ${lErr.message}`); return }
    setInstalls(prev => prev.map(i => i.id === ins.id ? { ...i, source_order_id: orderId } : i))
  }

  const updateZone = async (id: string, zone: string) => {
    const now = new Date().toISOString()
    const old = installs.find(i => i.id === id)
    // เลือกโซนที่รู้ชนิดช่างอยู่แล้ว (กทม = ช่างนอก) → เติมช่องช่างให้เลย ถ้ายังไม่ได้เลือกไว้
    const autoTech = TECH_BY_ZONE[zone]
    const patch = autoTech && !old?.technician_type
      ? { install_zone: zone, technician_type: autoTech, updated_at: now }
      : { install_zone: zone, updated_at: now }
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    const { error: err } = await instUpdate(patch).eq('id', id)
    if (err) { setError(`อัพเดทโซนไม่สำเร็จ: ${err.message}`); load() }
    else trackInst(id, patch, { install_zone: old?.install_zone ?? null, technician_type: old?.technician_type ?? null, updated_at: old?.updated_at ?? null }, `แก้โซนติดตั้ง ${old?.customer_real_name || ''}`)
  }

  const updateTech = async (id: string, tech: string) => {
    const now = new Date().toISOString()
    const old = installs.find(i => i.id === id)
    setInstalls(prev => prev.map(i => i.id === id ? { ...i, technician_type: tech, updated_at: now } : i))
    const { error: err } = await instUpdate({ technician_type: tech, updated_at: now }).eq('id', id)
    if (err) { setError(`อัพเดทช่างไม่สำเร็จ: ${err.message}`); load() }
    else trackInst(id, { technician_type: tech, updated_at: now }, { technician_type: old?.technician_type ?? null, updated_at: old?.updated_at ?? null }, `แก้ช่าง ${old?.customer_real_name || ''}`)
  }

  const del = async (id: string) => {
    if (!(await ask('ลบรายการนี้?', { okText: 'ลบ', danger: true }))) return
    const row = installs.find(i => i.id === id)
    setError('')
    try {
      // ‼️ ลบไม่สำเร็จต้องฟ้องเสมอ ห้ามเงียบ (เดิมไม่ได้เช็ค error เลยดูเหมือนกดปุ่มไม่ติด)
      const { error: err } = await supabase.from('installations').delete().eq('id', id)
      if (err) { setError(`ลบไม่สำเร็จ: ${err.message}`); return }
      if (row) recordAction({
        label: `ลบงานติดตั้ง ${row.customer_real_name || row.serial_no || ''}`,
        undo: async () => { await instInsert(row); await load() },
        redo: async () => { await supabase.from('installations').delete().eq('id', id); await load() },
      })
      load()
    } catch (e) {
      setError(`ลบไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ปริ้นใบงาน 1 ใบ (เมนู ··· → ปริ้น) — ใช้ฟอร์มหน้าตาเดียวกับใบปริ้นในหมวดออเดอร์
  // มีออเดอร์ต้นทาง = ปริ้นใบออเดอร์นั้นตรงๆ (พร้อม QR สแกน) แล้วเติมบรรทัดนัดหมาย/ช่างไว้หัวใบ
  const printInstall = async (ins: Installation) => {
    // เปิดหน้าต่างทันทีตอนกดปุ่ม (กัน popup blocker) แล้วค่อยเติมเนื้อหาหลังโหลดออเดอร์เสร็จ
    const win = window.open('', '_blank', 'width=1200,height=750')
    if (!win) { setError('เบราว์เซอร์บล็อก popup — โปรดอนุญาต popup เพื่อปริ้น'); return }
    win.document.write('<!DOCTYPE html><meta charset="UTF-8"><body style="font-family:sans-serif;padding:24px;color:#666">กำลังเตรียมเอกสาร…</body>')

    const dt = ins.appointment_datetime ? new Date(ins.appointment_datetime) : null
    const apptText = dt
      ? `${DAYS[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${TH_MONTHS[dt.getMonth()]} ${dt.getFullYear() + 543} ${dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
      : 'ยังไม่ได้นัดหมาย'

    const head: PrintLine[] = [{ t: `${ins.work_type || 'งานติดตั้ง'}${ins.serial_no ? ` #${ins.serial_no}` : ''} · ${apptText}` }]
    const techLine = [ins.technician_type, ins.install_zone, ins.province].filter(Boolean).join(' · ')
    if (techLine) head.push({ t: techLine })
    head.push({ t: '' })

    let body: PrintLine[] = []
    let qr: string | undefined

    try {
      if (ins.source_order_id) {
        const { data } = await supabase.from('order_entries').select('*').eq('id', ins.source_order_id).maybeSingle()
        if (data) {
          body = formatOrderLines(data as PrintableOrder)
          qr = await QRCode.toDataURL(`${window.location.origin}/scan?id=${data.id}&o=${encodeURIComponent(data.order_number || '')}`, { margin: 1, width: 240 }).catch(() => undefined)
        }
      }
    } catch { /* โหลดออเดอร์ต้นทางไม่ได้ → ใช้ข้อมูลในแถวงานติดตั้งแทน */ }

    // ไม่มีออเดอร์ต้นทาง (หรือโหลดไม่ได้) → ประกอบใบจากข้อมูลในแถวงานติดตั้งเอง หน้าตาเดียวกัน
    if (body.length === 0) {
      const push = (t: string) => body.push({ t })
      const cust = [ins.platform, ins.customer_real_name || ins.customer_id].filter(Boolean).join(': ')
      if (cust) push(cust)
      if (ins.phone) push(ins.phone)
      push('')
      const items = ins.source_order_id ? (orderItems[ins.source_order_id] ?? []) : []
      formatItemLines(items).forEach(l => push(l))
      if (items.length) push('')
      if (ins.work_details) push(ins.work_details)
      if (ins.location_link) push(ins.location_link)
      if (ins.price) push(`ราคา ${Number(ins.price).toLocaleString('th-TH')} บาท${ins.payment_status ? ` (${ins.payment_status})` : ''}`)
      if (ins.notes) push(`หมายเหตุ: ${ins.notes}`)
      if (ins.entered_by) { push(''); push(`แอดมิน: ${ins.entered_by}`) }
    }

    openFormPrintWindow(
      [{ html: linesToHtml([...head, ...body]), qr }],
      `${ins.work_type || 'งานติดตั้ง'} ${ins.customer_real_name || ins.customer_id || ''}`,
      win,
    )
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  // ── สรุปงานติดตั้ง: รวมงานที่ยังไม่เสร็จตั้งแต่วันนี้เป็นต้นไป จัดกลุ่มรายวัน ตามฟอร์แมตที่ทีมใช้ส่งไลน์ ──
  const buildInstallSummary = (zone: string | null): string => {
    const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
    const DIVIDER = '______________________________________________'
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const upcoming = installs
      .filter(ins => {
        if (!ins.appointment_datetime) return false
        if (ins.installation_status === 'ติดตั้งเสร็จ' || ins.installation_status === 'วัดหน้างานแล้ว') return false
        if (zone && ins.install_zone !== zone) return false
        return new Date(ins.appointment_datetime) >= today
      })
      .sort((a, b) => new Date(a.appointment_datetime).getTime() - new Date(b.appointment_datetime).getTime())

    const lines: string[] = ['🔥อัพเดตงานติดตั้ง+วัดหน้างาน🔥', `           #${zone || 'ทุกโซน'}`]
    let curDay = ''
    upcoming.forEach(ins => {
      const d = new Date(ins.appointment_datetime)
      const dayKey = d.toDateString()
      if (dayKey !== curDay) {
        curDay = dayKey
        lines.push(DIVIDER)
        lines.push(`📍วัน${TH_DAYS[d.getDay()]} ที่ ${String(d.getDate()).padStart(2, '0')}/${d.getMonth() + 1}/${d.getFullYear()} `)
      } else {
        lines.push('')
        lines.push('ต่อด้วย')
        lines.push('')
      }
      const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      const workLabel = (ins.work_type || '').replace(/^งาน(?!แก้)/, '') || 'ติดตั้ง'   // งานติดตั้ง→ติดตั้ง แต่ "งานแก้" คงคำว่างานไว้
      const details = (ins.work_details || '').trim()
      lines.push(`- ${time} น. ${workLabel}${details ? ' ' + details : ''}`)
      const who = [ins.platform, [ins.customer_real_name || ins.customer_id, ins.province ? `(${ins.province})` : ''].filter(Boolean).join(' ')].filter(Boolean)
      if (who.length) lines.push(who.join(': '))
      if ((ins.phone ?? '').trim()) lines.push(`เบอร์ : ${ins.phone.trim()}`)
      if ((ins.notes ?? '').trim()) lines.push(ins.notes.trim())
      if ((ins.location_link ?? '').trim()) { lines.push('พิกัด'); lines.push(ins.location_link.trim()) }
    })
    if (upcoming.length === 0) lines.push(DIVIDER, '— ไม่มีงานค้างตั้งแต่วันนี้เป็นต้นไป —')
    lines.push(DIVIDER)
    return lines.join('\n')
  }

  const openSummary = () => {
    setSummaryZone(zoneFilter)
    setSummaryText(buildInstallSummary(zoneFilter))
    setSummaryCopied(false)
    setSummaryModal(true)
  }

  // กรองบนค่า "ตอนโหลดหน้า" (stable) แล้วคืนค่าสด (live) ก่อนวาด
  const stableInstalls = installs.map(stable)
  const byMonth = listFilter === 'all' ? stableInstalls : stableInstalls.filter(ins => {
    const d = new Date(ins.appointment_datetime)
    return d.getMonth() === Number(listFilter.split('-')[1]) - 1 && d.getFullYear() === Number(listFilter.split('-')[0])
  })
  const byZone = zoneFilter ? byMonth.filter(ins => ins.install_zone === zoneFilter) : byMonth
  const q = search.trim().toLowerCase()
  const displayed = (!q ? byZone : byZone.filter(ins =>
    [ins.serial_no, ins.customer_real_name, ins.customer_id, ins.platform, ins.province, ins.install_zone, ins.phone, ins.installation_status, ins.notes]
      .some(v => (v ?? '').toLowerCase().includes(q))
  )).map(live)

  // ปฏิทินไม่แสดงงานที่ติดตั้งเสร็จแล้ว + filter ตามโซนที่เลือก
  const calendarInstalls = stableInstalls.filter(ins =>
    ins.installation_status !== 'ติดตั้งเสร็จ' && (!zoneFilter || ins.install_zone === zoneFilter)).map(live)

  // รายชื่อลูกค้าที่เคยมีในระบบ — ใช้เดาชื่อตอนพิมพ์ในกล่องเพิ่มรายการ
  const customerNames = Array.from(new Set(
    installs.flatMap(i => [i.customer_id, i.customer_real_name]).map(v => (v ?? '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'th'))

  const sel = (label: string, key: string, options: string[]) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={String(modal?.data[key as keyof typeof modal.data] ?? '')} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none' }}>
        <option value="">— เลือก —</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )

  const inp = (label: string, key: string, type = 'text') => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={type} value={String(modal?.data[key as keyof typeof modal.data] ?? '')} onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>งานติดตั้ง</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setBonusModal(true)}
            style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            ยอดติดตั้ง
          </button>
          <button onClick={openSummary}
            style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            สรุปงานติดตั้ง
          </button>
          <button onClick={() => window.print()}
            style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            🖨️ ปริ้นปฏิทิน
          </button>
          <button onClick={openAdd}
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

      {/* Calendar */}
      <div className="print-area" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="no-print" onClick={prevMonth} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, background: '#fff' }}>‹</button>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', flex: 1, textAlign: 'center' }}>
            {TH_MONTHS[month]} {year + 543}
          </h2>
          <button className="no-print" onClick={nextMonth} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, background: '#fff' }}>›</button>
        </div>
        <Calendar year={year} month={month} installs={calendarInstalls} onDayClick={day => {
          const items = calendarInstalls.filter(ins => {
            const d = new Date(ins.appointment_datetime)
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
          })
          setDayModal({ day, items })
        }} />
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {[['#5ac8fa', 'วัดหน้างาน'], ['#ff9f0a', 'ติดตั้ง'], ['var(--red)', 'รอแก้'], ['#eab308', 'วันหยุด'], ['#9ca3af', 'ร้านปิด (อา.)']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>รายการทั้งหมด</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* เลือกโซนติดตั้ง — ชิปชุดนี้ชุดเดียว คุมทั้งปฏิทินด้านบนและตารางรายการด้านล่าง */}
        <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['ทุกโซน', null], ...ZONES.map(z => [z, z] as [string, string])] as [string, string | null][]).map(([label, val]) => {
            const n = val ? byMonth.filter(i => i.install_zone === val).length : byMonth.length
            return (
              <button key={label} onClick={() => setZoneFilter(val)}
                style={{ padding: '5px 12px', borderRadius: 980, border: zoneFilter === val ? 'none' : '1px solid var(--border)', background: zoneFilter === val ? 'var(--blue)' : '#fff', color: zoneFilter === val ? '#fff' : 'var(--ink-3)', fontSize: 12, fontWeight: zoneFilter === val ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {label} <span style={{ opacity: 0.75 }}>{n}</span>
              </button>
            )
          })}
        </div>
        <select value={listFilter} onChange={e => setListFilter(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 13, outline: 'none' }}>
          <option value="all">ทั้งหมด</option>
          {Array.from(new Set(installs.map(ins => {
            const d = new Date(ins.appointment_datetime)
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          }))).sort().reverse().map(m => (
            <option key={m} value={m}>{TH_MONTHS[Number(m.split('-')[1]) - 1]} {Number(m.split('-')[0]) + 543}</option>
          ))}
        </select>
        </div>
      </div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา ชื่อลูกค้า / แพลตฟอร์ม / จังหวัด / เบอร์ / Serial / หมายเหตุ"
          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 34px 9px 13px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)' }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 15 }}>✕</button>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>ไม่มีรายการ</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {['Serial','นัดหมาย','งาน','ลูกค้า','รายการ','แพลตฟอร์ม','จังหวัด','โซน','ช่าง','เบอร์','สถานะ','หมายเหตุ','แก้ไขล่าสุด',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(ins => {
                const bg = rowColor(ins)
                return (
                  <tr key={ins.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--blue)' }}>{ins.serial_no}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {editAppt?.id === ins.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="date" autoFocus value={/^\d{4}-\d{2}-\d{2}$/.test(editAppt.date) ? editAppt.date : ''}
                            onChange={e => { if (e.target.value) { setEditAppt({ ...editAppt, date: e.target.value }); saveAppt(ins.id, e.target.value, editAppt.time) } }}
                            onMouseDown={e => { e.preventDefault(); try { (e.target as HTMLInputElement).showPicker() } catch {} }}
                            style={{ border: '1px solid var(--blue)', borderRadius: 6, padding: '4px 7px', fontSize: 11, outline: 'none' }} />
                          <select value={editAppt.time}
                            onChange={e => { setEditAppt({ ...editAppt, time: e.target.value }); saveAppt(ins.id, editAppt.date, e.target.value) }}
                            style={{ border: '1px solid var(--blue)', borderRadius: 6, padding: '4px 7px', fontSize: 11, outline: 'none' }}>
                            {TIMES.map(t => <option key={t}>{t}</option>)}
                          </select>
                          <button onClick={() => setEditAppt(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14 }}>✓</button>
                        </div>
                      ) : (
                        <span onClick={() => {
                          const d = ins.appointment_datetime ? new Date(ins.appointment_datetime) : null
                          setEditAppt({
                            id: ins.id,
                            date: ins.appointment_datetime?.split('T')[0] ?? '',
                            time: d ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : '9:00',
                          })
                        }} style={{ cursor: 'pointer' }}>
                          {ins.appointment_datetime ? (
                            <>
                              <span style={{ color: 'var(--ink)' }}>{new Date(ins.appointment_datetime).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                              {' '}
                              <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                            </>
                          ) : <span style={{ color: 'var(--ink-4)' }}>เลือกวันนัด</span>}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {/* งาน — ชิปสีเดียวกับคอลัมน์สถานะของแถวนั้น */}
                      <select value={ins.work_type || ''} onChange={e => updateWorkType(ins.id, e.target.value)}
                        style={{ background: bg + '22', color: bg, padding: '3px 8px', borderRadius: 980, fontWeight: 600, fontSize: 11, border: 'none', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                        <option value="" style={{ background: '#fff', color: 'var(--ink)' }}>—</option>
                        {Array.from(new Set([...WORK_TYPE_OPTIONS, ins.work_type].filter(Boolean))).map(w => (
                          <option key={w} value={w} style={{ background: '#fff', color: 'var(--ink)' }}>{w}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {(ins.customer_real_name || ins.customer_id)
                        ? <Link href={`/customers?name=${encodeURIComponent(ins.customer_real_name || ins.customer_id!)}`} title="เปิดโฟลเดอร์ออเดอร์" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{ins.customer_real_name || ins.customer_id}</Link>
                        : '-'}
                      {/* มีรูปหน้างานกี่รูป — เปิดดู/แก้ได้ในเมนู "แก้ไข" ของแถวนี้ */}
                      {!!ins.photos?.length && (
                        <span title={`มีรูปหน้างาน ${ins.photos.length} รูป`} style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>📷 {ins.photos.length}</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 14px', minWidth: 160, maxWidth: 200 }}>
                      {ins.source_order_id ? (
                        // มาจากหมวดออเดอร์ → จิ้มเปิด popup แก้รายการ บันทึกกลับไปที่ออเดอร์ต้นทาง
                        <div onClick={() => { ph.begin(ins.photos, ins.id); setItemsModal({ orderId: ins.source_order_id!, items: withAutoHooks(orderItems[ins.source_order_id!] ?? []), instId: ins.id }); setItemsPasteText(''); setItemsError('') }}
                          style={{ cursor: 'pointer' }} title="จิ้มเพื่อแก้รายการ">
                          {orderItems[ins.source_order_id]?.length ? (
                            // โชว์แบบเดียวกับคอลัมน์รายการในหมวดออเดอร์: บรรทัดสั้น 1 บรรทัด/ชิ้น ตัดท้ายด้วย …
                            <div>
                              {formatItemLines(orderItems[ins.source_order_id]).map((line, k) => (
                                <div key={k} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190, fontSize: 11, lineHeight: '1.6', color: k === 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{line}</div>
                              ))}
                            </div>
                          ) : <span style={{ color: 'var(--ink-4)' }}>+ เพิ่มรายการ</span>}
                        </div>
                      ) : editWork?.id === ins.id ? (
                        <textarea autoFocus value={editWork.value} rows={2}
                          onChange={e => setEditWork(ew => ew ? { ...ew, value: e.target.value } : null)}
                          onBlur={() => saveWork(ins.id, editWork.value)}
                          onKeyDown={e => { if (e.key === 'Escape') setEditWork(null) }}
                          style={{ border: '1px solid var(--blue)', borderRadius: 6, background: 'transparent', fontSize: 11, width: '100%', outline: 'none', padding: '4px 6px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                      ) : (
                        // แถวที่เพิ่มเองในหน้านี้ → จิ้มแก้รายละเอียดงานตรงนี้ได้เลย
                        <div onClick={() => setEditWork({ id: ins.id, value: ins.work_details ?? '' })}
                          style={{ cursor: 'text', fontSize: 11, whiteSpace: 'pre-line', color: ins.work_details ? 'var(--ink-3)' : 'var(--ink-4)', minWidth: 60 }}>
                          {ins.work_details || '—'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{ins.platform || '-'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{ins.province || '-'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select value={ins.install_zone || ''} onChange={e => updateZone(ins.id, e.target.value)}
                        style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: ins.install_zone ? 'var(--ink)' : 'var(--ink-4)', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                        <option value="">—</option>
                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <select value={ins.technician_type || ''} onChange={e => updateTech(ins.id, e.target.value)}
                        style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: ins.technician_type ? 'var(--ink)' : 'var(--ink-4)', background: '#fff', outline: 'none', cursor: 'pointer' }}>
                        <option value="">—</option>
                        {TECHS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{ins.phone || '-'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select value={normStatus(ins.installation_status)} onChange={e => updateStatus(ins.id, e.target.value)}
                        style={{ background: bg + '22', color: bg, padding: '3px 8px', borderRadius: 980, fontWeight: 600, fontSize: 11, border: 'none', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                        {Array.from(new Set([...statusOptions(ins.work_type), normStatus(ins.installation_status)])).map(s => (
                          <option key={s} value={s} style={{ background: '#fff', color: 'var(--ink)' }}>{statusLabel(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--ink-3)', minWidth: 140, maxWidth: 220 }}>
                      {editNote?.id === ins.id ? (
                        <input type="text" autoFocus value={editNote.value}
                          onChange={e => setEditNote(en => en ? { ...en, value: e.target.value } : null)}
                          onBlur={() => saveNote(ins.id, editNote.value)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditNote(null) }}
                          style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 11, width: '100%', outline: 'none', padding: '2px 0' }} />
                      ) : (
                        <div onClick={() => setEditNote({ id: ins.id, value: ins.notes ?? '' })}
                          style={{ cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ins.notes ? 'var(--ink-3)' : 'var(--ink-4)', minWidth: 60 }}>
                          {ins.notes || '—'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {ins.updated_at ? (
                        <div>
                          <div>{new Date(ins.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(ins.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={e => {
                        const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                        setActionMenu(actionMenu?.id === ins.id ? null : { id: ins.id, top: r.bottom + 4, left: r.right - 120 })
                      }}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'var(--ink-3)' }}>⋯</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Action menu (···) */}
      {actionMenu && (() => {
        const ins = installs.find(i => i.id === actionMenu.id)
        if (!ins) return null
        return (
          <>
            <div onMouseDown={() => setActionMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1500 }} />
            <div style={{ position: 'fixed', top: actionMenu.top, left: actionMenu.left, width: 120, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 1600, overflow: 'hidden' }}>
              <button onClick={() => {
                ph.begin(ins.photos, ins.id)
                setModal({ mode: 'edit', data: { ...ins } })
                setApptDate(ins.appointment_datetime?.split('T')[0] ?? '')
                setApptTime(ins.appointment_datetime ? new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '9:00')
                setActionMenu(null)
              }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>แก้ไข</button>
              <button onClick={() => { setActionMenu(null); printInstall(ins) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', borderTop: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>ปริ้น</button>
              <button onClick={() => { setActionMenu(null); del(ins.id) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', borderTop: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--red)' }}>ลบ</button>
            </div>
          </>
        )
      })()}

      {/* Items modal — แก้รายการสินค้าของออเดอร์ต้นทาง (หน้าตา/พฤติกรรมเดียวกับหมวดออเดอร์) */}
      {itemsModal && (
        <div onClick={closeItemsModal} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px' }}>

            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>รายการสินค้า</h3>

            {/* AI Paste zone */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6, fontWeight: 500 }}>วางข้อความรายการสินค้า — AI จะแปลงให้อัตโนมัติ</label>
              <textarea
                value={itemsPasteText}
                onChange={e => { setItemsPasteText(e.target.value); setItemsError('') }}
                rows={4}
                placeholder={'ตัวอย่าง:\nม่านจีบ CC-101 ขาวนวล กว้าง 2.5 สูง 2.2 จำนวน 1 ชุด\nม่านโปร่ง BB-202 ครีม 1.8x2.0 2 ชุด'}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}
              />
              {itemsError && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{itemsError}</div>
              )}
              <button
                onClick={parseItems}
                disabled={!itemsPasteText.trim() || itemsParsing}
                style={{ marginTop: 8, padding: '7px 18px', borderRadius: 7, border: 'none', background: itemsParsing || !itemsPasteText.trim() ? 'var(--border)' : 'var(--blue)', color: itemsParsing || !itemsPasteText.trim() ? 'var(--ink-3)' : '#fff', fontSize: 13, fontWeight: 600, cursor: itemsParsing || !itemsPasteText.trim() ? 'default' : 'pointer' }}>
                {itemsParsing ? 'กำลังแปลง…' : '✦ แปลงรายการ'}
              </button>
            </div>

            {/* Editable table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border)' }}>
                    {['#', 'ประเภท', 'สีตาไก่', 'ชั้น', 'หัวราง/จีบ', 'ตะขอ', 'รหัสสี', 'ชื่อสี', 'กว้าง (ม.)', 'สูง (ม.)', 'จำนวน', 'หน่วย', 'กระดูม', 'ขวางผ้า', 'แบ่งผ้า', 'เคมี', 'โซ่ถ่วง', 'ฝั่งดึง', 'สั่งนอก', 'หมายเหตุ'].map(h => (
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
                        ['eyelet_color', 'text', 64],
                        ['floors', 'number', 44],
                        ['rail_head', 'text', 64],
                        ['hook_type', 'text', 70],
                        ['color_code', 'text', 60],
                        ['color_name', 'text', 90],
                        ['width', 'text', 56],
                        ['height', 'text', 56],
                        ['quantity', 'number', 50],
                        ['unit', 'text', 46],
                        ['hooks', 'text', 60],
                        ['orientation', 'text', 60],
                        ['fabric_split', 'text', 74],
                        ['chemical', 'text', 64],
                        ['weight_chain', 'text', 80],
                        ['pull_side', 'text', 54],
                        ['outsource', 'text', 90],
                        ['note', 'text', 90],
                      ] as [keyof RawItem, string, number][]).map(([key, type, w]) => (
                        <td key={key} style={{ padding: '4px 6px' }}>
                          <input
                            type={type}
                            step={type === 'number' ? '0.01' : undefined}
                            value={key === 'hooks' && !(item.hooks ?? '').toString().trim()
                              ? autoTapeHooks(item)                                  /* ว่าง → โชว์กระดูมที่คำนวณจากม่านลอนเทป (พิมพ์ทับได้) */
                              : (item[key] == null ? '' : String(item[key]))}
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
                      <td colSpan={20} style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
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

            {ph.trigger()}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeItemsModal}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>
                ยกเลิก
              </button>
              <button onClick={saveItems}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                บันทึก
              </button>
            </div>
          </div>
          {ph.open && ph.panel()}
        </div>
      )}

      {/* Day modal */}
      {dayModal && (
        <div onClick={() => setDayModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>วันที่ {dayModal.day} {TH_MONTHS[month]} {year + 543}</h2>
              <button onClick={() => setDayModal(null)} style={{ border: 'none', background: 'rgba(0,0,0,0.10)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            {(() => {
              const h = HOLIDAYS[`${year}-${String(month + 1).padStart(2, '0')}-${String(dayModal.day).padStart(2, '0')}`]
              return h ? (
                <div style={{ background: '#fff9e6', border: '1px solid #f0d98c', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#b45309', fontSize: 13, fontWeight: 600 }}>
                  🏖️ วันหยุดร้าน · {h}
                </div>
              ) : null
            })()}
            {dayModal.items.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>ไม่มีนัดหมาย</p>
            ) : dayModal.items.map(ins => {
              const bg = rowColor(ins)
              return (
                <div key={ins.id} style={{ borderLeft: `4px solid ${bg}`, borderRadius: 10, padding: '14px 16px', background: 'var(--bg)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{ins.serial_no}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {ins.appointment_datetime ? new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{ins.customer_real_name || ins.customer_id}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{ins.work_type} · {ins.province}</div>
                  {ins.phone && <div style={{ fontSize: 13, marginTop: 4 }}>📞 {ins.phone}</div>}
                  {ins.location_link && <a href={ins.location_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--blue)', display: 'block', marginTop: 4 }}>📍 ดูแผนที่</a>}
                  <div style={{ marginTop: 8 }}>
                    <span style={{ background: bg + '22', color: bg, padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600 }}>{statusLabel(normStatus(ins.installation_status))}</span>
                  </div>
                </div>
              )
            })}
            <button onClick={() => {
              const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayModal.day).padStart(2, '0')}`
              setDayModal(null)
              openAdd()
              setApptDate(d)
            }}
              style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed var(--border-2)', background: 'var(--surface)', color: 'var(--blue)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              + เพิ่มรายการวันนี้
            </button>
          </div>
        </div>
      )}

      {/* สรุปงานติดตั้ง — ข้อความอัพเดตงานล่วงหน้ารายวัน แยกโซนได้ แก้ในกล่องก่อนคัดลอกส่งไลน์ */}
      {summaryModal && (
        <div onClick={() => setSummaryModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>สรุปงานติดตั้ง</h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['ทุกโซน', null], ...ZONES.map(z => [z, z] as [string, string])] as [string, string | null][]).map(([label, val]) => (
                  <button key={label} onClick={() => { setSummaryZone(val); setSummaryText(buildInstallSummary(val)); setSummaryCopied(false) }}
                    style={{ padding: '5px 12px', borderRadius: 980, border: summaryZone === val ? 'none' : '1px solid var(--border)', background: summaryZone === val ? 'var(--blue)' : '#fff', color: summaryZone === val ? '#fff' : 'var(--ink-3)', fontSize: 12, fontWeight: summaryZone === val ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>รวมงานที่ยังไม่เสร็จตั้งแต่วันนี้เป็นต้นไป — แก้ข้อความในกล่องได้ก่อนกดคัดลอก</p>
            <textarea value={summaryText} onChange={e => { setSummaryText(e.target.value); setSummaryCopied(false) }}
              style={{ flex: 1, minHeight: 320, width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.55, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', whiteSpace: 'pre' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setSummaryModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ปิด</button>
              <button onClick={async () => { await navigator.clipboard.writeText(summaryText); setSummaryCopied(true); setTimeout(() => setSummaryCopied(false), 2000) }}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: summaryCopied ? '#34c759' : 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'background 0.15s' }}>
                {summaryCopied ? '✓ คัดลอกแล้ว' : 'คัดลอกข้อความ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ยอดติดตั้ง — สรุปยอดติดตั้งสำเร็จ+โบนัสช่างรายเดือน (สูตรตามชีท: ทุน 80% / กำไร 20% / โบนัสรวม 1% ของยอด / หารตามจำนวนช่าง) */}
      {bonusModal && (() => {
        const [by, bm] = bonusMonth.split('-').map(Number)
        const inMonth = installs.filter(ins => {
          if (!ins.appointment_datetime) return false
          const d = new Date(ins.appointment_datetime)
          if (bonusZones.length && !bonusZones.includes(ins.install_zone)) return false
          if (bonusTech && ins.technician_type !== bonusTech) return false
          return d.getFullYear() === by && d.getMonth() === bm - 1
        })
        const done = inMonth.filter(ins => ins.installation_status === 'ติดตั้งเสร็จ')
        const noPrice = done.filter(ins => !(ins.price > 0))
        const total = done.reduce((s, ins) => s + (ins.price > 0 ? ins.price : 0), 0)
        const cost = total * 0.8
        const profit = total * 0.2
        const bonusTotal = total * 0.01
        const bonusEach = techCount > 0 ? Math.round(bonusTotal / techCount) : 0
        const fmtB = (n: number) => '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const monthOptions = Array.from(new Set(installs.filter(i => i.appointment_datetime).map(ins => {
          const d = new Date(ins.appointment_datetime)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }).concat([bonusMonth]))).sort().reverse()
        const card = (label: string, value: string, color: string) => (
          <div key={label} style={{ flex: 1, minWidth: 140, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, marginBottom: 6, whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, whiteSpace: 'nowrap' }}>{value}</div>
          </div>
        )
        return (
          <div onClick={() => setBonusModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 860, maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>ยอดติดตั้ง{(bonusZones.length || bonusTech) ? <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-3)' }}> — {[bonusZones.length ? `โซน${bonusZones.join(' + ')}` : '', bonusTech || ''].filter(Boolean).join(' · ')}</span> : null}</h2>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* เลือกโซน — กดได้หลายโซนพร้อมกัน (กดซ้ำเพื่อเอาออก) · ไม่เลือกเลย = ทุกโซน */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setBonusZones([])}
                      style={{ padding: '5px 12px', borderRadius: 980, border: bonusZones.length === 0 ? 'none' : '1px solid var(--border)', background: bonusZones.length === 0 ? 'var(--blue)' : '#fff', color: bonusZones.length === 0 ? '#fff' : 'var(--ink-3)', fontSize: 12, fontWeight: bonusZones.length === 0 ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      ทุกโซน
                    </button>
                    {ZONES.map(z => {
                      const on = bonusZones.includes(z)
                      return (
                        <button key={z} onClick={() => setBonusZones(prev => on ? prev.filter(v => v !== z) : [...prev, z])}
                          style={{ padding: '5px 12px', borderRadius: 980, border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--blue)' : '#fff', color: on ? '#fff' : 'var(--ink-3)', fontSize: 12, fontWeight: on ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {on ? '✓ ' : ''}{z}
                        </button>
                      )
                    })}
                  </div>
                  {/* เลือกชนิดช่าง */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([['ทุกช่าง', null], ...TECHS.map(t => [t, t] as [string, string])] as [string, string | null][]).map(([label, val]) => (
                      <button key={label} onClick={() => setBonusTech(val)}
                        style={{ padding: '5px 12px', borderRadius: 980, border: bonusTech === val ? 'none' : '1px solid var(--border)', background: bonusTech === val ? '#ff9f0a' : '#fff', color: bonusTech === val ? '#fff' : 'var(--ink-3)', fontSize: 12, fontWeight: bonusTech === val ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <select value={bonusMonth} onChange={e => setBonusMonth(e.target.value)}
                    style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, outline: 'none' }}>
                    {monthOptions.map(m => (
                      <option key={m} value={m}>{TH_MONTHS[Number(m.split('-')[1]) - 1]} {Number(m.split('-')[0]) + 543}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    จำนวนช่าง
                    <input type="number" min={1} value={techCount}
                      onChange={e => { const n = Math.max(1, Number(e.target.value) || 1); setTechCount(n); localStorage.setItem('install_tech_count', String(n)) }}
                      style={{ width: 52, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 13, outline: 'none', textAlign: 'center' }} />
                    คน
                  </label>
                  <button onClick={() => setBonusModal(false)} style={{ border: 'none', background: 'rgba(0,0,0,0.10)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, marginTop: 14, flexWrap: 'wrap' }}>
                {card('งานติดตั้งเสร็จ', `${done.length} งาน`, 'var(--ink)')}
                {card('รวมยอดติดตั้งสำเร็จ', fmtB(total), 'var(--blue)')}
                {card('ทุน 80%', fmtB(cost), 'var(--ink-2)')}
                {card('กำไร 20%', fmtB(profit), '#34c759')}
                {card('โบนัสรวม 1%', fmtB(bonusTotal), '#ff9f0a')}
                {card(`โบนัสต่อคน (${techCount} คน)`, '฿' + bonusEach.toLocaleString('th-TH'), 'var(--red)')}
              </div>
              {noPrice.length > 0 && (
                <div style={{ background: '#fff9e6', border: '1px solid #f0d98c', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#b45309', fontSize: 12, fontWeight: 600 }}>
                  ⚠️ งานติดตั้งเสร็จ {noPrice.length} งานยังไม่ลงราคา — ยอดรวมยังไม่นับงานพวกนี้ ({noPrice.map(i => i.serial_no).join(', ')})
                </div>
              )}
              {done.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24, fontSize: 13 }}>ยังไม่มีงานติดตั้งเสร็จในเดือนนี้{bonusZones.length ? ` (โซน${bonusZones.join(' + ')})` : ''}{bonusTech ? ` (${bonusTech})` : ''}</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                      {['Serial', 'ลูกค้า', 'วันติดตั้ง', 'แพลตฟอร์ม', 'โซน', 'ช่าง', 'สถานะชำระ', 'ราคา'].map(h => (
                        <th key={h} style={{ textAlign: h === 'ราคา' ? 'right' : 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {done.map(ins => (
                      <tr key={ins.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--blue)' }}>{ins.serial_no}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {(ins.customer_real_name || ins.customer_id)
                            ? <Link href={`/customers?name=${encodeURIComponent(ins.customer_real_name || ins.customer_id)}`} title="เปิดโฟลเดอร์ออเดอร์" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{ins.customer_real_name || ins.customer_id}</Link>
                            : '-'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                          {ins.appointment_datetime ? new Date(ins.appointment_datetime).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{ins.platform || '-'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{ins.install_zone || '-'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{ins.technician_type || '-'}</td>
                        <td style={{ padding: '10px 14px', color: ins.payment_status === 'ชำระครบ' ? '#34c759' : 'var(--ink-3)', fontWeight: ins.payment_status === 'ชำระครบ' ? 600 : 400 }}>{ins.payment_status || '-'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: ins.price > 0 ? 'var(--ink)' : '#b45309', whiteSpace: 'nowrap' }}>
                          {ins.price > 0 ? fmtB(ins.price) : 'ยังไม่ลงราคา'}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>รวม</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--blue)', whiteSpace: 'nowrap' }}>{fmtB(total)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      })()}

      {/* Add/Edit modal */}
      {modal && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
              {modal.mode === 'add' ? '+ เพิ่มรายการติดตั้ง' : 'แก้ไขรายการ'}
            </h2>
            {modal.mode === 'add' && (
              <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>วางข้อความจากไลน์</label>
                  <button onClick={parseFromLine} disabled={parsing || !pasteText.trim()}
                    style={{ border: 'none', background: 'var(--blue)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: parsing || !pasteText.trim() ? 'default' : 'pointer', opacity: parsing || !pasteText.trim() ? 0.5 : 1 }}>
                    {parsing ? 'กำลังแปลง…' : '✨ แปลงข้อมูล'}
                  </button>
                </div>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={3}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                {/* ลากไฟล์ PDF ใบเสนอราคามาวาง → อ่านข้อความแล้วกรอกฟอร์มให้ตรวจก่อนบันทึก */}
                <div
                  onDragOver={e => { e.preventDefault(); setQuoteDragOver(true) }}
                  onDragLeave={() => setQuoteDragOver(false)}
                  onDrop={e => {
                    e.preventDefault(); setQuoteDragOver(false)
                    const f = e.dataTransfer.files[0]
                    if (f) handleQuotePdf(f)
                  }}
                  style={{ marginTop: 10, border: `2px dashed ${quoteDragOver ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 10, padding: '22px 16px', textAlign: 'center', background: quoteDragOver ? 'var(--blue-bg)' : 'var(--surface)', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{parsing ? 'กำลังอ่านใบเสนอราคา…' : 'วางไฟล์ใบเสนอราคาที่นี่'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>รองรับ .pdf</div>
                  <label style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: 'var(--bg)', color: 'var(--ink)' }}>
                    เลือกไฟล์
                    <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handleQuotePdf(f)
                      e.target.value = ''
                    }} />
                  </label>
                </div>
                {parseError && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--red)' }}>{parseError}</div>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>วันที่นัดหมาย</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(apptDate) ? apptDate : ''}
                    onChange={e => { if (e.target.value) setApptDate(e.target.value) }}
                    onMouseDown={e => { e.preventDefault(); try { (e.target as HTMLInputElement).showPicker() } catch {} }}
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: apptDate ? 'transparent' : 'var(--ink-3)' }}
                  />
                  {apptDate && (
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingLeft: 10, fontSize: 13, color: 'var(--ink)', pointerEvents: 'none' }}>
                      {apptDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>เวลานัด</label>
                <select value={apptTime} onChange={e => setApptTime(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none' }}>
                  {TIMES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {sel('ลักษณะงาน', 'work_type', WORK_TYPES)}
              {sel('จาก', 'platform', PLATFORMS)}
              {sel('ผู้ลงข้อมูล', 'entered_by', ENTERED_BY)}
              {/* ชื่อลูกค้า — พิมพ์แล้วเดาชื่อจากลูกค้าที่เคยมีในระบบ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */}
              {(() => {
                const val = String(modal.data.customer_id ?? '')
                const key = val.trim().toLowerCase()
                const sugs = key
                  ? customerNames
                      .filter(n => n.toLowerCase().includes(key) && n.toLowerCase() !== key)
                      .sort((a, b) => Number(b.toLowerCase().startsWith(key)) - Number(a.toLowerCase().startsWith(key)))
                      .slice(0, 8)
                  : []
                return (
                  <div style={{ marginBottom: 12, position: 'relative' }}>
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ชื่อลูกค้า</label>
                    <input type="text" autoComplete="off" value={val}
                      onChange={e => { set('customer_id', e.target.value); setNameSugOpen(true) }}
                      onFocus={() => setNameSugOpen(true)}
                      onBlur={() => setTimeout(() => setNameSugOpen(false), 120)}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    {nameSugOpen && sugs.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,0.14)', zIndex: 30, maxHeight: 190, overflowY: 'auto', marginTop: 2 }}>
                        {sugs.map(n => (
                          <div key={n} onMouseDown={e => { e.preventDefault(); set('customer_id', n); setNameSugOpen(false) }}
                            style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', color: 'var(--ink)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff' }}>
                            {n}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
              {inp('จังหวัด', 'province')}
              {sel('โซนติดตั้ง', 'install_zone', ZONES)}
              {sel('ช่าง', 'technician_type', TECHS)}
              {inp('เบอร์โทร', 'phone')}
              {sel('การนัดหมาย', 'appointment_status', ['รอนัดหมาย','นัดหมายแล้ว','จัดส่งตามที่อยู่'])}
            </div>
            {inp('ลิงค์โลเคชั่น', 'location_link')}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>รายละเอียดงาน</label>
              <textarea value={modal.data.work_details ?? ''} onChange={e => set('work_details', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>หมายเหตุ</label>
              <textarea value={modal.data.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            {ph.trigger()}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={closeModal}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
          {ph.open && ph.panel()}
        </div>
      )}

      {/* กล่องยืนยัน (ลบรายการติดตั้ง) — ต้องอยู่ท้ายสุดเพื่อทับทุกโมดัล */}
      {confirmDialog}
    </div>
  )
}
