'use client'

// ป๊อปอัป "รายละเอียดออเดอร์" — กดที่แถวในตารางหน้าภาพรวมแล้วเปิดขึ้นมา
// ดึงทุกคอลัมน์ของใบนั้นจาก order_entries (ตารางหน้าภาพรวมโหลดมาแค่บางช่อง)
//
// เรียงเป็น 6 ส่วน: สรุปออเดอร์ · ไทม์ไลน์สถานะ · รายการสินค้า · การจัดส่ง · ข้อมูลใบออเดอร์ · ประวัติแก้ไข
// เนื้อหาแยกเป็น OrderDetailBody ใช้ร่วมกับโฟลเดอร์ลูกค้า (app/(admin)/customers) ให้หน้าตาเดียวกัน
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FIELD_TH } from '@/lib/activityText'
import { PlatformIcon, CourierIcon } from './BrandMark'
import { itemBlockLines, itemPrice, type RawItem } from '@/lib/itemFormat'
import OrderHistory from './OrderHistory'
import Pager from './Pager'
import { OUTSIDE_PLATFORMS, PLATFORM_NAMES } from '@/lib/orderTabs'

type Row = Record<string, unknown>
type Item = Record<string, unknown>
type Hist = { at?: string; by?: string; status?: string; helper?: boolean }
type Shipment = { no?: string; carrier?: string; status?: string }

// ช่องที่ไม่โชว์ในตาราง "ข้อมูลใบออเดอร์" (โชว์แยกไว้ส่วนอื่นแล้ว / เป็นข้อมูลภายใน)
const HIDE = new Set([
  'id', 'items', 'status_history', 'packing_photos', 'install_photos', 'rail_photos',
  'created_at', 'updated_at', 'customer_name', 'order_number', 'order_status',
  'actor_code', 'actor_name', 'created_by_code', 'last_content_at', 'pinned',
  'shipments', 'shipped_at', 'order_assigned', 'courier',
  // user ขอเอาออก (ติ๊ก/สถานะภายใน ไม่ช่วยตอนอ่านรายละเอียด): สถานะ · งานเสร็จ · งานติดตั้ง · ลูกค้ามารับเอง · สั่งของแล้ว · แพ็ครางแล้ว
  'status', 'is_urgent', 'is_installation', 'is_dropoff', 'is_ordered', 'rail_packed', 'rail_packed_at',
])

const EXTRA_TH: Record<string, string> = {
  entry_date: 'วันที่ลงออเดอร์', is_installation: 'งานติดตั้ง', is_dropoff: 'ลูกค้ามารับเอง',
  is_ordered: 'สั่งของแล้ว', rail_packed: 'แพ็ครางแล้ว', created_by_name: 'ผู้ลงออเดอร์',
  printed_at: 'ปริ้นใบออเดอร์เมื่อ',
}

// ช่อง "ลงออเดอร์" — ตัวเลือกชุดเดียวกับหมวดออเดอร์ (ORDER_ASSIGNED ใน OrderWorkspace / installations)
// ค่าที่ไม่อยู่ในตัวเลือก (เช่น "สรุปออเดอร์" ที่ติดมาจาก Google Sheet ตอนย้ายข้อมูล ก.ค.) → ขึ้น "รออัพเดท"
// ให้ตรงกับช่องเลือกในตาราง ซึ่งแสดงค่าที่ไม่รู้จักเป็นตัวเลือกแรกอยู่แล้ว
const ORDER_ASSIGNED = ['รออัพเดท', 'แจ้งลงหน้าร้าน', 'พี่ฟอง', 'ช่างเชียงใหม่']
const assignedLabel = (v: unknown) => { const s = String(v ?? '').trim(); return ORDER_ASSIGNED.includes(s) ? s : 'รออัพเดท' }

// ใบที่รายการสินค้าเยอะ (งานติดตั้งทั้งหลัง) → แบ่งหน้า หน้าละ ITEMS_PER_PAGE รายการ ไม่ต้องเลื่อนยาว (user ขอ 15ก.ย.69)
const ITEMS_PER_PAGE = 5

const MONEY_FIELDS = new Set(['price', 'deposit', 'paid_amount', 'refund_amount', 'shipping_cost'])
const baht = (v: number) => '฿' + v.toLocaleString('th-TH', { maximumFractionDigits: 2 })

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+)?/
function fmtDate(v: string, withTime = true): string {
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const day = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  return (withTime && v.includes('T'))
    ? `${day} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
    : day
}

// "แลง (DN032)" → "แลง" · ถ้ามีแต่รหัสไม่มีชื่อ ("DN032") ก็คงไว้ตามเดิม
const byName = (by: string) => by.replace(/\s*\(DN\d+\)\s*$/i, '') || by

function fmt(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  if (MONEY_FIELDS.has(k)) return typeof v === 'number' ? baht(v) : String(v)
  if (Array.isArray(v)) {
    return v.map(it => (it && typeof it === 'object'
      ? Object.values(it as Record<string, unknown>).filter(x => x !== null && x !== '').join(' ')
      : String(it))).filter(Boolean).join(' · ')
  }
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).filter(Boolean).join(' ')
  const str = String(v)
  return ISO.test(str) ? fmtDate(str) : str
}

const label = (k: string) => FIELD_TH[k] ?? EXTRA_TH[k] ?? k

// ── ไอคอนเล็กหน้าแต่ละช่องในตารางข้อมูล ──
const ICON: Record<string, string> = {
  cal: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 21.75c-2.7 0-5.2-.6-7.5-1.65z',
  money: 'M12 6v12m3-9.75a3 3 0 00-3-1.5c-1.7 0-3 .9-3 2.25S10.3 11.25 12 11.25s3 .9 3 2.25-1.3 2.25-3 2.25a3 3 0 01-3-1.5',
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  doc: 'M19.5 14.25v-2.6c0-1.14-.9-2.06-2-2.06h-1.5c-.55 0-1-.46-1-1.03v-1.55c0-1.14-.9-2.06-2-2.06H9.75M9 15l2 2 4-4m-6.75 8.25h7.5c1.1 0 2-.92 2-2.06V11.9c0-3.13-2.47-5.66-5.5-5.66H8.25c-1.1 0-2 .92-2 2.06v10.9c0 1.14.9 2.06 2 2.06z',
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182l-9.58-9.581A2.25 2.25 0 009.567 3z',
}
const iconFor = (k: string) =>
  MONEY_FIELDS.has(k) ? ICON.money
    : /date|deadline|_at|datetime/.test(k) ? ICON.cal
      : /name|admin|technician|assigned|code/.test(k) ? ICON.user
        : /is_|status|packed|ordered/.test(k) ? ICON.check
          : /platform|courier|type/.test(k) ? ICON.tag
            : ICON.doc

// การ์ดมีหัวข้อ + ไอคอน — ใช้ทั้งในเนื้อหาออเดอร์ และหน้าอื่นที่อยากได้หน้าตาเดียวกัน (โฟลเดอร์ลูกค้า)
export function Card({ title, icon, children, right }: { title: string; icon: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 18px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <svg width="19" height="19" fill="none" stroke="#8A5C3A" strokeWidth="1.6" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#74401E', flex: 1 }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

export const BOX_ICON = 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9'
const TRUCK_ICON = 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.9 17.9 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12'
export const CAMERA_ICON = 'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z'

export default function OrderDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [row, setRow] = useState<Row | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    supabase.from('order_entries').select('*').eq('id', id).single().then(({ data, error }) => {
      if (!alive) return
      if (error) setErr(error.message || 'โหลดข้อมูลไม่สำเร็จ')
      else setRow(data as Row)
    })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.40)', display: 'flex',
               alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 880, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
                 background: 'var(--cream-2)', border: '1px solid var(--border)', borderRadius: 22,
                 boxShadow: '0 24px 60px rgba(90,60,38,0.30)' }}>

        {/* ── หัวป๊อปอัป ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px 14px',
                      borderBottom: '1px solid var(--hairline)' }}>
          <svg width="26" height="26" fill="none" stroke="#8A5C3A" strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d={BOX_ICON} />
          </svg>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#74401E' }}>รายละเอียดออเดอร์</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {String(row?.customer_name ?? '') || '(ไม่ระบุชื่อลูกค้า)'}
              {row?.order_number ? '  ·  ' + String(row.order_number) : ''}
            </div>
          </div>
          {row?.customer_name ? (
            <Link href={`/customers?name=${encodeURIComponent(String(row.customer_name))}`} className="dn-ctrl"
              style={{ height: 36, fontSize: 12.5, textDecoration: 'none' }}>เปิดโฟลเดอร์ลูกค้า</Link>
          ) : null}
          <button onClick={onClose} title="ปิด"
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)',
                     background: 'var(--surface)', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0,
                     display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* ── เนื้อหา ── */}
        <div style={{ overflowY: 'auto', padding: '16px 22px 22px' }}>
          {err ? (
            <div style={{ color: 'var(--red)', fontSize: 13.5 }}>{err}</div>
          ) : !row ? (
            <div style={{ color: 'var(--ink-3)', fontSize: 13.5, padding: '20px 0' }}>กำลังโหลด…</div>
          ) : (
            <OrderDetailBody row={row} />
          )}
        </div>
      </div>
    </div>
  )
}

// เนื้อหารายละเอียดออเดอร์ (การ์ดทั้งหมด) — ใช้ร่วม 2 ที่: ป๊อปอัปหน้าภาพรวม + โฟลเดอร์ลูกค้า (ทุกออเดอร์หน้าตาเดียวกัน)
// row = ทุกคอลัมน์ของ order_entries 1 แถว · afterShipping = การ์ดเพิ่มเฉพาะที่ ต่อท้ายการ์ดจัดส่ง (เช่น รูปแพ็คในโฟลเดอร์)
// wide = จอกว้าง (โฟลเดอร์ลูกค้า) → ใต้สรุป/ไทม์ไลน์แบ่ง 2 คอลัมน์: ซ้าย สินค้า·จัดส่ง·พัสดุ·รูปแพ็ค / ขวา ข้อมูลออเดอร์·ประวัติ
// ไม่ wide (ป๊อปอัป) = เรียงต่อกันคอลัมน์เดียวเหมือนเดิม (wrapper เป็น display: contents)
export function OrderDetailBody({ row, afterShipping, wide }: { row: Row; afterShipping?: React.ReactNode; wide?: boolean }) {
  const id = String(row.id)
  const [copied, setCopied] = useState(false)

  const items = (row.items as Item[] | null) ?? []
  const [itemPage, setItemPage] = useState(1)
  const itemPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE))
  const curItemPage = Math.min(itemPage, itemPages)
  const itemStart = (curItemPage - 1) * ITEMS_PER_PAGE
  const itemsTop = useRef<HTMLDivElement>(null)
  // bottom = กดจากแถบล่าง → เลื่อนกลับหัวรายการ (หน้าใหม่สูงไม่เท่าเดิม ไม่งั้นค้างกลางรายการ)
  const itemPager = (bottom: boolean) => (
    <Pager page={curItemPage} pageCount={itemPages}
      onPage={n => { setItemPage(n); if (bottom) requestAnimationFrame(() => itemsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}
      label={`รายการที่ ${itemStart + 1} - ${Math.min(itemStart + ITEMS_PER_PAGE, items.length)} จาก ${items.length}`} />
  )
  const price = typeof row.price === 'number' ? row.price as number : null
  const shipments = (row.shipments as Shipment[] | null) ?? []
  const tracking = shipments.map(sp => sp?.no).filter(Boolean).join(', ')
  const status = String(row.order_status ?? '')
  // งานติดตั้งที่ติ๊กเสร็จ ในระบบเก็บเป็น "จัดส่งแล้ว" (ขั้นเดียวกับออเดอร์ส่งของ) → โชว์เป็น "ติดตั้งแล้ว" ให้ตรงงาน
  const isInstall = !!row.is_installation
  const showStatus = (st: string) => (isInstall && st === 'จัดส่งแล้ว' ? 'ติดตั้งแล้ว' : st)

  // ไทม์ไลน์: เอาสถานะแรกสุดของแต่ละขั้นจาก status_history เรียงตามเวลา
  const hist = ((row.status_history as Hist[] | null) ?? [])
    .filter(h => h?.status && h?.at)
    .slice()
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
  const steps: Hist[] = []
  for (const h of hist) if (!steps.some(x => x.status === h.status)) steps.push(h)

  // งานแพลตฟอร์ม (Shopee/Tiktok/Lazada) ลูกค้าจ่ายผ่านแพลตฟอร์มแล้วทุกใบ — ช่อง "การชำระ" ค้าง "ยังไม่ชำระ" ชวนเข้าใจผิด
  // (หมวดออเดอร์แท็บงานแพลตฟอร์มก็ไม่มีคอลัมน์นี้) · ‼️ ...-Chat / งานนอก ยังโชว์ เพราะชำระนอกแพลตฟอร์ม
  const isMarketplace = PLATFORM_NAMES.includes(String(row.platform ?? ''))
  const fields0 = Object.entries(row).filter(([k, v]) => !HIDE.has(k) && fmt(k, v) !== ''
    && !(isMarketplace && k === 'payment_status')
    // มีชื่อแอดมินแล้ว ไม่ต้องโชว์รหัส DN ซ้ำ
    && !(k === 'admin_code' && (row.admin_name || row.created_by_name)))
  // เวลานัดอยู่ใต้วันติดตั้งเสมอ — ตารางเป็น grid จำนวนคอลัมน์เปลี่ยนตามความกว้าง
  // เลยรวมเป็นช่องเดียวซ้อนกัน 2 บรรทัด (ไม่งั้นเวลานัดไปอยู่ข้างๆ หรือห่างออกไปตามลำดับคอลัมน์ในฐานข้อมูล)
  const timeField = fields0.find(([k]) => k === 'install_time')
  const stackTime = !!timeField && fields0.some(([k]) => k === 'installation_date')
  const fields = stackTime ? fields0.filter(([k]) => k !== 'install_time') : fields0

  const copyTracking = async () => {
    if (!tracking) return
    try { await navigator.clipboard.writeText(tracking); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  return (
    <>
      {/* ══ สรุปออเดอร์ ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.2fr)',
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                    padding: '16px 18px', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <svg width="19" height="19" fill="none" stroke="#8A5C3A" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={BOX_ICON} />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#74401E' }}>สรุปออเดอร์</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--brand)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {price === null ? '—' : baht(price)}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--hairline)', paddingLeft: 18 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 8 }}>สถานะปัจจุบัน</div>
          <span className="dn-pill" style={{ color: pillInk(status), background: pillBg(status) }}>{showStatus(status) || '—'}</span>
        </div>

        <div style={{ borderLeft: '1px solid var(--hairline)', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>วันที่สั่งซื้อ</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)', marginTop: 1 }}>
              {fmt('entry_date', row.entry_date ?? row.created_at) || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>แพลตฟอร์ม</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 13.5, color: 'var(--ink)' }}>
              <PlatformIcon name={String(row.platform ?? '')} size={18} />
              {String(row.platform ?? '') || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ══ ไทม์ไลน์สถานะ ══ */}
      {steps.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                      padding: '18px 18px 14px', marginBottom: 14, overflowX: 'auto' }}>
          <div style={{ display: 'flex', minWidth: Math.max(steps.length * 132, 320) }}>
            {steps.map((h, i) => {
              const last = i === steps.length - 1
              return (
                <div key={i} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                  {/* เส้นเชื่อมไปขั้นถัดไป */}
                  {!last && <div style={{ position: 'absolute', left: 'calc(50% + 16px)', right: 'calc(-50% + 16px)',
                                          top: 13, height: 1.5, background: 'var(--border-2)' }} />}
                  <div style={{
                    width: 27, height: 27, borderRadius: '50%', margin: '0 auto',
                    background: last ? 'var(--brand)' : 'var(--cream)',
                    color: last ? '#FFF8F0' : '#8A5C3A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5 10-11" />
                    </svg>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12.5, fontWeight: last ? 700 : 500,
                                color: last ? 'var(--brand)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {showStatus(h.status ?? '')}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 2, fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                    {h.at ? fmtDate(h.at) : ''}
                  </div>
                  {h.by && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-4)', overflow: 'hidden',
                                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{byName(h.by)}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className={wide ? 'odb-cols' : undefined} style={wide ? undefined : { display: 'contents' }}>
      <div style={wide ? { minWidth: 0 } : { display: 'contents' }}>
      {/* ══ รายการสินค้า ══ */}
      {items.length > 0 && (
        <Card title={`รายการสินค้า (${items.length})`} icon={BOX_ICON}>
          <div ref={itemsTop} style={{ display: 'flex', flexDirection: 'column', gap: 6, scrollMarginTop: 16 }}>
            {itemPager(false)}
            {items.slice(itemStart, itemStart + ITEMS_PER_PAGE).map((it, idx) => {
              const i = itemStart + idx
              const qty = Number(it.quantity) || null
              // ‼️ ใช้สูตรบรรทัดเดียวกับตอนปริ้น/คัดลอกในหมวดออเดอร์ จะได้อ่านแล้วตรงกับใบสั่งงาน
              const lines = itemBlockLines(it as RawItem)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14,
                                      background: 'var(--cream-2)', borderRadius: 12, padding: '8px 14px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {lines.map((ln, li) => (
                      <div key={li} style={{
                        fontSize: li === 0 ? 14.5 : 13,
                        fontWeight: li === 0 ? 700 : 400,
                        color: li === 0 ? 'var(--ink)' : (ln.rail ? 'var(--brand)' : 'var(--ink-soft)'),
                        lineHeight: 1.5, wordBreak: 'break-word',
                      }}>{ln.t}</div>
                    ))}
                    {it.outsource ? (
                      <span className="dn-pill" style={{ minWidth: 0, fontSize: 11.5, padding: '2px 10px',
                            marginTop: 6, color: '#6B4326', background: '#F0C0B7' }}>สั่งนอก {String(it.outsource)}</span>
                    ) : null}
                  </div>

                  {/* จำนวน / ราคา — มีราคาแยกของรายการ (แปลงมาจากข้อความที่เขียนราคาไว้) ใช้อันนั้น
                      ไม่มี → ใบรายการเดียวใช้ราคาทั้งใบแทนได้ · ใบหลายรายการไม่โชว์ช่องราคา */}
                  <div style={{ display: 'flex', flexShrink: 0, alignItems: 'stretch' }}>
                    {[
                      { k: 'จำนวน', v: qty ? String(qty) : '—', sub: String(it.unit ?? '') },
                      ...(itemPrice(it.price) != null ? [{ k: 'ราคา', v: baht(itemPrice(it.price)!), sub: '' }]
                        : items.length === 1 && price !== null ? [{ k: 'ราคารวม', v: baht(price), sub: '' }] : []),
                    ].map((c, j) => (
                      <div key={c.k} style={{ minWidth: 92, textAlign: 'right', paddingLeft: 16,
                                              borderLeft: j === 0 ? 'none' : '1px solid var(--hairline)', marginLeft: j === 0 ? 0 : 16 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.k}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{c.v}</div>
                        {c.sub && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{c.sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {itemPager(true)}
          </div>
        </Card>
      )}

      {/* ══ รายละเอียดการจัดส่ง ══ */}
      <Card title="รายละเอียดการจัดส่ง" icon={TRUCK_ICON}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <CourierIcon name={String(row.courier ?? '')} install={!!row.is_installation} size={44} />
          <div style={{ minWidth: 180, flex: 1 }}>
            <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>
              {row.is_installation ? 'งานติดตั้ง' : (String(row.courier ?? '') || 'ยังไม่ระบุขนส่ง')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>สถานะ</span>
              {status === 'จัดส่งแล้ว' ? <DeliveredPill label={isInstall ? 'ติดตั้งแล้ว' : 'จัดส่งสำเร็จ'} /> : (
                <span className="dn-pill" style={{ minWidth: 0, fontSize: 11.5, padding: '2px 10px', color: '#6B4326', background: pillBg(status) }}>
                  {status || '—'}
                </span>
              )}
            </div>
            {tracking && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 5 }}>
                เลขพัสดุ <span style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{tracking}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '1px solid var(--hairline)', paddingLeft: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" fill="none" stroke="var(--ink-4)" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.cal} />
              </svg>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)', minWidth: 62 }}>วันที่ส่ง</span>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                {fmt('shipped_at', row.shipped_at ?? row.shipping_datetime) || '—'}
              </span>
            </div>
            {/* ลงออเดอร์ — มีช่องให้เลือกเฉพาะงานนอก/งานติดตั้ง (งานแพลตฟอร์มค้าง "รออัพเดท" ตลอด เลยไม่โชว์) */}
            {(OUTSIDE_PLATFORMS.includes(String(row.platform ?? '')) || !!row.is_installation) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" fill="none" stroke="var(--ink-4)" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON.user} />
              </svg>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)', minWidth: 62 }}>ลงออเดอร์</span>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{assignedLabel(row.order_assigned)}</span>
            </div>
            )}
          </div>

          {tracking && (
            <button onClick={copyTracking} className={`dn-ctrl dn-copy${copied ? ' is-done' : ''}`}
                    aria-label={copied ? 'คัดลอกแล้ว' : 'คัดลอกเลขพัสดุ'} style={{ height: 38, fontSize: 12.5 }}>
              {/* ตัวหนังสือค้างไว้แค่จางหาย เพื่อคงความกว้างปุ่ม */}
              <span className="dn-copy-label">คัดลอกเลขพัสดุ</span>
              {copied && (
                <svg className="dn-copy-check" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="12" />
                  <path d="M7.5 12.3l3 3 6-6.3" />
                </svg>
              )}
            </button>
          )}
        </div>
      </Card>

      {afterShipping}
      </div>
      <div style={wide ? { minWidth: 0 } : { display: 'contents' }}>

      {/* ══ ข้อมูลใบออเดอร์ ══ */}
      <Card title="ข้อมูลออเดอร์" icon={ICON.doc}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0 24px' }}>
          {fields.map(([k, v]) => {
            const line = (key: string, val: unknown, last = true) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: last ? '1px solid var(--hairline)' : 'none' }}>
                <svg width="15" height="15" fill="none" stroke="var(--ink-4)" strokeWidth="1.6" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={iconFor(key)} />
                </svg>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)', minWidth: 108, flexShrink: 0 }}>{label(key)}</span>
                <span style={{ fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word' }}>{fmt(key, val)}</span>
              </div>
            )
            // วันติดตั้ง + เวลานัด ซ้อนกันในช่องเดียว
            if (k === 'installation_date' && stackTime && timeField) {
              return <div key={k}>{line(k, v, false)}{line(timeField[0], timeField[1])}</div>
            }
            return line(k, v)
          })}
        </div>
      </Card>

      {/* ══ ประวัติการแก้ไข ══ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 18px' }}>
        <OrderHistory orderId={id} />
      </div>
      </div>
      </div>
    </>
  )
}

// พื้นป้ายสถานะ — ชุดสีเดียวกับตารางหน้าภาพรวม
const PILL_BG: Record<string, string> = {
  'รอดำเนินการ': '#F9E0C3', 'กำลังตัด': '#CFE0EA', 'ตัดผ้าแล้ว': '#CFE0EA',
  'กำลังเย็บ': '#E2D5EC', 'เย็บแล้ว': '#E2D5EC', 'ตรวจสอบแล้ว': '#D6DAF0',
  'กำลังรีด': '#F6D5DE', 'รีดแล้ว': '#F6D5DE', 'กำลังแพ็ค': '#CFE6DE', 'แพ็คแล้ว': '#CFE6DE',
  'รอจัดส่ง': '#DBBEA7', 'งานเสร็จ': '#E3F3E0', 'จัดส่งแล้ว': '#E3F3E0',
  'รอติดตั้ง': '#F0C0B7', 'ยกเลิก': '#E6D9D5',
  // สถานะของงานเคลม (components/ClaimsWorkspace.tsx) — ใช้ป้ายชุดเดียวกับออเดอร์
  'รอของคืน': '#F9E0C3', 'ส่งแล้ว': '#E3F3E0',
}
// ป้าย "จัดส่งสำเร็จ" — เขียวอ่อน + วงกลมเขียวติ๊กถูก (ตามภาพที่ user ส่ง 14ก.ย.69) · ใช้ร่วมกับสถานะพัสดุในโฟลเดอร์ลูกค้า
export function DeliveredPill({ label = 'จัดส่งสำเร็จ' }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E3F3E0', color: '#1F8A3B', borderRadius: 999, padding: '3px 12px 3px 4px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="11" fill="#22A447" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {label}
    </span>
  )
}
export function pillBg(st: string) { return PILL_BG[st] ?? '#EFE3D4' }
// สีตัวหนังสือในป้าย — จัดส่งแล้ว = เขียว (ชุดเดียวกับป้ายจัดส่งสำเร็จ) · ที่เหลือน้ำตาลเข้ม
// ‼️ ป้ายที่แปลว่า 'จบแล้ว' (งานเสร็จ / จัดส่งแล้ว / ติดตั้งแล้ว) ใช้เขียวชุดเดียวกันหมด — พื้น #E3F3E0 ตัวอักษร #1F8A3B
export const DONE_GREEN_BG = '#E3F3E0'
export const DONE_GREEN_INK = '#1F8A3B'
export function pillInk(st: string) { return (st === 'จัดส่งแล้ว' || st === 'งานเสร็จ' || st === 'ส่งแล้ว') ? DONE_GREEN_INK : '#6B4326' }
// วงกลมเขียวติ๊กถูก หน้าคำว่าจัดส่งแล้ว
export function ShippedCheck() {
  return <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="11" fill="#22A447" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
