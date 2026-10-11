'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { thaiTrackStatus } from '@/lib/trackExtract'
import { carrierTrackUrl } from '@/lib/carriers'
import { INSTALL_STATUS_COLOR } from '@/lib/shopCalendar'
import { usePullToRefresh, useSheetBack, PullIndicator, CardSkeleton } from './mobileUi'
import { compressImage, uploadPackingFile, deletePackingFile } from '@/lib/packingPhotos'
import { readStaffSession, type StaffSession } from '@/lib/staffSession'
import { useConfirm } from '@/components/ConfirmDialog'
import Pager from '@/components/Pager'
import PhotoViewer from '@/components/PhotoViewer'
import { topicsForOrders } from '@/lib/boardStore'
import { OrderDetailBody, Card, CAMERA_ICON, DeliveredPill } from '@/components/OrderDetailModal'
import { FolderGroup, FolderItem, OrderHeadBar, SummaryTiles, orderSectionStyle, ICON_TOOL, ICON_CART, ICON_CHAT, ICON_CLAIM, ICON_FOLDER, SHIP_ICON, CLAIM_STATUS_COLOR, PO_STATUS_COLOR } from '@/components/CustomerFolderParts'

// โฟลเดอร์ออเดอร์ของลูกค้า เวอร์ชันมือถือ
// ‼️ หน้าตาเหมือนเดสก์ท็อป app/(admin)/customers (user ขอ 29ก.ย.69) — การ์ดออเดอร์ = OrderDetailBody ชุดเดียวกับป๊อปอัป
//    กล่องท้ายโฟลเดอร์ = components/CustomerFolderParts · จัดให้พอดีจอแคบด้วย CSS ใน globals.css (.odb-* / .cf-*)
// ‼️ พนักงานที่ล็อกอินด้วยรหัสตัวเอง เพิ่ม/ลบรูปงานของออเดอร์ได้จากที่นี่ (packing_photos ชุดเดียวกับหน้า /scan)
//    เข้ามาจากแดชบอร์ด "ของฉัน" (/m/me → งานที่สแกน) โดยไม่ต้องสแกนซ้ำ
type Shipment = { no: string; carrier: string; status: string; checked_at: string | null }
type Order = {
  id: string
  entry_date: string | null
  order_number: string | null
  platform: string | null
  order_status: string | null
  price: number | null
  items: RawItem[] | null
  is_installation?: boolean | null
  packing_photos?: string[] | null
  shipments?: Shipment[] | null
}
// ใครสแกนขั้นไหน (production_scans) — 1 ขั้นมีได้หลายคน (คนเดินสถานะ + คนที่กด "ลงชื่อช่วย" ดู sql/scan_helpers.sql)
type Scan = { order_number: string; stage: string; tech_name: string | null; scanned_at: string | null }
// เรียงขั้นตามสายงานจริง ไม่ใช่ตามเวลาที่สแกน (สแกนย้อน/สแกนช่วยทีหลังจะได้ไม่สลับบรรทัด)
const STAGE_ORDER = ['ตัด', 'เย็บ', 'ผู้ช่วยช่าง', 'รีด', 'แพ็ค', 'แพ็คราง', 'จัดส่งแล้ว']

type Claim = { id: string; claim_date: string | null; channel: string | null; original_order_number: string | null; claim_type: string | null; fault: string | null; cause: string | null; resolution: string | null; refund_amount: number | null; money_direction: string | null; status: string; notes: string | null }
type Install = { id: string; serial_no: string | null; appointment_datetime: string | null; work_type: string | null; province: string | null; work_details: string | null; installation_status: string | null; price: number | null; notes: string | null }
type PO = { id: string; order_number: string | null; items: string | null; supplier: string | null; status: string; notes: string | null; created_at: string }
type Topic = Awaited<ReturnType<typeof topicsForOrders>>[number]

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// ลูกค้าประจำออเดอร์เยอะ → แบ่งหน้าเหมือนเดสก์ท็อป
const ORDERS_PER_PAGE = 5

export default function MobileCustomer() {
  const params = useSearchParams()
  const router = useRouter()
  const name = params.get('name') ?? ''
  // ออเดอร์ที่เพิ่งกดมาจากแดชบอร์ด "ของฉัน" (กุญแจเดียวกับ production_scans = เลขออเดอร์ หรือ 'id:<uuid>')
  const focusKey = params.get('order') ?? ''
  const [orders, setOrders] = useState<Order[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [installs, setInstalls] = useState<Install[]>([])
  const [pos, setPos] = useState<PO[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [page, setPage] = useState(1)
  const listTop = useRef<HTMLDivElement>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')          // เดิมทิ้ง error ทั้ง 4 query → เน็ตหลุดขึ้น "ไม่พบประวัติ" หลอกผู้ใช้ว่าลูกค้าไม่มีข้อมูล
  // รูปที่เปิดดูเต็มจอ + ออเดอร์เจ้าของรูป (ปุ่มลบอยู่ในหน้าดูเต็มจอ ต้องรู้ว่าลบออกจากใบไหน)
  const [photo, setPhoto] = useState<{ url: string; orderId: string } | null>(null)
  // กล่องยืนยันของเว็บเอง (ไม่ใช้ window.confirm — ดูเหตุผลใน components/ConfirmDialog.tsx)
  const { ask, confirmDialog } = useConfirm()
  const [copiedId, setCopiedId] = useState<string | null>(null)   // ออเดอร์ที่เพิ่งคัดลอก → โชว์ "คัดลอกแล้ว" ชั่วครู่
  // ── รูปงาน: เพิ่ม/ลบได้เฉพาะคนที่ล็อกอินด้วยรหัสพนักงาน ──
  const [staff, setStaff] = useState<StaffSession | null>(null)
  const [busyPhoto, setBusyPhoto] = useState<string | null>(null)  // id ออเดอร์ที่กำลังอัพ / url รูปที่กำลังลบ
  const [photoErr, setPhotoErr] = useState('')

  // คุกกี้อ่านได้เฉพาะบนเบราว์เซอร์ — อ่านตอน render แรกจะไม่ตรงกับที่ server เรนเดอร์
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setStaff(readStaffSession()) }, [])

  // เพิ่มรูปเข้าออเดอร์: ย่อรูป → อัพขึ้น R2 → ต่อ URL เข้า packing_photos (ตรรกะเดียวกับหน้า /scan)
  const addPhoto = async (orderId: string, file: File) => {
    setBusyPhoto(orderId); setPhotoErr('')
    try {
      const small = await compressImage(file)
      const ext = (small.name.split('.').pop() || 'jpg').toLowerCase()
      const url = await uploadPackingFile(small, `${orderId}/me-${Date.now()}.${ext}`)
      const { data: row } = await supabase.from('order_entries').select('packing_photos').eq('id', orderId).single()
      const cur = Array.isArray(row?.packing_photos) ? row.packing_photos : []
      const { error: err } = await supabase.from('order_entries')
        .update({ packing_photos: [...cur, url], updated_at: new Date().toISOString() }).eq('id', orderId)
      if (err) throw err
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, packing_photos: [...(o.packing_photos ?? []), url] } : o))
    } catch (e) {
      setPhotoErr(`เพิ่มรูปไม่สำเร็จ: ${(e as { message?: string })?.message || String(e)}`)
    }
    setBusyPhoto(null)
  }

  // ลบรูป: ลบไฟล์จริง (R2/Supabase ตามที่มา) แล้วเอา URL ออกจาก packing_photos
  const removePhoto = async (orderId: string, url: string) => {
    if (!(await ask('ลบรูปนี้ออกจากออเดอร์?', { okText: 'ลบ', danger: true }))) return
    setBusyPhoto(url); setPhotoErr('')
    try {
      await deletePackingFile(url)
      const { data: row } = await supabase.from('order_entries').select('packing_photos').eq('id', orderId).single()
      const cur = Array.isArray(row?.packing_photos) ? row.packing_photos : []
      const { error: err } = await supabase.from('order_entries')
        .update({ packing_photos: cur.filter((u: string) => u !== url), updated_at: new Date().toISOString() }).eq('id', orderId)
      if (err) throw err
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, packing_photos: (o.packing_photos ?? []).filter(u => u !== url) } : o))
      setPhoto(null)
    } catch (e) {
      setPhotoErr(`ลบรูปไม่สำเร็จ: ${(e as { message?: string })?.message || String(e)}`)
    }
    setBusyPhoto(null)
  }

  // แชร์รายการออเดอร์เข้ากลุ่ม LINE (navigator.share) — มือถือไม่มี share ก็คัดลอกลงคลิปบอร์ดแทน
  const shareOrder = async (o: Order) => {
    const lines = formatItemLines(o.items)
    const text = [
      name,
      `ออเดอร์ ${o.order_number || '-'}${o.platform ? ` · ${o.platform}` : ''}`,
      ...lines.map(l => `• ${l}`),
      o.order_status ? `สถานะ: ${o.order_status}` : '',
      o.price != null ? `ยอด: ${o.price.toLocaleString('th-TH')} ฿` : '',
    ].filter(Boolean).join('\n')
    if (navigator.share) {
      try { await navigator.share({ text }) } catch { /* ผู้ใช้กดยกเลิก → เงียบ */ }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(o.id)
      setTimeout(() => setCopiedId(c => (c === o.id ? null : c)), 1500)
    } catch { /* คลิปบอร์ดใช้ไม่ได้ (สิทธิ์/เบราว์เซอร์เก่า) → ข้าม */ }
  }

  const load = async () => {
    if (!name) { setLoading(false); return }
    // query ชุดเดียวกับหน้าเดสก์ท็อป (app/(admin)/customers) — จับคู่ด้วยชื่อลูกค้าเหมือนกัน
    const [o, c, i, p] = await Promise.all([
      supabase.from('order_entries')
        // ทุกคอลัมน์ — การ์ด "ข้อมูลออเดอร์" แบบเดียวกับหน้าคอมต้องใช้ครบ (ลูกค้าคนเดียว ไม่กี่ใบ ไม่หนัก)
        .select('*')
        .eq('customer_name', name)
        .order('entry_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('claims')
        .select('id, claim_date, channel, original_order_number, claim_type, fault, cause, resolution, refund_amount, money_direction, status, notes')
        .eq('customer_username', name).order('claim_date', { ascending: false, nullsFirst: false }),
      supabase.from('installations')
        .select('id, serial_no, appointment_datetime, work_type, province, work_details, installation_status, price, notes')
        .or(`customer_real_name.eq.${JSON.stringify(name)},customer_id.eq.${JSON.stringify(name)}`)
        .order('appointment_datetime', { ascending: false, nullsFirst: false }),
      supabase.from('purchase_orders')
        .select('id, order_number, items, supplier, status, notes, created_at')
        .eq('customer_name', name).order('created_at', { ascending: false }),
    ])
    const err = o.error ?? c.error ?? i.error ?? p.error
    setError(err ? `โหลดข้อมูลไม่ได้: ${err.message}` : '')
    setOrders((o.data as Order[]) ?? [])

    // ใครสแกนขั้นไหนบ้าง — ค้นด้วยกุญแจเดียวกับที่ RPC ใช้ตอนลง log (order_number ว่าง = 'id:<uuid>')
    // ‼️ ยิงหลัง query หลัก ไม่รวมใน Promise.all — ต้องรู้เลขออเดอร์ก่อนถึงจะค้นได้ และพังตรงนี้ไม่ควรทำให้ทั้งหน้าเป็น error
    const keys = ((o.data as Order[]) ?? []).map(r => r.order_number || `id:${r.id}`).filter(Boolean)
    if (keys.length) {
      const { data: sc } = await supabase.from('production_scans')
        .select('order_number, stage, tech_name, scanned_at')
        .in('order_number', keys)
        .order('scanned_at', { ascending: true })
      setScans((sc as Scan[]) ?? [])
    } else setScans([])

    setClaims((c.data as Claim[]) ?? [])
    setInstalls((i.data as Install[]) ?? [])
    setPos((p.data as PO[]) ?? [])
    // หัวข้อในหมวด "ตามงาน" ที่แท็กออเดอร์ของลูกค้าคนนี้ — พังก็ไม่ให้ทั้งหน้าเป็น error
    try { setTopics(await topicsForOrders(((o.data as Order[]) ?? []).map(r => r.id))) } catch { setTopics([]) }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLoading(true); setPage(1); load() }, [name])   // eslint-disable-line react-hooks/exhaustive-deps

  const { pull, refreshing, refresh } = usePullToRefresh(load)
  useSheetBack(!!photo, () => setPhoto(null))

  const total = orders.reduce((s, o) => s + (o.price ?? 0), 0)
  const latest = orders.find(o => o.entry_date)?.entry_date ?? null
  // ใบที่กดมาจาก "ของฉัน" ขึ้นก่อนเสมอ (ที่เหลือเรียงเดิม)
  const shownOrders = focusKey
    ? [...orders].sort((a, b) => Number((b.order_number || `id:${b.id}`) === focusKey) - Number((a.order_number || `id:${a.id}`) === focusKey))
    : orders
  const pageCount = Math.max(1, Math.ceil(shownOrders.length / ORDERS_PER_PAGE))
  const curPage = Math.min(page, pageCount)
  const pageStart = (curPage - 1) * ORDERS_PER_PAGE
  const pageOrders = shownOrders.slice(pageStart, pageStart + ORDERS_PER_PAGE)
  // เปลี่ยนหน้า → เลื่อนกลับไปหัวรายการ
  const goPage = (n: number) => {
    setPage(n)
    requestAnimationFrame(() => listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const pagerLabel = `ออเดอร์ที่ ${pageStart + 1} - ${Math.min(pageStart + ORDERS_PER_PAGE, orders.length)} จากทั้งหมด ${orders.length} ใบ`

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '8px 14px 4px' }}>
          {/* router.back() ไม่ใช่ลิงก์ตายไป /m/orders — เข้ามาจากการ์ดเคลมด้วย ต้องกลับที่เดิม */}
          <button onClick={() => router.back()}
            style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: 13.5, cursor: 'pointer', padding: '0 4px 0 0', WebkitTapHighlightColor: 'transparent' }}>
            ← กลับ
          </button>
        </div>
        <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" fill="none" stroke="#8A5C3A" strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d={ICON_FOLDER} />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>โฟลเดอร์ลูกค้า</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#74401E', letterSpacing: '-0.3px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'ไม่ระบุชื่อลูกค้า'}
            </h1>
          </div>
          <button onClick={refresh} disabled={refreshing} aria-label="อัปเดตข้อมูล"
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-3)', cursor: 'pointer', flexShrink: 0, opacity: refreshing ? 0.5 : 1 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ animation: refreshing ? 'm-spin 0.7s linear infinite' : undefined }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7" />
            </svg>
          </button>
        </div>
      </div>

      <PullIndicator pull={pull} refreshing={refreshing} />

      {error && (
        <div style={{ margin: '12px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 12px', color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span>
          <button onClick={refresh} style={{ border: 'none', background: 'transparent', color: 'var(--red)', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>ลองใหม่</button>
        </div>
      )}

      {loading ? (
        <CardSkeleton n={3} />
      ) : (
        <div style={{ padding: '0 12px 16px' }}>
          {/* สรุป */}
          <SummaryTiles tiles={[
            ['จำนวนออเดอร์', `${orders.length}`],
            ['ยอดรวมทั้งหมด', `฿${total.toLocaleString('th-TH')}`],
            ['ออเดอร์ล่าสุด', fmtDate(latest)],
            ...(installs.length > 0 ? [['งานติดตั้ง/วัดหน้างาน', `${installs.length}`] as [string, string]] : []),
            ...(pos.length > 0 ? [['รายการสั่งซื้อ', `${pos.length}`] as [string, string]] : []),
            ...(claims.length > 0 ? [['งานเคลม', `${claims.length}`] as [string, string]] : []),
          ]} />

          {!error && orders.length === 0 && claims.length === 0 && installs.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              ไม่พบประวัติของลูกค้านี้
            </div>
          ) : null}

          {orders.length > 0 && (
            <div ref={listTop} style={{ display: 'flex', flexDirection: 'column', gap: 24, scrollMarginTop: 110 }}>
              {pageCount > 1 && <Pager page={curPage} pageCount={pageCount} onPage={goPage} label={pagerLabel} />}
              {pageOrders.map(o => {
                const ships = Array.isArray(o.shipments) ? o.shipments : []
                const photos = o.packing_photos ?? []
                const focused = !!focusKey && (o.order_number || `id:${o.id}`) === focusKey
                // ป้าย "ออเดอร์ที่ X / N" นับตามวันที่จริงเหมือนหน้าคอม — ไม่ใช้ตำแหน่งหลังดันใบที่กดมาขึ้นก่อน
                const idx = orders.indexOf(o)
                return (
                  <section key={o.id} className="cf-order"
                    style={focused ? { ...orderSectionStyle, outline: '2px solid var(--brand)', outlineOffset: 2 } : orderSectionStyle}>
                    <OrderHeadBar index={orders.length - idx} total={orders.length}
                      title={o.order_number || (o.is_installation ? 'งานติดตั้ง' : 'ไม่มีเลขออเดอร์')}
                      sub={`${fmtDate(o.entry_date)}${o.platform ? ` · ${o.platform}` : ''}`}
                      status={o.order_status ? (o.is_installation && o.order_status === 'จัดส่งแล้ว' ? 'ติดตั้งแล้ว' : o.order_status) : null}
                      price={o.price}
                      right={
                        // แชร์รายการเข้ากลุ่ม LINE ในแตะเดียว — ดูอย่างเดียว ไม่แก้ข้อมูล
                        <button onClick={() => shareOrder(o)} style={shareBtn}>
                          {copiedId === o.id ? 'คัดลอกแล้ว' : 'แชร์'}
                        </button>
                      } />
                    <div style={{ padding: '12px 10px 2px' }}>
                      <OrderDetailBody
                        row={o as unknown as Record<string, unknown>}
                        afterShipping={<>
                          {/* สถานะพัสดุ — กดเลขเปิดหน้าเช็คของขนส่ง */}
                          {ships.length > 0 && (
                            <Card title="สถานะพัสดุ" icon={SHIP_ICON}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {ships.map((s, k) => (
                                  <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13, flexWrap: 'wrap' }}>
                                    <span style={{ color: 'var(--ink-3)', minWidth: 100 }}>{s.carrier || 'ไม่ระบุขนส่ง'}</span>
                                    <a href={carrierTrackUrl(s)} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--brand)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{s.no} ↗</a>
                                    {s.status && /เซ็นรับ|สำเร็จ|ถึงมือ|delivered/i.test(s.status) ? (
                                      <DeliveredPill label={thaiTrackStatus(s.status)} />
                                    ) : s.status ? (
                                      <span className="dn-pill" style={{ minWidth: 0, fontSize: 11.5, padding: '2px 10px', color: '#6B4326', background: '#EFE3D4' }}>{thaiTrackStatus(s.status)}</span>
                                    ) : (
                                      <span style={{ color: 'var(--ink-4)', fontSize: 12.5 }}>ยังไม่เคยเช็คสถานะ</span>
                                    )}
                                    {s.checked_at && <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>เช็คล่าสุด {fmtDateTime(s.checked_at)}</span>}
                                  </div>
                                ))}
                              </div>
                            </Card>
                          )}

                          {/* ภาพการแพ็ค — กดดูเต็มจอในหน้าเดิม · พนักงานที่ล็อกอินด้วยรหัสตัวเองเพิ่ม/ลบได้ */}
                          <Card title={`ภาพการแพ็ค${photos.length ? ` (${photos.length})` : ''}`} icon={CAMERA_ICON}>
                            {photos.length > 0 || staff ? (
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {photos.map(url => (
                                  <div key={url} style={{ position: 'relative' }}>
                                    {/* เปิดแท็บใหม่บนแอป PWA = เด้งออกจากแอป → ดูเต็มจอในหน้าเดิมแทน
                                        ‼️ ไม่มีปุ่ม ✕ ที่มุมรูปแล้ว (user บอกกดโดนง่าย 29ก.ย.69) — ลบได้จากหน้าดูเต็มจอ (ถังขยะแถบล่าง) */}
                                    <button onClick={() => setPhoto({ url, orderId: o.id })} aria-label="ดูรูปเต็ม"
                                      style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0, WebkitTapHighlightColor: 'transparent' }}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt="ภาพการแพ็ค" loading="lazy" decoding="async"
                                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', display: 'block', opacity: busyPhoto === url ? 0.4 : 1 }} />
                                    </button>
                                  </div>
                                ))}
                                {staff && (
                                  <label style={{ width: 80, height: 80, borderRadius: 12, border: '1px dashed var(--border-2)', background: 'var(--cream-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', color: '#8A5C3A' }}>
                                    <span style={{ fontSize: 20, lineHeight: 1 }}>{busyPhoto === o.id ? '…' : '＋'}</span>
                                    <span style={{ fontSize: 11 }}>{busyPhoto === o.id ? 'กำลังอัพ' : 'เพิ่มรูป'}</span>
                                    <input type="file" accept="image/*" disabled={busyPhoto === o.id} style={{ display: 'none' }}
                                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addPhoto(o.id, f) }} />
                                  </label>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64, background: 'var(--cream-2)', borderRadius: 12, color: 'var(--ink-4)', fontSize: 12.5 }}>
                                ยังไม่มีภาพการแพ็คของออเดอร์นี้
                              </div>
                            )}
                            {photoErr && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{photoErr}</div>}
                          </Card>

                          <ScanCredits scans={scans} orderKey={o.order_number || `id:${o.id}`} />
                        </>} />
                    </div>
                  </section>
                )
              })}
              {pageCount > 1 && <Pager page={curPage} pageCount={pageCount} onPage={goPage} label={pagerLabel} />}
            </div>
          )}

          {/* งานติดตั้ง/วัดหน้างานของลูกค้าคนนี้ */}
          {installs.length > 0 && (
            <FolderGroup title="งานติดตั้ง / วัดหน้างาน" icon={ICON_TOOL} count={installs.length}>
              {installs.map(ins => (
                <FolderItem key={ins.id}
                  title={ins.work_type || 'งานติดตั้ง'}
                  tags={[ins.serial_no ? `IN${String(ins.serial_no).replace(/^IN/, '')}` : '', ins.province || '']}
                  sub={ins.appointment_datetime
                    ? `นัด ${fmtDate(ins.appointment_datetime)} ${new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
                    : 'ยังไม่นัดวัน'}
                  status={ins.installation_status} statusColor={INSTALL_STATUS_COLOR[ins.installation_status ?? '']}
                  amount={ins.price != null && ins.price > 0 ? `฿${ins.price.toLocaleString('th-TH')}` : null}
                  body={ins.work_details ? <div style={{ whiteSpace: 'pre-line' }}>{ins.work_details}</div> : null}
                  note={ins.notes} />
              ))}
            </FolderGroup>
          )}

          {/* รายการสั่งซื้อของลูกค้าคนนี้ */}
          {pos.length > 0 && (
            <FolderGroup title="รายการสั่งซื้อ" icon={ICON_CART} count={pos.length}>
              {pos.map(po => (
                <FolderItem key={po.id}
                  title={po.order_number || 'ไม่มีเลขคำสั่งซื้อ'}
                  tags={[po.supplier || '']}
                  sub={fmtDate(po.created_at)}
                  status={po.status} statusColor={PO_STATUS_COLOR[po.status]}
                  body={po.items ? <div style={{ whiteSpace: 'pre-line' }}>{po.items}</div> : null}
                  note={po.notes} />
              ))}
            </FolderGroup>
          )}

          {/* หัวข้อในตามงานที่แท็กออเดอร์ของลูกค้าคนนี้ */}
          {topics.length > 0 && (
            <FolderGroup title="ตามงาน" icon={ICON_CHAT} count={topics.length}>
              {topics.map(t => (
                <Link key={t.id} href={`/board?topic=${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <FolderItem
                    title={t.title}
                    tags={[t.category, t.order_label || (t.order_number ? `#${t.order_number}` : '')]}
                    sub={`${fmtDate(t.created_at)} · โดย ${t.author} · ${t.comment_count} ความคิดเห็น${t.media?.length ? ` · แนบ ${t.media.length} ไฟล์` : ''}`}
                    status={t.status}
                    body={t.body ? <div style={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.body}</div> : null} />
                </Link>
              ))}
            </FolderGroup>
          )}

          {/* งานเคลมของลูกค้าคนนี้ */}
          {claims.length > 0 && (
            <FolderGroup title="งานเคลม" icon={ICON_CLAIM} count={claims.length}>
              {claims.map(c => (
                <FolderItem key={c.id}
                  title={c.claim_type || 'งานเคลม'}
                  tags={[c.channel || '', c.original_order_number ? `#${c.original_order_number}` : '']}
                  sub={`${fmtDate(c.claim_date)}${c.fault ? ` · ความผิด: ${c.fault}` : ''}`}
                  status={c.status} statusColor={CLAIM_STATUS_COLOR[c.status]}
                  amount={c.refund_amount != null && c.money_direction
                    ? <span style={{ color: c.money_direction === 'เก็บลูกค้า' ? '#1F8A3B' : 'var(--red)' }}>{c.money_direction === 'เก็บลูกค้า' ? '+' : '−'}฿{Number(c.refund_amount).toLocaleString('th-TH')} <small style={{ fontWeight: 500, color: 'var(--ink-3)' }}>({c.money_direction})</small></span>
                    : null}
                  body={(c.cause || c.resolution) ? <>
                    {c.cause && <div><span style={{ color: 'var(--ink-3)' }}>สาเหตุ:</span> {c.cause}</div>}
                    {c.resolution && <div><span style={{ color: 'var(--ink-3)' }}>การแก้ไข:</span> {c.resolution}</div>}
                  </> : null}
                  note={c.notes} />
              ))}
            </FolderGroup>
          )}
        </div>
      )}

      {/* ดูรูปแพ็คเต็มจอ — ปุ่ม back ของ Android ปิดได้ (useSheetBack) */}
      {/* ดูรูปเต็มจอ — ถังขยะแถบล่าง เฉพาะพนักงานที่ล็อกอินรหัส · ปุ่ม back ของ Android ปิดได้ (useSheetBack) */}
      {photo && (
        <PhotoViewer url={photo.url} onClose={() => setPhoto(null)} title="ภาพการแพ็ค"
          subtitle={(() => { const o = orders.find(x => x.id === photo.orderId); const ph = o?.packing_photos ?? []; return [o?.order_number || 'ไม่มีเลขออเดอร์', `รูปที่ ${ph.indexOf(photo.url) + 1} / ${ph.length}`].join(' · ') })()}
          onDelete={staff ? () => removePhoto(photo.orderId, photo.url) : undefined}
          deleting={busyPhoto === photo.url} error={photoErr} />
      )}

      {/* กล่องยืนยัน (ลบรูป) — ต้องอยู่ท้ายสุดเพื่อทับรูปเต็มจอ */}
      {confirmDialog}
    </div>
  )
}

// "ใครทำขั้นไหน" ในการ์ดออเดอร์ — 1 บรรทัดต่อขั้น ถ้าขั้นนั้นแบ่งกันทำหลายคนก็ขึ้นชื่อทุกคน
function ScanCredits({ scans, orderKey }: { scans: Scan[]; orderKey: string }) {
  const mine = scans.filter(s => s.order_number === orderKey)
  if (mine.length === 0) return null

  // จัดกลุ่มตามขั้น + กันชื่อซ้ำ (คนเดิมสแกนซ้ำในขั้นเดิมไม่ควรขึ้น 2 ครั้ง)
  // ‼️ ไม่แยกว่าใครเป็นคนเดินสถานะ/คนช่วย (ผู้ใช้สั่ง) — เอาแค่รายชื่อคนที่สแกนขั้นนั้น
  const byStage = new Map<string, string[]>()
  for (const s of mine) {
    const name = (s.tech_name || '').trim()
    if (!name) continue
    const list = byStage.get(s.stage) ?? []
    if (!list.includes(name)) list.push(name)
    byStage.set(s.stage, list)
  }
  if (byStage.size === 0) return null

  const stages = [...byStage.keys()].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a), ib = STAGE_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)   // ขั้นแปลกที่ไม่รู้จักไปท้ายสุด ไม่ทิ้ง
  })

  return (
    <Card title="ผู้สแกนแต่ละขั้น" icon={ICON_SCAN}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {stages.map(st => (
          <div key={st} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.45, padding: '6px 0', borderBottom: '1px solid var(--hairline)' }}>
            <span style={{ color: 'var(--ink-3)', flexShrink: 0, minWidth: 72 }}>{st}</span>
            <span style={{ color: 'var(--ink)' }}>{byStage.get(st)!.join(', ')}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

const ICON_SCAN = 'M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 14.25h.75v.75h-.75zM17.25 14.25h.75v.75h-.75zM19.5 19.5h.75v.75h-.75zM13.5 19.5h.75v.75h-.75zM16.5 16.5h.75v.75h-.75z'
// ปุ่มแชร์บนแถบหัวสีน้ำตาลของออเดอร์
const shareBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#8A5C3A', minHeight: 30,
  display: 'inline-flex', alignItems: 'center', border: 'none',
  borderRadius: 999, padding: '0 12px', background: '#FFF8F0', cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
}
