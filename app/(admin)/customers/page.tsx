'use client'

import NotifyBell from '@/components/NotifyBell'
import { Suspense, useEffect, useRef, useState } from 'react'
import Pager from '@/components/Pager'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { type RawItem } from '@/lib/itemFormat'
import { deletePackingFile } from '@/lib/packingPhotos'
import { thaiTrackStatus } from '@/lib/trackExtract'
import { useConfirm } from '@/components/ConfirmDialog'
// ‼️ แต่ละออเดอร์ใช้การ์ดชุดเดียวกับป๊อปอัปรายละเอียดออเดอร์ (หน้าภาพรวม) — แก้หน้าตาที่ components/OrderDetailModal.tsx ที่เดียว
import { OrderDetailBody, Card, CAMERA_ICON, DeliveredPill } from '@/components/OrderDetailModal'
import { topicsForOrders } from '@/lib/boardStore'

type Item = RawItem

type StatusEvent = { status: string; at: string; by: string | null }

// เลขพัสดุ + สถานะล่าสุดที่เช็คไว้ (โครงเดียวกับ OrderWorkspace — เก็บใน order_entries.shipments)
type Shipment = {
  no: string
  carrier: string
  status: string
  events: { time: string; desc: string }[] | null
  checked_at: string | null
}

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

type Order = {
  id: string
  entry_date: string | null
  created_at: string | null
  updated_at: string | null
  order_number: string | null
  platform: string | null
  order_status: string | null
  payment_status: string | null
  is_installation: boolean | null
  price: number | null
  items: Item[] | null
  notes: string | null
  status_history: StatusEvent[] | null
  done_at: string | null
  shipped_at: string | null
  packing_photos?: string[] | null   // ภาพตอนแพ็คราง/แพ็คม่าน (อนาคต) — array ของ URL รูป
  shipments?: Shipment[] | null      // เลขพัสดุ + สถานะที่เช็คล่าสุด
  created_by_name?: string | null    // คนลงออเดอร์ (ตั้งครั้งเดียว)
  admin_name?: string | null         // แอดมินหลักคนล่าสุดที่แก้ = เจ้าของโบนัส
  last_content_at?: string | null
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

const SHIP_ICON = 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'

// งานเคลมของลูกค้าคนนี้ (จากหน้างานเคลม — จับคู่ด้วยชื่อ/username เดียวกัน)
type CustomerClaim = {
  id: string
  claim_date: string | null
  channel: string | null
  original_order_number: string | null
  claim_type: string | null
  fault: string | null
  cause: string | null
  resolution: string | null
  refund_amount: number | null
  money_direction: string | null
  status: string
  notes: string | null
}

const CLAIM_STATUS_COLOR: Record<string, string> = {
  'รอของคืน': '#C79A4B', 'ตัดผ้าแล้ว': '#30d158', 'เย็บแล้ว': '#5e9eff',
  'ตรวจสอบแล้ว': '#7B7FA3', 'รีดแล้ว': '#9A7BA0', 'แพ็คแล้ว': '#f43f5e', 'ส่งแล้ว': '#6F8F6A',
}

// งานติดตั้ง/วัดหน้างานของลูกค้าคนนี้ (จากหมวดปฏิทินงานติดตั้ง)
type CustomerInstall = {
  id: string
  serial_no: string
  appointment_datetime: string | null
  work_type: string | null
  province: string | null
  work_details: string | null
  installation_status: string | null
  price: number | null
  notes: string | null
}

const INSTALL_STATUS_COLOR: Record<string, string> = {
  'รอนัดหมาย': '#8e8e93', 'นัดหมายแล้ว': '#5ac8fa',
  'วัดหน้างาน': '#5ac8fa', 'วัดหน้างานแล้ว': '#30b0c7', 'ติดตั้ง': '#C79A4B',
  'ติดตั้งเสร็จ': '#6F8F6A', 'ติดตั้ง50%': '#9A7BA0', 'รอแก้': 'var(--red)',
}

// รายการสั่งซื้อของลูกค้าคนนี้ (จากหมวดสั่งซื้อ)
type CustomerPO = {
  id: string
  order_number: string | null
  items: string | null
  supplier: string | null
  status: string
  notes: string | null
  created_at: string
}

const PO_STATUS_COLOR: Record<string, string> = { 'รอของ': '#C79A4B', 'ของเข้าแล้ว': '#6F8F6A' }

// ออเดอร์เยอะ (ลูกค้าประจำ) → แบ่งหน้า หน้าละ ORDERS_PER_PAGE ใบ ไม่ต้องเลื่อนยาว (user ขอ 15ก.ย.69)
const ORDERS_PER_PAGE = 5


function CustomerFolder() {
  const params = useSearchParams()
  const name = params.get('name') ?? ''
  const [orders, setOrders] = useState<Order[]>([])
  const [claims, setClaims] = useState<CustomerClaim[]>([])
  const [installs, setInstalls] = useState<CustomerInstall[]>([])
  const [pos, setPos] = useState<CustomerPO[]>([])
  // หัวข้อในหมวด "ตามงาน" ที่แท็กออเดอร์ของลูกค้าคนนี้
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof topicsForOrders>>>([])
  const [loading, setLoading] = useState(true)
  const [delPhoto, setDelPhoto] = useState<string | null>(null) // URL รูปแพ็คที่กำลังลบ
  const [page, setPage] = useState(1)
  const listTop = useRef<HTMLDivElement>(null)
  useEffect(() => { setPage(1) }, [name])   // เปิดโฟลเดอร์ลูกค้าคนอื่น = กลับหน้า 1
  // กล่องยืนยันของเว็บเอง (ไม่ใช้ window.confirm — ดูเหตุผลใน components/ConfirmDialog.tsx)
  const { ask, confirmDialog } = useConfirm()

  // ลบรูปแพ็คออกจากออเดอร์: ลบไฟล์ (R2/Supabase ตามที่มา) + เอา URL ออกจาก packing_photos
  async function deletePackingPhoto(orderId: string, url: string) {
    if (!(await ask('ลบรูปนี้ออกจากออเดอร์?', { okText: 'ลบ', danger: true }))) return
    setDelPhoto(url)
    try {
      await deletePackingFile(url)
      const { data: row } = await supabase.from('order_entries').select('packing_photos').eq('id', orderId).single()
      const cur = Array.isArray(row?.packing_photos) ? row.packing_photos : []
      const next = cur.filter((u: string) => u !== url)
      const { error } = await supabase.from('order_entries')
        .update({ packing_photos: next, updated_at: new Date().toISOString() }).eq('id', orderId)
      if (error) throw error
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, packing_photos: (o.packing_photos || []).filter(u => u !== url) } : o))
    } catch (e: any) {
      alert(`ลบรูปไม่สำเร็จ: ${e?.message || e}`)
    }
    setDelPhoto(null)
  }

  useEffect(() => {
    if (!name) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('order_entries')
        // ทุกคอลัมน์ — การ์ด "ข้อมูลออเดอร์" แบบเดียวกับป๊อปอัปต้องใช้ครบ (ลูกค้าคนเดียว ไม่กี่ใบ ไม่หนัก)
        .select('*')
        .eq('customer_name', name)
        .order('entry_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      setOrders((data as Order[]) ?? [])
      const { data: cls } = await supabase
        .from('claims')
        .select('id, claim_date, channel, original_order_number, claim_type, fault, cause, resolution, refund_amount, money_direction, status, notes')
        .eq('customer_username', name)
        .order('claim_date', { ascending: false, nullsFirst: false })
      setClaims((cls as CustomerClaim[]) ?? [])
      const { data: ins } = await supabase
        .from('installations')
        .select('id, serial_no, appointment_datetime, work_type, province, work_details, installation_status, price, notes')
        .or(`customer_real_name.eq.${JSON.stringify(name)},customer_id.eq.${JSON.stringify(name)}`)
        .order('appointment_datetime', { ascending: false, nullsFirst: false })
      setInstalls((ins as CustomerInstall[]) ?? [])
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('id, order_number, items, supplier, status, notes, created_at')
        .eq('customer_name', name)
        .order('created_at', { ascending: false })
      setPos((po as CustomerPO[]) ?? [])
      setTopics(await topicsForOrders(((data as Order[]) ?? []).map(o => o.id)))
      setLoading(false)
    })()
  }, [name])

  const total = orders.reduce((s, o) => s + (o.price ?? 0), 0)
  const pageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE))
  const curPage = Math.min(page, pageCount)
  const pageStart = (curPage - 1) * ORDERS_PER_PAGE
  const pageOrders = orders.slice(pageStart, pageStart + ORDERS_PER_PAGE)
  // เปลี่ยนหน้า → เลื่อนกลับไปหัวรายการ (กดเลขหน้าจากแถบล่างจะได้ไม่ค้างอยู่ท้ายหน้า)
  const goPage = (n: number) => {
    setPage(n)
    requestAnimationFrame(() => listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const latest = orders.find(o => o.entry_date)?.entry_date ?? null

  // การ์ดโทนเดียวกับป๊อปอัปรายละเอียดออเดอร์ (พื้นครีม มุมมน 16 เส้นบาง ไม่มีเงาหนา)
  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
  }

  return (
    <div>
      <Link
        href="/order-entry"
        style={{ color: 'var(--ink-3)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← กลับไปออเดอร์
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <svg width="30" height="30" fill="none" stroke="#8A5C3A" strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>โฟลเดอร์ลูกค้า</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#74401E', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            {name || 'ไม่ระบุชื่อลูกค้า'}
          </h1>
        </div>
        <div style={{ marginLeft: 'auto' }}><NotifyBell /></div>
      </div>

      {/* สรุป */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '18px 0 24px' }}>
        {[
          ['จำนวนออเดอร์', `${orders.length}`],
          ['ยอดรวมทั้งหมด', `฿${total.toLocaleString('th-TH')}`],
          ['ออเดอร์ล่าสุด', fmtDate(latest)],
          ...(installs.length > 0 ? [['งานติดตั้ง/วัดหน้างาน', `${installs.length}`]] : []),
          ...(pos.length > 0 ? [['รายการสั่งซื้อ', `${pos.length}`]] : []),
          ...(claims.length > 0 ? [['งานเคลม', `${claims.length}`]] : []),
        ].map(([label, val]) => (
          <div key={label} style={{ ...card, padding: '14px 18px', minWidth: 150 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: label === 'งานเคลม' ? 'var(--red)' : 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      ) : orders.length === 0 ? (
        <div style={{ ...card, padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          ไม่พบประวัติออเดอร์ของลูกค้านี้
        </div>
      ) : (
        <div ref={listTop} style={{ display: 'flex', flexDirection: 'column', gap: 36, scrollMarginTop: 16 }}>
          <Pager page={curPage} pageCount={pageCount} onPage={goPage} label={`ออเดอร์ที่ ${pageStart + 1} - ${Math.min(pageStart + ORDERS_PER_PAGE, orders.length)} จากทั้งหมด ${orders.length} ใบ`} />
          {pageOrders.map((o, idx) => {
            const i = pageStart + idx   // ลำดับจริงในรายการทั้งหมด (ป้าย "ออเดอร์ที่ X / N" ยังนับต่อเนื่องข้ามหน้า)
            const ships = Array.isArray(o.shipments) ? o.shipments : []
            const photos = o.packing_photos ?? []
            return (
            // แต่ละออเดอร์ = กรอบครีมเหมือนตัวป๊อปอัป · หัวบอกลำดับ/เลขออเดอร์ · ข้างในเป็นการ์ดชุดเดียวกับป๊อปอัป
            // แต่ละออเดอร์ = การ์ดแยกชัด: แถบหัวสีน้ำตาล (ลำดับ · เลขออเดอร์ · วันที่ · สถานะ · ยอด) + ตัวการ์ดครีม · เว้นระยะห่างระหว่างใบ
            <section key={o.id} className="cf-order" style={{ background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 6px 20px rgba(120,86,58,0.10)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 16px', background: 'linear-gradient(90deg, #9E6A49, #B8845F)', color: '#FFF8F0' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, background: '#FFF8F0', color: '#8A5C3A', borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                  ออเดอร์ที่ {orders.length - i}{orders.length > 1 ? ` / ${orders.length}` : ''}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>
                  {o.order_number || (o.is_installation ? 'งานติดตั้ง' : 'ไม่มีเลขออเดอร์')}
                </span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>{fmtDate(o.entry_date)}{o.platform ? ` · ${o.platform}` : ''}</span>
                <span style={{ flex: 1 }} />
                {o.order_status && (
                  <span style={{ fontSize: 11.5, fontWeight: 600, background: 'rgba(255,248,240,0.2)', border: '1px solid rgba(255,248,240,0.35)', borderRadius: 999, padding: '1px 10px', whiteSpace: 'nowrap' }}>
                    {o.is_installation && o.order_status === 'จัดส่งแล้ว' ? 'ติดตั้งแล้ว' : o.order_status}
                  </span>
                )}
                {typeof o.price === 'number' && (
                  <span style={{ fontSize: 14.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>฿{o.price.toLocaleString('th-TH')}</span>
                )}
              </div>
              <div style={{ padding: '16px 18px 4px' }}>

              <OrderDetailBody
                wide
                row={o as unknown as Record<string, unknown>}
                afterShipping={<>
                  {/* สถานะพัสดุ — เฉพาะออเดอร์ที่ใส่เลขพัสดุแล้ว (สถานะ = ที่เช็คล่าสุดจากหน้าออเดอร์) กดเลขเปิดหน้าเช็คของขนส่ง */}
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
                              <span className="dn-pill" style={{ minWidth: 0, fontSize: 11.5, padding: '2px 10px', color: '#6B4326',
                                    background: /เซ็นรับ|สำเร็จ|ถึงมือ|delivered/i.test(s.status) ? '#D5E6C6' : '#EFE3D4' }}>{thaiTrackStatus(s.status)}</span>
                            ) : (
                              <span style={{ color: 'var(--ink-4)', fontSize: 12.5 }}>ยังไม่เคยเช็คสถานะ</span>
                            )}
                            {s.checked_at && <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>เช็คล่าสุด {fmtDateTime(s.checked_at)}</span>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* ภาพการแพ็ค (ราง/ม่าน) — ลบรูปได้จากตรงนี้ */}
                  <Card title={`ภาพการแพ็ค${photos.length ? ` (${photos.length})` : ''}`} icon={CAMERA_ICON}>
                    {photos.length > 0 ? (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {photos.map((url, k) => (
                          <div key={k} style={{ position: 'relative' }}>
                            <a href={url} target="_blank" rel="noreferrer" title="เปิดรูปขนาดเต็ม">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="ภาพการแพ็ค" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', display: 'block', opacity: delPhoto === url ? 0.4 : 1 }} />
                            </a>
                            <button onClick={() => deletePackingPhoto(o.id, url)} disabled={delPhoto !== null} title="ลบรูปนี้"
                              style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--surface)', background: '#B5715A', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {delPhoto === url ? '…' : '✕'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64, background: 'var(--cream-2)', borderRadius: 12, color: 'var(--ink-4)', fontSize: 12.5 }}>
                        ยังไม่มีภาพการแพ็คของออเดอร์นี้
                      </div>
                    )}
                  </Card>
                </>} />
              </div>
            </section>
            )
          })}
          <Pager page={curPage} pageCount={pageCount} onPage={goPage} label={`ออเดอร์ที่ ${pageStart + 1} - ${Math.min(pageStart + ORDERS_PER_PAGE, orders.length)} จากทั้งหมด ${orders.length} ใบ`} />
        </div>
      )}

      {/* งานติดตั้ง/วัดหน้างานของลูกค้าคนนี้ (จากหมวดปฏิทินงานติดตั้ง) — โชว์เฉพาะเมื่อมี */}
      {!loading && installs.length > 0 && (
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

      {/* รายการสั่งซื้อของลูกค้าคนนี้ (จากหมวดสั่งซื้อ) — โชว์เฉพาะเมื่อมี */}
      {!loading && pos.length > 0 && (
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

      {/* หัวข้อในตามงานที่แท็กออเดอร์ของลูกค้าคนนี้ — กดแล้วเปิดหัวข้อนั้น */}
      {!loading && topics.length > 0 && (
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

      {/* งานเคลมของลูกค้าคนนี้ — โชว์เฉพาะเมื่อมี */}
      {!loading && claims.length > 0 && (
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

      {/* กล่องยืนยัน (ลบรูปแพ็ค) — ต้องอยู่ท้ายสุดเพื่อทับทุกโมดัล */}
      {confirmDialog}
    </div>
  )
}

// ── กล่องรายการท้ายโฟลเดอร์ (งานติดตั้ง / สั่งซื้อ / เคลม) — ธีมเดียวกับการ์ดออเดอร์ด้านบน ──
const ICON_TOOL = 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085'
const ICON_CART = 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z'
const ICON_CHAT = 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z'
const ICON_CLAIM = 'M8.25 9.75h4.875a2.625 2.625 0 010 5.25H12M8.25 9.75L10.5 7.5M8.25 9.75L10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z'

function FolderGroup({ title, icon, count, children }: { title: string; icon: string; count: number; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36, background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 22, padding: '16px 18px 18px', boxShadow: '0 6px 20px rgba(120,86,58,0.10)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <svg width="19" height="19" fill="none" stroke="#8A5C3A" strokeWidth="1.6" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#74401E' }}>{title}</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8A6142', background: 'var(--cream)', borderRadius: 999, padding: '2px 10px' }}>{count} รายการ</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 12 }}>
        {children}
      </div>
    </section>
  )
}

function FolderItem({ title, tags, sub, status, statusColor, amount, body, note }: {
  title: string; tags: string[]; sub: string; status?: string | null; statusColor?: string
  amount?: React.ReactNode; body?: React.ReactNode; note?: string | null
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 18px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
            {tags.filter(Boolean).map(t => (
              <span key={t} style={{ fontSize: 11.5, color: '#8A6142', background: 'var(--cream)', borderRadius: 999, padding: '1px 9px' }}>{t}</span>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {status && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#6B4326', background: 'var(--cream)', borderRadius: 999, padding: '3px 11px', whiteSpace: 'nowrap' }}>
              <i style={{ width: 7, height: 7, borderRadius: 999, background: statusColor || 'var(--ink-4)', display: 'inline-block' }} />
              {status}
            </span>
          )}
          {amount && <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{amount}</div>}
        </div>
      </div>
      {body && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontSize: 13, lineHeight: 1.65, color: 'var(--ink-2)' }}>{body}</div>
      )}
      {note && (
        <div style={{ marginTop: 10, background: 'var(--cream-2)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: 'var(--ink-3)' }}>
          <span style={{ fontWeight: 600, color: '#8A6142' }}>หมายเหตุ</span> · {note}
        </div>
      )}
    </div>
  )
}

export default function CustomerFolderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: 'var(--ink-3)' }}>กำลังโหลด…</div>}>
      <CustomerFolder />
    </Suspense>
  )
}
