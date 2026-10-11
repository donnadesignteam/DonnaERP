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
import PhotoViewer from '@/components/PhotoViewer'
import { FolderGroup, FolderItem, OrderHeadBar, SummaryTiles, orderSectionStyle, ICON_TOOL, ICON_CART, ICON_CHAT, ICON_CLAIM, ICON_FOLDER, SHIP_ICON, CLAIM_STATUS_COLOR, PO_STATUS_COLOR } from '@/components/CustomerFolderParts'

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
  // รูปที่เปิดดูเต็มจอ — ลบได้จากในนั้นเท่านั้น (ปุ่ม ✕ มุมรูปกดโดนง่าย user ขอเอาออก 29ก.ย.69)
  const [view, setView] = useState<{ url: string; orderId: string } | null>(null)
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
      setView(null)
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
          <path strokeLinecap="round" strokeLinejoin="round" d={ICON_FOLDER} />
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
      <SummaryTiles tiles={[
        ['จำนวนออเดอร์', `${orders.length}`],
        ['ยอดรวมทั้งหมด', `฿${total.toLocaleString('th-TH')}`],
        ['ออเดอร์ล่าสุด', fmtDate(latest)],
        ...(installs.length > 0 ? [['งานติดตั้ง/วัดหน้างาน', `${installs.length}`] as [string, string]] : []),
        ...(pos.length > 0 ? [['รายการสั่งซื้อ', `${pos.length}`] as [string, string]] : []),
        ...(claims.length > 0 ? [['งานเคลม', `${claims.length}`] as [string, string]] : []),
      ]} />

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
            <section key={o.id} className="cf-order" style={orderSectionStyle}>
              <OrderHeadBar index={orders.length - i} total={orders.length}
                title={o.order_number || (o.is_installation ? 'งานติดตั้ง' : 'ไม่มีเลขออเดอร์')}
                sub={`${fmtDate(o.entry_date)}${o.platform ? ` · ${o.platform}` : ''}`}
                status={o.order_status ? (o.is_installation && o.order_status === 'จัดส่งแล้ว' ? 'ติดตั้งแล้ว' : o.order_status) : null}
                price={o.price} />
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

                  {/* ภาพการแพ็ค (ราง/ม่าน) — คลิกรูปเปิดเต็มจอ ลบได้จากในนั้น (ถังขยะแถบล่าง) */}
                  <Card title={`ภาพการแพ็ค${photos.length ? ` (${photos.length})` : ''}`} icon={CAMERA_ICON}>
                    {photos.length > 0 ? (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {photos.map((url, k) => (
                          <button key={k} onClick={() => setView({ url, orderId: o.id })} title="ดูรูปเต็ม / ลบ"
                            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="ภาพการแพ็ค" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', display: 'block', opacity: delPhoto === url ? 0.4 : 1 }} />
                          </button>
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

      {view && (
        <PhotoViewer url={view.url} onClose={() => setView(null)} title="ภาพการแพ็ค"
          subtitle={(() => { const o = orders.find(x => x.id === view.orderId); const ph = o?.packing_photos ?? []; return [o?.order_number || 'ไม่มีเลขออเดอร์', `รูปที่ ${ph.indexOf(view.url) + 1} / ${ph.length}`].join(' · ') })()}
          onDelete={() => deletePackingPhoto(view.orderId, view.url)} deleting={delPhoto === view.url} />
      )}

      {/* กล่องยืนยัน (ลบรูปแพ็ค) — ต้องอยู่ท้ายสุดเพื่อทับทุกโมดัล */}
      {confirmDialog}
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
