'use client'

import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { itemBlockLines, heightText, formatItemLines, railKind, railSplit, railLayers } from '@/lib/itemFormat'
import { railLink } from '@/lib/rail'
import { OUTSIDE_PLATFORMS, PROD_STATUSES, INSTALL_STATUSES, PROD_STATUS_COLOR, matchQuickTab, effectiveDueDate, type QuickTab } from '@/lib/orderTabs'
import { detectCarrier, CARRIER_OPTIONS } from '@/lib/carriers'
import { effShipping } from '@/lib/shipping'
import { thaiTrackStatus } from '@/lib/trackExtract'
import { syncOutsourcePO } from '@/lib/outsourceSync'
import { useInstallPhotos, photoSaveError } from '@/components/InstallPhotos'
import ProvinceSelect from '@/components/ProvinceSelect'
import { syncWorkStatus as syncWorkStatusExact } from '@/lib/workStatusSync'
import { recordAction } from '@/lib/history'
import { prevOf } from '@/lib/trackedDb'
import { stampInsert, oeUpdate, oeInsert, instUpdate, instInsert, claimUpdate } from '@/lib/adminActor'
import { useStableView } from '@/lib/useStableView'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'

type Item = {
  type: string
  floors: number | null
  rail_head: string       // ผ้าม่านจีบ = จำนวนจีบ ("3จีบ") · ราง = หัวราง
  hook_type?: string      // ชนิดตะขอ (ตะขอสั้น/ยาว/เพดาน) แยกช่องจากจำนวนจีบ
  eyelet_color?: string   // สีห่วงตาไก่ (เฉพาะม่านตาไก่) เช่น สีขาว สีสัก สีดำ
  fabric_type: string
  color_code: string
  color_name: string
  color_desc: string
  width: number | string
  height: number | string
  quantity: number | string
  unit: string
  hooks: string
  orientation?: string    // การวางผ้า เช่น "ขวางผ้า" — โชว์ต่อท้ายบรรทัดสีตามใบออเดอร์ต้นฉบับ
  fabric_split?: string   // แบ่งผ้า (ม่านผ้าทั่วไป): แยกกลาง / สไลด์เดี่ยว
  chemical?: string       // เคมี (เฉพาะม่านซ่อนหู): ใส่เคมี / ไม่ใส่เคมี
  weight_chain?: string   // โซ่ถ่วง: ว่าง = ไม่ได้ระบุ / ใส่โซ่ถ่วง / ไม่รับโซ่ถ่วง
  pull_side?: string      // ฝั่งดึง (ม่านพับ/มู่ลี่): ดึงซ้าย / ดึงขวา
  note: string
  outsource?: string      // สั่งนอกของรายการนี้ — ตอนบันทึกจะรวมทุกรายการไปลงคอลัมน์สั่งนอกของออเดอร์
}

type StatusEvent = {
  status: string
  at: string
  by: string | null   // ใครทำ — ยังว่าง (null) จนกว่าจะเริ่มใช้ตัวสแกนเดือนหน้า
}

// พัสดุ 1 เลข = 1 รายการ — status/events เติมทีหลังจาก extension เช็คให้
type Shipment = {
  no: string
  carrier: string
  status: string                                    // ข้อความสถานะล่าสุด เช่น "กำลังนำส่ง"
  events: { time: string; desc: string }[] | null   // timeline ใหม่ → เก่า
  checked_at: string | null
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
  install_time: string
  province: string
  phone: string
  location_link: string
  outsource: string
  outsource_at: string | null
  address: string
  install_status: string
  notes: string
  price: number | null
  payment_status: string
  deposit: number | null
  paid_amount: number | null   // ยอดที่ลูกค้าชำระมาแล้ว (กรอกเอง) — ที่เหลือ = ยอดทั้งหมด − ยอดนี้
  order_assigned: string
  created_at: string
  updated_at: string
  shipped_at: string | null
  rail_packed: boolean
  rail_packed_at: string | null
  done_at: string | null
  printed_at: string | null
  status_history: StatusEvent[] | null
  shipments: Shipment[] | null
  // ยอดโอนจริงจากไฟล์ Income Shopee (sql/add_net_income.sql)
  net_income?: number | null
  net_income_at?: string | null
  // ใครทำ (sql/admin_activity.sql) — คนลงออเดอร์ตั้งครั้งเดียว, actor = คนบันทึกล่าสุด
  created_by_code?: string | null
  created_by_name?: string | null
  actor_code?: string | null
  actor_name?: string | null
  admin_code?: string | null
  last_content_at?: string | null
  // แถวที่ดึงมาจากหน้าเคลม (ตาราง claims) — ไม่ใช่ใบออเดอร์จริง แก้ได้เฉพาะสถานะ/งานเสร็จ/จัดส่ง/ปริ้น/หมายเหตุ
  claim_id?: string | null
}

// สถานะเคลม ↔ สถานะออเดอร์ (ต่างกันแค่หัวกับท้ายของสายงาน)
const CLAIM_TO_ORDER_STATUS: Record<string, string> = { 'รอของคืน': 'รอดำเนินการ', 'ส่งแล้ว': 'จัดส่งแล้ว' }
const ORDER_TO_CLAIM_STATUS: Record<string, string> = { 'รอดำเนินการ': 'รอของคืน', 'จัดส่งแล้ว': 'ส่งแล้ว', 'รอจัดส่ง': 'แพ็คแล้ว', 'รอติดตั้ง': 'แพ็คแล้ว' }
const isClaimEntry = (r: { claim_id?: string | null }) => !!r.claim_id

// แถวเคลม → หน้าตาแบบใบออเดอร์ (ใช้ตัวกรอง/การเรียง/คอลัมน์ชุดเดียวกับออเดอร์)
type ClaimSource = {
  id: string; claim_date: string | null; deadline: string | null; channel: string | null
  customer_username: string | null; original_order_number: string | null; items: Item[] | null
  status: string | null; is_urgent: boolean | null; notes: string | null; courier: string | null
  printed_at: string | null; shipped_at: string | null; admin_name: string | null
  estimated_price: number | null; created_at?: string | null; updated_at?: string | null
}
const claimToEntry = (c: ClaimSource): Entry => ({
  ...emptyForm(),
  id: c.id,
  claim_id: c.id,
  entry_date: c.claim_date,
  deadline: c.deadline,
  platform: `เคลม:${c.channel || 'หน้าร้าน'}`,
  customer_name: c.customer_username,
  order_number: c.original_order_number,
  items: c.items,
  order_status: CLAIM_TO_ORDER_STATUS[c.status ?? ''] ?? c.status ?? 'รอดำเนินการ',
  is_urgent: !!c.is_urgent,
  notes: c.notes,
  courier: c.courier,
  printed_at: c.printed_at,
  shipped_at: c.shipped_at,
  admin_name: c.admin_name,
  price: c.estimated_price,
  created_at: c.created_at ?? '',
  updated_at: c.updated_at ?? '',
} as Entry)

const emptyItem = (): Item => ({ type: '', floors: null, rail_head: '', hook_type: '', eyelet_color: '', fabric_type: '', color_code: '', color_name: '', color_desc: '', width: '', height: '', quantity: 1, unit: 'ชุด', hooks: '', orientation: '', fabric_split: '', chemical: '', weight_chain: '', pull_side: '', note: '', outsource: '' })

// รวมข้อความสั่งนอกจากทุกรายการ → ไว้ลงคอลัมน์สั่งนอกของออเดอร์
const itemsOutsourceText = (items: Item[]): string =>
  items.map(it => (it.outsource ?? '').trim()).filter(Boolean).join(', ')

// ความกว้างอาจเป็น "1.69+0.49" (รางต่อโค้ง) ต้องเก็บทั้งสองค่าไว้ให้ช่างเห็น
// ทศนิยม: ปกติ 2 ตำแหน่ง ถ้าลงมา 3 ตำแหน่งเก็บ 3 ตำแหน่งตามต้นฉบับ
const widthText = (w: number | string): string => {
  const raw = typeof w === 'string' ? w.trim() : ''
  if (raw.includes('+')) return raw
  const n = Number(w)
  if (!(n > 0)) return ''
  const dec = (String(w ?? '').trim().split('.')[1] || '').length
  return n.toFixed(dec >= 3 ? 3 : 2)
}

const PLATFORMS = ['Tiktok','Tiktok-Chat','Shopee','Shopee-Chat','Lazada','Facebook','LineOA',
  'Lineส่วนตัวยุน','Lineส่วนตัวสู้','Lineส่วนตัวเฟิร์น','Lineส่วนตัวน็อต','หน้าร้าน',
  'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:หน้าร้าน',
  'เคลม:LineOA','เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวสู้','เคลม:Lineส่วนตัวเฟิร์น','เคลม:Lineส่วนตัวน็อต']

const COURIERS = [
  'J&T Express',
  'LEX TH',
  'Standard Delivery - ส่งธรรมดาในประเทศ-SPX Express',
  'Standard Delivery - ส่งธรรมดาในประเทศ-Flash Express',
  'Standard Delivery - ส่งธรรมดาในประเทศ',
  'Standard Delivery Bulky - ส่งสินค้าขนาดใหญ่-Flash Express Bulky',
]

// ตัวเลือกในช่องแอดมิน (เลือกเอง) — user กำหนดรายชื่อชุดนี้เอง
// ‼️ คนละชุดกับ BONUS_ADMINS ใน lib/adminActor.ts (กลุ่มที่ระบบใส่ชื่อให้อัตโนมัติ)
const ADMINS = ['กาย', 'แพท', 'หนูนา', 'ยุน', 'ส้ม', 'เก๋']
const TECHS = ['ช่างดอนน่า', 'ช่างพี่ฟอง', 'ช่างเชียงใหม่']

// ไฮไลต์ช่องที่ยังไม่ได้ลงข้อมูล (คอลัมน์แอดมิน/ช่าง) — สีส้มชุดเดียวกับสถานะ "รอดำเนินการ" (#f59e0b ใน PROD_STATUS_COLOR)
const EMPTY_HL = 'rgba(245,158,11,0.42)'

const TIMES = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

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
  const result = Math.ceil(diff / 86400000)
  return isNaN(result) ? null : result
}

// detectCarrier/CARRIER_OPTIONS ย้ายไป lib/carriers.ts (ใช้ร่วมกับหน้า /scan)
// เจ้าที่ extension เปิดแท็บดึงสถานะได้ — J&T มีสไลด์ captcha ต้องเปิดแท็บจริงให้คนเลื่อน 1 ครั้ง (active)
// SPX เรียก API ตรงได้ผ่าน /api/track-spx, ไปรษณีย์ไทยใช้ API ทางการผ่าน /api/track-thailandpost (Kerry เว็บกันหนัก อาจ timeout)
const EXT_CARRIERS = ['Flash Express', 'J&T Express', 'Kerry Express']
const API_CARRIERS: Record<string, string> = { 'SPX Express': '/api/track-spx', 'ไปรษณีย์ไทย': '/api/track-thailandpost' }
const isAutoCarrier = (c: string) => EXT_CARRIERS.includes(c) || c in API_CARRIERS

const CARRIER_TRACK_URL: Record<string, (no: string) => string> = {
  'Flash Express': no => `https://www.flashexpress.com/fle/tracking?se=${no}`,
  'SPX Express': no => `https://spx.co.th/track?${no}`,
  'ไปรษณีย์ไทย': no => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  'J&T Express': no => `https://www.jtexpress.co.th/service/track?bills=${no}`,
  'Kerry Express': no => `https://th.kerryexpress.com/th/track/?track=${no}`,
  'Ninja Van': no => `https://www.ninjavan.co/th-th/tracking?id=${no}`,
}
const carrierTrackUrl = (sh: Shipment) =>
  CARRIER_TRACK_URL[sh.carrier]?.(sh.no) || `https://www.google.com/search?q=${encodeURIComponent(sh.no + ' เช็คพัสดุ')}`

// สี/ข้อความคอลัมน์วันที่เหลือ: เกินกำหนด+0 วัน = แดง (0 = ต้องจัดส่งวันนี้), 1-10 วัน = เหลือง, >10 วัน = เขียว
const daysLabel = (d: number) => d < 0 ? `เกิน ${Math.abs(d)} วัน` : d === 0 ? 'ต้องจัดส่งวันนี้' : `${d} วัน`
const daysColor = (d: number) => d <= 0 ? 'var(--red)' : d <= 10 ? '#eab308' : '#34c759'

const emptyForm = (): Omit<Entry, 'id' | 'created_at' | 'updated_at' | 'shipping_datetime' | 'shipped_at' | 'rail_packed' | 'rail_packed_at' | 'done_at' | 'printed_at' | 'status_history' | 'shipments' | 'outsource_at' | 'install_status'> => ({
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
  install_time: '9:00',
  province: '',
  phone: '',
  address: '',
  location_link: '',
  outsource: '',
  notes: '',
  price: null,
  payment_status: 'ยังไม่ชำระ',
  deposit: null,
  paid_amount: null,
  order_assigned: 'รออัพเดท',
})

const STATUS_COLOR: Record<string, string> = {
  'อยู่ในกำหนด': '#34c759',
  'งานเสร็จแล้ว': 'var(--blue)',
}

// PROD_STATUSES / INSTALL_STATUSES / PROD_STATUS_COLOR / OUTSIDE_PLATFORMS / matchQuickTab
// ย้ายไป lib/orderTabs.ts แล้ว — ใช้ร่วมกับหน้ามือถือ (/m/orders) จะได้ไม่กรองข้อมูลเพี้ยนจากกัน

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

// คอลัมน์ที่ซ่อน/โชว์ได้ ต่อแต่ละแท็บ (คอลัมน์ checkbox เลือกแถว + ··· ซ่อนไม่ได้)
const COLUMN_DEFS: Record<string, { id: string; label: string }[]> = {
  all: [
    { id: 'days', label: 'วันที่เหลือ' }, { id: 'deadline', label: 'ต้องส่งภายใน' },
    { id: 'print', label: 'ปริ้น' },
    { id: 'customer', label: 'ลูกค้า' }, { id: 'platform', label: 'แพลตฟอร์ม' },
    { id: 'courier', label: 'บริษัทจัดส่ง' }, { id: 'status', label: 'สถานะงาน' },
    { id: 'done', label: 'งานเสร็จ' }, { id: 'shipped', label: 'จัดส่งแล้ว' },
    { id: 'rail', label: 'สถานะราง' },
    { id: 'notes', label: 'หมายเหตุ' }, { id: 'updated', label: 'แก้ไขล่าสุด' },
  ],
  platform: [
    { id: 'days', label: 'วันที่เหลือ' }, { id: 'shipping', label: 'ต้องส่งภายใน' },
    { id: 'print', label: 'ปริ้น' },
    { id: 'order_number', label: 'เลขคำสั่งซื้อ' }, { id: 'customer', label: 'ลูกค้า' },
    { id: 'price', label: 'ราคาสุทธิ' }, { id: 'items', label: 'รายการ' },
    { id: 'platform', label: 'แพลตฟอร์ม' }, { id: 'courier', label: 'บริษัทส่ง' },
    { id: 'pay_date', label: 'วันที่ชำระ' }, { id: 'ship_date', label: 'วันที่ต้องส่ง' },
    { id: 'admin', label: 'แอดมิน' }, { id: 'tech', label: 'ช่าง' },
    { id: 'status', label: 'สถานะงาน' }, { id: 'dropoff', label: 'Drop-off' },
    { id: 'done', label: 'งานเสร็จ' }, { id: 'shipped', label: 'จัดส่งแล้ว' },
    { id: 'rail', label: 'สถานะราง' }, { id: 'outsource', label: 'สั่งนอก' },
    { id: 'ship_address', label: 'ที่อยู่จัดส่งแยก' },
    { id: 'notes', label: 'หมายเหตุ' }, { id: 'updated', label: 'เวลาที่แก้ไข' },
  ],
  outside: [
    { id: 'days', label: 'วันที่เหลือ' }, { id: 'deadline', label: 'ต้องส่งภายใน' },
    { id: 'print', label: 'ปริ้น' },
    { id: 'customer', label: 'ลูกค้า' }, { id: 'platform', label: 'แพลตฟอร์ม' },
    { id: 'items', label: 'รายการ' }, { id: 'total', label: 'ยอดทั้งหมด' },
    { id: 'payment', label: 'ชำระ' }, { id: 'paid', label: 'ชำระแล้ว' },
    { id: 'paybefore', label: 'ยอดชำระก่อนจัดส่ง' },
    { id: 'assigned', label: 'ลงออเดอร์' }, { id: 'admin', label: 'แอดมิน' },
    { id: 'status', label: 'สถานะงาน' },
    { id: 'done', label: 'งานเสร็จ' }, { id: 'shipped', label: 'จัดส่งแล้ว' },
    { id: 'rail', label: 'สถานะราง' },
    { id: 'created', label: 'วันที่สร้าง' }, { id: 'outsource', label: 'สั่งนอก' },
    { id: 'address', label: 'ที่อยู่' }, { id: 'phone', label: 'เบอร์โทร' },
    { id: 'notes', label: 'หมายเหตุ' },
    { id: 'updated', label: 'แก้ไขล่าสุด' },
  ],
  install: [
    { id: 'days', label: 'วันที่เหลือ' }, { id: 'deadline', label: 'วันที่ติดตั้ง' },
    { id: 'print', label: 'ปริ้น' },
    { id: 'customer', label: 'ลูกค้า' }, { id: 'platform', label: 'แพลตฟอร์ม' },
    { id: 'items', label: 'รายการ' }, { id: 'total', label: 'ยอดทั้งหมด' },
    { id: 'payment', label: 'ชำระ' }, { id: 'paid', label: 'ชำระแล้ว' },
    { id: 'paybefore', label: 'ยอดชำระหลังติดตั้ง' },
    { id: 'assigned', label: 'ลงออเดอร์' }, { id: 'admin', label: 'แอดมิน' },
    { id: 'status', label: 'สถานะงาน' },
    { id: 'done', label: 'งานเสร็จ' }, { id: 'installed', label: 'ติดตั้ง' },
    { id: 'rail', label: 'สถานะราง' },
    { id: 'created', label: 'วันที่สร้าง' }, { id: 'outsource', label: 'สั่งนอก' },
    { id: 'province', label: 'จังหวัด' },
    { id: 'address', label: 'ที่อยู่' }, { id: 'phone', label: 'เบอร์โทร' }, { id: 'maps', label: 'Maps' },
    { id: 'notes', label: 'หมายเหตุ' },
    { id: 'updated', label: 'แก้ไขล่าสุด' },
  ],
}

// คอลัมน์รายการโชว์ได้ไม่เกินกี่บรรทัด (เกินนี้ขึ้น "+ อีก N รายการ" แทน แถวจะได้ไม่ยืด)
const ITEM_LINE_MAX = 3

const isClaimRow = (platform: string | null | undefined) => (platform ?? '').startsWith('เคลม:')

// ปริ้นใบงานเกิน 24 ชม. แล้ว แต่สถานะผลิตยังไม่ขยับ (ยังเป็น "รอดำเนินการ")
const isPrintedPending = (r: Entry) => {
  if (!r.printed_at) return false
  if (r.order_status && r.order_status !== 'รอดำเนินการ') return false
  const t = new Date(r.printed_at).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t >= 24 * 60 * 60 * 1000
}

// สถานะติดตั้ง: แถวเก่าที่ติ๊ก checkbox ไว้ (is_dropoff) ให้ถือเป็น "ติดตั้งแล้ว"
const installStatusOf = (r: Entry) => r.install_status || (r.is_dropoff ? 'ติดตั้งแล้ว' : '')
const INSTALL_STATUS_OPTIONS = ['ติดตั้งแล้ว', 'ติดตั้ง50%']
const linkHref = (l: string) => /^https?:\/\//i.test(l) ? l : `https://${l}`

export default function OrderWorkspace({ scope = 'orders' }: { scope?: 'orders' | 'claims' }) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const modalDownOnBackdrop = useRef(false)
  const tableCardRef = useRef<HTMLDivElement>(null)
  // เปิดหน้าซ้ำ → โชว์ข้อมูลรอบก่อนทันที แล้ว load() ดึงของใหม่เบื้องหลัง (stale-while-revalidate)
  const cached = getPageCache<{ rows: Entry[]; sortOrder: string[] }>('order_entries')
  const [rows, setRows] = useState<Entry[]>(cached?.rows ?? [])
  // แถวไม่เด้งหนีตอนติ๊ก/เปลี่ยนสถานะ — กรอง+เรียงด้วย stable() แต่แสดงผลด้วย live() (ดู lib/useStableView.ts)
  const { snapshot, stable, live } = useStableView<Entry>(rows)
  const [loading, setLoading] = useState(!cached)
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
  const [openFilter, setOpenFilter] = useState<'platform' | 'courier' | 'status' | 'admin' | 'tech' | 'shipping' | 'urgent' | 'install' | 'days' | 'updated' | 'out-days' | 'out-deadline' | 'out-platform' | 'out-payment' | 'out-assigned' | 'out-admin' | 'out-status' | 'out-done' | 'out-installed' | 'out-updated' | null>(null)
  const [daysSort, setDaysSort] = useState<'asc' | 'desc' | null>('asc')
  const [sortOrder, setSortOrder] = useState<string[]>(cached?.sortOrder ?? [])
  const [updatedSort, setUpdatedSort] = useState<'asc' | 'desc' | null>(null)
  const [outDaysSort, setOutDaysSort] = useState<'asc' | 'desc' | null>('asc')
  const [outUpdatedSort, setOutUpdatedSort] = useState<'asc' | 'desc' | null>(null)
  const [outDeadlineFrom, setOutDeadlineFrom] = useState('')
  const [outDeadlineTo, setOutDeadlineTo] = useState('')
  const [outPlatformFilters, setOutPlatformFilters] = useState<string[]>([])
  const [outPaymentFilters, setOutPaymentFilters] = useState<string[]>([])
  const [outAssignedFilters, setOutAssignedFilters] = useState<string[]>([])
  const [outAdminFilters, setOutAdminFilters] = useState<string[]>([])
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
  const [pasteCol9, setPasteCol9] = useState('') // เวลาส่งสินค้า (Shopee) → ใช้เป็นวันที่จัดส่งแล้ว
  const [pasteRows, setPasteRows] = useState<{ paymentDate: string; deadline: string; orderNumber: string; price: number; customerName: string; courier: string; orderStatus: string; isDuplicate: boolean; isDropoff: boolean; shippedDate: string }[]>([])
  const [pasteSaving, setPasteSaving] = useState(false)
  // ไฟล์ Income Shopee (ยอดโอนจริงหลังหักค่าธรรมเนียมครบ) — drop ช่องเดียวกับไฟล์ออเดอร์ ตรวจแยกอัตโนมัติ
  const [incomeRows, setIncomeRows] = useState<{ orderNumber: string; amount: number; payoutDate: string; matchedId: string | null; hasIncome: boolean }[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [modalItems, setModalItems] = useState<Item[]>([])
  const [itemsModal, setItemsModal] = useState<{ id: string; items: Item[]; instId: string | null } | null>(null)
  // รูปหน้างาน (งานติดตั้ง) — คอมโพเนนต์กลางตัวเดียวกับหน้างานติดตั้ง
  const ph = useInstallPhotos()
  const [itemsPasteText, setItemsPasteText] = useState('')
  const [itemsModalPasteText, setItemsModalPasteText] = useState('')
  const [itemsModalLoading, setItemsModalLoading] = useState(false)
  const [itemsModalError, setItemsModalError] = useState('')
  const [openAction, setOpenAction] = useState<string | null>(null)
  const [actionRect, setActionRect] = useState<DOMRect | null>(null)
  // จัดส่งแล้ว + ติดตามพัสดุ — manual = ผู้ใช้เลือกเจ้าเองจาก dropdown แล้ว ไม่ต้องเดาทับ
  const [shipModal, setShipModal] = useState<{ id: string; parcels: { no: string; carrier: string; manual: boolean }[] } | null>(null)
  const [shipSaving, setShipSaving] = useState(false)
  const [editShipped, setEditShipped] = useState<string | null>(null)  // "<entry id>|<done_at|shipped_at>" ที่กำลังแก้วัน-เวลา
  const [trackModal, setTrackModal] = useState<string | null>(null)   // entry id ที่เปิดดูสถานะพัสดุ
  const [trackChecking, setTrackChecking] = useState<string | null>(null)  // entry id ที่กำลังเช็ค — แยกต่อออเดอร์ กันเช็คตัวหนึ่งค้างแล้วล็อกทั้งหน้า
  const [trackError, setTrackError] = useState('')
  const [extReady, setExtReady] = useState(false)                     // Chrome extension "Donna Track" ติดตั้งอยู่ไหม
  const [extPrompt, setExtPrompt] = useState<{ id: string; parcels: { no: string; carrier: string; manual: boolean }[] } | null>(null)  // popup ชวนติดตั้ง extension (เก็บ payload ไว้ไปต่อ shipModal)
  const [printAsk, setPrintAsk] = useState<Entry[] | null>(null) // หลายรายการ → ถามก่อนว่าตาราง/ฟอร์ม
  const [editCell, setEditCell] = useState<{id: string; field: string; val: string} | null>(null)
  const [shipDtEdit, setShipDtEdit] = useState<{ id: string; date: string; time: string } | null>(null) // จิ้มคอลัมน์ต้องส่งภายในเพื่อแก้วัน/เวลา
  const [installDtEdit, setInstallDtEdit] = useState<{ id: string; date: string; time: string } | null>(null) // จิ้มคอลัมน์วันที่ติดตั้งเพื่อแก้วัน/เวลานัด
  const [printModal, setPrintModal] = useState(false)
  const [printMaxDays, setPrintMaxDays] = useState(3)
  // id ใบออเดอร์ที่ในปฏิทินไม่ใช่ "งานติดตั้ง" (งานวัดหน้างาน ฯลฯ) — ซ่อนจากหมวดออเดอร์
  const [nonOrderIds, setNonOrderIds] = useState<Set<string>>(new Set())
  const [quickFilter, setQuickFilter] = useState<'all' | 'platform' | 'outside' | 'install' | 'claim' | 'shipped' | 'cancelled'>('all')
  const [hiddenCols, setHiddenCols] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(`ow_hidden_cols_${scope}`) || '{}') } catch { return {} }
  })
  const [openColMenu, setOpenColMenu] = useState(false)
  const colTabKey = (quickFilter === 'claim' || quickFilter === 'shipped' || quickFilter === 'cancelled') ? 'all' : quickFilter
  const tabHidden = hiddenCols[colTabKey] ?? []
  const showCol = (id: string) => !tabHidden.includes(id)
  const toggleCol = (id: string) => setHiddenCols(prev => {
    const cur = prev[colTabKey] ?? []
    const next = cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id]
    const obj = { ...prev, [colTabKey]: next }
    try { localStorage.setItem(`ow_hidden_cols_${scope}`, JSON.stringify(obj)) } catch {}
    return obj
  })
  const [addTypeModal, setAddTypeModal] = useState(false)
  const [incompleteFilter, setIncompleteFilter] = useState(false)
  const [unprintedFilter, setUnprintedFilter] = useState(false)
  const [printedPendingFilter, setPrintedPendingFilter] = useState(false)
  const [allDaysSort, setAllDaysSort] = useState<'asc' | 'desc' | null>('asc')
  const [allUpdatedSort, setAllUpdatedSort] = useState<'asc' | 'desc' | null>(null)
  const [allDeadlineFrom, setAllDeadlineFrom] = useState('')
  const [allDeadlineTo, setAllDeadlineTo] = useState('')
  const [allPlatformFilters, setAllPlatformFilters] = useState<string[]>([])
  const [allStatusFilters, setAllStatusFilters] = useState<string[]>([])
  const [allDoneFilter, setAllDoneFilter] = useState<boolean | null>(null)
  const [allCourierFilters, setAllCourierFilters] = useState<string[]>([])
  const [openAllFilter, setOpenAllFilter] = useState<'days'|'deadline'|'platform'|'courier'|'status'|'done'|'updated'|null>(null)
  const [addType, setAddType] = useState<'platform' | 'outside' | 'install' | 'claim' | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [orderPasteText, setOrderPasteText] = useState('')      // วางข้อความไลน์ → autofill ทั้งฟอร์ม
  const [orderParsing, setOrderParsing] = useState(false)
  const [orderParseError, setOrderParseError] = useState('')
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
      const aShipping = effShipping(a)
      const bShipping = effShipping(b)
      const da = parseD(aShipping), db = parseD(bShipping)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return sort === 'asc' ? da.getTime() - db.getTime() : db.getTime() - da.getTime()
    }).map(r => r.id)
  }

  const load = async () => {
    const { data, error: err } = await fetchAllRows<Entry>(() =>
      supabase.from('order_entries').select('*').order('entry_date', { ascending: false, nullsFirst: false }).order('id', { ascending: true }))
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    // ใบที่ผูกกับปฏิทิน แต่ในปฏิทินไม่ใช่ "งานติดตั้ง" (เช่น งานวัดหน้างาน) → ไม่ต้องโชว์ในหมวดออเดอร์
    const { data: insts } = await fetchAllRows<{ source_order_id: string | null; work_type: string | null }>(() =>
      supabase.from('installations').select('source_order_id, work_type').not('source_order_id', 'is', null))
    setNonOrderIds(new Set(insts.filter(i => i.source_order_id && i.work_type !== 'งานติดตั้ง').map(i => i.source_order_id as string)))
    // งานเคลมจากหน้าเคลม (ตาราง claims) → โชว์ปนในหมวดออเดอร์ด้วย จะได้เรียงวันที่เหลือรวมกัน
    const CLAIM_COLS = 'id, claim_date, channel, customer_username, original_order_number, items, status, is_urgent, notes, courier, printed_at, shipped_at, admin_name, estimated_price, created_at, updated_at'
    let claimRes = await fetchAllRows<ClaimSource>(() => supabase.from('claims').select(`${CLAIM_COLS}, deadline`))
    // ยังไม่ได้รัน scripts/add_claim_deadline.sql → ดึงแบบไม่มีคอลัมน์กำหนดส่งไปก่อน (งานเคลมยังโชว์ได้)
    if (claimRes.error) claimRes = await fetchAllRows<ClaimSource>(() => supabase.from('claims').select(CLAIM_COLS))
    const claimEntries = claimRes.data.map(claimToEntry)
    const entries = scope === 'claims' ? data : [...data, ...claimEntries]
    const order = computeSortOrder(entries, daysSort)
    setPageCache('order_entries', { rows: entries, sortOrder: order })
    setRows(entries)
    snapshot(entries)   // ตั้งจุดอ้างอิงใหม่ → แถวที่ค้างรอย้าย (ติ๊กจัดส่ง/งานเสร็จ) ไปเข้าที่ตอนนี้
    setSortOrder(order)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // อัปเดตสด: สแกน/แก้จากเครื่องอื่นแล้วตารางนี้เปลี่ยนเองโดยไม่ต้องรีเฟรช
  useEffect(() => {
    const ch = supabase
      .channel('order_entries_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_entries' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const row = payload.new as Entry
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...row } : r))
        } else {
          load()   // INSERT/DELETE — โหลดใหม่ให้ลำดับถูก (เกิดไม่บ่อย)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

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

  // sync ออเดอร์ติดตั้ง → ปฏิทินงานติดตั้ง (ตาราง installations) ผูกด้วย source_order_id
  // ออเดอร์เป็นเจ้าของข้อมูลการนัด (วัน/เวลา/จังหวัด/เบอร์/โลเคชั่น) → push ทุกครั้งที่บันทึก
  // ส่วนสถานะติดตั้ง/ลักษณะงาน เป็นของฝั่งปฏิทิน ไม่ทับ
  // - ปลด is_installation: ลบแถวในปฏิทิน (ลบออเดอร์ทั้งแถวมี FK cascade จัดการเอง)
  const syncInstallation = async (p: Record<string, unknown>, orderId: string) => {
    if (!orderId) return
    if (p.is_installation) {
      // "กำหนดติดตั้ง" เก็บที่ deadline (installation_date มักว่าง) + เวลานัดจาก install_time
      const instDate = p.installation_date || p.deadline
      const t = String(p.install_time || '9:00').split(':')
      const hhmm = `${(t[0] || '9').padStart(2, '0')}:${(t[1] || '00').padStart(2, '0')}`
      const apptFromDate = instDate ? `${String(instDate)}T${hhmm}:00+07:00` : null
      // ข้อมูลที่ออเดอร์เป็นเจ้าของ (ไม่รวม serial_no — กำหนดครั้งเดียวตอนสร้าง ไม่เปลี่ยนตอนแก้)
      const onsite = {
        appointment_datetime: apptFromDate,
        platform: p.platform || '',
        customer_id: p.customer_name || '',
        customer_real_name: p.customer_name || '',
        province: p.province || '',
        phone: p.phone || '',
        location_link: p.location_link || '',
        price: p.price ?? 0,
        notes: p.notes || '',
        entered_by: p.admin_name || '',
        updated_at: p.updated_at,
      }
      const { data: existing } = await supabase.from('installations').select('id').eq('source_order_id', orderId).maybeSingle()
      if (existing) {
        await instUpdate(onsite).eq('source_order_id', orderId)
      } else {
        // รัน serial เลข 4 หลักต่อจากที่มีอยู่ (เหมือนรายการที่ลงในหน้าปฏิทินเอง)
        const { data: serials } = await supabase.from('installations').select('serial_no')
        const maxN = (serials ?? []).reduce((mx, r) => Math.max(mx, parseInt(String(r.serial_no), 10) || 0), 0)
        await instInsert({
          source_order_id: orderId,
          serial_no: String(maxN + 1).padStart(4, '0'),
          work_type: 'งานติดตั้ง',
          work_details: '',
          payment_status: p.payment_status || 'รอมัดจำ',
          appointment_status: 'นัดหมายแล้ว',
          production_status: 'กำลังผลิต',
          send_to_technician: 'หน้าร้าน',
          installation_status: 'ติดตั้ง',
          ...onsite,
        })
      }
    } else {
      await supabase.from('installations').delete().eq('source_order_id', orderId)
    }
  }

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const d = modal.data
    const now = new Date().toISOString()
    // งานเคลม: บังคับให้ platform ขึ้นต้นด้วย "เคลม:" เสมอ เพื่อให้ไปอยู่ tab งานเคลม
    const isClaimAdd = modal.mode === 'add' && addType === 'claim'
    const platformVal = d.platform
      ? (isClaimAdd && !d.platform.startsWith('เคลม:') ? `เคลม:${d.platform}` : d.platform)
      : null
    // สั่งนอกจากรายการสินค้า: มีข้อความ → ทับช่องสั่งนอกของออเดอร์ + ประทับเวลาเมื่อข้อความเปลี่ยน
    const itemsOut = itemsOutsourceText(modalItems)
    const prevOutsource = modal.mode === 'edit' ? (rows.find(r => r.id === d.id)?.outsource ?? '') : ''
    const outsourceVal = itemsOut || d.outsource || null
    // ‼️ ส่งช่องแอดมินไปเฉพาะตอนที่คนกรอกเปลี่ยนเอง — ถ้าส่งไปทุกครั้ง ระบบจะถือว่า "เลือกเอง"
    //    แล้วไม่ใส่ชื่อแอดมินหลักที่มาแก้ให้อัตโนมัติ (ดู stampUpdate ใน lib/adminActor.ts)
    const prevAdmin = modal.mode === 'edit' ? (rows.find(r => r.id === d.id)?.admin_name ?? '') : ''
    const adminPicked = (d.admin_name ?? '') !== prevAdmin
    const payload = {
      entry_date: d.entry_date || null,
      deadline: d.deadline || null,
      shipping_datetime: (d.shipping_datetime && d.shipping_datetime !== '-') ? d.shipping_datetime : calcShipping(d.deadline ?? '', d.courier ?? ''),
      status: d.status || 'อยู่ในกำหนด',
      ...(adminPicked ? { admin_name: d.admin_name || null } : {}),
      technician: d.technician || null,
      customer_name: d.customer_name || null,
      order_number: d.order_number || null,
      shipping_date: d.shipping_date || null,
      is_urgent: !!d.is_urgent,
      platform: platformVal,
      items: modalItems.length > 0 ? modalItems : null,
      order_status: d.order_status || 'รอดำเนินการ',
      courier: d.courier || null,
      is_installation: !!d.is_installation,
      installation_date: d.is_installation ? (d.installation_date || null) : null,
      install_time: d.is_installation ? (d.install_time || '9:00') : null,
      province: d.is_installation ? (d.province || null) : null,
      // ‼️ ที่อยู่/เบอร์โทร เก็บทุกประเภทงาน (เดิมเบอร์โทรบันทึกเฉพาะงานติดตั้ง ทำให้เบอร์ที่แปลงมาจากข้อความหายตอนบันทึก)
      phone: d.phone || null,
      address: d.address || null,
      location_link: d.is_installation ? (d.location_link || null) : null,
      outsource: outsourceVal,
      ...(outsourceVal && outsourceVal !== prevOutsource ? { outsource_at: now } : {}),
      notes: d.notes || null,
      price: d.price ? Number(d.price) : null,
      payment_status: d.payment_status || 'ยังไม่ชำระ',
      // ชำระแล้ว: กรอกเอง · ไม่กรอกแล้วเลือกมัดจำ50% → ครึ่งหนึ่งของยอดทั้งหมด · ยอดที่เหลือคิดจากยอดนี้
      ...(() => {
        const typed = d.paid_amount != null && String(d.paid_amount) !== '' ? Number(d.paid_amount) : null
        const paid = typed ?? (d.payment_status === 'มัดจำ50%' && d.price ? Number(d.price) / 2 : null)
        return {
          deposit: paid != null && d.price ? Math.max(0, Number(d.price) - paid) : (d.deposit ? Number(d.deposit) : null),
          paid_amount: paid,
        }
      })(),
      order_assigned: d.order_assigned || 'รออัพเดท',
      updated_at: now,
    }
    const oname = (payload.order_number || payload.customer_name || '').toString()
    if (modal.mode === 'add') {
      const res = await oeInsert(payload).select().single()
      if (res.error) { setSaving(false); setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      const saved = res.data as Entry
      await syncInstallation({ ...payload, admin_name: d.admin_name || null }, saved.id)
      if (payload.is_installation) await saveOrderPhotos(saved.id)
      if (outsourceVal) await syncOutsourcePO(saved.id, payload.customer_name, payload.order_number, outsourceVal, modalItems)
      setSaving(false)
      setRows(prev => [saved, ...prev])
      recordAction({
        label: `เพิ่มออเดอร์ ${oname}`,
        // ย้อน = ลบออเดอร์ + งานติดตั้ง/สั่งซื้อที่ผูกกัน (source_order_id)
        undo: async () => {
          await supabase.from('installations').delete().eq('source_order_id', saved.id)
          await supabase.from('purchase_orders').delete().eq('source_order_id', saved.id)
          await supabase.from('order_entries').delete().eq('id', saved.id)
          await load()
        },
        redo: async () => {
          await supabase.from('order_entries').insert(saved)
          await syncInstallation({ ...payload, admin_name: d.admin_name || null }, saved.id)
          if (outsourceVal) await syncOutsourcePO(saved.id, payload.customer_name, payload.order_number, outsourceVal, modalItems)
          await load()
        },
      })
    } else {
      const orig = rows.find(r => r.id === d.id)
      // รายการสินค้าไม่ได้แก้ = ตัด items ออกจากคำสั่ง → ชื่อแอดมิน/โบนัสไม่ขยับ
      // (กติกา 3 ส.ค. 69: แก้เฉพาะรายการสินค้าเท่านั้นที่ย้าย/ล้างเจ้าของโบนัส — ดู lib/adminActor.ts)
      if (orig && JSON.stringify(orig.items ?? null) === JSON.stringify(payload.items ?? null)) delete (payload as Record<string, unknown>).items
      const res = await oeUpdate(payload).eq('id', d.id).select().single()
      if (res.error) { setSaving(false); setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      await syncInstallation({ ...payload, admin_name: d.admin_name || null }, String(d.id))
      if (payload.is_installation) await saveOrderPhotos(String(d.id))
      if (outsourceVal || prevOutsource) await syncOutsourcePO(String(d.id), payload.customer_name, payload.order_number, outsourceVal, modalItems)
      setSaving(false)
      setRows(prev => prev.map(r => r.id === d.id ? res.data as Entry : r))
      if (orig) trackOrderField(String(d.id), payload, prevOf(orig, payload), `แก้ออเดอร์ ${oname}`)
    }
    setModal(null)
    setAddType(null)
  }

  const del = async (id: string) => {
    const row = rows.find(r => r.id === id)
    if (row && isClaimEntry(row)) { setError('งานเคลมลบได้ที่หน้าเคลม'); return }
    if (!confirm('ลบรายการนี้?')) return
    // แปะชื่อคนลบก่อน แล้วค่อยลบ — ประวัติจะได้รู้ว่าใครลบ (trigger อ่านจากแถวที่กำลังถูกลบ)
    await oeUpdate({ updated_at: new Date().toISOString() }).eq('id', id)
    const { error: err } = await supabase.from('order_entries').delete().eq('id', id)
    if (!err) {
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
      setRows(prev => prev.filter(r => r.id !== id))
      if (row) recordAction({
        label: `ลบออเดอร์ ${row.order_number || row.customer_name || ''}`,
        undo: async () => { await supabase.from('order_entries').insert(row); await load() },
        redo: async () => { await supabase.from('order_entries').delete().eq('id', id); await load() },
      })
    }
  }

  // สร้างบรรทัดของใบออเดอร์ พร้อมธง rail (บรรทัดของรายการ "ราง")
  function formatOrderLines(r: Entry): { t: string; rail?: boolean }[] {
    const lines: { t: string; rail?: boolean }[] = []
    const push = (t: string, rail = false) => lines.push({ t, rail })

    if (r.entry_date) {
      push(new Date(r.entry_date).toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }))
    }

    const platformLine = [r.platform, r.customer_name].filter(Boolean).join(': ')
    if (platformLine) push(platformLine)
    if (r.order_number) push(r.order_number)

    push('')

    if (r.items && r.items.length > 0) {
      r.items.forEach((item, idx) => {
        if (idx > 0) push('')
        for (const ln of itemBlockLines(item)) push(ln.t, ln.rail)
        // รายการที่ลงสั่งนอก: ชื่อที่สั่ง + วัน/เดือนที่ลง ต่อท้ายรายการ เช่น "KC 8/7"
        const out = (item.outsource ?? '').trim()
        if (out) {
          const dt = r.outsource_at ? new Date(r.outsource_at) : new Date()
          push(`${out} ${dt.getDate()}/${dt.getMonth() + 1}`)
        }
      })
    }

    push('')

    // ‼️ ใช้ effShipping (dropoff +2 + เลี่ยงวันอาทิตย์/วันหยุดร้าน) ให้ตรงกับวันที่ที่โชว์บนหน้าจอ — ห้ามใช้ shipping_datetime ดิบ
    const effShip = effShipping(r)
    if (effShip && effShip !== '-') {
      push(`ส่งก่อน ${effShip}`)
    }
    if (r.courier) push(r.courier)
    if (r.notes) push(`หมายเหตุ: ${r.notes}`)

    // ที่อยู่จัดส่ง — ขึ้นเมื่อมีข้อมูลเท่านั้น
    // ‼️ คอลัมน์ "ที่อยู่จัดส่งแยก" ของแท็บงานแพลตฟอร์ม = ช่อง address ตัวเดียวกับ "ที่อยู่" ของแท็บอื่น
    //    (ดู COLUMN_DEFS: platform → ship_address, outside/install → address) เลยครอบคลุมทุกแท็บในที่เดียว
    const shipAddr = (r.address ?? '').trim()
    const shipPhone = (r.phone ?? '').trim()
    if (shipAddr || shipPhone) {
      push('')
      push(r.is_installation ? 'ที่อยู่หน้างาน' : 'ที่อยู่จัดส่ง')
      if (r.customer_name) push(r.customer_name)
      if (shipPhone) push(shipPhone)
      if (shipAddr) {
        const prov = (r.province ?? '').trim()
        push(prov && !shipAddr.includes(prov) ? `${shipAddr} ${prov}` : shipAddr)
      }
    }

    // ชื่อแอดมินต่อท้ายสุด — ขึ้นทั้งตอนคัดลอกและใบปริ้น
    if (r.admin_name) {
      push('')
      push(`แอดมิน: ${r.admin_name}`)
    }

    return lines
  }

  function formatOrderText(r: Entry): string {
    return formatOrderLines(r).map(l => l.t).join('\n')
  }

  // เวอร์ชัน HTML สำหรับปริ้น: บรรทัดของราง = สีแดง
  function formatOrderHtml(r: Entry): string {
    const esc = (v: string) => v.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
    return formatOrderLines(r)
      .map(l => l.rail ? `<span class="rail">${esc(l.t)}</span>` : esc(l.t))
      .join('\n')
  }

  const copyOrderText = async (r: Entry) => {
    setOpenAction(null)
    await navigator.clipboard.writeText(formatOrderText(r))
    setCopiedId(r.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ===== เชื่อมกับเว็บคำนวณอุปกรณ์ราง (donna-rail) =====
  const railItemsOf = (r: Entry) => (Array.isArray(r.items) ? r.items : []).filter(it => typeof it.type === 'string' && it.type.startsWith('ราง'))
  const hasRail = (r: Entry) => railItemsOf(r).length > 0
  const openRailCalc = (r: Entry) => {
    const courier = (r.courier || '').toLowerCase()
    const carrier = r.is_installation ? 'ติดตั้ง'
      : /spx|shopee/.test(courier) ? 'Spx'
      : /flash/.test(courier) ? 'Flash'
      : /j&t|jt/.test(courier) ? 'J&T'
      : 'อื่นๆ'
    // ชนิดรางดูจากคำในชื่อ (railKind) — ชื่อที่อ่านไม่ออกให้เตือนก่อน ไม่เดาเป็นรางจีบเงียบๆ
    const unknown = railItemsOf(r).filter(it => !railKind(it.type)).map(it => it.type)
    if (unknown.length && !confirm(`อ่านชนิดรางไม่ออก: ${unknown.join(', ')}\nจะคิดเป็น "รางจีบ" ให้ — ไปต่อไหม?`)) return
    const items = railItemsOf(r).map(it => ({
      type: railKind(it.type) || 'รางจีบ',
      size: typeof it.width === 'string' && it.width.includes('+') ? it.width.trim() : (Number(it.width) || 0),
      qty: Number(it.quantity) || 1,
      layers: railLayers(it),   // ช่องชั้นว่าง → อ่านจากชื่อชนิด ("รางม่านจีบ 2 ชั้น")
      color: (it.color_name || '').replace(/^สี/, '') || undefined,
      // ออเดอร์ไม่ได้ลงว่าแยกกลาง/สไลด์เดี่ยว → ส่งค่าว่าง ไม่เดาให้ (donna-rail จะเว้นไว้ให้ช่างกดเลือกเอง)
      split: railSplit(`${it.fabric_split || ''} ${it.note || ''}`),
      head: it.rail_head || undefined,
      carrier,
    }))
    const scanBase = typeof window !== 'undefined' ? window.location.origin : ''
    const payload = { cust: r.customer_name || '', order: r.order_number || '', platform: r.platform || '', note: r.notes || '', id: r.id, scanBase, items }
    window.open(railLink({ prefill: JSON.stringify(payload) }), '_blank')
  }

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !rows.some(r => r.id === id && isClaimEntry(r)))
    if (ids.length < selectedIds.size) setError('งานเคลมลบได้ที่หน้าเคลม — ข้ามให้แล้ว')
    if (!ids.length) return
    if (!confirm(`ลบ ${ids.length} รายการที่เลือก?`)) return
    const deleted = rows.filter(r => ids.includes(r.id))   // เก็บแถวที่ลบไว้ย้อนกลับ
    await oeUpdate({ updated_at: new Date().toISOString() }).in('id', ids)   // แปะชื่อคนลบก่อนลบ (ดู del)
    const { error: err } = await supabase.from('order_entries').delete().in('id', ids)
    if (!err) {
      setSelectedIds(new Set())
      setRows(prev => prev.filter(r => !ids.includes(r.id)))
      if (deleted.length) recordAction({
        label: `ลบออเดอร์ ${deleted.length} รายการ`,
        undo: async () => { await supabase.from('order_entries').insert(deleted); await load() },
        redo: async () => { await supabase.from('order_entries').delete().in('id', ids); await load() },
      })
    }
  }

  const syncWorkStatus = async (orderNumber: string, customerName: string, status: string, now: string) => {
    if (status === 'รอดำเนินการ') return
    await syncWorkStatusExact(orderNumber, customerName, status, now)
  }

  // บันทึกประวัติสถานะ (สถานะ + เวลา + ใครทำ) แบบ best-effort
  // แยกออกจาก update หลัก เผื่อคอลัมน์ status_history ยังไม่ถูกสร้าง จะได้ไม่พังสถานะหลัก
  const logStatus = async (id: string, status: string, now: string, existing: StatusEvent[] | null | undefined) => {
    if (!status) return
    const prev = Array.isArray(existing) ? existing : []
    if (prev.length && prev[prev.length - 1]?.status === status) return  // กันบันทึกซ้ำสถานะเดิม
    const next = [...prev, { status, at: now, by: null }]
    const { error } = await oeUpdate({ status_history: next }).eq('id', id)
    if (!error) setRows(p => p.map(r => r.id === id ? { ...r, status_history: next } as Entry : r))
  }

  // แก้ค่าจริง (DB + sync กระดานงาน + log ประวัติ + state) — ไม่บันทึกกองประวัติ ใช้ซ้ำได้ทั้ง undo/redo
  // แถวเคลม: แก้ได้เฉพาะช่องที่มีในตาราง claims — ช่องอื่นให้ไปแก้ที่หน้าเคลม
  const CLAIM_EDITABLE = ['order_status', 'notes', 'courier', 'admin_name', 'deadline', 'printed_at', 'shipped_at', 'is_urgent']
  const claimFieldPatch = (field: string, value: unknown): Record<string, unknown> | null => {
    if (!CLAIM_EDITABLE.includes(field)) return null
    if (field === 'order_status') return { status: ORDER_TO_CLAIM_STATUS[String(value)] ?? value }
    return { [field]: value }
  }

  const applyField = async (id: string, field: string, value: string | boolean): Promise<boolean> => {
    const now = new Date().toISOString()
    const claimRow = rows.find(r => r.id === id && isClaimEntry(r))
    if (claimRow) {
      const patch = claimFieldPatch(field, value)
      if (!patch) { setError('ช่องนี้ของงานเคลมแก้ได้ที่หน้าเคลม'); return false }
      const { error: cErr } = await claimUpdate({ ...patch, updated_at: now }).eq('id', id)
      if (cErr) { setError(`บันทึกงานเคลมไม่สำเร็จ: ${cErr.message}`); return false }
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
      return true
    }
    const { error: err } = await oeUpdate({ [field]: value, updated_at: now }).eq('id', id)
    if (err) return false
    if (field === 'order_status' && typeof value === 'string') {
      const row = rows.find(r => r.id === id)
      if (row) {
        await syncWorkStatus(row.order_number, row.customer_name, value, now)
        await logStatus(id, value, now, row.status_history)
      }
    }
    const sy = window.scrollY
    flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, updated_at: now } as Entry : r)))
    window.scrollTo(window.scrollX, sy)
    return true
  }

  const updateField = async (id: string, field: string, value: string | boolean) => {
    const row = rows.find(r => r.id === id)
    const old = row ? (row as any)[field] ?? null : null
    const ok = await applyField(id, field, value)
    if (!ok) return
    const what = field === 'order_status' ? 'สถานะ' : 'ข้อมูล'
    recordAction({
      label: `แก้${what} ${row?.order_number || row?.customer_name || ''}`,
      undo: async () => { await applyField(id, field, old); await load() },
      redo: async () => { await applyField(id, field, value); await load() },
    })
  }

  // บันทึกการแก้ช่องออเดอร์ (แบบ raw update) เข้ากองประวัติ — ใช้กับช่องที่ไม่มี side-effect พิเศษ
  const trackOrderField = (id: string, patch: Record<string, any>, prev: Record<string, any>, label: string) => {
    recordAction({
      label,
      undo: async () => { await oeUpdate(prev).eq('id', id); await load() },
      redo: async () => { await oeUpdate(patch).eq('id', id); await load() },
    })
  }

  // คอลัมน์สถานะ: dropdown เลือกสถานะ (เปลี่ยนสถานะย้อนได้ด้วยปุ่มเลิกทำ ↶ รวมของทั้งเว็บ)
  const statusCell = (r: Entry) => {
    const flow = r.is_installation ? INSTALL_STATUSES : PROD_STATUSES
    return (
      <td style={{ padding: '8px 14px' }}>
        <select value={r.order_status || ''} onChange={e => updateField(r.id, 'order_status', e.target.value)}
          style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: PROD_STATUS_COLOR[r.order_status] ?? 'var(--ink-4)', padding: 0 }}>
          <option value="">—</option>
          {flow.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
    )
  }

  // ติ๊กช่องปริ้นเอง: ติ๊ก = บันทึกเวลาปริ้นตอนนี้, เอาติ๊กออก = ล้างค่า (ไม่แตะ updated_at เพราะไม่ใช่การแก้ข้อมูลออเดอร์)
  const togglePrinted = async (id: string, printed: boolean) => {
    const val = printed ? new Date().toISOString() : null
    const isClaim = rows.some(r => r.id === id && isClaimEntry(r))
    const { error: err } = isClaim
      ? await claimUpdate({ printed_at: val }).eq('id', id)
      : await oeUpdate({ printed_at: val }).eq('id', id)
    if (!err) setRows(prev => prev.map(r => r.id === id ? { ...r, printed_at: val } : r))
  }

  // ช่องคอลัมน์ "ปริ้น": ติ๊กถูก = ปริ้นแล้ว + โชว์วันเวลาที่ปริ้น (auto ติ๊กเมื่อกดปริ้นในเมนู ···)
  const printCell = (r: Entry) => (
    <td style={{ padding: '8px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={!!r.printed_at} onChange={e => togglePrinted(r.id, e.target.checked)}
        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
      {r.printed_at && (
        <div style={{ fontSize: 10, color: '#eab308', fontWeight: 600, marginTop: 2 }}>
          {new Date(r.printed_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
          {new Date(r.printed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </td>
  )
  const printHeader = () => (
    <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ปริ้น</th>
  )

  const toggleDone = async (id: string, checked: boolean) => {
    const row = rows.find(r => r.id === id)
    const now = new Date().toISOString()
    if (row && isClaimEntry(row)) {
      // งานเคลม: งานเสร็จ = แพ็คแล้ว (สายงานเคลมไม่มีขั้น "รอจัดส่ง")
      const st = checked ? 'แพ็คแล้ว' : 'รอของคืน'
      const { error: cErr } = await claimUpdate({ is_urgent: checked, status: st, updated_at: now }).eq('id', id)
      if (cErr) { setError(`บันทึกงานเคลมไม่สำเร็จ: ${cErr.message}`); return }
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, is_urgent: checked, order_status: CLAIM_TO_ORDER_STATUS[st] ?? st, done_at: checked ? now : null, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
      return
    }
    const updates = checked
      ? { is_urgent: true, order_status: row?.is_installation ? 'รอติดตั้ง' : 'รอจัดส่ง', done_at: now, updated_at: now }
      : { is_urgent: false, order_status: 'รอดำเนินการ', done_at: null, updated_at: now }
    const { error: err } = await oeUpdate(updates).eq('id', id)
    if (!err) {
      if (row) {
        await syncWorkStatus(row.order_number, row.customer_name, updates.order_status, now)
        await logStatus(id, updates.order_status, now, row.status_history)
      }
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
    }
  }

  // ติ๊ก "จัดส่งแล้ว": order_status='จัดส่งแล้ว' + shipped_at=now + is_urgent (คงงานเสร็จ)
  // ติ๊กออก: กลับเป็น 'รอจัดส่ง' + shipped_at=null (ยังถือว่างานเสร็จ)
  const toggleShipped = async (id: string, checked: boolean) => {
    const row = rows.find(r => r.id === id)
    const now = new Date().toISOString()
    if (row && isClaimEntry(row)) {
      const st = checked ? 'ส่งแล้ว' : 'แพ็คแล้ว'
      const { error: cErr } = await claimUpdate({ status: st, shipped_at: checked ? now : null, updated_at: now }).eq('id', id)
      if (cErr) { setError(`บันทึกงานเคลมไม่สำเร็จ: ${cErr.message}`); return }
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, order_status: CLAIM_TO_ORDER_STATUS[st] ?? st, shipped_at: checked ? now : null, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
      return
    }
    const updates = checked
      ? { is_urgent: true, order_status: 'จัดส่งแล้ว', shipped_at: now, updated_at: now }
      : { is_urgent: true, order_status: 'รอจัดส่ง', shipped_at: null, updated_at: now }
    const { error: err } = await oeUpdate(updates).eq('id', id)
    if (!err) {
      if (row) {
        await syncWorkStatus(row.order_number, row.customer_name, updates.order_status, now)
        await logStatus(id, updates.order_status, now, row.status_history)
      }
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
    }
  }

  // แก้วัน-เวลาย้อนหลังใต้ช่องติ๊ก "งานเสร็จ" (done_at) และ "จัดส่งแล้ว" (shipped_at)
  // — เผื่อติ๊กช้ากว่าที่ทำจริง กดที่ตัวเลขแล้วเลือกใหม่ได้
  const toLocalInput = (iso: string) => {
    const d = new Date(iso), p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }
  const saveStampAt = async (id: string, field: 'done_at' | 'shipped_at', local: string) => {
    setEditShipped(null)
    const row = rows.find(r => r.id === id)
    if (!row || !local) return
    const iso = new Date(local).toISOString()
    if (!iso || iso === row[field]) return
    const patch = { [field]: iso, updated_at: new Date().toISOString() }
    const { error: err } = await oeUpdate(patch).eq('id', id)
    if (err) { alert('บันทึกวัน-เวลาไม่สำเร็จ: ' + err.message); return }
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } as Entry : r))
    trackOrderField(id, patch, { [field]: row[field], updated_at: row.updated_at },
      `แก้${field === 'done_at' ? 'วันงานเสร็จ' : 'วันจัดส่ง'} ${row.order_number || row.customer_name || ''}`)
  }
  // วัน-เวลาใต้ช่องติ๊ก (ใช้ร่วมกันทั้ง 3 ตาราง ทั้งงานเสร็จและจัดส่ง) — กดที่ตัวเลขเพื่อแก้
  const timeStamp = (r: Entry, field: 'done_at' | 'shipped_at') => {
    const iso = r[field]
    const shown = field === 'done_at' ? !!r.is_urgent : r.order_status === 'จัดส่งแล้ว'
    if (!shown || !iso) return null
    const key = `${r.id}|${field}`
    if (editShipped === key) return (
      <input type="datetime-local" autoFocus defaultValue={toLocalInput(iso)}
        onBlur={e => saveStampAt(r.id, field, e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setEditShipped(null)
        }}
        style={{ fontSize: 10, padding: '1px 4px', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--ink)', background: 'var(--bg)' }} />
    )
    return (
      <span onClick={() => setEditShipped(key)} title={`กดเพื่อแก้วัน-เวลา${field === 'done_at' ? 'งานเสร็จ' : 'จัดส่ง'}`}
        style={{ color: '#22c55e', fontSize: 10, lineHeight: 1.3, cursor: 'pointer', textDecoration: 'underline dotted' }}>
        {new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
        {new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }
  const shippedStamp = (r: Entry) => timeStamp(r, 'shipped_at')

  // ===== ติดตามพัสดุ (Donna Track extension) =====
  // จับมือกับ extension: extension ประกาศ READY ตอนโหลดหน้า / ตอบ PING
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== 'donna-track-ext') return
      if (e.data.type === 'READY') setExtReady(true)
    }
    window.addEventListener('message', onMsg)
    window.postMessage({ source: 'donna-track', type: 'PING' }, window.location.origin)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // บันทึกเลขพัสดุจาก popup "จัดส่งแล้ว" → ติ๊กจัดส่งแล้ว (เจ้าขนส่งตามที่โชว์/เลือกใน popup)
  const saveShipments = async () => {
    if (!shipModal) return
    const row = rows.find(r => r.id === shipModal.id)
    const parcels = shipModal.parcels.map(p => ({ ...p, no: p.no.trim() })).filter(p => p.no)
    if (parcels.length === 0) { alert('กรอกเลขพัสดุอย่างน้อย 1 เลข'); return }
    setShipSaving(true)
    const now = new Date().toISOString()
    const prev = Array.isArray(row?.shipments) ? row!.shipments! : []
    const list: Shipment[] = parcels.map(p => {
      const carrier = p.carrier || detectCarrier(p.no, row?.courier) || 'อื่นๆ'
      const old = prev.find(s => s.no === p.no)
      return old ? { ...old, carrier } : { no: p.no, carrier, status: '', events: null, checked_at: null }
    })
    const updates = { shipments: list, is_urgent: true, order_status: 'จัดส่งแล้ว', shipped_at: row?.shipped_at || now, updated_at: now }
    const { error: err } = await oeUpdate(updates).eq('id', shipModal.id)
    setShipSaving(false)
    if (err) {
      alert(`บันทึกไม่สำเร็จ: ${err.message}${/shipments/.test(err.message) ? '\n\n(ต้องรัน sql/add_shipments.sql ใน Supabase ก่อน)' : ''}`)
      return
    }
    if (row) {
      await syncWorkStatus(row.order_number, row.customer_name, 'จัดส่งแล้ว', now)
      await logStatus(shipModal.id, 'จัดส่งแล้ว', now, row.status_history)
    }
    setRows(p => p.map(r => r.id === shipModal.id ? { ...r, ...updates } as Entry : r))
    const id = shipModal.id
    setShipModal(null)
    setTrackModal(id)          // เปิดหน้าสถานะต่อเลย จะได้กดเช็คได้ทันที
    setTrackError('')
  }

  // เช็คสถานะ: Flash/Kerry ผ่าน extension แท็บเบื้องหลัง, J&T ผ่าน extension แท็บจริง (มีสไลด์ captcha ให้คนเลื่อน),
  // SPX + ไปรษณีย์ไทย ผ่าน API ฝั่งเซิร์ฟเวอร์ — ยิงพร้อมกันแล้วรวมผล
  // รับ shipments ตรงๆ ไม่อ่านจาก rows ตอนผลกลับมา — กัน closure เก่าตอนถูกเรียกอัตโนมัติหลังเพิ่งบันทึก
  const checkTracking = async (entryId: string, shipments: Shipment[]) => {
    if (trackChecking === entryId) return
    const extParcels = shipments.filter(s => EXT_CARRIERS.includes(s.carrier))
    const apiParcels = shipments.filter(s => s.carrier in API_CARRIERS)
    if (extParcels.length === 0 && apiParcels.length === 0) return
    if (extParcels.length > 0 && !extReady && apiParcels.length === 0) {
      setTrackError('ไม่พบ extension "Donna Track" — ติดตั้งใน Chrome ก่อน (โฟลเดอร์ extension ใน repo)')
      return
    }
    setTrackChecking(entryId)
    setTrackError('')
    type CheckResult = { no: string; ok: boolean; status: string; events: { time: string; desc: string }[] }
    const jobs: Promise<CheckResult[]>[] = []
    let sideError = ''
    if (extParcels.length > 0 && extReady) {
      const reqId = `${entryId}-${Date.now()}`
      jobs.push(new Promise<CheckResult[]>(resolve => {
        // J&T ต้องรอคนเลื่อนสไลด์ → เผื่อเวลาเยอะกว่า
        const budget = extParcels.reduce((t, s) => t + (s.carrier === 'J&T Express' ? 170000 : 60000), 0)
        const timeout = setTimeout(() => { window.removeEventListener('message', onResult); resolve([]) }, budget)
        const onResult = (e: MessageEvent) => {
          if (e.source !== window || e.data?.source !== 'donna-track-ext' || e.data.type !== 'RESULT' || e.data.reqId !== reqId) return
          window.removeEventListener('message', onResult)
          clearTimeout(timeout)
          resolve(e.data.results || [])
        }
        window.addEventListener('message', onResult)
        window.postMessage({ source: 'donna-track', type: 'CHECK', reqId, parcels: extParcels.map(s => ({ no: s.no, carrier: s.carrier, url: carrierTrackUrl(s), active: s.carrier === 'J&T Express' })) }, window.location.origin)
      }))
    }
    for (const [carrier, api] of Object.entries(API_CARRIERS)) {
      const nos = apiParcels.filter(s => s.carrier === carrier).map(s => s.no)
      if (nos.length === 0) continue
      jobs.push(
        fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nos }) })
          .then(async r => { const d = await r.json(); if (d.error) { sideError = d.error; return [] } return (d.results || []) as CheckResult[] })
          .catch(() => [] as CheckResult[])
      )
    }
    const results = (await Promise.all(jobs)).flat()
    const now = new Date().toISOString()
    const merged = shipments.map(s => {
      const res = results.find(x => x.no === s.no)
      return res?.ok ? { ...s, status: res.status || s.status, events: res.events?.length ? res.events : s.events, checked_at: now } : s
    })
    if (results.some(x => x.ok)) {
      const { error: err } = await oeUpdate({ shipments: merged, updated_at: now }).eq('id', entryId)
      if (!err) setRows(p => p.map(r => r.id === entryId ? { ...r, shipments: merged } as Entry : r))
    }
    setTrackChecking(c => c === entryId ? null : c)
    if (results.length === 0 || results.every(x => !x.ok)) {
      setTrackError(sideError || 'ดึงสถานะไม่ได้ — ลองใหม่ หรือกดเปิดเว็บขนส่งดูตรงๆ')
    } else if (sideError) {
      setTrackError(sideError)
    }
  }

  // เปิดหน้าสถานะพัสดุเมื่อไหร่ (รวมถึงเด้งมาหลังกดยืนยันเลขพัสดุ) → เช็คให้เองถ้ามีเลข Flash ที่ยังไม่เคยเช็ค
  // autoCheckedRef กันยิงวนถ้าเช็คไม่สำเร็จ (checked_at ยัง null อยู่) — อัตโนมัติแค่ครั้งเดียวต่อการเปิด ที่เหลือใช้ปุ่ม
  const autoCheckedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!trackModal) { autoCheckedRef.current = null; return }
    if (trackChecking === trackModal || autoCheckedRef.current === trackModal) return
    const r = rows.find(x => x.id === trackModal)
    const sh = Array.isArray(r?.shipments) ? r!.shipments! : []
    // extension-เจ้า ต้องมี extension / เจ้าที่เช็คผ่าน API (SPX/ไปรษณีย์ไทย) เช็คได้เสมอ
    const need = sh.some(s => !s.checked_at && (EXT_CARRIERS.includes(s.carrier) ? extReady : s.carrier in API_CARRIERS))
    if (need) {
      autoCheckedRef.current = trackModal
      checkTracking(trackModal, sh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackModal, extReady, rows])

  // ติ๊ก "สถานะราง" (แพ็ครางเสร็จ) — ไม่ยุ่งกับ order_status สายผลิต
  const toggleRailPacked = async (id: string, checked: boolean) => {
    const now = new Date().toISOString()
    const updates = { rail_packed: checked, rail_packed_at: checked ? now : null, updated_at: now }
    const { error: err } = await oeUpdate(updates).eq('id', id)
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

  function computePasteRowsFromCols(c1: string, c2: string, c3: string, c4: string, c5: string, c6: string, c7: string, c8: string, c9 = '') {
    const split = (s: string) => s.trimEnd().split('\n').map(x => x.trim())
    const orderNums = split(c1); const customers = split(c2); const payDates = split(c3); const couriers = split(c4)
    const deadlines = split(c5); const prices = split(c6); const statuses = split(c7); const dropoffs = split(c8)
    const shippedDates = split(c9)
    const existingNums = new Set(rows.map(r => r.order_number).filter(Boolean))
    const len = Math.max(orderNums.length, customers.length, payDates.length, couriers.length, deadlines.length, prices.length, statuses.length, dropoffs.length)
    const map = new Map<string, { paymentDate: string; deadline: string; orderNumber: string; price: number; customerName: string; courier: string; orderStatus: string; isDuplicate: boolean; isDropoff: boolean; shippedDate: string }>()
    for (let i = 0; i < len; i++) {
      const orderNumber = orderNums[i] ?? ''
      const price = parseFloat((prices[i] ?? '0').replace(/,/g, '')) || 0
      if (!orderNumber) continue
      if (map.has(orderNumber)) { map.get(orderNumber)!.price += price }
      else {
        const isDropoff = !!(dropoffs[i] ?? '').trim()
        map.set(orderNumber, { paymentDate: payDates[i] ?? '', deadline: deadlines[i] ?? '', orderNumber, price, customerName: customers[i] ?? '', courier: normalizeCourier(couriers[i] ?? ''), orderStatus: statuses[i] ?? '', isDuplicate: existingNums.has(orderNumber), isDropoff, shippedDate: shippedDates[i] ?? '' })
      }
    }
    setPasteRows(Array.from(map.values()))
  }

  function parsePasteData() {
    computePasteRowsFromCols(pasteCol1, pasteCol2, pasteCol3, pasteCol4, pasteCol5, pasteCol6, pasteCol7, pasteCol8, pasteCol9)
  }

  // สถานะ Shopee ที่ถือว่า "ส่งถึงมือลูกค้าแล้ว" → ติ๊กจัดส่งแล้วอัตโนมัติ + นับโบนัสแอดมิน
  const isDeliveredStatus = (s: string) => s.includes('สำเร็จ') || s.includes('ได้รับสินค้าแล้ว')

  // แปลง "เวลาส่งสินค้า" จาก excel เป็น ISO (รองรับ DD/MM/YYYY HH:mm, YYYY-MM-DD และ Date string)
  function toShippedIso(s: string): string | null {
    const t = (s || '').trim()
    if (!t || t === '-') return null
    const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? '12'), +(m[5] ?? '0'))
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    const d = new Date(t)
    return isNaN(d.getTime()) ? null : d.toISOString()
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
    'เวลาส่งสินค้า': 8,           // col9 = วันที่ส่งถึงลูกค้า → ใช้เป็นวันที่จัดส่งแล้ว
  }

  function processRawRows(rawRows: string[][]) {
    if (rawRows.length === 0) { setFileParseError('ไฟล์ว่างเปล่า'); return }
    const headers = rawRows[0].map(h => h.toString().trim())
    const isNamedHeader = headers.some(h => Object.keys(XLSX_COL_MAP).includes(h))

    let cols: string[]
    if (isNamedHeader) {
      const colIdx = new Array(9).fill(-1)
      headers.forEach((h, i) => { if (XLSX_COL_MAP[h] !== undefined) colIdx[XLSX_COL_MAP[h]] = i })
      const data = rawRows.slice(1).filter(r => r.some(c => c.toString().trim()))
      if (data.length === 0) { setFileParseError('ไม่พบข้อมูล'); return }
      cols = colIdx.map(ci => data.map(r => ci >= 0 ? (r[ci] ?? '').toString().trim() : '').join('\n'))
    } else {
      const hasHeader = headers.some(c => isNaN(parseFloat(c.replace(/,/g, ''))) && c.length > 0 && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(c))
      const data = (hasHeader ? rawRows.slice(1) : rawRows).filter(r => r.some(c => c.toString().trim()))
      if (data.length === 0) { setFileParseError('ไม่พบข้อมูล'); return }
      cols = [0,1,2,3,4,5,6,7,8].map(i => data.map(r => (r[i] ?? '').toString().trim()).join('\n'))
    }

    const [c1,c2,c3,c4,c5,c6,c7,c8,c9] = cols
    setPasteCol1(c1); setPasteCol2(c2); setPasteCol3(c3); setPasteCol4(c4)
    setPasteCol5(c5); setPasteCol6(c6); setPasteCol7(c7); setPasteCol8(c8); setPasteCol9(c9)
    computePasteRowsFromCols(c1, c2, c3, c4, c5, c6, c7, c8, c9)
    setModalTab('paste')
  }

  // ไฟล์รายรับ Shopee (การเงิน → รายรับของฉัน → Export) มีชีทชื่อ "Income"
  // หัวตารางไม่อยู่แถวแรก ต้องหาแถวที่มี "หมายเลขคำสั่งซื้อ" แล้วอ่านคอลัมน์ตามชื่อ
  function processIncomeSheet(rawRows: string[][]) {
    const hIdx = rawRows.findIndex(r => r.some(c => String(c).trim() === 'หมายเลขคำสั่งซื้อ'))
    if (hIdx < 0) { setFileParseError('ไฟล์ Income ไม่มีหัวตาราง "หมายเลขคำสั่งซื้อ"'); return }
    const headers = rawRows[hIdx].map(h => String(h).trim())
    const colOrder = headers.indexOf('หมายเลขคำสั่งซื้อ')
    const colAmount = headers.findIndex(h => h.startsWith('จำนวนเงินทั้งหมดที่โอนแล้ว'))
    const colDate = headers.indexOf('วันที่โอนชำระเงินสำเร็จ')
    if (colAmount < 0) { setFileParseError('ไฟล์ Income ไม่มีคอลัมน์ "จำนวนเงินทั้งหมดที่โอนแล้ว"'); return }
    // ออเดอร์เดียวอาจมีหลายแถว (เช่นมีแถวคืนสินค้า) → รวมยอดต่อออเดอร์
    const map = new Map<string, { amount: number; payoutDate: string }>()
    for (const r of rawRows.slice(hIdx + 1)) {
      const orderNumber = String(r[colOrder] ?? '').trim()
      if (!orderNumber) continue
      const amount = parseFloat(String(r[colAmount] ?? '0').replace(/,/g, '')) || 0
      const payoutDate = colDate >= 0 ? String(r[colDate] ?? '').trim() : ''
      const prev = map.get(orderNumber)
      if (prev) prev.amount += amount
      else map.set(orderNumber, { amount, payoutDate })
    }
    if (map.size === 0) { setFileParseError('ไม่พบข้อมูลในชีท Income'); return }
    setIncomeRows(Array.from(map.entries()).map(([orderNumber, v]) => {
      const existing = rows.find(row => row.order_number === orderNumber)
      return { orderNumber, amount: v.amount, payoutDate: v.payoutDate, matchedId: existing?.id ?? null, hasIncome: existing?.net_income != null }
    }))
  }

  function processFileBuffer(buf: ArrayBuffer, filename: string) {
    setFileParseError('')
    try {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      // แยกชนิดไฟล์อัตโนมัติ: ไฟล์รายรับมีชีท "Income", ไฟล์ออเดอร์มีชีทเดียว
      const incomeSheet = wb.SheetNames.find(n => n.trim().toLowerCase() === 'income')
      if (incomeSheet) {
        const rawRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[incomeSheet], { header: 1, defval: '' }) as string[][]
        processIncomeSheet(rawRows)
        return
      }
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]
      processRawRows(rawRows)
    } catch {
      setFileParseError('อ่านไฟล์ไม่ได้: ' + filename)
    }
  }

  async function saveIncomeRows() {
    setPasteSaving(true)
    const now = new Date().toISOString()
    const applied = new Map<string, { net_income: number; net_income_at: string | null }>()
    for (const r of incomeRows) {
      if (!r.matchedId) continue
      const updates = { net_income: r.amount, net_income_at: toIsoDate(r.payoutDate) || null }
      const { error: err } = await oeUpdate({ ...updates, updated_at: now }).eq('id', r.matchedId)
      if (err) { setPasteSaving(false); setError(`บันทึกยอดโอนไม่สำเร็จ: ${err.message}`); return }
      applied.set(r.matchedId, updates)
    }
    setRows(prev => prev.map(r => applied.has(r.id) ? { ...r, ...applied.get(r.id)! } : r))
    setPasteSaving(false)
    setIncomeRows([])
    setModal(null)
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
    // รวมสถานะส่งถึงลูกค้าแล้ว (จัดส่งสำเร็จแล้ว/สำเร็จแล้ว/ได้รับสินค้าแล้ว) → บันทึกใหม่พร้อมติ๊กจัดส่งแล้ว
    return s.includes('ต้องจัดส่ง') || s.includes('จัดส่งแล้ว') || isDeliveredStatus(s)
  }

  async function savePasteRows() {
    setPasteSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const resetCols = () => { setPasteRows([]); setPasteCol1(''); setPasteCol2(''); setPasteCol3(''); setPasteCol4(''); setPasteCol5(''); setPasteCol6(''); setPasteCol7(''); setPasteCol8(''); setPasteCol9('') }

    const newRows = pasteRows.filter(isPasteRowSaveable)
    const dropoffUpdateRows = pasteRows.filter(r => {
      if (!r.isDuplicate || !r.isDropoff) return false
      const existing = rows.find(row => row.order_number === r.orderNumber)
      return existing && !existing.is_dropoff
    })
    // สถานะ excel = สำเร็จ/ผู้ซื้อได้รับสินค้าแล้ว → ติ๊กจัดส่งแล้ว + วันที่ตามช่องเวลาส่งสินค้า
    // (ถ้าติ๊กจัดส่งไปแล้ว → ข้าม ไม่อัพเดทซ้ำ)
    const shippedUpdateRows = pasteRows.filter(r => {
      if (!r.isDuplicate || !isDeliveredStatus(r.orderStatus)) return false
      const existing = rows.find(row => row.order_number === r.orderNumber)
      return existing && existing.order_status !== 'จัดส่งแล้ว'
    })
    // สถานะ excel = ยกเลิก + มีออเดอร์ในระบบ → ย้ายเข้าหมวด "ยกเลิก" (ไม่ลบทิ้ง เผื่อดูย้อนหลัง) — ยกเลิกอยู่แล้วข้าม
    const cancelRows = pasteRows.filter(r => {
      if (!r.orderStatus.includes('ยกเลิก') || !r.isDuplicate) return false
      const existing = rows.find(row => row.order_number === r.orderNumber)
      return existing && existing.order_status !== 'ยกเลิก'
    })

    const insertPayload = newRows.map(r => {
      // สถานะ excel = ส่งถึงลูกค้าแล้ว → บันทึกเป็นจัดส่งแล้วเลย พร้อมวันที่จากช่องเวลาส่งสินค้า
      const delivered = isDeliveredStatus(r.orderStatus)
      return {
        entry_date: (r.paymentDate && r.paymentDate !== '-') ? (toIsoDate(r.paymentDate) || today) : null,
        deadline: toIsoDate(r.deadline) || null,
        shipping_datetime: (toIsoDate(r.deadline) && r.courier) ? calcShipping(toIsoDate(r.deadline)!, r.courier) : null,
        status: 'อยู่ในกำหนด',
        order_number: r.orderNumber || null,
        notes: null,
        price: r.price || null,
        order_status: delivered ? 'จัดส่งแล้ว' : 'รอดำเนินการ',
        is_urgent: delivered,
        shipped_at: delivered ? (toShippedIso(r.shippedDate) || new Date().toISOString()) : null,
        is_installation: false,
        is_dropoff: r.isDropoff,
        admin_name: null, technician: null,
        customer_name: r.customerName || null,
        courier: r.courier || null,
        shipping_date: null, platform: 'Shopee', items: null, installation_date: null,
      }
    })

    let updatedIds: string[] = []
    for (const r of dropoffUpdateRows) {
      const existing = rows.find(row => row.order_number === r.orderNumber)
      if (!existing) continue
      const now = new Date().toISOString()
      const { error: err } = await oeUpdate({ is_dropoff: true, updated_at: now }).eq('id', existing.id)
      if (!err) updatedIds.push(existing.id)
    }

    // ติ๊กจัดส่งแล้วตามสถานะ excel (สำเร็จ/ผู้ซื้อได้รับสินค้าแล้ว)
    const shippedApplied = new Map<string, Partial<Entry>>()
    for (const r of shippedUpdateRows) {
      const existing = rows.find(row => row.order_number === r.orderNumber)
      if (!existing) continue
      const now = new Date().toISOString()
      const shippedAt = toShippedIso(r.shippedDate) || existing.shipped_at || now
      const updates = { order_status: 'จัดส่งแล้ว', shipped_at: shippedAt, is_urgent: true, updated_at: now }
      const { error: err } = await oeUpdate(updates).eq('id', existing.id)
      if (!err) {
        shippedApplied.set(existing.id, updates)
        if (existing.order_status !== 'จัดส่งแล้ว') {
          await syncWorkStatus(existing.order_number, existing.customer_name, 'จัดส่งแล้ว', now)
          await logStatus(existing.id, 'จัดส่งแล้ว', now, existing.status_history)
        }
      }
    }

    // ย้ายออเดอร์ที่ยกเลิกใน excel เข้าหมวดยกเลิก
    const cancelApplied = new Map<string, Partial<Entry>>()
    for (const r of cancelRows) {
      const existing = rows.find(row => row.order_number === r.orderNumber)
      if (!existing) continue
      const now = new Date().toISOString()
      const updates = { order_status: 'ยกเลิก', updated_at: now }
      const { error: err } = await oeUpdate(updates).eq('id', existing.id)
      if (!err) {
        cancelApplied.set(existing.id, updates)
        await syncWorkStatus(existing.order_number, existing.customer_name, 'ยกเลิก', now)
        await logStatus(existing.id, 'ยกเลิก', now, existing.status_history)
      }
    }

    if (insertPayload.length === 0 && updatedIds.length === 0 && shippedApplied.size === 0 && cancelApplied.size === 0) {
      setPasteSaving(false)
      setModal(null)
      resetCols()
      return
    }

    let insertedRows: Entry[] = []
    if (insertPayload.length > 0) {
      const res = await supabase.from('order_entries').insert(insertPayload.map(p => stampInsert(p))).select()
      if (res.error) { setPasteSaving(false); setError(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
      insertedRows = res.data as Entry[]
    }

    setPasteSaving(false)
    setRows(prev => [
      ...insertedRows,
      ...prev.map(r => {
        const shipped = shippedApplied.get(r.id)
        const cancelled = cancelApplied.get(r.id)
        const dropoff = updatedIds.includes(r.id) ? { is_dropoff: true } : null
        return (shipped || cancelled || dropoff) ? { ...r, ...dropoff, ...shipped, ...cancelled } as Entry : r
      }),
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
          hook_type: '',
          eyelet_color: '',
          fabric_type: '',
          color_code: c[1]?.trim() || '',
          color_name: c[2]?.trim() || '',
          color_desc: '',
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

  // ตั้งแต่บรรทัดนี้ถึงจบการเรียงลำดับ ทุกอย่างทำงานบนค่า "ตอนโหลดหน้า" (stable) แถวจึงไม่ขยับตอนแก้
  // หมวดออเดอร์รวมงานเคลมด้วย (แท็บทั้งหมดจะได้เรียงงานเคลม/งานติดตั้งปนกันตามวันที่เหลือ)
  const scopedRows = rows.map(stable).filter(r => scope === 'claims' ? isClaimRow(r.platform) : true)

  const displayedFrozen = scopedRows.filter(r => {
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
    // จัดส่งแล้ว/ยกเลิก → ย้ายไปอยู่หมวดของตัวเองหมวดเดียว หายจากหมวดอื่นทั้งหมด (ตรรกะอยู่ใน lib/orderTabs.ts)
    const matchQuick = matchQuickTab(r, quickFilter as QuickTab)
    const matchIncomplete = !incompleteFilter || (!r.items || r.items.length === 0 || !r.deadline || r.price == null || !r.customer_name || (OUTSIDE_PLATFORMS.includes(r.platform ?? '') && (!r.order_assigned || r.order_assigned === 'รออัพเดท')) || ((OUTSIDE_PLATFORMS.includes(r.platform ?? '') || r.is_installation) && (!r.payment_status || r.payment_status === 'ยังไม่ชำระ')))
    const matchUnprinted = !unprintedFilter || !r.printed_at
    const matchPrintedPending = !printedPendingFilter || isPrintedPending(r)
    // งานในปฏิทินที่ยังไม่ใช่งานติดตั้ง (เช่น รอวัดหน้างาน) ไม่ต้องขึ้นในหมวดออเดอร์
    const matchFromCalendar = !nonOrderIds.has(r.id)
    return matchSearch && matchStatus && matchPlatform && matchCourier && matchAdmin && matchTech && matchUrgent && matchInstall && matchShipping && matchQuick && matchIncomplete && matchUnprinted && matchPrintedPending && matchFromCalendar
  })

  if (updatedSort) {
    displayedFrozen.sort((a, b) => {
      const da = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const db = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return updatedSort === 'desc' ? db - da : da - db
    })
  } else if (daysSort && sortOrder.length > 0) {
    const orderMap = new Map(sortOrder.map((id, i) => [id, i]))
    displayedFrozen.sort((a, b) => (orderMap.get(a.id) ?? 999999) - (orderMap.get(b.id) ?? 999999))
  }

  // คืนค่าสดก่อนเอาไปวาดบนจอ — ลำดับ/สมาชิกได้จาก stable แล้ว แต่ข้อมูลที่โชว์ต้องเป็นของล่าสุด
  const displayed = displayedFrozen.map(live)

  // ตัวเลือกกรองคอลัมน์แอดมิน = รายชื่อในช่องเลือก + ชื่อที่มีอยู่จริงในข้อมูล
  // (ชื่อที่ระบบใส่ให้อัตโนมัติ เช่น น็อต จะได้กรองได้ด้วย ถึงจะไม่มีในช่องเลือก)
  const adminNames = Array.from(new Set([
    ...ADMINS,
    ...rows.map(r => r.admin_name).filter((n): n is string => !!n),
  ]))

  const displayedOut = (() => {
    let rs = displayedFrozen
    if (outPlatformFilters.length) rs = rs.filter(r => outPlatformFilters.includes(r.platform ?? ''))
    if (outPaymentFilters.length) rs = rs.filter(r => outPaymentFilters.includes(r.payment_status || 'ยังไม่ชำระ'))
    if (outAssignedFilters.length) rs = rs.filter(r => outAssignedFilters.includes(r.order_assigned || 'รออัพเดท'))
    if (outAdminFilters.length) rs = rs.filter(r => outAdminFilters.includes(r.admin_name ?? ''))
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
        // เรียงน้อยไปมาก: งานเสร็จ (is_urgent) เลื่อนไปอยู่ล่างสุดเสมอ
        if (outDaysSort === 'asc' && !!a.is_urgent !== !!b.is_urgent) return a.is_urgent ? 1 : -1
        const da = a.deadline ? new Date(a.deadline).getTime() : (outDaysSort === 'asc' ? Infinity : -Infinity)
        const db = b.deadline ? new Date(b.deadline).getTime() : (outDaysSort === 'asc' ? Infinity : -Infinity)
        return outDaysSort === 'asc' ? da - db : db - da
      })
    }
    return rs.map(live)
  })()

  const displayedAll = (() => {
    let rs = displayedFrozen
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
        // เรียงน้อยไปมาก: งานเสร็จ (is_urgent) เลื่อนไปอยู่ล่างสุดเสมอ
        if (allDaysSort === 'asc' && !!a.is_urgent !== !!b.is_urgent) return a.is_urgent ? 1 : -1
        const getMs = (r: Entry) => {
          const isOut = OUTSIDE_PLATFORMS.includes(r.platform ?? '') || r.is_installation
          if (isOut) return r.deadline ? new Date(r.deadline).getTime() : null
          const eff = effShipping(r)
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
    return rs.map(live)
  })()

  const activeDisplayed = (quickFilter === 'all' || quickFilter === 'claim' || quickFilter === 'shipped') ? displayedAll
    : (quickFilter === 'outside' || quickFilter === 'install') ? displayedOut
    : displayed

  useEffect(() => {
    if (selectAllRef.current) {
      const some = activeDisplayed.some(r => selectedIds.has(r.id))
      const all = activeDisplayed.length > 0 && activeDisplayed.every(r => selectedIds.has(r.id))
      selectAllRef.current.indeterminate = some && !all
    }
  })

  // วางข้อความไลน์ก้อนเดียว → autofill ทั้งฟอร์ม (ลูกค้า/แพลตฟอร์ม/เลขออเดอร์/รายการ) เหมือนงานเคลม
  const parseOrderFromLine = async () => {
    if (!orderPasteText.trim()) return
    setOrderParsing(true); setOrderParseError('')
    try {
      const res = await fetch('/api/parse-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: orderPasteText }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'แปลงไม่สำเร็จ')
      const o = data.order || {}
      if (o.customer_name) set('customer_name', String(o.customer_name))
      if (o.platform) set('platform', String(o.platform))
      if (o.order_number) set('order_number', String(o.order_number))
      if (o.deadline) set('deadline', String(o.deadline))
      if (o.price != null && o.price !== '') set('price', String(o.price))
      if (o.payment_status) set('payment_status', String(o.payment_status))
      if (o.notes) set('notes', String(o.notes))
      if (o.address) set('address', String(o.address))
      if (o.phone) set('phone', String(o.phone))
      if (Array.isArray(o.items) && o.items.length) setModalItems(o.items)
    } catch (e: unknown) {
      setOrderParseError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setOrderParsing(false)
    }
  }

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

  // เปิดป๊อปอัปรายการสินค้า — ถ้าออเดอร์นี้เป็นงานติดตั้ง ดึงรูปหน้างานของแถวในปฏิทินติดตั้งมาแก้ในแผงรูปได้เลย
  const openItemsModal = async (r: Entry) => {
    setItemsModal({ id: r.id, items: Array.isArray(r.items) ? r.items : [], instId: null })
    setItemsModalPasteText('')
    ph.begin([], null)
    if (!r.is_installation) return
    const { data } = await supabase.from('installations').select('id').eq('source_order_id', r.id).maybeSingle()
    if (!data) return
    // อ่านรูปแยกคำสั่ง — คอลัมน์ photos อาจยังไม่มี (ยังไม่ได้รัน migrations/add_installation_photos.sql) อ่านไม่ได้ก็ถือว่ายังไม่มีรูป
    const { data: pRow } = await supabase.from('installations').select('photos').eq('id', data.id).maybeSingle()
    ph.begin(Array.isArray(pRow?.photos) ? pRow.photos : [], data.id)
    setItemsModal(m => m && m.id === r.id ? { ...m, instId: data.id } : m)
  }

  const closeItemsModal = () => { setItemsModal(null); setItemsModalError(''); ph.cancel() }

  // เปิดฟอร์มแก้ไขออเดอร์ → ถ้าเป็นงานติดตั้ง ดึงรูปหน้างานของแถวในปฏิทินติดตั้งมาให้แก้ได้เลย
  const loadOrderPhotos = async (r: Entry) => {
    ph.begin([], null)
    if (!r.is_installation) return
    const { data } = await supabase.from('installations').select('id, photos').eq('source_order_id', r.id).maybeSingle()
    if (data) ph.begin(Array.isArray(data.photos) ? data.photos : [], data.id)
  }

  // บันทึกรูปหน้างานลงแถวงานติดตั้งที่ผูกกับออเดอร์ (syncInstallation สร้าง/อัปเดตแถวให้ก่อนหน้านี้แล้ว)
  const saveOrderPhotos = async (orderId: string) => {
    const { data } = await supabase.from('installations').select('id').eq('source_order_id', orderId).maybeSingle()
    if (!data) return
    const { error: pErr } = await instUpdate({ photos: ph.photos, updated_at: new Date().toISOString() }).eq('id', data.id)
    if (pErr) setError(photoSaveError(pErr.message))   // ออเดอร์บันทึกไปแล้ว บอกเฉพาะส่วนรูปที่พลาด
    else ph.commit()
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

  // บันทึกวัน/เวลาต้องส่งจากการจิ้มแก้ในคอลัมน์ — ค่าที่ผู้ใช้ตั้ง = วันส่งจริงที่โชว์
  // dropoff โชว์ +2 วันจากค่าดิบ จึงแปลงกลับ -2 ก่อนเก็บ ให้โชว์ตรงกับที่ตั้งไว้
  const saveShipDt = async (r: Entry, dateStr: string, timeStr: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return
    const [y, mo, da] = dateStr.split('-').map(Number)
    const d = new Date(y, mo - 1, da)
    if (r.is_dropoff) d.setDate(d.getDate() - 2)
    const [h, mi] = timeStr.split(':')
    const raw = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()},${h.padStart(2, '0')}:${mi}:00`
    const now = new Date().toISOString()
    const { error: err } = await oeUpdate({ shipping_datetime: raw, updated_at: now }).eq('id', r.id)
    if (!err) setRows(prev => prev.map(x => x.id === r.id ? { ...x, shipping_datetime: raw, updated_at: now } : x))
  }

  // คอลัมน์ต้องส่งภายใน: จิ้มแล้วโผล่ [เลือกวัน][เลือกเวลา]✓ แบบเดียวกับนัดหมายในปฏิทินงานติดตั้ง บันทึกทันทีที่เลือก
  const shipDtCell = (r: Entry, eff: string | null) => {
    const editing = shipDtEdit?.id === r.id ? shipDtEdit : null
    const m = (eff || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),(\d{1,2}):(\d{2})/)
    if (editing) {
      const timeOpts = TIMES.includes(editing.time) ? TIMES : [editing.time, ...TIMES]
      return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="date" autoFocus value={/^\d{4}-\d{2}-\d{2}$/.test(editing.date) ? editing.date : ''}
            onChange={e => { if (e.target.value) { setShipDtEdit({ ...editing, date: e.target.value }); saveShipDt(r, e.target.value, editing.time) } }}
            onMouseDown={e => { e.preventDefault(); try { (e.target as HTMLInputElement).showPicker() } catch {} }}
            style={{ border: '1px solid var(--blue)', borderRadius: 6, padding: '4px 7px', fontSize: 11, outline: 'none' }} />
          <select value={editing.time}
            onChange={e => { setShipDtEdit({ ...editing, time: e.target.value }); saveShipDt(r, editing.date, e.target.value) }}
            style={{ border: '1px solid var(--blue)', borderRadius: 6, padding: '4px 7px', fontSize: 11, outline: 'none' }}>
            {timeOpts.map(t => <option key={t}>{t}</option>)}
          </select>
          <button onClick={() => setShipDtEdit(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14 }}>✓</button>
        </div>
      )
    }
    const open = () => setShipDtEdit({
      id: r.id,
      date: m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '',
      time: m ? `${parseInt(m[4])}:${m[5]}` : '13:00',
    })
    if (!m) return (
      <span onClick={open} title="จิ้มเพื่อตั้งวันส่ง" style={{ color: 'var(--ink-4)', fontWeight: 400, cursor: 'pointer' }}>รอกำหนด</span>
    )
    return <span onClick={open} title="จิ้มเพื่อแก้วันเวลาส่ง" style={{ cursor: 'pointer' }}>{eff}</span>
  }

  const saveTextCell = async (id: string, field: string, val: string) => {
    const now = new Date().toISOString()
    const row = rows.find(r => r.id === id)
    const oldVal = row ? (row as any)[field] ?? null : null
    // แถวเคลม: บันทึกลงตาราง claims เฉพาะช่องที่มีจริง (ช่องอื่นบอกให้ไปแก้ที่หน้าเคลม)
    if (row && isClaimEntry(row)) {
      const patch = claimFieldPatch(field, val || null)
      if (!patch) { setError('ช่องนี้ของงานเคลมแก้ได้ที่หน้าเคลม'); setEditCell(null); return }
      const { error: cErr } = await claimUpdate({ ...patch, updated_at: now }).eq('id', id)
      if (cErr) setError(`บันทึกงานเคลมไม่สำเร็จ: ${cErr.message}`)
      else setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val || null, updated_at: now } as Entry : r))
      setEditCell(null)
      return
    }
    const { error: err } = await oeUpdate({ [field]: val || null, updated_at: now }).eq('id', id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val || null, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
      if ((oldVal ?? '') !== (val || '')) trackOrderField(id, { [field]: val || null, updated_at: now }, { [field]: oldVal, updated_at: row?.updated_at ?? null }, `แก้ข้อมูล ${row?.order_number || row?.customer_name || ''}`)
    }
    setEditCell(null)
  }

  // สั่งนอก: เก็บข้อความ + จำวันเวลาที่พิมพ์ (outsource_at) ไว้โชว์ใต้ข้อความ
  const saveOutsourceCell = async (id: string, val: string) => {
    const now = new Date().toISOString()
    const updates: Partial<Entry> = { outsource: val || null, outsource_at: val ? now : null, updated_at: now } as Partial<Entry>
    // ลบข้อความในคอลัมน์ → ล้างช่องสั่งนอกในรายการสินค้าด้วย ไม่งั้นค้างในใบปริ้นและเด้งกลับตอนบันทึกรายการรอบหน้า
    if (!val) {
      const items = rows.find(x => x.id === id)?.items
      if (Array.isArray(items) && items.some(it => (it.outsource ?? '').trim())) {
        updates.items = items.map(it => ({ ...it, outsource: '' }))
      }
    }
    const { error: err } = await oeUpdate(updates).eq('id', id)
    if (!err) {
      const row = rows.find(x => x.id === id)
      await syncOutsourcePO(id, row?.customer_name, row?.order_number, val, row?.items)
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
    }
    setEditCell(null)
  }

  // คอลัมน์วันที่ติดตั้ง: บันทึกวันนัด (deadline) + เวลานัด (install_time) จากการจิ้มแก้ในตาราง
  const saveInstallDt = async (id: string, dateStr: string, timeStr: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return
    const now = new Date().toISOString()
    const row = rows.find(r => r.id === id)
    const updates = { deadline: dateStr, install_time: timeStr, updated_at: now }
    const { error: err } = await oeUpdate(updates).eq('id', id)
    if (!err) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } as Entry : r))
      if (row) trackOrderField(id, updates, prevOf(row, updates), `แก้วันติดตั้ง ${row.order_number || row.customer_name || ''}`)
    }
  }

  // dropdown ติดตั้ง: ติดตั้งแล้ว / ติดตั้ง50% — เลือก 50% จะล้างวันนัดเดิมให้ขึ้น "รอนัดหมาย" รอนัดใหม่
  // is_dropoff คงไว้เป็นธง "ติดตั้งแล้ว" เพื่อให้ filter/จอเดิมทำงานเหมือนเดิม
  const handleInstallStatus = async (r: Entry, val: string) => {
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { install_status: val || null, is_dropoff: val === 'ติดตั้งแล้ว', updated_at: now }
    if (val === 'ติดตั้ง50%') updates.deadline = null
    const { error: err } = await oeUpdate(updates).eq('id', r.id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(row => row.id === r.id ? { ...row, ...updates } as Entry : row)))
      window.scrollTo(window.scrollX, sy)
      trackOrderField(r.id, updates, prevOf(r, updates), `แก้สถานะติดตั้ง ${r.order_number || r.customer_name || ''}`)
    }
  }

  const handlePaymentStatus = async (r: Entry, val: string) => {
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { payment_status: val, updated_at: now }
    // มัดจำ50% → ลงยอดชำระแล้ว + ยอดที่เหลือให้เลย (ครึ่งหนึ่งของยอดทั้งหมด) · มัดจำธรรมดา = รอกรอกยอดเอง
    if (val === 'มัดจำ50%' && r.price) { updates.deposit = r.price / 2; updates.paid_amount = r.price / 2 }
    else if (val === 'มัดจำ') { updates.deposit = null; updates.paid_amount = null }
    else if (val === 'ชำระครบ' && r.price) { updates.deposit = null; updates.paid_amount = r.price }
    else if (val === 'ยังไม่ชำระ') { updates.deposit = null; updates.paid_amount = null }
    const { error: err } = await oeUpdate(updates).eq('id', r.id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(row => row.id === r.id ? { ...row, ...updates, updated_at: now } as Entry : row)))
      window.scrollTo(window.scrollX, sy)
      trackOrderField(r.id, updates, prevOf(r, updates), `แก้การชำระ ${r.order_number || r.customer_name || ''}`)
    }
  }

  const saveNumericCell = async (id: string, field: string, val: string) => {
    const num = val === '' ? null : parseFloat(val)
    const now = new Date().toISOString()
    const row = rows.find(r => r.id === id)
    const oldVal = row ? (row as any)[field] ?? null : null
    // กรอก "ชำระแล้ว" → คำนวณยอดที่เหลือ (ชำระก่อนจัดส่ง/หลังติดตั้ง) ให้เลย
    const extra = field === 'paid_amount' && row?.price != null && num != null
      ? { deposit: Math.max(0, Number(row.price) - num) } : {}
    const { error: err } = await oeUpdate({ [field]: num, ...extra, updated_at: now }).eq('id', id)
    if (!err) {
      const sy = window.scrollY
      flushSync(() => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: num, ...extra, updated_at: now } as Entry : r)))
      window.scrollTo(window.scrollX, sy)
      if (oldVal !== num) trackOrderField(id, { [field]: num, updated_at: now }, { [field]: oldVal, updated_at: row?.updated_at ?? null }, `แก้ข้อมูล ${row?.order_number || row?.customer_name || ''}`)
    }
    setEditCell(null)
  }

  function getPrintRows(maxDays: number) {
    // ปริ้นต้องดูค่าสด ไม่ใช่ค่าตอนโหลดหน้า — ติ๊กงานเสร็จแล้วต้องไม่ติดมาในใบปริ้น
    return scopedRows.map(live).filter(r => {
      if (isClaimEntry(r)) return false   // ใบงานเคลมปริ้นที่หน้าเคลม (ฟอร์มคนละแบบ)
      if (r.is_urgent) return false
      const es = effShipping(r)
      const d = es ? daysRemaining(es) : null
      return d !== null && d < maxDays
    }).sort((a, b) => {
      const parseD = (r: Entry) => {
        const es = effShipping(r)
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

  async function openPrintWindow(toPrint: Entry[], title: string, mode: 'auto' | 'table' | 'form' = 'auto') {
    const escHtml = (v: unknown) => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))

    // auto: 1 รายการ = ฟอร์ม, หลายรายการ = ตาราง · form: ฟอร์มทุกใบ (แบ่งหน้า) · table: ตารางเสมอ
    const asForm = mode === 'form' || (mode === 'auto' && toPrint.length === 1)

    // เปิดหน้าต่างทันที (กัน popup block) แล้วค่อยใส่เนื้อหาหลังสร้าง QR เสร็จ
    const win = window.open('', '_blank', 'width=1200,height=750')
    if (!win) { alert('เบราว์เซอร์บล็อก popup — โปรดอนุญาต popup เพื่อปริ้น'); return }
    win.document.write('<!DOCTYPE html><meta charset="UTF-8"><body style="font-family:sans-serif;padding:24px;color:#666">กำลังเตรียมเอกสาร…</body>')

    // จำเวลาปริ้นล่าสุดต่อใบ → โชว์ข้างปุ่มปริ้นในเมนู ··· (ไม่แตะ updated_at เพราะไม่ใช่การแก้ข้อมูล)
    const printedNow = new Date().toISOString()
    const printedIds = toPrint.map(r => r.id)
    oeUpdate({ printed_at: printedNow }).in('id', printedIds)
      .then((res: { error: { message: string } | null }) => {
        if (!res.error) setRows(p => p.map(x => printedIds.includes(x.id) ? { ...x, printed_at: printedNow } : x))
      })

    // ฟอร์ม → สร้าง QR ต่อออเดอร์ (ชี้ไปหน้า /scan บนโดเมนเดียวกับที่เปิดอยู่)
    let qrs: string[] = []
    if (asForm) {
      const origin = window.location.origin
      qrs = await Promise.all(toPrint.map(r =>
        QRCode.toDataURL(`${origin}/scan?id=${r.id}&o=${encodeURIComponent(r.order_number || '')}`, { margin: 1, width: 240 }).catch(() => '')
      ))
    }

    const body = asForm
      ? toPrint.map((r, i) => `<div class="order"><pre class="copy" contenteditable="true" spellcheck="false" data-id="${r.id}">${formatOrderHtml(r)}</pre>${qrs[i] ? `<div class="qr-box"><img class="qr" src="${qrs[i]}"/></div>` : ''}</div>`).join('')
      : `<h2>${escHtml(title)} (${toPrint.length} รายการ)</h2>
<table>
<thead><tr>
  <th>#</th><th>วันที่เหลือ</th><th>ต้องจัดส่งภายใน</th><th>เลขคำสั่งซื้อ</th><th>ลูกค้า</th><th>ช่างที่รับผิดชอบ</th><th>แพลตฟอร์ม</th><th>สถานะงาน</th><th>บริษัทขนส่ง</th>
</tr></thead>
<tbody>
${toPrint.map((r, i) => {
  const es = effShipping(r)
  const d = es ? daysRemaining(es) : null
  const cls = d !== null ? (d <= 0 ? 'dr' : d <= 10 ? 'do' : 'dg') : ''
  const dtext = d !== null ? daysLabel(d) : '-'
  return `<tr><td>${i + 1}</td><td class="${cls}">${dtext}</td><td>${es || '-'}</td><td>${r.order_number || '-'}</td><td>${r.customer_name || '-'}</td><td>${r.technician || '-'}</td><td>${r.platform || '-'}</td><td>${r.order_status || '-'}</td><td>${r.courier || '-'}</td></tr>`
}).join('\n')}
</tbody>
</table>`

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
  pre.copy { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; font-size: 16px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; margin: 0; }
  pre.copy .rail { color: #c00; }
  /* ต้องเป็น block — break-inside: avoid ไม่ทำงานบน flex container (Chromium) ทำให้ออเดอร์โดนตัดข้ามหน้า
     avoid = ออเดอร์ไหนไม่พอที่ท้ายหน้า ยกไปขึ้นหน้าใหม่ทั้งใบ */
  .order { display: block; break-inside: avoid; page-break-inside: avoid; padding-bottom: 28px; margin-bottom: 28px; border-bottom: 1px dashed #b0b0b0; }
  .order:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: none; }
  .qr-box { display: inline-block; text-align: center; margin-top: 14px; }
  .qr { width: 120px; height: 120px; display: block; }
  .qr-cap { font-size: 11px; color: #555; margin-top: 4px; }
  /* margin:0 กันเบราว์เซอร์พิมพ์หัว/ท้ายกระดาษ — ไม่ fix ขนาด ใช้กระดาษที่เลือกใน dialog */
  @page { margin: 0; }
  @media print { body { padding: 14mm; } .toolbar { display: none !important; } pre.copy { outline: none !important; background: transparent !important; } }
  /* แก้ข้อความในใบได้ก่อนปริ้น */
  pre.copy[contenteditable]:hover { outline: 1.5px dashed #c0c0c0; outline-offset: 4px; }
  pre.copy[contenteditable]:focus { outline: 1.5px solid #2563eb; outline-offset: 4px; background: #fafcff; }
  .toolbar { position: fixed; top: 10px; right: 10px; background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 8px 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); display: flex; gap: 10px; align-items: center; z-index: 99; }
  .toolbar .hint { font-size: 12px; color: #888; }
  .toolbar button.go { padding: 8px 20px; border-radius: 8px; border: none; background: #1a1a1a; color: #fff; cursor: pointer; font-size: 14px; font-weight: 700; font-family: inherit; }
</style>
</head>
<body>
<div class="toolbar">
  <span class="hint">แตะข้อความเพื่อแก้ไขได้ก่อนปริ้น</span>
  <button class="go">🖨 ปริ้น</button>
</div>
${body}
<script>
  // จำข้อความเดิมไว้ กดปริ้นแล้วอันไหนถูกแก้ → ส่งกลับไปให้หน้าหลักบันทึกลงออเดอร์
  var orig = {};
  document.querySelectorAll('pre.copy[data-id]').forEach(function (p) { orig[p.dataset.id] = p.innerText; });
  document.querySelector('.toolbar .go').onclick = function () {
    document.querySelectorAll('pre.copy[data-id]').forEach(function (p) {
      if (p.innerText !== orig[p.dataset.id] && window.opener) {
        window.opener.postMessage({ type: 'donna-print-edited', id: p.dataset.id, text: p.innerText }, '*');
        orig[p.dataset.id] = p.innerText;
      }
    });
    window.print();
  };
</script>
</body>
</html>`
    win.document.open(); win.document.write(html); win.document.close(); win.focus()
    // ไม่เปิด dialog ปริ้นอัตโนมัติ — ให้แก้ข้อความก่อนได้ แล้วกดปุ่ม 🖨 ปริ้น ในหน้านั้น
  }

  // รับข้อความจากหน้าต่างปริ้น: แก้ในใบแล้วกดปริ้น → parse รายการกลับมาบันทึกลงออเดอร์
  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data
      if (!d || d.type !== 'donna-print-edited' || !d.id || typeof d.text !== 'string') return
      try {
        const res = await fetch('/api/parse-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: d.text }) })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'แปลงไม่สำเร็จ')
        const o = data.order || {}
        if (!Array.isArray(o.items) || o.items.length === 0) throw new Error('อ่านรายการจากข้อความที่แก้ไม่ได้')
        const now = new Date().toISOString()
        const updates = { items: o.items as Item[], updated_at: now }
        const { error: err } = await oeUpdate(updates).eq('id', d.id)
        if (err) throw new Error(err.message)
        setRows(prev => prev.map(r => r.id === d.id ? { ...r, ...updates } as Entry : r))
      } catch (err) {
        setError(`บันทึกรายการที่แก้จากใบปริ้นไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const printTitle = (list: Entry[]) => `ออเดอร์ที่เลือก ${list.length} รายการ — ${new Date().toLocaleDateString('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // ปริ้น: 1 รายการ → ฟอร์มทันที / หลายรายการ → ถามก่อนว่าตารางหรือฟอร์ม
  const requestPrint = (list: Entry[]) => {
    if (list.length === 0) return
    if (list.length === 1) { openPrintWindow(list, printTitle(list)); return }
    setPrintAsk(list)
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
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>{scope === 'claims' ? 'งานเคลม' : 'ออเดอร์'}</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{scopedRows.length} รายการ</p>
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
                requestPrint(rows.filter(r => selectedIds.has(r.id)))
              } else { setPrintModal(true) }
            }}
            style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            🖨️ ปริ้น{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
          <button onClick={() => { if (scope === 'claims') { setAddType('claim'); setModalTab('form'); setModal({ mode: 'add', data: { ...emptyForm(), shipping_datetime: '' } }); ph.begin([], null); setModalItems([]); setItemsPasteText('') } else setAddTypeModal(true) }}
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
        {scope === 'orders' && ([['all', 'ทั้งหมด'], ['platform', 'งานแพลตฟอร์ม'], ['outside', 'งานนอก'], ['install', 'งานติดตั้ง'], ['claim', 'งานเคลม'], ['shipped', 'จัดส่งแล้ว'], ['cancelled', 'ยกเลิก']] as [typeof quickFilter, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setQuickFilter(val)}
            style={{ padding: '6px 16px', borderRadius: 20, border: quickFilter === val ? 'none' : '1px solid var(--border)', background: quickFilter === val ? 'var(--blue)' : 'var(--surface)', color: quickFilter === val ? '#fff' : 'var(--ink-3)', fontSize: 13, fontWeight: quickFilter === val ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        {(() => {
          const incompleteCount = scopedRows.filter(r => {
            const p = r.platform ?? ''
            const isClaim = p.startsWith('เคลม:')
            const isShipped = r.order_status === 'จัดส่งแล้ว'
            const isCancelled = r.order_status === 'ยกเลิก'
            const matchQ = quickFilter === 'shipped' ? isShipped
              : quickFilter === 'cancelled' ? isCancelled
              : quickFilter === 'claim' ? isClaim
              : (isShipped || isCancelled) ? false
              : quickFilter === 'all' ? true
              : quickFilter === 'platform' ? (!isClaim && (p === 'Shopee' || p === 'Tiktok' || p === 'Lazada'))
              : quickFilter === 'outside' ? (!isClaim && OUTSIDE_PLATFORMS.includes(p) && !r.is_installation)
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
        {(() => {
          const unprintedCount = scopedRows.filter(r => matchQuickTab(r, quickFilter as QuickTab) && !r.printed_at).length
          if (unprintedCount === 0) return null
          return (
            <button onClick={() => { setUnprintedFilter(f => !f); setPrintedPendingFilter(false) }}
              style={{ padding: '6px 14px', borderRadius: 20, border: unprintedFilter ? 'none' : '1px solid var(--border)', background: unprintedFilter ? '#eab308' : 'var(--surface)', color: unprintedFilter ? '#fff' : '#eab308', fontSize: 13, fontWeight: unprintedFilter ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              ยังไม่ปริ้น
              <span style={{ background: unprintedFilter ? 'rgba(255,255,255,0.3)' : '#eab30822', color: unprintedFilter ? '#fff' : '#eab308', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                {unprintedCount}
              </span>
            </button>
          )
        })()}
        {(() => {
          const printedPendingCount = scopedRows.filter(r => matchQuickTab(r, quickFilter as QuickTab) && isPrintedPending(r)).length
          if (printedPendingCount === 0) return null
          return (
            <button onClick={() => { setPrintedPendingFilter(f => !f); setUnprintedFilter(false) }}
              title="ปริ้นใบงานไปเกิน 24 ชม. แล้ว แต่สถานะยังเป็น รอดำเนินการ"
              style={{ padding: '6px 14px', borderRadius: 20, border: printedPendingFilter ? 'none' : '1px solid var(--border)', background: printedPendingFilter ? '#3b82f6' : 'var(--surface)', color: printedPendingFilter ? '#fff' : '#3b82f6', fontSize: 13, fontWeight: printedPendingFilter ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              ปริ้นแล้วแต่ยังไม่ดำเนินการ
              <span style={{ background: printedPendingFilter ? 'rgba(255,255,255,0.3)' : '#3b82f622', color: printedPendingFilter ? '#fff' : '#3b82f6', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                {printedPendingCount}
              </span>
            </button>
          )
        })()}
        {COLUMN_DEFS[colTabKey] && (
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button onClick={() => setOpenColMenu(v => !v)}
              style={{ padding: '6px 14px', borderRadius: 20, border: tabHidden.length ? 'none' : '1px solid var(--border)', background: tabHidden.length ? 'var(--blue)' : 'var(--surface)', color: tabHidden.length ? '#fff' : 'var(--ink-3)', fontSize: 13, fontWeight: tabHidden.length ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              คอลัมน์{tabHidden.length > 0 && ` (ซ่อน ${tabHidden.length})`} <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
            </button>
            {openColMenu && (
              <>
                <div onClick={() => setOpenColMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '6px 0', minWidth: 200, maxHeight: 360, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>ติ๊กออก = ซ่อน</span>
                    {tabHidden.length > 0 && (
                      <button onClick={() => setHiddenCols(prev => { const obj = { ...prev, [colTabKey]: [] }; try { localStorage.setItem(`ow_hidden_cols_${scope}`, JSON.stringify(obj)) } catch {}; return obj })}
                        style={{ border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 11, cursor: 'pointer', padding: 0 }}>โชว์ทั้งหมด</button>
                    )}
                  </div>
                  {COLUMN_DEFS[colTabKey].map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)' }}>
                      <input type="checkbox" checked={showCol(c.id)} onChange={() => toggleCol(c.id)} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
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
              {/* filter งานเสร็จ: กดเพื่อดูเฉพาะงานเสร็จ กดซ้ำเพื่อยกเลิก */}
              <div onClick={() => { setOutDoneFilter(outDoneFilter === true ? null : true); setOpenFilter(null); setOutFilterPos(null) }}
                style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: outDoneFilter === true ? 600 : 400, color: outDoneFilter === true ? '#22c55e' : 'var(--ink)', background: outDoneFilter === true ? 'rgba(34,197,94,0.08)' : 'transparent', borderTop: '1px solid var(--border)' }}>
                งานเสร็จ {outDoneFilter === true && '✓'}
              </div>
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
          if (openFilter === 'out-admin') return (
            <div style={{ ...dropStyle, minWidth: 160 }}>
              {adminNames.map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: outAdminFilters.includes(a) ? 'var(--blue-bg)' : 'transparent' }}>
                  <input type="checkbox" checked={outAdminFilters.includes(a)} onChange={() => setOutAdminFilters(toggleArr(outAdminFilters, a))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                  {a}
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
                {showCol('days') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-days')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outDaysSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    วันที่เหลือ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {showCol('deadline') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-deadline')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: (outDeadlineFrom || outDeadlineTo) ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {quickFilter === 'install' ? 'วันที่ติดตั้ง' : 'ต้องส่งภายใน'} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {showCol('print') && printHeader()}
                {showCol('customer') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                )}
                {showCol('platform') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-platform')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outPlatformFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แพลตฟอร์ม{outPlatformFilters.length > 0 && ` (${outPlatformFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {showCol('items') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>รายการ</th>
                )}
                {showCol('total') && (
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ยอดทั้งหมด</th>
                )}
                {showCol('payment') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-payment')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outPaymentFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ชำระ{outPaymentFilters.length > 0 && ` (${outPaymentFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {showCol('paid') && (
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ชำระแล้ว</th>
                )}
                {showCol('paybefore') && (
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{quickFilter === 'install' ? 'ยอดชำระหลังติดตั้ง' : 'ยอดชำระก่อนจัดส่ง'}</th>
                )}
                {showCol('assigned') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-assigned')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outAssignedFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    ลงออเดอร์{outAssignedFilters.length > 0 && ` (${outAssignedFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {showCol('admin') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-admin')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outAdminFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แอดมิน{outAdminFilters.length > 0 && ` (${outAdminFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {showCol('status') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-status')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outStatusFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    สถานะงาน{outStatusFilters.length > 0 && ` (${outStatusFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {showCol('done') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-done')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outDoneFilter !== null ? '#22c55e' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    งานเสร็จ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                {quickFilter !== 'install' && showCol('shipped') && (
                  <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>จัดส่งแล้ว</th>
                )}
                {quickFilter === 'install' && showCol('installed') && (
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <button onClick={e => openOutFilter(e, 'out-installed')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outInstalledFilter !== null ? '#22c55e' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      ติดตั้ง <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                  </th>
                )}
                {showCol('rail') && (
                <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>สถานะราง</th>
                )}
                {showCol('created') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>วันที่สร้าง</th>
                )}
                {showCol('outsource') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>สั่งนอก</th>
                )}
                {quickFilter === 'install' && showCol('province') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>จังหวัด</th>
                )}
                {showCol('address') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ที่อยู่</th>
                )}
                {showCol('phone') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>เบอร์โทร</th>
                )}
                {quickFilter === 'install' && showCol('maps') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>Maps</th>
                )}
                {showCol('notes') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                )}
                {showCol('updated') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <button onClick={e => openOutFilter(e, 'out-updated')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: outUpdatedSort ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แก้ไขล่าสุด <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                </th>
                )}
                <th style={{ padding: '10px 14px' }} />
              </tr>
            </thead>
            <tbody>
              {displayedOut.map(r => {
                const isEditing = (f: string) => editCell?.id === r.id && editCell.field === f
                const numCell = (field: 'price' | 'deposit' | 'paid_amount') => {
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
                const textCell = (field: 'customer_name' | 'notes' | 'address' | 'phone', placeholder = '—') => {
                  const val = r[field] ?? ''
                  return isEditing(field) ? (
                    <input type="text" autoFocus value={editCell!.val}
                      onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                      onBlur={() => saveTextCell(r.id, field, editCell!.val)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', minWidth: 100, outline: 'none', padding: '2px 0' }} />
                  ) : (
                    <div onClick={() => setEditCell({ id: r.id, field, val })} title={val || undefined}
                      style={{ cursor: 'text', color: val ? (field === 'customer_name' ? 'var(--blue)' : 'var(--ink)') : 'var(--ink-4)', fontWeight: field === 'customer_name' && val ? 600 : undefined, maxWidth: field === 'notes' ? 160 : field === 'address' ? 180 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {val || placeholder}
                    </div>
                  )
                }
                // จังหวัด: จิ้มแล้วเป็นช่องพิมพ์ค้นหา เลือกจากรายชื่อจังหวัดทั้งหมด (เชียงราย/เชียงใหม่/กทม อยู่บนสุด)
                const provinceCell = () => {
                  const val = r.province ?? ''
                  return isEditing('province') ? (
                    <ProvinceSelect value={val}
                      onPick={v => saveTextCell(r.id, 'province', v)}
                      onCancel={() => setEditCell(null)} />
                  ) : (
                    <div onClick={() => setEditCell({ id: r.id, field: 'province', val })}
                      style={{ cursor: 'pointer', color: val ? 'var(--ink)' : 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                      {val || '—'}
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
                // maps: มีลิงก์ → จิ้มเปิดลิงก์เลย มีปุ่ม ✎ ไว้แก้ / ยังว่าง → จิ้มเพื่อกรอกเหมือนหมายเหตุ
                const mapsCell = () => {
                  const val = r.location_link ?? ''
                  return isEditing('location_link') ? (
                    <input type="text" autoFocus value={editCell!.val}
                      onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                      onBlur={() => saveTextCell(r.id, 'location_link', editCell!.val)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', minWidth: 120, outline: 'none', padding: '2px 0' }} />
                  ) : val ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      <a href={linkHref(val)} target="_blank" rel="noreferrer" title={val}
                        style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>📍 เปิด Maps</a>
                      <button onClick={() => setEditCell({ id: r.id, field: 'location_link', val })} title="แก้ลิงก์"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 11, padding: 0 }}>✎</button>
                    </div>
                  ) : (
                    <div onClick={() => setEditCell({ id: r.id, field: 'location_link', val: '' })}
                      style={{ cursor: 'text', color: 'var(--ink-4)', minWidth: 60 }}>—</div>
                  )
                }
                // สั่งนอก: แก้เหมือนหมายเหตุ + โชว์วันเวลาที่พิมพ์ใต้ข้อความ
                const outsourceCell = () => {
                  const val = r.outsource ?? ''
                  return isEditing('outsource') ? (
                    <input type="text" autoFocus value={editCell!.val}
                      onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                      onBlur={() => saveOutsourceCell(r.id, editCell!.val)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', minWidth: 100, outline: 'none', padding: '2px 0' }} />
                  ) : (
                    <div onClick={() => setEditCell({ id: r.id, field: 'outsource', val })} style={{ cursor: 'text', minWidth: 60 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, color: val ? 'var(--ink)' : 'var(--ink-4)' }}>{val || '—'}</div>
                      {val && r.outsource_at && (
                        <div style={{ color: 'var(--ink-4)', fontSize: 10, lineHeight: 1.3 }}>
                          {new Date(r.outsource_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                          {new Date(r.outsource_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  )
                }
                // วันที่ติดตั้ง: โชว์วัน+เวลานัด จิ้มแล้วเลือกวันและเวลาได้ / ยังไม่มีนัด (เช่น ติดตั้ง50%) → "รอนัดหมาย"
                const installDtCell = () => {
                  const editing = installDtEdit?.id === r.id ? installDtEdit : null
                  if (editing) {
                    const timeOpts = TIMES.includes(editing.time) ? TIMES : [editing.time, ...TIMES]
                    return (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="date" autoFocus value={/^\d{4}-\d{2}-\d{2}$/.test(editing.date) ? editing.date : ''}
                          onChange={e => { if (e.target.value) { setInstallDtEdit({ ...editing, date: e.target.value }); saveInstallDt(r.id, e.target.value, editing.time) } }}
                          onMouseDown={e => { e.preventDefault(); try { (e.target as HTMLInputElement).showPicker() } catch {} }}
                          style={{ border: '1px solid var(--blue)', borderRadius: 6, padding: '4px 7px', fontSize: 11, outline: 'none' }} />
                        <select value={editing.time}
                          onChange={e => { setInstallDtEdit({ ...editing, time: e.target.value }); saveInstallDt(r.id, editing.date, e.target.value) }}
                          style={{ border: '1px solid var(--blue)', borderRadius: 6, padding: '4px 7px', fontSize: 11, outline: 'none' }}>
                          {timeOpts.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <button onClick={() => setInstallDtEdit(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14 }}>✓</button>
                      </div>
                    )
                  }
                  const open = () => setInstallDtEdit({ id: r.id, date: (r.deadline || '').slice(0, 10), time: r.install_time || '9:00' })
                  if (!r.deadline) return (
                    <span onClick={open} title="จิ้มเพื่อนัดวันติดตั้ง" style={{ color: '#f59e0b', fontWeight: 600, cursor: 'pointer' }}>รอนัดหมาย</span>
                  )
                  return (
                    <span onClick={open} title="จิ้มเพื่อแก้วันเวลานัด" style={{ cursor: 'pointer', whiteSpace: 'nowrap', color: '#bf5af2' }}>
                      {new Date(r.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}{r.install_time ? ` ${r.install_time}` : ''}
                    </span>
                  )
                }
                const instStatus = installStatusOf(r)
                // ยอดที่ต้องชำระต่อ: กรอกช่อง "ชำระแล้ว" ไว้ → ยอดทั้งหมด − ยอดที่ชำระแล้ว · ไม่ได้กรอกและเป็นมัดจำ50% → ครึ่งหนึ่งเหมือนเดิม
                const autoDeposit = r.paid_amount != null && r.price != null
                  ? Math.max(0, Number(r.price) - Number(r.paid_amount))
                  : r.payment_status === 'มัดจำ50%' && r.price ? r.price / 2 : null
                const outDays = r.deadline ? daysRemaining(r.deadline) : null
                const isDone = r.order_status === 'เสร็จสิ้น'
                const isCancelled = r.order_status === 'ยกเลิก'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                    </td>
                    {showCol('days') && (
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      {isCancelled ? (
                        <span style={{ fontWeight: 700, color: '#ef4444' }}>ยกเลิก</span>
                      ) : r.is_urgent ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จ</span>
                      ) : isDone ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>เสร็จสิ้น</span>
                      ) : outDays !== null ? (
                        <span style={{ fontWeight: 700, color: daysColor(outDays) }}>
                          {outDays === 0 && quickFilter === 'install' ? 'ต้องติดตั้งวันนี้' : daysLabel(outDays)}
                        </span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                    </td>
                    )}
                    {showCol('deadline') && (
                    <td style={{ padding: '8px 14px' }}>
                      {isCancelled ? <span style={{ color: 'var(--ink-4)' }}>-</span>
                        : r.order_status === 'จัดส่งแล้ว' ? <span style={{ fontWeight: 700, color: '#22c55e' }}>จัดส่งแล้ว</span>
                        : (quickFilter === 'install' && instStatus === 'ติดตั้งแล้ว') ? <span style={{ fontWeight: 700, color: '#22c55e' }}>ติดตั้งแล้ว</span>
                        : quickFilter === 'install' ? installDtCell()
                        : dateCell('deadline')}
                    </td>
                    )}
                    {showCol('print') && printCell(r)}
                    {showCol('customer') && (
                    <td style={{ padding: '8px 14px', minWidth: 100 }}>
                      {r.customer_name
                        ? <Link href={`/customers?name=${encodeURIComponent(r.customer_name)}`} title="ดูประวัติลูกค้า" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{r.customer_name}</Link>
                        : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    )}
                    {showCol('platform') && (
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
                    )}
                    {showCol('items') && (
                    <td style={{ padding: '6px 14px', maxWidth: 200 }}>
                      <button onClick={() => { openItemsModal(r) }}
                        style={{ border: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', padding: 0, color: r.items?.length ? 'var(--ink)' : 'var(--ink-4)', textAlign: 'left', display: 'block', width: '100%' }}>
                        {r.items?.length ? (
                          <div>
                            {/* โชว์ไม่เกิน 3 บรรทัด — รายการเยอะแค่ไหนแถวก็ไม่ยืด (กดเปิดดูรายการเต็มได้) */}
                            {formatItemLines(r.items).slice(0, ITEM_LINE_MAX).map((line, i) => (
                              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190, lineHeight: '1.6', color: i === 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{line}</div>
                            ))}
                            {formatItemLines(r.items).length > ITEM_LINE_MAX && (
                              <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>+ อีก {formatItemLines(r.items).length - ITEM_LINE_MAX} รายการ</div>
                            )}
                          </div>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </button>
                    </td>
                    )}
                    {showCol('total') && (
                    <td style={{ padding: '8px 14px' }}>{numCell('price')}</td>
                    )}
                    {showCol('payment') && (
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.payment_status || 'ยังไม่ชำระ'} onChange={e => handlePaymentStatus(r, e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: PAYMENT_STATUS_COLOR[r.payment_status] ?? '#f59e0b', padding: 0 }}>
                        {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    )}
                    {showCol('paid') && (
                    <td style={{ padding: '8px 14px' }}>
                      {(!r.payment_status || r.payment_status === 'ยังไม่ชำระ') ? (
                        <div style={{ textAlign: 'right', color: 'var(--ink-4)' }}>-</div>
                      ) : r.payment_status === 'ชำระครบ' && r.paid_amount == null ? (
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>{r.price != null ? Number(r.price).toLocaleString('th-TH') : '—'}</div>
                      ) : numCell('paid_amount')}
                    </td>
                    )}
                    {showCol('paybefore') && (
                    <td style={{ padding: '8px 14px' }}>
                      {(r.payment_status === 'ชำระครบ' || !r.payment_status || r.payment_status === 'ยังไม่ชำระ') ? (
                        <div style={{ textAlign: 'right', color: 'var(--ink-4)' }}>-</div>
                      ) : autoDeposit != null ? (
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>{autoDeposit.toLocaleString('th-TH')}</div>
                      ) : numCell('deposit')}
                    </td>
                    )}
                    {showCol('assigned') && (
                    <td style={{ padding: '8px 14px' }}>
                      <select value={r.order_assigned || 'รออัพเดท'} onChange={e => updateField(r.id, 'order_assigned', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.order_assigned && r.order_assigned !== 'รออัพเดท' ? 'var(--ink)' : 'var(--ink-4)', fontWeight: r.order_assigned && r.order_assigned !== 'รออัพเดท' ? 600 : 400, padding: 0 }}>
                        {ORDER_ASSIGNED.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    )}
                    {/* แอดมิน — ช่องเดียวกับงานแพลตฟอร์ม (เลือกเองได้ · ระบบทับให้เมื่อแอดมินหลักแก้เนื้อออเดอร์) */}
                    {showCol('admin') && (
                    <td style={{ padding: '8px 14px', background: r.admin_name ? undefined : EMPTY_HL }}>
                      <select value={r.admin_name || ''} onChange={e => updateField(r.id, 'admin_name', e.target.value)}
                        title="เลือกเองได้ · ระบบจะเปลี่ยนให้เองเมื่อมีแอดมินหลักมาแก้เนื้อออเดอร์"
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.admin_name ? 'var(--ink)' : 'var(--ink-4)', padding: 0, maxWidth: 80 }}>
                        <option value="">—</option>
                        {ADMINS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    )}
                    {showCol('status') && statusCell(r)}
                    {showCol('done') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <input type="checkbox" checked={!!r.is_urgent} onChange={e => toggleDone(r.id, e.target.checked)}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                        {timeStamp(r, 'done_at')}
                      </div>
                    </td>
                    )}
                    {quickFilter !== 'install' && showCol('shipped') && (
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <input type="checkbox" checked={r.order_status === 'จัดส่งแล้ว'} onChange={e => toggleShipped(r.id, e.target.checked)}
                            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                          {shippedStamp(r)}
                          {Array.isArray(r.shipments) && r.shipments.length > 0 && (
                            <button onClick={() => { setTrackModal(r.id); setTrackError('') }} title="ดูสถานะพัสดุ"
                              style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 6, padding: '1px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--ink-2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📦 {thaiTrackStatus(r.shipments[0].status) || `${r.shipments.length} เลขพัสดุ`}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {quickFilter === 'install' && showCol('installed') && (
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <select value={instStatus} onChange={e => handleInstallStatus(r, e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', fontWeight: 600, color: instStatus === 'ติดตั้งแล้ว' ? '#22c55e' : instStatus === 'ติดตั้ง50%' ? '#f59e0b' : 'var(--ink-4)', padding: 0 }}>
                          <option value="">—</option>
                          {INSTALL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    )}
                    {showCol('rail') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {hasRail(r) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <input type="checkbox" checked={!!r.rail_packed} onChange={e => toggleRailPacked(r.id, e.target.checked)}
                            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                          {r.rail_packed && r.rail_packed_at && (
                            <span style={{ color: '#22c55e', fontSize: 10, lineHeight: 1.3 }}>
                              {new Date(r.rail_packed_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                              {new Date(r.rail_packed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--ink-4)' }}>–</span>}
                    </td>
                    )}
                    {showCol('created') && (
                    <td style={{ padding: '8px 14px' }}>{dateCell('entry_date')}</td>
                    )}
                    {showCol('outsource') && (
                    <td style={{ padding: '8px 14px', minWidth: 100 }}>{outsourceCell()}</td>
                    )}
                    {quickFilter === 'install' && showCol('province') && (
                    <td style={{ padding: '8px 14px', minWidth: 100 }}>{provinceCell()}</td>
                    )}
                    {showCol('address') && (
                    <td style={{ padding: '8px 14px', minWidth: 120, maxWidth: 180 }}>{textCell('address', '—')}</td>
                    )}
                    {showCol('phone') && (
                    <td style={{ padding: '8px 14px', minWidth: 90 }}>{textCell('phone', '—')}</td>
                    )}
                    {quickFilter === 'install' && showCol('maps') && (
                    <td style={{ padding: '8px 14px' }}>{mapsCell()}</td>
                    )}
                    {showCol('notes') && (
                    <td style={{ padding: '8px 14px', minWidth: 120 }}>{textCell('notes', '—')}</td>
                    )}
                    {showCol('updated') && (
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    )}
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
        ) : (quickFilter === 'all' || quickFilter === 'claim' || quickFilter === 'shipped') ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                <th style={{ padding: '10px 14px', width: 36 }}>
                  <input type="checkbox" ref={selectAllRef}
                    checked={activeDisplayed.length > 0 && activeDisplayed.every(r => selectedIds.has(r.id))}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                </th>
                {showCol('days') && (
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
                      {/* filter งานเสร็จ: กดเพื่อดูเฉพาะงานเสร็จ กดซ้ำเพื่อยกเลิก */}
                      <div onClick={() => { setAllDoneFilter(allDoneFilter === true ? null : true); setOpenAllFilter(null) }}
                        style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: allDoneFilter === true ? 600 : 400, color: allDoneFilter === true ? '#22c55e' : 'var(--ink)', background: allDoneFilter === true ? 'rgba(34,197,94,0.08)' : 'transparent', borderTop: '1px solid var(--border)' }}>
                        งานเสร็จ {allDoneFilter === true && '✓'}
                      </div>
                    </div>
                  )}
                </th>
                )}
                {showCol('deadline') && (
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
                )}
                {showCol('print') && printHeader()}
                {quickFilter === 'shipped' && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>เลขออเดอร์</th>
                )}
                {showCol('customer') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                )}
                {showCol('platform') && (
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
                )}
                {showCol('courier') && (
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
                )}
                {showCol('status') && (
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
                )}
                {showCol('done') && (
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
                )}
                {showCol('shipped') && (
                <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>จัดส่งแล้ว</th>
                )}
                {showCol('rail') && (
                <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>สถานะราง</th>
                )}
                {showCol('notes') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                )}
                {showCol('updated') && (
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
                )}
                <th style={{ padding: '10px 14px' }} />
              </tr>
            </thead>
            <tbody>
              {displayedAll.map(r => {
                const isOutsideRow = OUTSIDE_PLATFORMS.includes(r.platform ?? '') || r.is_installation
                const allEffective = effectiveDueDate(r)   // งานนอก/ติดตั้ง=deadline · แพลตฟอร์ม=effShipping (lib/orderTabs.ts)
                const allDays = allEffective ? daysRemaining(allEffective) : null
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                    </td>
                    {showCol('days') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {r.order_status === 'จัดส่งแล้ว' ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จแล้ว</span>
                      ) : r.is_urgent ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จ</span>
                      ) : allDays !== null ? (
                        <span style={{ fontWeight: 700, color: daysColor(allDays) }}>
                          {daysLabel(allDays)}
                        </span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                    </td>
                    )}
                    {showCol('deadline') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 500, color: '#bf5af2' }}>
                      {!isOutsideRow ? (
                        r.order_status === 'จัดส่งแล้ว' ? <span style={{ color: '#22c55e', fontWeight: 700 }}>จัดส่งแล้ว</span>
                        : shipDtCell(r, allEffective)
                      ) : (
                        r.order_status === 'จัดส่งแล้ว' ? <span style={{ color: '#22c55e', fontWeight: 700 }}>จัดส่งแล้ว</span>
                        : r.deadline ? new Date(r.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>
                      )}
                    </td>
                    )}
                    {showCol('print') && printCell(r)}
                    {quickFilter === 'shipped' && (
                    <td style={{ padding: '12px 14px', color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.order_number || '-'}</td>
                    )}
                    {showCol('customer') && (
                    <td style={{ padding: '12px 14px' }}>
                      {r.customer_name
                        ? <Link href={`/customers?name=${encodeURIComponent(r.customer_name)}`} title="ดูประวัติลูกค้า" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{r.customer_name}</Link>
                        : <span style={{ color: 'var(--ink-4)' }}>-</span>}
                    </td>
                    )}
                    {showCol('platform') && (
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{r.platform || '-'}</td>
                    )}
                    {showCol('courier') && (
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {r.is_installation ? <span style={{ color: '#f97316', fontWeight: 600 }}>งานติดตั้ง</span> : r.courier || <span style={{ color: 'var(--ink-4)' }}>-</span>}
                    </td>
                    )}
                    {showCol('status') && statusCell(r)}
                    {showCol('done') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <input type="checkbox" checked={!!r.is_urgent} onChange={e => toggleDone(r.id, e.target.checked)}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                        {timeStamp(r, 'done_at')}
                      </div>
                    </td>
                    )}
                    {showCol('shipped') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {r.is_installation ? (
                        <span style={{ color: 'var(--ink-4)' }}>-</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <input type="checkbox" checked={r.order_status === 'จัดส่งแล้ว'} onChange={e => toggleShipped(r.id, e.target.checked)}
                            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                          {shippedStamp(r)}
                          {Array.isArray(r.shipments) && r.shipments.length > 0 && (
                            <button onClick={() => { setTrackModal(r.id); setTrackError('') }} title="ดูสถานะพัสดุ"
                              style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 6, padding: '1px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--ink-2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📦 {thaiTrackStatus(r.shipments[0].status) || `${r.shipments.length} เลขพัสดุ`}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    )}
                    {showCol('rail') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {hasRail(r) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <input type="checkbox" checked={!!r.rail_packed} onChange={e => toggleRailPacked(r.id, e.target.checked)}
                            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                          {r.rail_packed && r.rail_packed_at && (
                            <span style={{ color: '#22c55e', fontSize: 10, lineHeight: 1.3 }}>
                              {new Date(r.rail_packed_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                              {new Date(r.rail_packed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--ink-4)' }}>–</span>}
                    </td>
                    )}
                    {showCol('notes') && (
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
                    )}
                    {showCol('updated') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    )}
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
                {showCol('days') && (
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
                      {/* filter งานเสร็จ: กดเพื่อดูเฉพาะงานเสร็จ กดซ้ำเพื่อยกเลิก */}
                      <div onClick={() => { setUrgentFilter(urgentFilter === true ? null : true); setOpenFilter(null) }}
                        style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: urgentFilter === true ? 600 : 400, color: urgentFilter === true ? '#22c55e' : 'var(--ink)', background: urgentFilter === true ? 'rgba(34,197,94,0.08)' : 'transparent', borderTop: '1px solid var(--border)' }}>
                        งานเสร็จ {urgentFilter === true && '✓'}
                      </div>
                    </div>
                  )}
                </th>
                )}
                {showCol('shipping') && (
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
                )}
                {showCol('print') && printHeader()}
                {showCol('order_number') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>เลขคำสั่งซื้อ</th>
                )}
                {showCol('customer') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                )}
                {showCol('price') && (
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ราคาสุทธิ</th>
                )}
                {showCol('items') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>รายการ</th>
                )}
                {showCol('platform') && (
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
                )}
                {showCol('courier') && (
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
                )}
                {showCol('pay_date') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>วันที่ชำระ</th>
                )}
                {showCol('ship_date') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>วันที่ต้องส่ง</th>
                )}
                {showCol('admin') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                  <button onClick={() => setOpenFilter(openFilter === 'admin' ? null : 'admin')}
                    style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, color: adminFilters.length ? 'var(--blue)' : 'var(--ink-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    แอดมิน{adminFilters.length > 0 && ` (${adminFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                  </button>
                  {openFilter === 'admin' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 140, padding: '6px 0' }}>
                      {adminNames.map(a => (
                        <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontWeight: 400, background: adminFilters.includes(a) ? 'var(--blue-bg)' : 'transparent' }}>
                          <input type="checkbox" checked={adminFilters.includes(a)} onChange={() => setAdminFilters(toggleArr(adminFilters, a))} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                          {a}
                        </label>
                      ))}
                    </div>
                  )}
                </th>
                )}
                {showCol('tech') && (
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
                )}
                {showCol('status') && (
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
                )}
                {showCol('dropoff') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>Drop-off</th>
                )}
                {showCol('done') && (
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
                )}
                {showCol('shipped') && (
                <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>จัดส่งแล้ว</th>
                )}
                {showCol('rail') && (
                <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>สถานะราง</th>
                )}
                {showCol('outsource') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>สั่งนอก</th>
                )}
                {showCol('ship_address') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>ที่อยู่จัดส่งแยก</th>
                )}
                {showCol('notes') && (
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                )}
                {showCol('updated') && (
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
                )}
                <th style={{ padding: '10px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => {
                const effectiveShipping = effShipping(r)
                const days = effectiveShipping ? daysRemaining(effectiveShipping) : null
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(r.id) ? 'var(--blue-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                        style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--blue)' }} />
                    </td>
                    {showCol('days') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {r.order_status === 'จัดส่งแล้ว' ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จแล้ว</span>
                      ) : r.is_urgent ? (
                        <span style={{ fontWeight: 700, color: '#22c55e' }}>งานเสร็จ</span>
                      ) : days !== null ? (
                        <span style={{ fontWeight: 700, color: daysColor(days) }}>
                          {daysLabel(days)}
                        </span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                    </td>
                    )}
                    {showCol('shipping') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 500, color: '#bf5af2' }}>
                      {r.order_status === 'จัดส่งแล้ว' ? (
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>จัดส่งแล้ว</span>
                      ) : shipDtCell(r, effectiveShipping)}
                    </td>
                    )}
                    {showCol('print') && printCell(r)}
                    {showCol('order_number') && (
                    <td style={{ padding: '12px 14px', color: 'var(--ink)', fontWeight: 600 }}>{r.order_number || '-'}</td>
                    )}
                    {showCol('customer') && (
                    <td style={{ padding: '12px 14px' }}>
                      {r.customer_name
                        ? <Link href={`/customers?name=${encodeURIComponent(r.customer_name)}`} title="ดูประวัติลูกค้า" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>{r.customer_name}</Link>
                        : <span style={{ color: 'var(--ink-4)' }}>-</span>}
                    </td>
                    )}
                    {showCol('price') && (
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: r.price ? 600 : 400, color: r.price ? 'var(--ink)' : 'var(--ink-4)' }}>
                      {r.price ? `${r.price.toLocaleString('th-TH')} ฿` : '-'}
                      {r.net_income != null && (
                        <div title={`ยอดโอนจริงจากไฟล์รายรับ Shopee${r.net_income_at ? ` · โอนเมื่อ ${r.net_income_at}` : ''}`}
                          style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>รับจริง {r.net_income.toLocaleString('th-TH')} ฿</div>
                      )}
                    </td>
                    )}
                    {showCol('items') && (
                    <td style={{ padding: '6px 14px', maxWidth: 240 }}>
                      <button onClick={() => { openItemsModal(r) }}
                        style={{ border: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', padding: 0, color: r.items?.length ? 'var(--ink)' : 'var(--ink-4)', textAlign: 'left', display: 'block', width: '100%' }}>
                        {r.items?.length ? (
                          <div>
                            {/* โชว์ไม่เกิน 3 บรรทัด — รายการเยอะแค่ไหนแถวก็ไม่ยืด (กดเปิดดูรายการเต็มได้) */}
                            {formatItemLines(r.items).slice(0, ITEM_LINE_MAX).map((line, i) => (
                              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 230, lineHeight: '1.6', color: i === 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{line}</div>
                            ))}
                            {formatItemLines(r.items).length > ITEM_LINE_MAX && (
                              <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>+ อีก {formatItemLines(r.items).length - ITEM_LINE_MAX} รายการ</div>
                            )}
                          </div>
                        ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                      </button>
                    </td>
                    )}
                    {showCol('platform') && (
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{r.platform || '-'}</td>
                    )}
                    {showCol('courier') && (
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)', maxWidth: 140 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.courier || '-'}</div>
                    </td>
                    )}
                    {showCol('pay_date') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>
                      {r.entry_date ? new Date(r.entry_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span style={{ color: '#f59e0b', fontWeight: 500 }}>ยังไม่ชำระ</span>}
                    </td>
                    )}
                    {showCol('ship_date') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-3)' }}>
                      {r.deadline ? new Date(r.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                    </td>
                    )}
                    {showCol('admin') && (
                    // เลือกเองได้เหมือนเดิม + ระบบเปลี่ยนให้เองเมื่อมีแอดมินหลักมาแก้เนื้อออเดอร์ (lib/adminActor.ts)
                    // ยังไม่ได้ลงชื่อ = ไฮไลต์เหลืองให้เห็นว่าตกหล่น (user สั่ง 4 ส.ค. 69)
                    <td style={{ padding: '8px 14px', background: r.admin_name ? undefined : EMPTY_HL }}>
                      <select value={r.admin_name || ''} onChange={e => updateField(r.id, 'admin_name', e.target.value)}
                        title="เลือกเองได้ · ระบบจะเปลี่ยนให้เองเมื่อมีแอดมินหลักมาแก้เนื้อออเดอร์"
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.admin_name ? 'var(--ink)' : 'var(--ink-4)', padding: 0, maxWidth: 80 }}>
                        <option value="">—</option>
                        {ADMINS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    )}
                    {showCol('tech') && (
                    <td style={{ padding: '8px 14px', background: r.technician ? undefined : EMPTY_HL }}>
                      <select value={r.technician || ''} onChange={e => updateField(r.id, 'technician', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: r.technician ? 'var(--ink)' : 'var(--ink-4)', padding: 0, maxWidth: 100 }}>
                        <option value="">—</option>
                        {TECHS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    )}
                    {showCol('status') && statusCell(r)}
                    {showCol('dropoff') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!r.is_dropoff} onChange={e => updateField(r.id, 'is_dropoff', e.target.checked)}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#6366f1' }} />
                    </td>
                    )}
                    {showCol('done') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <input type="checkbox" checked={!!r.is_urgent} onChange={e => toggleDone(r.id, e.target.checked)}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                        {timeStamp(r, 'done_at')}
                      </div>
                    </td>
                    )}
                    {showCol('shipped') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <input type="checkbox" checked={r.order_status === 'จัดส่งแล้ว'} onChange={e => toggleShipped(r.id, e.target.checked)}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                        {shippedStamp(r)}
                        {Array.isArray(r.shipments) && r.shipments.length > 0 && (
                          <button onClick={() => { setTrackModal(r.id); setTrackError('') }} title="ดูสถานะพัสดุ"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 6, padding: '1px 6px', fontSize: 10, cursor: 'pointer', color: 'var(--ink-2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📦 {thaiTrackStatus(r.shipments[0].status) || `${r.shipments.length} เลขพัสดุ`}
                          </button>
                        )}
                      </div>
                    </td>
                    )}
                    {showCol('rail') && (
                    <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {hasRail(r) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <input type="checkbox" checked={!!r.rail_packed} onChange={e => toggleRailPacked(r.id, e.target.checked)}
                            style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#22c55e' }} />
                          {r.rail_packed && r.rail_packed_at && (
                            <span style={{ color: '#22c55e', fontSize: 10, lineHeight: 1.3 }}>
                              {new Date(r.rail_packed_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                              {new Date(r.rail_packed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--ink-4)' }}>–</span>}
                    </td>
                    )}
                    {showCol('outsource') && (
                    <td style={{ padding: '8px 14px', maxWidth: 160 }}>
                      {editCell?.id === r.id && editCell.field === 'outsource' ? (
                        <input type="text" autoFocus value={editCell.val}
                          onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                          onBlur={() => saveOutsourceCell(r.id, editCell.val)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', outline: 'none', padding: '2px 0' }} />
                      ) : (
                        <div onClick={() => setEditCell({ id: r.id, field: 'outsource', val: r.outsource ?? '' })} style={{ cursor: 'text', minWidth: 60 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.outsource ? 'var(--ink)' : 'var(--ink-4)' }}>{r.outsource || '—'}</div>
                          {r.outsource && r.outsource_at && (
                            <div style={{ color: 'var(--ink-4)', fontSize: 10, lineHeight: 1.3 }}>
                              {new Date(r.outsource_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                              {new Date(r.outsource_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    )}
                    {showCol('ship_address') && (
                    <td style={{ padding: '8px 14px', maxWidth: 180 }}>
                      {editCell?.id === r.id && editCell.field === 'address' ? (
                        <input type="text" autoFocus value={editCell.val}
                          onChange={e => setEditCell(ec => ec ? { ...ec, val: e.target.value } : null)}
                          onBlur={() => saveTextCell(r.id, 'address', editCell.val)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 12, width: '100%', minWidth: 120, outline: 'none', padding: '2px 0' }} />
                      ) : (
                        <div onClick={() => setEditCell({ id: r.id, field: 'address', val: r.address ?? '' })} title={r.address || undefined}
                          style={{ cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.address ? 'var(--ink)' : 'var(--ink-4)', minWidth: 60, maxWidth: 180 }}>
                          {r.address || '—'}
                        </div>
                      )}
                    </td>
                    )}
                    {showCol('notes') && (
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
                    )}
                    {showCol('updated') && (
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                      {r.updated_at ? (
                        <div>
                          <div>{new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                          <div>{new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : '-'}
                    </td>
                    )}
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
            <button onClick={() => { setOpenAction(null); setActionRect(null); requestPrint(selectedIds.size > 1 ? rows.filter(x => selectedIds.has(x.id)) : [r]) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/></svg>
              ปริ้น
              {r.printed_at && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#eab308', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {new Date(r.printed_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                  {new Date(r.printed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </button>
            {hasRail(r) && (
              <button onClick={() => { setOpenAction(null); setActionRect(null); openRailCalc(r) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18M7 4v3m5-3v3m5-3v3"/></svg>
                ปริ้นอุปกรณ์ราง
              </button>
            )}
            <button onClick={() => {
              setOpenAction(null); setActionRect(null)
              const payload = { id: r.id, parcels: (r.shipments || []).map(s => ({ no: s.no, carrier: s.carrier, manual: true })).concat([{ no: '', carrier: '', manual: false }]) }
              // ยังไม่ติดตั้ง extension → ชวนติดตั้งก่อน (กดข้ามไปกรอกเลขได้ / กดไม่เตือนอีกได้)
              if (!extReady && localStorage.getItem('donna_track_ext_dismissed') !== '1') setExtPrompt(payload)
              else setShipModal(payload)
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
              จัดส่งแล้ว
            </button>
            {Array.isArray(r.shipments) && r.shipments.length > 0 && (
              <button onClick={() => { setOpenAction(null); setActionRect(null); setTrackModal(r.id); setTrackError('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                สถานะพัสดุ
              </button>
            )}
            <button onClick={() => { setOpenAction(null); setActionRect(null); setModal({ mode: 'edit', data: { ...r, items: null } }); void loadOrderPhotos(r); setModalItems(Array.isArray(r.items) ? [...(r.items as Item[])] : []); setItemsPasteText('') }}
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

      {/* Popup ชวนติดตั้ง extension "Donna Track" (เด้งตอนกดจัดส่งแล้ว ถ้ายังไม่ติดตั้ง) */}
      {extPrompt && (
        <div onClick={() => setExtPrompt(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 24, width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>🧩 ยังไม่ได้ติดตั้ง extension &quot;Donna Track&quot;</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14, lineHeight: 1.6 }}>
              บันทึกเลขพัสดุได้ตามปกติ แต่เครื่องนี้จะกด <b>เช็คสถานะ Flash อัตโนมัติ</b> ไม่ได้จนกว่าจะติดตั้ง (ทำครั้งเดียวต่อเครื่อง)
            </p>
            <ol style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.9, paddingLeft: 20, marginBottom: 6 }}>
              <li>เปิด Chrome ไปที่ <b style={{ fontFamily: 'monospace' }}>chrome://extensions</b></li>
              <li>เปิดสวิตช์ <b>Developer mode</b> (มุมขวาบน)</li>
              <li>กด <b>Load unpacked</b> → เลือกโฟลเดอร์ <b style={{ fontFamily: 'monospace' }}>donnaweb\extension</b>{' '}
                <button onClick={e => { navigator.clipboard.writeText('C:\\Users\\Com\\donnaweb\\extension'); (e.currentTarget as HTMLButtonElement).textContent = 'คัดลอกแล้ว ✓' }}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--ink-2)' }}>คัดลอก path</button>
              </li>
              <li>เสร็จแล้ว<b>รีเฟรชหน้าเว็บนี้</b> 1 ครั้ง</li>
            </ol>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setExtPrompt(null)}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>ปิด</button>
              <button onClick={() => { setShipModal(extPrompt); setExtPrompt(null) }}
                style={{ flex: 2, padding: '9px', borderRadius: 10, border: 'none', background: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>ข้ามไป — กรอกเลขพัสดุ</button>
            </div>
            <button onClick={() => { localStorage.setItem('donna_track_ext_dismissed', '1'); setShipModal(extPrompt); setExtPrompt(null) }}
              style={{ width: '100%', marginTop: 10, padding: '6px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)', textDecoration: 'underline' }}>
              ไม่ต้องเตือนเครื่องนี้อีก
            </button>
          </div>
        </div>
      )}

      {/* Popup จัดส่งแล้ว — กรอกเลขพัสดุ (เพิ่มได้หลายเลข) */}
      {shipModal && (
        <div onClick={() => setShipModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>จัดส่งแล้ว — กรอกเลขพัสดุ</h3>
              <button onClick={() => setShipModal(m => m ? { ...m, parcels: [...m.parcels, { no: '', carrier: '', manual: false }] } : m)} title="เพิ่มเลขพัสดุ"
                style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>ระบบเดาเจ้าขนส่งให้ — เดาผิดกดเปลี่ยนที่ dropdown ได้เลย, มีหลายกล่องกด + เพิ่มเลข</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {(() => {
                const ord = rows.find(row => row.id === shipModal.id)
                return shipModal.parcels.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input value={p.no} autoFocus={i === shipModal.parcels.length - 1}
                      placeholder="เช่น TH0118ABCDE1F"
                      onChange={e => setShipModal(m => m ? { ...m, parcels: m.parcels.map((x, j) => j === i ? { ...x, no: e.target.value, carrier: x.manual ? x.carrier : detectCarrier(e.target.value, ord?.courier) } : x) } : m)}
                      onKeyDown={e => { if (e.key === 'Enter') saveShipments() }}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--ink)', outline: 'none' }} />
                    <select value={p.carrier || ''}
                      onChange={e => setShipModal(m => m ? { ...m, parcels: m.parcels.map((x, j) => j === i ? { ...x, carrier: e.target.value, manual: true } : x) } : m)}
                      style={{ width: 110, padding: '7px 4px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, background: 'var(--bg)', color: p.carrier ? 'var(--ink)' : 'var(--ink-3)', outline: 'none', cursor: 'pointer' }}>
                      <option value="">เจ้าขนส่ง?</option>
                      {CARRIER_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {shipModal.parcels.length > 1 && (
                      <button onClick={() => setShipModal(m => m ? { ...m, parcels: m.parcels.filter((_, j) => j !== i) } : m)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                ))
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShipModal(null)}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>ยกเลิก</button>
              <button onClick={saveShipments} disabled={shipSaving}
                style={{ flex: 2, padding: '9px', borderRadius: 10, border: 'none', background: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', opacity: shipSaving ? 0.6 : 1 }}>
                {shipSaving ? 'กำลังบันทึก…' : 'ยืนยันจัดส่งแล้ว'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup สถานะพัสดุ — timeline ส่งถึงไหนแล้ว */}
      {trackModal && (() => {
        const r = rows.find(row => row.id === trackModal)
        if (!r) return null
        const shipments = Array.isArray(r.shipments) ? r.shipments : []
        const hasAuto = shipments.some(s => isAutoCarrier(s.carrier))
        const hasExtCarrier = shipments.some(s => EXT_CARRIERS.includes(s.carrier))
        return (
          <div onClick={() => setTrackModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 24, width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>📦 สถานะพัสดุ</h3>
                {hasAuto && (
                  <button onClick={() => checkTracking(r.id, Array.isArray(r.shipments) ? r.shipments : [])} disabled={trackChecking === r.id}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--blue)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff', opacity: trackChecking === r.id ? 0.6 : 1 }}>
                    {trackChecking === r.id ? 'กำลังเช็ค…' : 'เช็คสถานะ'}
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
                {r.customer_name || r.order_number || ''}
                {hasExtCarrier && !extReady && ' · เช็คอัตโนมัติต้องติดตั้ง extension "Donna Track" ใน Chrome'}
              </p>
              {trackChecking === r.id && shipments.some(s => s.carrier === 'J&T Express') && (
                <p style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 10 }}>J&T จะเปิดแท็บขึ้นมาให้เลื่อนแถบยืนยัน 1 ครั้ง — เลื่อนเสร็จแท็บจะปิดเองแล้วสถานะขึ้นที่นี่</p>
              )}
              {trackError && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{trackError}</p>}
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {shipments.map((s, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'monospace' }}>{s.no}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>{s.carrier}</span>
                      </div>
                      <a href={carrierTrackUrl(s)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--blue)' }}>เปิดเว็บขนส่ง ↗</a>
                    </div>
                    {s.status && (
                      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: /เซ็นรับ|สำเร็จ|ถึงมือ|delivered/i.test(s.status) ? 'var(--green)' : 'var(--ink)' }}>{thaiTrackStatus(s.status)}</div>
                    )}
                    {s.checked_at && (
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
                        เช็คล่าสุด {new Date(s.checked_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} {new Date(s.checked_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {Array.isArray(s.events) && s.events.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {s.events.map((ev, j) => (
                          <div key={j} style={{ display: 'flex', gap: 8, fontSize: 11, opacity: j === 0 ? 1 : 0.65 }}>
                            <span style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{ev.time}</span>
                            <span style={{ color: 'var(--ink)' }}>{ev.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!s.status && !s.events?.length && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>ยังไม่เคยเช็คสถานะ{isAutoCarrier(s.carrier) ? ' — กดปุ่ม "เช็คสถานะ" ด้านบน' : ' — เจ้านี้ยังเช็คอัตโนมัติไม่ได้ กดเปิดเว็บขนส่ง'}</div>
                    )}
                  </div>
                ))}
                {shipments.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>ยังไม่มีเลขพัสดุ — กดเมนู ··· → จัดส่งแล้ว เพื่อกรอก</p>}
              </div>
              <button onClick={() => setTrackModal(null)}
                style={{ width: '100%', marginTop: 14, padding: '9px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>ปิด</button>
            </div>
          </div>
        )
      })()}

      {/* ถามรูปแบบการปริ้น เมื่อเลือกหลายรายการ */}
      {printAsk && (
        <div onClick={() => setPrintAsk(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 24, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>ปริ้น {printAsk.length} รายการ</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>เลือกรูปแบบการปริ้น</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { const l = printAsk; setPrintAsk(null); openPrintWindow(l, printTitle(l), 'table') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}>
                📋 ปริ้นแบบตาราง<span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 12 }}>— สรุปรวมในหน้าเดียว</span>
              </button>
              <button onClick={() => { const l = printAsk; setPrintAsk(null); openPrintWindow(l, printTitle(l), 'form') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}>
                🧾 ปริ้นแบบออเดอร์<span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 12 }}>— ฟอร์มแยกใบ/แผ่น</span>
              </button>
            </div>
            <button onClick={() => setPrintAsk(null)}
              style={{ width: '100%', marginTop: 16, padding: '9px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Modal form */}
      {modal && (
        <div
          onMouseDown={e => { modalDownOnBackdrop.current = e.target === e.currentTarget }}
          onClick={e => { if (e.target === e.currentTarget && modalDownOnBackdrop.current) { setModal(null); ph.cancel() } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Tabs (add) / Title (edit) */}
            {modal.mode === 'edit' ? (
              <div style={{ padding: '24px 32px 0' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>แก้ไขออเดอร์</h2>
              </div>
            ) : (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {(['form', ...(addType === 'platform' ? ['paste', 'file'] : [])] as ('form'|'paste'|'file')[]).map(t => (
                  <button key={t} onClick={() => { setModalTab(t); setPasteRows([]); setIncomeRows([]); setFileParseError('') }}
                    style={{ flex: 1, padding: '16px 0', fontSize: 14, fontWeight: modalTab === t ? 600 : 400, border: 'none', borderBottom: modalTab === t ? '2px solid var(--blue)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', color: modalTab === t ? 'var(--blue)' : 'var(--ink-3)', transition: 'all 0.15s' }}>
                    {t === 'form' ? 'กรอกฟอร์ม' : t === 'paste' ? 'วาง Copy' : 'Drop ไฟล์'}
                  </button>
                ))}
              </div>
            )}

            <div style={{ padding: '24px 32px 32px' }}>

            {/* ---- File drop tab ---- */}
            {modal.mode === 'add' && modalTab === 'file' && incomeRows.length > 0 && (
              <div>
                {(() => {
                  const matchNew = incomeRows.filter(r => r.matchedId && !r.hasIncome).length
                  const matchOld = incomeRows.filter(r => r.matchedId && r.hasIncome).length
                  const noMatch = incomeRows.filter(r => !r.matchedId).length
                  return (
                    <p style={{ fontSize: 13, marginBottom: 10 }}>
                      <strong style={{ color: 'var(--blue)' }}>ตรวจพบไฟล์รายรับ (Income)</strong> — {incomeRows.length} ออเดอร์ · ลงยอดใหม่ <strong>{matchNew}</strong>{matchOld > 0 && <> · ทับยอดเดิม <strong style={{ color: '#f59e0b' }}>{matchOld}</strong></>}{noMatch > 0 && <> · ไม่พบในระบบ <strong style={{ color: 'var(--red)' }}>{noMatch}</strong></>}
                    </p>
                  )
                })()}
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        {['สถานะ', 'เลขออเดอร์', 'ยอดโอนจริง', 'วันที่โอน'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: h === 'ยอดโอนจริง' ? 'right' : 'left', fontWeight: 500, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {incomeRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: r.matchedId ? 1 : 0.55 }}>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                            {!r.matchedId ? (
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', background: '#fee2e2', borderRadius: 4, padding: '2px 6px' }}>ไม่พบในระบบ</span>
                            ) : r.hasIncome ? (
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: '#fef3c7', borderRadius: 4, padding: '2px 6px' }}>ทับยอดเดิม</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', background: '#dcfce7', borderRadius: 4, padding: '2px 6px' }}>ลงยอดใหม่</span>
                            )}
                          </td>
                          <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--blue)' }}>{r.orderNumber}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{r.amount.toLocaleString('th-TH')} ฿</td>
                          <td style={{ padding: '7px 10px' }}>{r.payoutDate || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setIncomeRows([])}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
                  <button onClick={saveIncomeRows} disabled={pasteSaving || incomeRows.every(r => !r.matchedId)}
                    style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: incomeRows.every(r => !r.matchedId) ? 0.5 : 1 }}>
                    {pasteSaving ? 'กำลังบันทึก…' : `บันทึกยอดโอนจริง ${incomeRows.filter(r => r.matchedId).length} ออเดอร์`}
                  </button>
                </div>
              </div>
            )}

            {modal.mode === 'add' && modalTab === 'file' && incomeRows.length === 0 && (
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
                  <strong>ลำดับคอลัมน์ที่รองรับ:</strong> เลขออเดอร์ · ชื่อลูกค้า · วันชำระ · บริษัทขนส่ง · วันต้องส่ง · ราคา · สถานะ · Drop-off<br />
                  <strong>ไฟล์รายรับ Shopee (Income):</strong> วางไฟล์เดียวกันได้เลย ระบบแยกอัตโนมัติ → ลงยอดโอนจริงให้ออเดอร์ที่มีอยู่
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
                    ['เวลาส่งสินค้า', pasteCol9, setPasteCol9],
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
                      const shippedCount = pasteRows.filter(r => r.isDuplicate && isDeliveredStatus(r.orderStatus) && rows.find(row => row.order_number === r.orderNumber)?.order_status !== 'จัดส่งแล้ว' && rows.some(row => row.order_number === r.orderNumber)).length
                      const cancelCount = pasteRows.filter(r => r.orderStatus.includes('ยกเลิก') && r.isDuplicate && (() => { const ex = rows.find(row => row.order_number === r.orderNumber); return ex && ex.order_status !== 'ยกเลิก' })()).length
                      const skipCount = pasteRows.length - saveCount - dropoffCount - shippedCount - cancelCount
                      return (
                        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                          พบ {pasteRows.length} ออเดอร์ — บันทึกใหม่ <strong style={{ color: 'var(--ink)' }}>{saveCount}</strong>{shippedCount > 0 && <> · จัดส่งแล้ว <strong style={{ color: '#22c55e' }}>{shippedCount}</strong></>}{cancelCount > 0 && <> · ย้ายไปหมวดยกเลิก <strong style={{ color: 'var(--red)' }}>{cancelCount}</strong></>}{dropoffCount > 0 && <> · อัพเดท Drop-off <strong style={{ color: '#6366f1' }}>{dropoffCount}</strong></>}{skipCount > 0 && <> · ข้าม <strong style={{ color: 'var(--red)' }}>{skipCount}</strong></>} รายการ
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
                            const existingRow = rows.find(row => row.order_number === r.orderNumber)
                            const isDropoffUpdate = r.isDuplicate && r.isDropoff && existingRow && !existingRow.is_dropoff
                            const isCancelDelete = isCancelled && r.isDuplicate && !!existingRow && existingRow.order_status !== 'ยกเลิก'
                            // ติ๊กจัดส่งไปแล้ว → ข้าม ไม่อัพเดทซ้ำ
                            const isShippedRow = isDeliveredStatus(r.orderStatus) && (!r.isDuplicate || (existingRow && existingRow.order_status !== 'จัดส่งแล้ว'))
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: (saveable || isDropoffUpdate || isShippedRow || isCancelDelete) ? 1 : 0.55 }}>
                                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                                  {isShippedRow ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', background: '#dcfce7', borderRadius: 4, padding: '2px 6px' }}>จัดส่งแล้ว{r.shippedDate ? ` · ${r.shippedDate}` : ''}</span>
                                  ) : isCancelDelete ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', background: '#fee2e2', borderRadius: 4, padding: '2px 6px' }}>ย้ายไปหมวดยกเลิก</span>
                                  ) : isDropoffUpdate ? (
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
                          const s = pasteRows.filter(r => r.isDuplicate && isDeliveredStatus(r.orderStatus) && rows.find(row => row.order_number === r.orderNumber)?.order_status !== 'จัดส่งแล้ว' && rows.some(row => row.order_number === r.orderNumber)).length
                          const c = pasteRows.filter(r => r.orderStatus.includes('ยกเลิก') && r.isDuplicate && (() => { const ex = rows.find(row => row.order_number === r.orderNumber); return ex && ex.order_status !== 'ยกเลิก' })()).length
                          const parts: string[] = []
                          if (n > 0) parts.push(`บันทึก ${n} ใหม่`)
                          if (s > 0) parts.push(`จัดส่งแล้ว ${s}`)
                          if (c > 0) parts.push(`ยกเลิก ${c}`)
                          if (d > 0) parts.push(`Drop-off ${d}`)
                          return parts.length ? parts.join(' · ') : 'บันทึก 0 รายการ'
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
            {modal.mode === 'add' && (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 6 }}>วางข้อความจากไลน์</label>
                <textarea value={orderPasteText} onChange={e => { setOrderPasteText(e.target.value); setOrderParseError('') }} rows={4}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <button type="button" onClick={parseOrderFromLine} disabled={orderParsing || !orderPasteText.trim()}
                    style={{ background: orderParsing || !orderPasteText.trim() ? 'var(--border)' : 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: orderParsing ? 'default' : 'pointer' }}>
                    {orderParsing ? 'กำลังแปลงข้อมูล…' : '✨ แปลงข้อมูล'}
                  </button>
                  {orderParseError && <span style={{ color: 'var(--red)', fontSize: 12 }}>{orderParseError}</span>}
                </div>
              </div>
            )}
            {(() => {
              const ft = modal.mode === 'add' ? addType
                : modal.data.is_installation ? 'install'
                : OUTSIDE_PLATFORMS.includes(modal.data.platform ?? '') ? 'outside' : 'platform'
              const isOutside = ft === 'outside' || ft === 'install' || ft === 'claim'
              const isInstall = ft === 'install'
              return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {inp('ชื่อลูกค้าซื้อ', 'customer_name')}
              {sel('จากแพลตฟอร์ม', 'platform', isOutside ? OUTSIDE_PLATFORMS : PLATFORMS)}
              {!isOutside && inp('เลขคำสั่งซื้อ', 'order_number')}
              {inp('วันที่สร้าง', 'entry_date', 'date')}
              {inp(isInstall ? 'กำหนดติดตั้ง' : 'กำหนดส่งงาน', 'deadline', 'date')}
              {isInstall && sel('เวลานัด', 'install_time', TIMES)}
              {isInstall && inp('จังหวัด', 'province')}
              {inp('เบอร์โทร', 'phone')}
              {isInstall && inp('ลิงก์โลเคชั่น', 'location_link')}
              {/* ที่อยู่ — เต็มบรรทัด (ยาวกว่าช่องอื่น) กรอกเองหรือให้ปุ่มแปลงข้อความเติมให้
                  ‼️ ชื่อช่องต้องตรงกับชื่อคอลัมน์ในตารางของแต่ละแท็บ (ดู COLUMN_DEFS):
                     งานติดตั้ง = ที่อยู่หน้างาน · งานนอก/เคลม = ที่อยู่ · งานแพลตฟอร์ม = ที่อยู่จัดส่งแยก */}
              <div style={{ gridColumn: '1 / -1' }}>
                {inp(isInstall ? 'ที่อยู่หน้างาน' : isOutside ? 'ที่อยู่' : 'ที่อยู่จัดส่งแยก', 'address')}
              </div>
              {!isInstall && !isOutside && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>วันและเวลาที่ต้องส่ง</label>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: 'var(--bg)', color: '#bf5af2', fontWeight: 600 }}>
                    {modal.data.shipping_datetime || calcShipping(modal.data.deadline ?? '', modal.data.courier ?? '') || '— เลือกกำหนดส่ง + บริษัท'}
                  </div>
                </div>
              )}
              {/* แอดมิน: เลือกเองได้ + ระบบทับให้เองเมื่อแอดมินหลักแก้เนื้อออเดอร์ */}
              {sel('แอดมิน', 'admin_name', ADMINS)}
              {sel('ช่างที่รับผิดชอบ', 'technician', TECHS)}
              {!isInstall && sel('บริษัทจัดส่ง', 'courier', COURIERS)}
              {inp('สั่งนอก', 'outsource')}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr 2fr 2fr 2fr 2fr 2fr', gap: '6px 8px', marginBottom: 6 }}>
                    {([['ประเภท', 'type', 'text'], ['สีตาไก่', 'eyelet_color', 'text'], ['ชั้น', 'floors', 'number'], ['หัวราง/จีบ', 'rail_head', 'text'], ['ตะขอ', 'hook_type', 'text'], ['ประเภทผ้า', 'fabric_type', 'text'], ['รหัสสี', 'color_code', 'text'], ['ลาย/สไตล์', 'color_name', 'text'], ['สีจริง', 'color_desc', 'text']] as [string, keyof Item, string][]).map(([lbl, key, type]) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, color: 'var(--ink-4)', display: 'block', marginBottom: 2 }}>{lbl}</label>
                        <input type={type} step={type === 'number' ? '1' : undefined}
                          value={item[key] == null ? '' : String(item[key])}
                          onChange={e => {
                            const val = key === 'floors' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value
                            setModalItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
                          }}
                          style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 2fr', gap: '6px 8px' }}>
                    {([['กว้าง (ม.)', 'width', 'text'], ['สูง (ม.)', 'height', 'text'], ['จำนวน', 'quantity', 'number'], ['หน่วย', 'unit', 'text'], ['กระดูม', 'hooks', 'text'], ['ขวางผ้า', 'orientation', 'text'], ['แบ่งผ้า', 'fabric_split', 'text'], ['เคมี', 'chemical', 'text'], ['โซ่ถ่วง', 'weight_chain', 'text'], ['ฝั่งดึง', 'pull_side', 'text'], ['สั่งนอก', 'outsource', 'text'], ['หมายเหตุ', 'note', 'text']] as [string, keyof Item, string][]).map(([lbl, key, type]) => (
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
              const isOutside = ft === 'outside' || ft === 'install' || ft === 'claim'
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
                      <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>ชำระแล้ว (บาท)</label>
                      <input type="number" step="0.01"
                        value={modal.data.paid_amount ?? (modal.data.payment_status === 'มัดจำ50%' && modal.data.price ? Number(modal.data.price) / 2 : '')}
                        onChange={e => set('paid_amount', e.target.value)}
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  )}
                  {(modal.data.payment_status === 'มัดจำ' || modal.data.payment_status === 'มัดจำ50%') && (() => {
                    // กรอก "ชำระแล้ว" ไว้ → ช่องนี้คิดให้เอง (ยอดทั้งหมด − ชำระแล้ว) แก้เองไม่ได้
                    const paid = modal.data.paid_amount ?? (modal.data.payment_status === 'มัดจำ50%' && modal.data.price ? Number(modal.data.price) / 2 : null)
                    const autoRemain = paid !== null && paid !== undefined && String(paid) !== '' && modal.data.price
                      ? Math.max(0, Number(modal.data.price) - Number(paid)) : null
                    return (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }}>ยอดชำระก่อนจัดส่ง (บาท)</label>
                      <input type="number" step="0.01" readOnly={autoRemain != null}
                        value={autoRemain ?? modal.data.deposit ?? (modal.data.payment_status === 'มัดจำ50%' && modal.data.price ? Number(modal.data.price) / 2 : '')}
                        onChange={e => set('deposit', e.target.value)}
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: autoRemain != null ? 'var(--bg)' : undefined, color: autoRemain != null ? 'var(--ink-3)' : undefined }} />
                    </div>
                    )
                  })()}
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

            {/* รูปหน้างาน — เฉพาะงานติดตั้ง (เก็บที่แถวปฏิทินติดตั้งของออเดอร์นี้) วางไว้บรรทัดล่างสุดก่อนปุ่มบันทึก */}
            {(modal.mode === 'add' ? addType === 'install' : !!modal.data.is_installation) && ph.trigger()}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setModal(null); setAddType(null); ph.cancel() }}
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
          {ph.open && ph.panel()}
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
              ] as [string, string, string, 'platform'|'outside'|'install'|'claim', object][]).map(([label, icon, desc, type, extra]) => (
                <button key={label} onClick={() => {
                  setAddTypeModal(false)
                  setAddType(type)
                  setModalTab('form')
                  setModal({ mode: 'add', data: { ...emptyForm(), shipping_datetime: '', ...extra } })
                  ph.begin([], null)
                  setModalItems([])
                  setItemsPasteText('')
                  setOrderPasteText('')
                  setOrderParseError('')
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
                return <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 12 }}>พบ <strong style={{ color: 'var(--ink)' }}>{count}</strong> รายการ จากออเดอร์ทั้งหมด {scopedRows.length} รายการ</p>
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
        <div onClick={closeItemsModal} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 1000, padding: 24 }}>
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
                      ] as [keyof Item, string, number][]).map(([key, type, w]) => (
                        <td key={key} style={{ padding: '4px 6px' }}>
                          <input
                            type={type}
                            step={type === 'number' ? '0.01' : undefined}
                            value={item[key] == null ? '' : String(item[key])}
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
                      <td colSpan={19} style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
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

            {itemsModal.instId && ph.trigger()}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeItemsModal}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>
                ยกเลิก
              </button>
              <button onClick={async () => {
                const newItems = itemsModal.items.length > 0 ? itemsModal.items : null
                const now = new Date().toISOString()
                // สั่งนอกในรายการ → ลงคอลัมน์สั่งนอกของออเดอร์ + ประทับเวลาเมื่อข้อความเปลี่ยน
                const itemsOut = itemsOutsourceText(itemsModal.items)
                const prevOut = rows.find(r => r.id === itemsModal.id)?.outsource ?? ''
                const updates = {
                  items: newItems,
                  updated_at: now,
                  ...(itemsOut && itemsOut !== prevOut ? { outsource: itemsOut, outsource_at: now } : {}),
                }
                const { error: err } = await oeUpdate(updates).eq('id', itemsModal.id)
                if (!err) {
                  // สั่งนอกเปลี่ยน → sync ไปหมวดสั่งซื้อด้วย
                  if (itemsOut && itemsOut !== prevOut) {
                    const row = rows.find(r => r.id === itemsModal.id)
                    await syncOutsourcePO(itemsModal.id, row?.customer_name, row?.order_number, itemsOut, itemsModal.items)
                  }
                  // รูปหน้างานเก็บที่แถวงานติดตั้ง (installations.photos) ไม่ใช่ที่ออเดอร์
                  if (itemsModal.instId) {
                    const { error: pErr } = await instUpdate({ photos: ph.photos, updated_at: now }).eq('id', itemsModal.instId)
                    if (pErr) { setItemsModalError(photoSaveError(pErr.message)); return }
                  }
                  ph.commit()
                  setRows(prev => prev.map(r => r.id === itemsModal.id ? { ...r, ...updates } as Entry : r))
                  setItemsModal(null)
                  setItemsModalError('')
                }
              }}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                บันทึก
              </button>
            </div>
          </div>
          {ph.open && ph.panel()}
        </div>
      )}
    </div>
  )
}
