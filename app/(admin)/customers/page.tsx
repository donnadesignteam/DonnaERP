'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { type RawItem } from '@/lib/itemFormat'
import { deletePackingFile } from '@/lib/packingPhotos'
import { thaiTrackStatus } from '@/lib/trackExtract'
import { useConfirm } from '@/components/ConfirmDialog'
// ‼️ แต่ละออเดอร์ใช้การ์ดชุดเดียวกับป๊อปอัปรายละเอียดออเดอร์ (หน้าภาพรวม) — แก้หน้าตาที่ components/OrderDetailModal.tsx ที่เดียว
import { OrderDetailBody, Card, CAMERA_ICON, DeliveredPill } from '@/components/OrderDetailModal'

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

function CustomerFolder() {
  const params = useSearchParams()
  const name = params.get('name') ?? ''
  const [orders, setOrders] = useState<Order[]>([])
  const [claims, setClaims] = useState<CustomerClaim[]>([])
  const [installs, setInstalls] = useState<CustomerInstall[]>([])
  const [pos, setPos] = useState<CustomerPO[]>([])
  const [loading, setLoading] = useState(true)
  const [delPhoto, setDelPhoto] = useState<string | null>(null) // URL รูปแพ็คที่กำลังลบ
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
      setLoading(false)
    })()
  }, [name])

  const total = orders.reduce((s, o) => s + (o.price ?? 0), 0)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {orders.map((o, i) => {
            const ships = Array.isArray(o.shipments) ? o.shipments : []
            const photos = o.packing_photos ?? []
            return (
            // แต่ละออเดอร์ = กรอบครีมเหมือนตัวป๊อปอัป · หัวบอกลำดับ/เลขออเดอร์ · ข้างในเป็นการ์ดชุดเดียวกับป๊อปอัป
            // แต่ละออเดอร์ = การ์ดแยกชัด: แถบหัวสีน้ำตาล (ลำดับ · เลขออเดอร์ · วันที่ · สถานะ · ยอด) + ตัวการ์ดครีม · เว้นระยะห่างระหว่างใบ
            <section key={o.id} className="cf-order" style={{ background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 6px 20px rgba(120,86,58,0.10)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 20px', background: 'linear-gradient(90deg, #9E6A49, #B8845F)', color: '#FFF8F0' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, background: '#FFF8F0', color: '#8A5C3A', borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>
                  ออเดอร์ที่ {orders.length - i}{orders.length > 1 ? ` / ${orders.length}` : ''}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px' }}>
                  {o.order_number || (o.is_installation ? 'งานติดตั้ง' : 'ไม่มีเลขออเดอร์')}
                </span>
                <span style={{ fontSize: 13, opacity: 0.85 }}>{fmtDate(o.entry_date)}{o.platform ? ` · ${o.platform}` : ''}</span>
                <span style={{ flex: 1 }} />
                {o.order_status && (
                  <span style={{ fontSize: 12.5, fontWeight: 600, background: 'rgba(255,248,240,0.2)', border: '1px solid rgba(255,248,240,0.35)', borderRadius: 999, padding: '3px 12px', whiteSpace: 'nowrap' }}>
                    {o.is_installation && o.order_status === 'จัดส่งแล้ว' ? 'ติดตั้งแล้ว' : o.order_status}
                  </span>
                )}
                {typeof o.price === 'number' && (
                  <span style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>฿{o.price.toLocaleString('th-TH')}</span>
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
        </div>
      )}

      {/* งานติดตั้ง/วัดหน้างานของลูกค้าคนนี้ (จากหมวดปฏิทินงานติดตั้ง) — โชว์เฉพาะเมื่อมี */}
      {!loading && installs.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#74401E' }}>งานติดตั้ง / วัดหน้างาน</h2>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#C79A4B', background: '#C79A4B15', border: '1px solid #C79A4B33', borderRadius: 12, padding: '2px 10px' }}>{installs.length} รายการ</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {installs.map(ins => {
              const sc = INSTALL_STATUS_COLOR[ins.installation_status ?? ''] ?? 'var(--ink-3)'
              return (
                <div key={ins.id} style={{ ...card, padding: '16px 18px', borderLeft: `4px solid ${sc}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)' }}>#{ins.serial_no}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{ins.work_type || 'งานติดตั้ง'}</span>
                        {ins.province && (
                          <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px' }}>{ins.province}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                        {ins.appointment_datetime
                          ? <>นัด {fmtDate(ins.appointment_datetime)} {new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</>
                          : 'ยังไม่นัดวัน'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {ins.installation_status && (
                        <span style={{ background: sc + '22', color: sc, padding: '3px 10px', borderRadius: 980, fontSize: 11, fontWeight: 700 }}>{ins.installation_status}</span>
                      )}
                      {ins.price != null && ins.price > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: 'var(--ink)' }}>{ins.price.toLocaleString('th-TH')} ฿</div>
                      )}
                    </div>
                  </div>
                  {ins.work_details && (
                    <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{ins.work_details}</div>
                  )}
                  {ins.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, fontStyle: 'italic' }}>📝 {ins.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* รายการสั่งซื้อของลูกค้าคนนี้ (จากหมวดสั่งซื้อ) — โชว์เฉพาะเมื่อมี */}
      {!loading && pos.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#74401E' }}>รายการสั่งซื้อ</h2>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', background: 'rgba(196,126,58,0.10)', border: '1px solid rgba(196,126,58,0.25)', borderRadius: 12, padding: '2px 10px' }}>{pos.length} รายการ</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pos.map(p => {
              const sc = PO_STATUS_COLOR[p.status] ?? 'var(--ink-3)'
              return (
                <div key={p.id} style={{ ...card, padding: '16px 18px', borderLeft: `4px solid ${sc}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.order_number || 'ไม่มีเลขคำสั่งซื้อ'}</span>
                        {p.supplier && (
                          <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px' }}>{p.supplier}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{fmtDate(p.created_at)}</div>
                    </div>
                    <span style={{ background: sc + '22', color: sc, padding: '3px 10px', borderRadius: 980, fontSize: 11, fontWeight: 700 }}>{p.status}</span>
                  </div>
                  {p.items && (
                    <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{p.items}</div>
                  )}
                  {p.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, fontStyle: 'italic' }}>📝 {p.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* งานเคลมของลูกค้าคนนี้ — โชว์เฉพาะเมื่อมี */}
      {!loading && claims.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#74401E' }}>งานเคลม</h2>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', background: '#ff375f15', border: '1px solid #ff375f33', borderRadius: 12, padding: '2px 10px' }}>{claims.length} รายการ</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {claims.map(c => {
              const sc = CLAIM_STATUS_COLOR[c.status] ?? 'var(--ink-3)'
              return (
                <div key={c.id} style={{ ...card, padding: '16px 18px', borderLeft: `4px solid ${sc}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.claim_type || 'งานเคลม'}</span>
                        {c.channel && (
                          <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px' }}>{c.channel}</span>
                        )}
                        {c.original_order_number && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>#{c.original_order_number}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{fmtDate(c.claim_date)}{c.fault ? ` · ความผิด: ${c.fault}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ background: sc + '22', color: sc, padding: '3px 10px', borderRadius: 980, fontSize: 11, fontWeight: 700 }}>{c.status}</span>
                      {c.refund_amount != null && c.money_direction && (
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: c.money_direction === 'เก็บลูกค้า' ? '#6F8F6A' : 'var(--red)' }}>
                          {c.money_direction === 'เก็บลูกค้า' ? '+' : '−'}{Number(c.refund_amount).toLocaleString('th-TH')} ฿ ({c.money_direction})
                        </div>
                      )}
                    </div>
                  </div>
                  {(c.cause || c.resolution) && (
                    <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6 }}>
                      {c.cause && <div><span style={{ color: 'var(--ink-4)' }}>สาเหตุ:</span> {c.cause}</div>}
                      {c.resolution && <div><span style={{ color: 'var(--ink-4)' }}>การแก้ไข:</span> {c.resolution}</div>}
                    </div>
                  )}
                  {c.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, fontStyle: 'italic' }}>📝 {c.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
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
