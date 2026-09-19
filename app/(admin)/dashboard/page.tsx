'use client'

import { useState, useEffect, useRef } from 'react'
// สีวันผลิตที่เหลือชุดเดียวกับหมวดออเดอร์: เกิน/วันนี้ = แดงอิฐ · 1-10 วัน = เหลือง · เกิน 10 วัน = เขียว
import { daysColor } from '@/lib/orderTabs'
import { createPortal } from 'react-dom'
import { matchSerial } from '@/lib/serialNo'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { syncRows, byCreatedAsc } from '@/lib/rowCache'
import { getPageCache, setPageCache } from '@/lib/pageCache'
import { effShipping } from '@/lib/shipping'
import { syncWorkStatus } from '@/lib/workStatusSync'
import { useStableView } from '@/lib/useStableView'
import { oeUpdate } from '@/lib/adminActor'
import { todayYmd } from '@/lib/thaiDate'
import { PlatformIcon, CourierIcon } from '@/components/BrandMark'
import NotifyBell from '@/components/NotifyBell'
import OrderDetailModal from '@/components/OrderDetailModal'
import ScanToast from '@/components/ScanToast'
import BoardAnnouncements from '@/components/BoardAnnouncements'


type Order = {
  id: string
  serial_no?: string | null   // เลขที่ใบงานนอก DR0001 — ไว้ค้นหา
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
  'Lineส่วนตัวยุน','Lineส่วนตัวเฟิร์น','Lineส่วนตัวสู้','Lineส่วนตัวน็อต',
  'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:LineOA','เคลม:หน้าร้าน',
  'เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวเฟิร์น','เคลม:Lineส่วนตัวสู้','เคลม:Lineส่วนตัวน็อต',
]

// พื้นป้ายสถานะ — พาสเทลนุ่มแยกสีชัดรายขั้น (ตัวหนังสือน้ำตาลเข้มอ่านได้ทุกใบ)
// รอดำเนินการ #F9E0C3 · รอจัดส่ง #DBBEA7 · รอติดตั้ง #F0C0B7 = สีที่ดูดจากภาพต้นแบบ
const PILL_BG: Record<string, string> = {
  'รอดำเนินการ': '#F9E0C3',   // ครีมส้ม
  'กำลังตัด':    '#CFE0EA',   // ฟ้า
  'ตัดผ้าแล้ว':  '#CFE0EA',
  'กำลังเย็บ':   '#E2D5EC',   // ม่วงอ่อน
  'เย็บแล้ว':    '#E2D5EC',
  'ตรวจสอบแล้ว': '#D6DAF0',   // คราม
  'กำลังรีด':    '#F6D5DE',   // ชมพู
  'รีดแล้ว':     '#F6D5DE',
  'กำลังแพ็ค':   '#CFE6DE',   // เขียวอมฟ้า
  'แพ็คแล้ว':    '#CFE6DE',
  'รอจัดส่ง':    '#DBBEA7',   // น้ำตาลอ่อน
  'งานเสร็จ':    '#E3F3E0',   // เขียวชุดเดียวกับ 'จัดส่งแล้ว'
  'จัดส่งแล้ว':  '#E3F3E0',
  'รอติดตั้ง':   '#F0C0B7',   // ส้มอิฐอ่อน
  'ยกเลิก':      '#E6D9D5',   // เทาอมชมพู
}
const pillBg = (st: string) => PILL_BG[st] ?? '#EFE3D4'

// ‼️ ใช้ตัวเดียวกับ lib/orderTabs — deadline เป็น YYYY-MM-DD ถ้าส่งเข้า new Date() ตรงๆ
//    JS อ่านเป็น UTC เที่ยงคืน (= 07:00 ไทย) แล้ว Math.ceil ปัดขึ้นอีก 1 วัน
//    งานติดตั้งที่ต้องติดตั้งวันนี้เลยขึ้นว่า "1 วัน" แทน "ต้องจัดส่งวันนี้"
function daysRemaining(dateStr: string): number | null {
  if (!dateStr) return null
  let target: Date
  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dmy) {
    target = new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]))
  } else if (ymd) {
    target = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]))
  } else {
    target = new Date(dateStr)
  }
  const diff = target.getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

// สีแยกตามขั้นผลิต — ให้ตรงกับหน้าออเดอร์ (PROD_STATUS_COLOR ใน OrderWorkspace)
const STATUS_COLOR: Record<string, string> = {
  'รอดำเนินการ': '#C79A4B',
  'ตัดผ้าแล้ว': '#6E8CA0',
  'เย็บแล้ว': '#9A7BA0',
  'ตรวจสอบแล้ว': '#7B7FA3',
  'รีดแล้ว': '#C2848E',
  'แพ็คแล้ว': '#6E9A92',
  'กำลังตัด': '#6E8CA0',
  'กำลังเย็บ': '#9A7BA0',
  'กำลังรีด': '#C2848E',
  'กำลังแพ็ค': '#6E9A92',
  'งานเสร็จ': '#6F8F6A',
  'รอจัดส่ง': '#7B7FA3',
  'จัดส่งแล้ว': '#6F8F6A',
  'รอติดตั้ง': '#B5715A',
}

// ลายนาฬิกาพื้นหลังการ์ดเกินกำหนดส่ง — เข็มชั่วโมง/นาทีชี้ตามเวลาจริง (ขยับทีละนาที ไม่มีเข็มวินาที)
// ก่อน mount ยังไม่มีเวลา → ชี้ 12:00 ไว้ก่อน กัน hydration mismatch
function ClockArt({ time }: { time: Date | null }) {
  const h = time ? time.getHours() % 12 : 0
  const m = time ? time.getMinutes() : 0
  const minDeg = m * 6
  const hourDeg = h * 30 + m * 0.5
  return (
    <svg width="118" height="112" viewBox="0 0 59 56" fill="none" stroke="currentColor" strokeWidth="1.2"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="29.5" cy="29" r="21" />
      <circle cx="29.5" cy="29" r="17" />
      {/* ขีดหลัก 12/3/6/9 */}
      <path d="M29.5 9v3M29.5 46v3M50.5 29h-3M11.5 29h-3" />
      {/* ขีดย่อยแนวเฉียง */}
      <path d="M39.9 12.8l-1 1.7M19.1 45.2l1-1.7M45.7 39.4l-1.7-1M13.3 18.6l1.7 1M45.7 18.6l-1.7 1M13.3 39.4l1.7-1M39.9 45.2l-1-1.7M19.1 12.8l1 1.7"
            strokeWidth="0.8" />
      {/* เข็มนาที (ยาว) + เข็มชั่วโมง (สั้น) */}
      <path d="M29.5 29V17" transform={`rotate(${minDeg} 29.5 29)`} />
      <path d="M29.5 29v-9" transform={`rotate(${hourDeg} 29.5 29)`} />
      <circle cx="29.5" cy="29" r="1.4" strokeWidth="0.9" />
      {/* ห่วงแขวนด้านบน */}
      <path d="M27.7 6.6a2.4 2.4 0 013.6 0" strokeWidth="0.9" />
    </svg>
  )
}

// การ์ดหลัก 3 ใบ: ที่ต้องส่งวันนี้ / รอจัดส่ง / เกินกำหนดส่ง
const STATS_META = [
  {
    key: 'today',
    // ภาพพื้นหลัง: กล่องพัสดุ
    art: (
      <svg width="132" height="112" viewBox="0 0 66 56" fill="none" stroke="currentColor" strokeWidth="1.2"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M33 6 58 17 33 28 8 17z" />
        <path d="M8 17v22l25 11V28" />
        <path d="M58 17v22L33 50" />
        <path d="M33 28v22" />
        {/* เทปพันฝากล่อง + พาดลงหน้ากล่อง */}
        <path d="M20.5 11.5 45.5 22.5" />
        <path d="M20.5 22.5v22" strokeWidth="1" />
        {/* ป้ายที่อยู่บนหน้ากล่อง */}
        <path d="M24 33.5 30.5 36.4v7.4L24 40.9z" strokeWidth="1" />
        <path d="M25.6 36.4l3.3 1.5M25.6 39l3.3 1.5" strokeWidth="0.8" />
        {/* ฝากล่องที่เผยอขึ้นด้านขวา */}
        <path d="M45.5 22.5v8l6-2.6v-8z" />
        {/* รอยพับสันกล่อง */}
        <path d="M58 17 45.5 22.5" strokeWidth="0.8" />
      </svg>
    ),
    label: 'ที่ต้องส่งวันนี้',
    color: '#A87452',
    gradLight: 'linear-gradient(120deg, #F6E6D3 0%, #EFD3B7 100%)',
    gradDark: 'linear-gradient(120deg, #2C2016 0%, #3D2B1C 100%)',
    ink: '#8A6142', numInk: '#8A6142', onDark: false,
    icon: (
      <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"/>
      </svg>
    ),
  },
  {
    key: 'toship',
    // ภาพพื้นหลัง: รถส่งของ
    art: (
      <svg width="146" height="104" viewBox="0 0 73 52" fill="none" stroke="currentColor" strokeWidth="1.2"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h36v24H4z" />
        <path d="M40 20h11l7 8v8H40z" />
        <path d="M44 22h6l4 5h-10z" />
        <path d="M4 36h9M22 36h13M50 36h8" />
        {/* แถบคาดข้างตัวถัง + บานประตูท้าย */}
        <path d="M4 21h36" strokeWidth="0.9" />
        <path d="M28 12v24" strokeWidth="0.9" />
        <path d="M25 25.5h2" strokeWidth="0.9" />
        {/* ดุมล้อ */}
        <circle cx="17.5" cy="38.5" r="4.5" />
        <circle cx="46.5" cy="38.5" r="4.5" />
        <circle cx="17.5" cy="38.5" r="1.6" strokeWidth="0.9" />
        <circle cx="46.5" cy="38.5" r="1.6" strokeWidth="0.9" />
        {/* ไฟหน้า + กันชน */}
        <path d="M56.5 31.5h1.5v2.5h-1.5z" strokeWidth="0.9" />
        <path d="M53 36h5" strokeWidth="0.9" />
        {/* เส้นลมด้านหลัง */}
        <path d="M60 18h9M63 24h6M57 12h12" />
      </svg>
    ),
    label: 'รอจัดส่ง',
    color: '#8A6142',
    gradLight: 'linear-gradient(120deg, #BA8764 0%, #9E6A49 100%)',
    gradDark: 'linear-gradient(120deg, #7A5238 0%, #5E3E29 100%)',
    ink: '#FFF6EC', numInk: '#FFFFFF', onDark: true,
    icon: (
      <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>
      </svg>
    ),
  },
  {
    key: 'overdue',
    // ภาพพื้นหลัง: นาฬิกา — เข็มเดินตามเวลาจริง วาดใน <ClockArt> ตอนเรนเดอร์
    art: null,
    label: 'เกินกำหนดส่ง',
    color: '#B5715A',
    gradLight: 'linear-gradient(120deg, #F4DDD0 0%, #EAC6B2 100%)',
    gradDark: 'linear-gradient(120deg, #35211A 0%, #452A20 100%)',
    ink: '#6B4234', numInk: '#6B4234', onDark: false,
    icon: (
      <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
      </svg>
    ),
  },
]

// ลำดับขั้นสายการผลิต — ใช้กับแถบสายการผลิตในโหมดจอติดผนัง
// (ชื่อสั้นเพราะต้องอ่านจากระยะ 2-3 เมตร)
const FLOW: { short: string; status: string }[] = [
  { short: 'รอเริ่ม',  status: 'รอดำเนินการ' },
  { short: 'ตัด',      status: 'ตัดผ้าแล้ว' },
  { short: 'เย็บ',     status: 'เย็บแล้ว' },
  { short: 'ตรวจ',     status: 'ตรวจสอบแล้ว' },
  { short: 'รีด',      status: 'รีดแล้ว' },
  { short: 'แพ็ค',     status: 'แพ็คแล้ว' },
  { short: 'รอส่ง',    status: 'รอจัดส่ง' },
]

const DEPTS = [
  { label: 'แผนกตัดผ้า', status: 'ตัดผ้าแล้ว', color: '#8A8B5F', bg: 'rgba(138,139,95,0.08)', border: 'rgba(138,139,95,0.20)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path strokeLinecap="round" d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg> },
  { label: 'แผนกเย็บผ้า', status: 'เย็บแล้ว', color: '#A87452', bg: 'rgba(168,116,82,0.08)', border: 'rgba(168,116,82,0.20)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></svg> },
  { label: 'ผู้ช่วยช่าง', status: 'ตรวจสอบแล้ว', color: '#B5715A', bg: 'rgba(181,113,90,0.08)', border: 'rgba(181,113,90,0.20)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
  { label: 'แผนกรีดผ้า', status: 'รีดแล้ว', color: '#C2907F', bg: 'rgba(194,144,127,0.10)', border: 'rgba(194,144,127,0.22)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg> },
  { label: 'แผนกแพ็คสินค้า', status: 'แพ็คแล้ว', color: '#9A8570', bg: 'rgba(154,133,112,0.10)', border: 'rgba(154,133,112,0.22)',
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg> },
]

type ModalData = { title: string; orders: Order[]; showPrint?: boolean; showShipToggle?: boolean } | null

function OrderTable({ orders, today, onShip, onOpen }: { orders: Order[]; today: string; onShip?: (id: string) => void; onOpen: (id: string) => void }) {
  if (orders.length === 0) return (
    <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>ไม่มีข้อมูล</p>
  )
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
          {['เลขที่', 'ลูกค้า', 'สถานะ', 'กำหนดส่ง', 'วันที่สั่ง', ...(onShip ? ['จัดส่งแล้ว'] : [])].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--ink-3)', fontWeight: 500, fontSize: 12 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => {
          const dl = o.deadline?.split('T')[0] ?? ''
          const over = dl && dl < today && !['งานเสร็จ', 'จัดส่งแล้ว'].includes(o.order_status)
          return (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
              <td style={{ padding: '10px 14px', color: 'var(--blue)', fontWeight: 500 }}>{o.order_number}</td>
              <td style={{ padding: '10px 14px' }}>
                {o.customer_name
                  ? <span title="กดเพื่อดูรายการเต็ม" onClick={() => onOpen(o.id)} style={{ color: 'var(--blue)', fontWeight: 500, cursor: 'pointer' }}>{o.customer_name}</span>
                  : '-'}
              </td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{ background: (STATUS_COLOR[o.order_status] ?? '#8E8E93') + '18', color: STATUS_COLOR[o.order_status] ?? '#8E8E93', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500 }}>
                  {o.order_status}
                </span>
              </td>
              <td style={{ padding: '10px 14px', color: over ? 'var(--red)' : 'var(--ink)', fontWeight: over ? 600 : 400 }}>
                {dl ? new Date(o.deadline!).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{new Date(o.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
              {onShip && (
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <input type="checkbox" checked={o.order_status === 'จัดส่งแล้ว'} onChange={e => { if (e.target.checked) onShip(o.id) }}
                    style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#6F8F6A' }} />
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function DashboardPage() {
  // เปิดหน้าซ้ำ → โชว์ข้อมูลรอบก่อนทันที แล้วดึงของใหม่เบื้องหลัง (stale-while-revalidate)
  const cached = getPageCache<Order[]>('dashboard:order_entries')
  const [all, setAll] = useState<Order[]>(cached ?? [])
  // แถวไม่เด้งหนีตอนติ๊กจัดส่ง — กรอง/เรียงด้วย stable() แสดงผลด้วย live() (ดู lib/useStableView.ts)
  const { snapshot, stable, live } = useStableView<Order>(all)
  const [modal, setModal] = useState<ModalData>(null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)   // ออเดอร์ที่กดดูรายการเต็ม

  // เปิดรายการเต็มจากลิงก์ได้เลย: /dashboard?order=<id> (ส่งลิงก์ให้กันดูใบเดียว)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order')
    if (id) setDetailId(id)
  }, [])
  const [daysSort, setDaysSort] = useState<'asc'|'desc'|null>('asc')
  const [deadlineFrom, setDeadlineFrom] = useState('')
  const [deadlineTo, setDeadlineTo] = useState('')
  const [platformFilters, setPlatformFilters] = useState<string[]>([])
  const [courierFilters, setCourierFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [openColFilter, setOpenColFilter] = useState<string|null>(null)

  const today = todayYmd()

  // นาฬิกาใหญ่มุมขวาบน — เริ่มหลัง mount (กัน hydration mismatch) เดินทุกวินาที
  const [clock, setClock] = useState<Date | null>(null)
  useEffect(() => {
    setClock(new Date())
    const iv = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  // โหมดเต็มจอ — fullscreen ตัวหน้า dashboard (ไม่เอา sidebar)
  const pageRef = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)
  useEffect(() => {
    // เปิดด้วย ?fs=1 = เข้าโหมดจอติดผนังได้เลย (เครื่องที่เปิดค้างไว้กดปุ่มเองไม่ได้)
    if (new URLSearchParams(window.location.search).has('fs')) setIsFs(true)
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else pageRef.current?.requestFullscreen().catch(() => {})
  }

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const load = async () => {
    setError('')
    // จำไว้ในเครื่อง ขอเฉพาะใบที่เปลี่ยน (lib/rowCache.ts)
    const cols = 'id,serial_no,order_number,customer_name,order_status,deadline,created_at,platform,courier,is_installation,is_urgent,is_dropoff,shipping_datetime,notes,updated_at'
    const { data: rows, error: err } = await syncRows<Order>({
      key: 'dashboard', table: 'order_entries', select: cols, sort: byCreatedAsc,
      full: () => supabase.from('order_entries').select(cols).order('created_at', { ascending: true }).order('id', { ascending: true }),
    })
    if (err) { setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'); setLoading(false); return }
    setPageCache('dashboard:order_entries', rows)
    setAll(rows)
    snapshot(rows)   // ตั้งจุดอ้างอิงใหม่ → แถวที่ติ๊กจัดส่งค้างไว้ หายออกจากรายการตอนนี้
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── อัปเดตสด: เกาะฟังความเปลี่ยนแปลงของ order_entries ──
  // ‼️ เดิมหน้านี้ load() ครั้งเดียวตอนเปิด เปิดค้างไว้บนจอติดผนังตัวเลขจะค้างทั้งวัน
  //    ทำแบบเดียวกับหน้าปฏิทินงานติดตั้ง: merge แถวที่เปลี่ยนเข้า state ไม่ยิงโหลดใหม่ทั้งก้อน
  const allRef = useRef<Order[]>(all)
  allRef.current = all
  useEffect(() => {
    const ch = supabase
      .channel('dashboard_orders_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_entries' }, payload => {
        if (payload.eventType === 'DELETE') {
          const gone = (payload.old as { id?: string }).id
          if (!gone) return
          setAll(prev => {
            const next = prev.filter(o => o.id !== gone)
            setPageCache('dashboard:order_entries', next)
            return next
          })
          return
        }
        const row = payload.new as Order
        const before = allRef.current.find(o => o.id === row.id)
        // สถานะเปลี่ยน = มีคนสแกนงาน -> เด้งข้อความบอกบนหัวจอ
        if (before && before.order_status !== row.order_status) {
          window.dispatchEvent(new CustomEvent('scan-toast', {
            detail: {
              dept: '', status: row.order_status,
              orderNumber: row.order_number ?? '', customer: row.customer_name ?? '',
            },
          }))
        }
        setAll(prev => {
          const next = prev.some(o => o.id === row.id)
            ? prev.map(o => o.id === row.id ? { ...o, ...row } : o)
            : [...prev, row]
          setPageCache('dashboard:order_entries', next)
          return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])


  const DONE_STATUSES = ['งานเสร็จ', 'จัดส่งแล้ว']
  // ออเดอร์ที่ลงเดือนนี้ (ตาม created_at)
  const monthKey = today.slice(0, 7)
  const monthOrders = all.filter(o => o.created_at.startsWith(monthKey))

  function effectiveISODate(o: Order): string | null {
    const isOut = OUTSIDE_PLATFORMS.includes(o.platform ?? '') || o.is_installation
    if (isOut) return o.deadline ? o.deadline.split('T')[0] : null
    const sd = effShipping(o)
    if (!sd) return null
    const m = sd.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (!m) return null
    return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  }

  // เลข "วันผลิตที่เหลือ" ที่โชว์ในแถว — ใช้ทั้งตอนเรียงและตอนวาด จะได้ตรงกันเสมอ
  function rowDays(o: Order): number | null {
    const isOutside = OUTSIDE_PLATFORMS.includes(o.platform ?? '') || o.is_installation
    const effective = isOutside ? o.deadline : effShipping(o)
    return effective ? daysRemaining(effective) : null
  }

  // ข้อความในช่อง "วันผลิตที่เหลือ" — งานติดตั้งถึงวันนัดใช้คำว่า "ต้องติดตั้งวันนี้" เหมือนหมวดออเดอร์
  function daysLabel(days: number | null, o: Order): string {
    if (days === null) return 'รอกำหนด'
    if (days < 0) return `เกิน ${Math.abs(days)} วัน`
    if (days === 0) return o.is_installation ? 'ต้องติดตั้งวันนี้' : 'ต้องจัดส่งวันนี้'
    return `${days} วัน`
  }

  const PLATFORMS = ['Tiktok','Tiktok-Chat','Shopee','Shopee-Chat','Lazada','Facebook','LineOA',
    'Lineส่วนตัวยุน','Lineส่วนตัวสู้','Lineส่วนตัวเฟิร์น','Lineส่วนตัวน็อต','หน้าร้าน',
    'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:หน้าร้าน',
    'เคลม:LineOA','เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวเฟิร์น','เคลม:Lineส่วนตัวสู้','เคลม:Lineส่วนตัวน็อต']
  const platformOptions = PLATFORMS.concat(OUTSIDE_PLATFORMS.filter(p => !PLATFORMS.includes(p)))
  const courierOptions = ['งานติดตั้ง', ...new Set(all.map(r => r.courier).filter(Boolean))] as string[]

  // รายการออเดอร์ใน dashboard = งานที่ยังไม่จบ (จัดส่งแล้ว/ยกเลิก ไปดูที่หน้าออเดอร์แทน)
  // กรอง/เรียงบนค่า "ตอนโหลดหน้า" (stable) แล้วค่อยคืนค่าสด (live) ก่อนวาด — แถวจึงไม่หายทันทีที่ติ๊ก
  const stableAll = all.map(stable)
  const ordersListBase = [...stableAll].reverse().filter(o => o.order_status !== 'จัดส่งแล้ว' && o.order_status !== 'ยกเลิก')
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
    ordersList = ordersList.filter(o => o.order_number?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q) || matchSerial(o.serial_no, q))
  }
  if (daysSort) {
    // ‼️ ต้องคิดเลข "วันผลิตที่เหลือ" ด้วยสูตรเดียวกับที่วาดในแถว (rowDays) ไม่งั้นลำดับกับเลขที่เห็นไม่ตรงกัน
    //    (เดิมตอนเรียงใช้ effectiveISODate ซึ่งตัดเวลาทิ้ง เลยได้คนละค่ากับที่โชว์)
    ordersList = [...ordersList].sort((a, b) => {
      // งานเสร็จ (is_urgent) ลงไปอยู่ล่างสุดเสมอ
      const doneA = a.is_urgent ? 1 : 0, doneB = b.is_urgent ? 1 : 0
      if (doneA !== doneB) return doneA - doneB
      // ใบที่ยังไม่มีวัน (รอกำหนด) ไปอยู่ท้ายสุดเสมอ ไม่ว่าจะเรียงน้อย→มาก หรือมาก→น้อย
      const da = rowDays(a), db = rowDays(b)
      if (da === null || db === null) return (da === null ? 1 : 0) - (db === null ? 1 : 0)
      return daysSort === 'asc' ? da - db : db - da
    })
  }
  ordersList = ordersList.map(live)
  // ‼️ ใบที่ยกเลิกแล้วไม่ใช่งานค้าง — ไม่ต้องขึ้นในการ์ดทั้ง 3 ใบ (รายการออเดอร์ด้านล่างกรองออกอยู่แล้ว)
  const notCancelled = (o: Order) => o.order_status !== 'ยกเลิก'
  const todayDue = stableAll.filter(o => notCancelled(o) && !DONE_STATUSES.includes(o.order_status) && effectiveISODate(o) === today).map(live)
  const overdue = stableAll.filter(o => { const iso = effectiveISODate(o); return notCancelled(o) && iso && iso < today && !DONE_STATUSES.includes(o.order_status) }).map(live)
  // งานเสร็จ (is_urgent) ที่ยังไม่ได้จัดส่ง → รอติ๊กจัดส่งใน popup
  const toShip = stableAll.filter(o => notCancelled(o) && o.is_urgent && o.order_status !== 'จัดส่งแล้ว').map(live)

  // ติ๊กจัดส่งจาก popup: อัปเดตเหมือนหน้าออเดอร์ (สถานะ+shipped_at+sync work_status+ประวัติ)
  const markShipped = async (id: string) => {
    const row = all.find(o => o.id === id)
    const now = new Date().toISOString()
    const updates = { is_urgent: true, order_status: 'จัดส่งแล้ว', shipped_at: now, updated_at: now }
    const { error } = await oeUpdate(updates).eq('id', id)
    if (error) return
    try {
      await syncWorkStatus(row?.order_number, row?.customer_name, 'จัดส่งแล้ว', now)
      const { data: r2 } = await supabase.from('order_entries').select('status_history').eq('id', id).single()
      const prev = Array.isArray(r2?.status_history) ? r2.status_history : []
      if (!prev.length || prev[prev.length - 1]?.status !== 'จัดส่งแล้ว') {
        await oeUpdate({ status_history: [...prev, { status: 'จัดส่งแล้ว', at: now, by: null }] }).eq('id', id)
      }
    } catch {}
    setAll(prev => {
      const next = prev.map(o => o.id === id ? { ...o, order_status: 'จัดส่งแล้ว', updated_at: now } : o)
      setPageCache('dashboard:order_entries', next)
      return next
    })
    // ‼️ ไม่ตัดแถวออกจาก popup ทันที — ให้ค้างไว้ตรวจทานได้ แถวจะหายตอนปิด popup แล้วเปิดใหม่/รีเฟรช
  }

  // ── แบ่งหน้าตาราง ──
  const PER_PAGE = isFs ? 7 : 12   // จอติดผนังโชว์น้อยแถว แลกกับตัวหนังสือใหญ่
  const totalPages = Math.max(1, Math.ceil(ordersList.length / PER_PAGE))
  const curPage = Math.min(page, totalPages)
  const pageStart = (curPage - 1) * PER_PAGE
  const pageRows = ordersList.slice(pageStart, pageStart + PER_PAGE)
  // เลขหน้าที่โชว์: 1 … n-1 n n+1 … สุดท้าย (0 = จุดไข่ปลา)
  const pageNumbers: number[] = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const out = [1]
    if (curPage > 3) out.push(0)
    for (let n = Math.max(2, curPage - 1); n <= Math.min(totalPages - 1, curPage + 1); n++) out.push(n)
    if (curPage < totalPages - 2) out.push(0)
    out.push(totalPages)
    return out
  })()

  // ปริ้นตารางรายการทั้งหมดที่กรองอยู่ (ทุกหน้า ไม่ใช่แค่ 12 แถวที่เปิดค้างไว้)
  // เนื้อหาที่ปริ้นอยู่ในบล็อก .print-area ท้ายไฟล์ — ซ่อนบนหน้าจอ โผล่เฉพาะตอนสั่งปริ้น
  const printReport = () => window.print()

  // คำทักทายคิดจากนาฬิกาฝั่งไคลเอนต์ (clock ตั้งใน effect) กัน hydration mismatch
  const hr = clock?.getHours() ?? 9
  const greet = hr < 12 ? { text: 'สวัสดีตอนเช้า', emoji: '☀️' }
              : hr < 17 ? { text: 'สวัสดีตอนบ่าย', emoji: '🌤️' }
              : { text: 'สวัสดีตอนเย็น', emoji: '🌙' }

  const statCounts = [todayDue.length, toShip.length, overdue.length]
  const statOrders = [todayDue, toShip, overdue]

  return (
    <div ref={pageRef} style={isFs ? { background: 'var(--bg)', height: '100%', overflowY: 'auto', padding: 28 } : undefined}>

      {/* แถวบน: คำทักทายตามช่วงเวลา (ซ้าย) + วัน/เวลา + ปุ่มเต็มจอ (ขวา) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 26, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 27, lineHeight: 1 }} aria-hidden>{greet.emoji}</span>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 700, color: 'var(--brand)', lineHeight: 1.3 }}>{greet.text}</h1>
            <button onClick={() => setModal({ title: 'ออเดอร์ทั้งหมดของเดือนนี้', orders: [...monthOrders].reverse(), showPrint: true })}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)', marginTop: 2 }}>
              สรุปภาพรวมคำสั่งซื้อ · เดือนนี้{' '}
              <span style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>{(loading || !clock) ? '—' : monthOrders.length.toLocaleString()}</span> รายการ
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* การ์ดนาฬิกา — มุมมนใหญ่ ไอคอนในวงกลมครีม ตามธีมแบรนด์ */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 20px', height: 56,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow)',
          }}>
            {clock && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="30" height="30" fill="none" stroke="var(--brand)" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', lineHeight: 1.25 }}>
                    {clock.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
                    {clock.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* กระดิ่งแจ้งเตือนของค้างอนุมัติ (ใบลา / อุทธรณ์งานเคลม) */}
          <NotifyBell />

          {/* ปุ่มเต็มจอ (ไอคอนล้วน) */}
          <button onClick={toggleFs} title={isFs ? 'ออกจากเต็มจอ' : 'ดูแบบเต็มจอ'}
            style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flexShrink: 0 }}>
            {isFs ? (
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"/></svg>
            ) : (
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* ประกาศจากกระดานสนทนา (ไม่มีประกาศ = ไม่โชว์) */}
      <BoardAnnouncements />

      {/* การ์ดหลัก 3 ใบ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 28 }}>
        {STATS_META.map((s, i) => {
          return (
            <button key={s.key}
              onClick={() => setModal({ title: s.key === 'toship' ? 'รอจัดส่ง — ติ๊กเพื่อจัดส่ง' : s.label, orders: statOrders[i], showPrint: true, showShipToggle: s.key === 'toship' })}
              className="dn-stat"
              style={{
                background: isDark ? s.gradDark : s.gradLight,
                borderColor: s.onDark ? 'transparent' : 'rgba(168,116,82,0.16)',
                padding: '22px 24px 24px',
                outline: 'none',
              }}
            >
              {/* ภาพลายเส้นพื้นหลังมุมขวา */}
              <span className="dn-art" style={{ color: s.onDark ? '#FFF6EC' : s.numInk }}>{s.key === 'overdue' ? <ClockArt time={clock} /> : s.art}</span>

              {/* แถวบน: ไอคอน + ชื่อการ์ด */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.onDark ? '#FFF6EC' : s.numInk, flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? 'var(--ink-2)' : s.ink }}>{s.label}</span>
              </div>
              {/* ตัวเลขใหญ่ */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, position: 'relative' }}>
                <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, letterSpacing: '-1px',
                               fontVariantNumeric: 'tabular-nums', color: isDark ? 'var(--ink)' : s.numInk }}>
                  {(loading || !clock) ? '—' : statCounts[i]}
                </span>
                <span style={{ fontSize: 14, color: isDark ? 'var(--ink-3)' : s.ink, opacity: 0.85 }}>รายการ</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Orders list */}
      <div style={{ marginTop: 28 }}>
        {/* แถบสายการผลิต — เฉพาะจอติดผนัง เห็นทันทีว่างานไปกองอยู่ขั้นไหน */}
        {isFs && (
          <div className="dn-panel" style={{ display: 'flex', alignItems: 'stretch', marginBottom: 20, padding: '6px 4px' }}>
            {FLOW.map((f, i) => {
              const n = all.filter(o => o.order_status === f.status).length
              const most = Math.max(...FLOW.map(x => all.filter(o => o.order_status === x.status).length))
              const jam = n > 0 && n === most            // ขั้นที่งานกองมากสุด = คอขวด
              return (
                <div key={f.status} style={{
                  flex: 1, textAlign: 'center', padding: '12px 6px',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--hairline)',
                }}>
                  <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                                color: jam ? '#B5715A' : (n ? 'var(--brand)' : 'var(--ink-4)') }}>
                    {clock ? n : '·'}
                  </div>
                  <div style={{ fontSize: 17, marginTop: 6, color: jam ? '#B5715A' : 'var(--ink-2)',
                                fontWeight: jam ? 700 : 500 }}>{f.short}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* โหมดเต็มจอ (จอติดผนัง) ไม่ต้องมีแถบตัวกรอง — ไม่มีใครถือเมาส์กดอยู่หน้าจอ */}
        {!isFs && (<>
          {/* แถบตัวกรอง — ช่องค้นหายืดเต็ม + ปุ่มสูงเท่ากันหมด ให้แถวสมมาตร */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 260 }}>
              <svg width="17" height="17" fill="none" stroke="var(--ink-4)" strokeWidth="1.7" viewBox="0 0 24 24"
                   style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/>
              </svg>
              <input
                className="dn-field"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                placeholder="ค้นหาเลขที่ / Serial / ลูกค้า…"
                style={{ width: '100%', paddingLeft: 46 }}
              />
            </div>

            {/* ช่วงวันที่ (ผูกกับตัวกรอง "ต้องส่งภายใน" ชุดเดียวกับหัวคอลัมน์) */}
            <div style={{ position: 'relative' }}>
              <button className={`dn-ctrl${(deadlineFrom || deadlineTo) ? ' is-on' : ''}`}
                onClick={() => setOpenColFilter(openColFilter === 'tb-deadline' ? null : 'tb-deadline')}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                </svg>
                ช่วงวันที่
                <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
              </button>
              {openColFilter === 'tb-deadline' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', zIndex: 200, padding: '14px 16px', minWidth: 230 }}>
                  <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ตั้งแต่</label>
                  <input type="date" value={deadlineFrom} onChange={e => setDeadlineFrom(e.target.value)}
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, outline: 'none', marginBottom: 10, background: 'var(--surface)', color: 'var(--ink)' }} />
                  <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>ถึงวันที่</label>
                  <input type="date" value={deadlineTo} onChange={e => setDeadlineTo(e.target.value)}
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, outline: 'none', background: 'var(--surface)', color: 'var(--ink)' }} />
                  {(deadlineFrom || deadlineTo) && (
                    <button onClick={() => { setDeadlineFrom(''); setDeadlineTo('') }}
                      style={{ marginTop: 10, fontSize: 12, border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>ล้าง</button>
                  )}
                </div>
              )}
            </div>

            {/* สถานะ */}
            <div style={{ position: 'relative' }}>
              <button className={`dn-ctrl${statusFilters.length ? ' is-on' : ''}`}
                onClick={() => setOpenColFilter(openColFilter === 'tb-status' ? null : 'tb-status')}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5L14 12.4v5.6l-4 2.25V12.4L3.75 5.25z"/>
                </svg>
                {statusFilters.length ? `สถานะ (${statusFilters.length})` : 'สถานะทั้งหมด'}
                <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
              </button>
              {openColFilter === 'tb-status' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', zIndex: 200, minWidth: 190, padding: '8px 0' }}>
                  {Object.keys(STATUS_COLOR).map(st => (
                    <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px', cursor: 'pointer', fontSize: 12.5, background: statusFilters.includes(st) ? 'var(--cream)' : 'transparent' }}>
                      <input type="checkbox" checked={statusFilters.includes(st)}
                        onChange={() => setStatusFilters(statusFilters.includes(st) ? statusFilters.filter(x => x !== st) : [...statusFilters, st])}
                        style={{ cursor: 'pointer', accentColor: 'var(--brand)' }} />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[st], flexShrink: 0 }} />
                      {st}
                    </label>
                  ))}
                  {statusFilters.length > 0 && (
                    <div onClick={() => setStatusFilters([])}
                      style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--ink-4)', borderTop: '1px solid var(--border)', marginTop: 6 }}>ล้าง</div>
                  )}
                </div>
              )}
            </div>

            {/* ปริ้นรายงาน — ออกทุกแถวที่กรองอยู่ ไม่ใช่แค่หน้าที่เปิด */}
            <button className="dn-ctrl" onClick={printReport} title="ปริ้นตารางรายการทั้งหมดที่กรองอยู่">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5V3.75h10.5V7.5m0 0h1.5A2.25 2.25 0 0121 9.75v5.25a1.5 1.5 0 01-1.5 1.5h-2.25m0-9H6.75m0 0H5.25A2.25 2.25 0 003 9.75V15a1.5 1.5 0 001.5 1.5h2.25m10.5 0v3.75H6.75V16.5m10.5 0H6.75"/>
              </svg>
              ปริ้นรายงาน
            </button>
          </div>
        </>)}

        {openColFilter && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenColFilter(null)} />}

        <div className="dn-panel">
          {/* หัวแผง */}
          <div className="dn-panel-head">
            {/* กล่องพัสดุแบบเส้นโปร่ง (ไม่มีวงกลมพื้นหลัง) */}
            <svg width="28" height="28" fill="none" stroke="#8A5C3A" strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
            </svg>
            <h2 style={{ fontSize: isFs ? 22 : 16, fontWeight: 700, color: '#74401E' }}>รายการออเดอร์ทั้งหมด</h2>
          </div>

        <div style={{ overflowX: 'auto', padding: '0 20px' }}>

          {error ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>โหลดข้อมูลไม่สำเร็จ</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>{error}</div>
              <button onClick={() => { setLoading(true); load() }}
                style={{ border: 'none', background: 'var(--blue)', color: '#fff', borderRadius: 10, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>ลองใหม่</button>
            </div>
          ) : loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
          ) : ordersList.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>ไม่มีออเดอร์</div>
          ) : (
            <table className="dn-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: isFs ? 19 : 12.5 }}>
              <thead>
                <tr>
                  {/* วันผลิตที่เหลือ */}
                  <th style={{ textAlign: 'left', padding: isFs ? '14px 16px' : '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'days' ? null : 'days')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 600, color: daysSort ? 'var(--blue)' : '#8A6142', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      วันผลิตที่เหลือ <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
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
                  <th style={{ textAlign: 'left', padding: isFs ? '14px 16px' : '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'deadline' ? null : 'deadline')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 600, color: (deadlineFrom || deadlineTo) ? 'var(--blue)' : '#8A6142', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
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
                  <th style={{ textAlign: 'left', padding: isFs ? '14px 16px' : '10px 14px', fontSize: 12.5, whiteSpace: 'nowrap' }}>ลูกค้า</th>
                  {/* แพลตฟอร์ม */}
                  <th style={{ textAlign: 'left', padding: isFs ? '14px 16px' : '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'platform' ? null : 'platform')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 600, color: platformFilters.length ? 'var(--blue)' : '#8A6142', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
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
                  <th style={{ textAlign: 'left', padding: isFs ? '14px 16px' : '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'courier' ? null : 'courier')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 600, color: courierFilters.length ? 'var(--blue)' : '#8A6142', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      บริษัทจัดส่ง{courierFilters.length > 0 && ` (${courierFilters.length})`} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                    </button>
                    {openColFilter === 'courier' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 200, maxHeight: 260, overflowY: 'auto', padding: '6px 0' }}>
                        {courierOptions.map(c => (
                          <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, background: courierFilters.includes(c) ? 'var(--blue-bg)' : 'transparent' }}>
                            <input type="checkbox" checked={courierFilters.includes(c)} onChange={() => setCourierFilters(courierFilters.includes(c) ? courierFilters.filter(x => x !== c) : [...courierFilters, c])} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                            {c === 'งานติดตั้ง' ? <span style={{ color: '#B5715A', fontWeight: 600 }}>งานติดตั้ง</span> : c}
                          </label>
                        ))}
                        {courierFilters.length > 0 && <div onClick={() => setCourierFilters([])} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 11, color: 'var(--ink-4)', borderTop: '1px solid var(--border)', marginTop: 4 }}>ล้าง</div>}
                      </div>
                    )}
                  </th>
                  {/* สถานะงาน */}
                  <th style={{ textAlign: 'left', padding: isFs ? '14px 16px' : '10px 14px', fontWeight: 500, whiteSpace: 'nowrap', position: 'relative' }}>
                    <button onClick={() => setOpenColFilter(openColFilter === 'status' ? null : 'status')}
                      style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 600, color: statusFilters.length ? 'var(--blue)' : '#8A6142', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
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
                  <th style={{ textAlign: 'left', padding: isFs ? '14px 16px' : '10px 14px', fontSize: 12.5, whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(o => {
                  const isOutside = OUTSIDE_PLATFORMS.includes(o.platform ?? '') || o.is_installation
                  const effective = isOutside ? o.deadline : effShipping(o)
                  const days = rowDays(o)
                  return (
                    <tr key={o.id} onClick={() => setDetailId(o.id)} title="กดเพื่อดูรายการเต็ม"
                        style={{ borderBottom: '1px solid var(--hairline)', cursor: 'pointer' }}>
                      <td style={{ padding: isFs ? '18px 16px' : '12px 14px', whiteSpace: 'nowrap' }}>
                        {o.order_status === 'จัดส่งแล้ว' ? (
                          <span style={{ fontWeight: 600, color: '#6F8F6A' }}>งานเสร็จแล้ว</span>
                        ) : o.is_urgent ? (
                          <span style={{ fontWeight: 600, color: '#6F8F6A' }}>งานเสร็จ</span>
                        ) : days !== null ? (
                          <span style={{ fontWeight: 600, color: daysColor(days) }}>
                            {daysLabel(days, o)}
                          </span>
                        ) : <span style={{ color: 'var(--ink-4)' }}>รอกำหนด</span>}
                      </td>
                      <td style={{ padding: isFs ? '18px 16px' : '12px 14px', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--blue)' }}>
                        {o.order_status === 'จัดส่งแล้ว' ? (
                          <span style={{ color: '#6F8F6A', fontWeight: 600 }}>จัดส่งแล้ว</span>
                        ) : isOutside ? (
                          o.deadline ? new Date(o.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>
                        ) : (
                          effective ?? <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>รอกำหนด</span>
                        )}
                      </td>
                      <td style={{ padding: isFs ? '18px 16px' : '12px 14px' }}>
                        {o.customer_name
                          ? <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{o.customer_name}</span>
                          : '-'}
                      </td>
                      <td style={{ padding: isFs ? '18px 16px' : '12px 14px', color: 'var(--ink-3)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <PlatformIcon name={o.platform} />{o.platform || '-'}
                        </span>
                      </td>
                      <td style={{ padding: isFs ? '18px 16px' : '12px 14px', color: 'var(--ink-soft)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <CourierIcon name={o.courier} install={o.is_installation} />
                          {o.is_installation
                            ? <span style={{ color: 'var(--ink-soft)' }}>งานติดตั้ง</span>
                            : (o.courier || <span style={{ color: 'var(--ink-4)' }}>-</span>)}
                        </span>
                      </td>
                      <td style={{ padding: isFs ? '14px 16px' : '8px 14px' }}>
                        <span className="dn-pill" style={{ color: o.order_status === 'จัดส่งแล้ว' ? '#1F8A3B' : '#6B4326', fontSize: isFs ? 16 : undefined, minWidth: isFs ? 132 : undefined,
                                     background: pillBg(o.order_status) }}>
                          {(o.is_installation && o.order_status === 'จัดส่งแล้ว' ? 'ติดตั้งแล้ว' : o.order_status) || '—'}
                        </span>
                      </td>
                      <td style={{ padding: isFs ? '18px 16px' : '12px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: o.notes ? 'var(--ink-soft)' : 'var(--ink-4)' }}>
                        {o.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

          {/* ท้ายแผง: จำนวนที่แสดง + เลขหน้า */}
          {!loading && !error && ordersList.length > 0 && (
            <div className="dn-panel-foot" style={{ borderTop: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                แสดง {pageStart + 1} - {Math.min(pageStart + PER_PAGE, ordersList.length)} จากทั้งหมด {ordersList.length.toLocaleString()} รายการ
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="dn-page" disabled={curPage === 1} onClick={() => setPage(curPage - 1)}>‹</button>
                {pageNumbers.map((n, i) => n === 0
                  ? <span key={`gap${i}`} style={{ color: 'var(--ink-4)', padding: '0 2px' }}>…</span>
                  : <button key={n} className={`dn-page${n === curPage ? ' is-on' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
                <button className="dn-page" disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dept section header — ย้ายมาไว้ใต้รายการออเดอร์ */}
      <div style={{ marginBottom: 14, marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="26" height="26" fill="none" stroke="#8A5C3A" strokeWidth="1.9" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5M3.75 12h16.5M3.75 18h16.5"/>
          </svg>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#74401E' }}>สถานะงานแผนก</h2>
        </div>
      </div>

      {/* Department cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {DEPTS.map(dept => {
          const rows = all.filter(o => o.order_status === dept.status)
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
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{dept.label}</span>
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
                          <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.customer_name
                              ? <span title="กดเพื่อดูรายการเต็ม" onClick={e => { e.stopPropagation(); setDetailId(o.id) }} style={{ color: 'var(--blue)', fontWeight: 500, cursor: 'pointer' }}>{o.customer_name}</span>
                              : <span style={{ color: 'var(--ink)' }}>-</span>}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                            color: days === null ? 'var(--ink-4)' : daysColor(days) }}>
                            {daysLabel(days, o)}
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

      {/* ══ ใบปริ้นรายงาน — ซ่อนบนหน้าจอ โผล่เฉพาะตอนกด "ปริ้นรายงาน" ══
             ออกทุกแถวที่กรองอยู่ (ทุกหน้า) ไม่ใช่แค่ 12 แถวที่เปิดค้างไว้
             ‼️ แปะไว้ที่ body ตรงๆ ไม่งั้นได้กระดาษเปล่าตามมาตามความสูงของหน้าจอ */}
      {clock && createPortal(
        <div className="print-area print-only">
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>รายการออเดอร์ทั้งหมด</div>
          <div style={{ fontSize: 12 }}>
            พิมพ์เมื่อ {clock ? clock.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) : ''} · {ordersList.length.toLocaleString()} รายการ
            {(deadlineFrom || deadlineTo) ? ` · ต้องส่งภายใน ${deadlineFrom || '—'} ถึง ${deadlineTo || '—'}` : ''}
            {statusFilters.length ? ` · สถานะ: ${statusFilters.join(', ')}` : ''}
            {platformFilters.length ? ` · แพลตฟอร์ม: ${platformFilters.join(', ')}` : ''}
            {courierFilters.length ? ` · ขนส่ง: ${courierFilters.join(', ')}` : ''}
            {orderSearch ? ` · ค้นหา: ${orderSearch}` : ''}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {['วันผลิตที่เหลือ', 'ต้องส่งภายใน', 'ลูกค้า', 'แพลตฟอร์ม', 'บริษัทจัดส่ง', 'สถานะงาน', 'หมายเหตุ'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '5px 6px', borderBottom: '1.5px solid #000', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordersList.map(o => {
              const isOutside = OUTSIDE_PLATFORMS.includes(o.platform ?? '') || o.is_installation
              const effective = isOutside ? o.deadline : effShipping(o)
              const days = effective ? daysRemaining(effective) : null
              return (
                <tr key={o.id}>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', whiteSpace: 'nowrap' }}>
                    {daysLabel(days, o)}
                  </td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', whiteSpace: 'nowrap' }}>
                    {isOutside
                      ? (o.deadline ? new Date(o.deadline).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'รอกำหนด')
                      : (effective ?? 'รอกำหนด')}
                  </td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ccc' }}>{o.customer_name || '-'}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ccc' }}>{o.platform || '-'}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ccc' }}>
                    {o.is_installation ? 'งานติดตั้ง' : (o.courier || '-')}
                  </td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', whiteSpace: 'nowrap' }}>{o.order_status || '—'}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ccc' }}>{o.notes || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>, document.body)}

      {/* ข้อความเด้งเวลาช่างสแกนงาน (ยังไม่มีช่างจริงในโคลน — มีปุ่มทดสอบให้ยิงเอง) */}
      <ScanToast orders={all} />

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
              {/* รายชื่อในกล่องค้างไว้ตามตอนเปิด (ไม่หายเมื่อติ๊ก) แต่ข้อมูลแต่ละแถวดึงค่าสด */}
              <OrderTable orders={modal.orders.map(live)} today={today} onShip={modal.showShipToggle ? markShipped : undefined} onOpen={setDetailId} />
            </div>
          </div>
        </div>
      )}

      {/* ป๊อปอัปรายการเต็มของออเดอร์ (กดแถว/ชื่อลูกค้า) — วางท้ายสุดให้ซ้อนทับกล่องรายการด้านบนได้ */}
      {detailId && <OrderDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
