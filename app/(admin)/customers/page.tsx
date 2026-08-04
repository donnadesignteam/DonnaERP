'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { itemBlockLines, type RawItem } from '@/lib/itemFormat'
import { deletePackingFile } from '@/lib/packingPhotos'
import { thaiTrackStatus } from '@/lib/trackExtract'
import OrderHistory from '@/components/OrderHistory'

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

// format รายการใช้ formatter กลาง (lib/itemFormat) ให้ตรงกับใบคัดลอก/ปริ้นเสมอ
const itemLines = itemBlockLines

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
  'รอของคืน': '#ff9f0a', 'ตัดผ้าแล้ว': '#30d158', 'เย็บแล้ว': '#5e9eff',
  'ตรวจสอบแล้ว': '#6366f1', 'รีดแล้ว': '#bf5af2', 'แพ็คแล้ว': '#f43f5e', 'ส่งแล้ว': '#34c759',
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
  'วัดหน้างาน': '#5ac8fa', 'วัดหน้างานแล้ว': '#30b0c7', 'ติดตั้ง': '#ff9f0a',
  'ติดตั้งเสร็จ': '#34c759', 'ติดตั้ง50%': '#bf5af2', 'รอแก้': 'var(--red)',
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

const PO_STATUS_COLOR: Record<string, string> = { 'รอของ': '#ff9f0a', 'ของเข้าแล้ว': '#34c759' }

function CustomerFolder() {
  const params = useSearchParams()
  const name = params.get('name') ?? ''
  const [orders, setOrders] = useState<Order[]>([])
  const [claims, setClaims] = useState<CustomerClaim[]>([])
  const [installs, setInstalls] = useState<CustomerInstall[]>([])
  const [pos, setPos] = useState<CustomerPO[]>([])
  const [loading, setLoading] = useState(true)
  const [delPhoto, setDelPhoto] = useState<string | null>(null) // URL รูปแพ็คที่กำลังลบ

  // ลบรูปแพ็คออกจากออเดอร์: ลบไฟล์ (R2/Supabase ตามที่มา) + เอา URL ออกจาก packing_photos
  async function deletePackingPhoto(orderId: string, url: string) {
    if (!window.confirm('ลบรูปนี้ออกจากออเดอร์?')) return
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
        .select('id, entry_date, created_at, updated_at, order_number, platform, order_status, payment_status, is_installation, price, items, notes, status_history, done_at, shipped_at, packing_photos, shipments, created_by_name, admin_name, last_content_at')
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

  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <Link
        href="/order-entry"
        style={{ color: 'var(--ink-3)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← กลับไปออเดอร์
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 30 }}>📁</span>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>
          {name || 'ไม่ระบุชื่อลูกค้า'}
        </h1>
      </div>

      {/* สรุป */}
      <div style={{ display: 'flex', gap: 12, margin: '18px 0 24px', flexWrap: 'wrap' }}>
        {[
          ['จำนวนออเดอร์', `${orders.length}`],
          ['ยอดรวมทั้งหมด', `${total.toLocaleString('th-TH')} ฿`],
          ['ออเดอร์ล่าสุด', fmtDate(latest)],
          ...(installs.length > 0 ? [['งานติดตั้ง/วัดหน้างาน', `${installs.length}`]] : []),
          ...(pos.length > 0 ? [['รายการสั่งซื้อ', `${pos.length}`]] : []),
          ...(claims.length > 0 ? [['งานเคลม', `${claims.length}`]] : []),
        ].map(([label, val]) => (
          <div key={label} style={{ ...card, padding: '14px 18px', minWidth: 150 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: label === 'งานเคลม' ? 'var(--red)' : 'var(--blue)' }}>{val}</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map((o, i) => {
            const history = Array.isArray(o.status_history) ? o.status_history : []
            return (
            <div key={o.id} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)' }}>#{orders.length - i}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                      {o.order_number || (o.is_installation ? 'งานติดตั้ง' : 'ไม่มีเลขออเดอร์')}
                    </span>
                    {o.platform && (
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 8px' }}>
                        {o.platform}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{fmtDate(o.entry_date)}</div>
                  {/* ใครลงออเดอร์ / แอดมินคนล่าสุดที่แก้ (= เจ้าของโบนัส) */}
                  <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
                    ลงโดย <strong style={{ color: 'var(--ink-3)' }}>{o.created_by_name || '—'}</strong>
                    {' · '}แอดมินล่าสุด <strong style={{ color: o.admin_name ? 'var(--blue)' : 'var(--ink-4)' }}>{o.admin_name || '—'}</strong>
                    {o.last_content_at && ` (${fmtDate(o.last_content_at)})`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {o.price != null && (
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{o.price.toLocaleString('th-TH')} ฿</div>
                  )}
                  {o.order_status && (
                    <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, marginTop: 2 }}>{o.order_status}</div>
                  )}
                </div>
              </div>

              {Array.isArray(o.items) && o.items.length > 0 && (
                <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {o.items.map((it, j) => (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {itemLines(it).map((ln, k) => (
                        <div key={k} style={{ fontSize: 13, lineHeight: 1.5, fontWeight: k === 0 ? 600 : 400, color: ln.rail ? 'var(--red)' : k === 0 ? 'var(--ink)' : 'var(--ink-2)' }}>{ln.t}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* ไทม์ไลน์สถานะ — สถานะไหน เกิดวันไหน ใครทำ */}
              <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 8 }}>ประวัติสถานะ</div>
                {history.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {history.map((h, k) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: k === history.length - 1 ? 'var(--blue)' : 'var(--border-2)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 90 }}>{h.status}</span>
                        <span style={{ color: 'var(--ink-3)' }}>{fmtDateTime(h.at)}</span>
                        <span style={{ color: 'var(--ink-4)' }}>· โดย {h.by || '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                    {o.order_status ? <>สถานะปัจจุบัน: <strong style={{ color: 'var(--ink-3)' }}>{o.order_status}</strong> — ยังไม่มีประวัติย้อนหลัง (เริ่มบันทึกเมื่อมีการเปลี่ยนสถานะครั้งถัดไป)</> : 'ยังไม่มีประวัติสถานะ'}
                  </div>
                )}
                {/* ใครทำอะไรกับออเดอร์ใบนี้บ้าง (กดเปิดดู) */}
                <OrderHistory orderId={o.id} />
              </div>

              {/* สถานะพัสดุ — โชว์เฉพาะออเดอร์ที่ใส่เลขพัสดุแล้ว (สถานะ = ที่เช็คล่าสุดจากหน้าออเดอร์) */}
              {Array.isArray(o.shipments) && o.shipments.length > 0 && (
                <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 8 }}>สถานะพัสดุ</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {o.shipments.map((s, k) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--ink-3)' }}>📦 {s.carrier || 'ไม่ระบุขนส่ง'}</span>
                        <a href={carrierTrackUrl(s)} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--blue)', textDecoration: 'none' }}>{s.no} ↗</a>
                        {s.status ? (
                          <span style={{ fontWeight: 700, color: /เซ็นรับ|สำเร็จ|ถึงมือ|delivered/i.test(s.status) ? 'var(--green)' : 'var(--ink)' }}>{thaiTrackStatus(s.status)}</span>
                        ) : (
                          <span style={{ color: 'var(--ink-4)' }}>ยังไม่เคยเช็คสถานะ</span>
                        )}
                        {s.checked_at && (
                          <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                            เช็คล่าสุด {fmtDateTime(s.checked_at)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ภาพการแพ็ค (ราง/ม่าน) — ช่องไว้ก่อน รองรับเก็บรูปในอนาคต */}
              <div style={{ margin: '12px 0 0', padding: '12px 0 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', marginBottom: 8 }}>ภาพการแพ็ค (ราง/ม่าน)</div>
                {o.packing_photos && o.packing_photos.length > 0 ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {o.packing_photos.map((url, k) => (
                      <div key={k} style={{ position: 'relative' }}>
                        <a href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="ภาพการแพ็ค" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block', opacity: delPhoto === url ? 0.4 : 1 }} />
                        </a>
                        <button onClick={() => deletePackingPhoto(o.id, url)} disabled={delPhoto !== null} title="ลบรูปนี้"
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.92)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                          {delPhoto === url ? '…' : '✕'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72, border: '1.5px dashed var(--border-2)', borderRadius: 8, color: 'var(--ink-4)', fontSize: 12, gap: 6 }}>
                    📷 ยังไม่มีภาพการแพ็ค — ช่องเก็บภาพในอนาคต
                  </div>
                )}
              </div>

              {o.notes && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, fontStyle: 'italic' }}>📝 {o.notes}</div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* งานติดตั้ง/วัดหน้างานของลูกค้าคนนี้ (จากหมวดปฏิทินงานติดตั้ง) — โชว์เฉพาะเมื่อมี */}
      {!loading && installs.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>งานติดตั้ง / วัดหน้างาน</h2>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ff9f0a', background: '#ff9f0a15', border: '1px solid #ff9f0a33', borderRadius: 12, padding: '2px 10px' }}>{installs.length} รายการ</span>
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>รายการสั่งซื้อ</h2>
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>งานเคลม</h2>
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
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: c.money_direction === 'เก็บลูกค้า' ? '#34c759' : 'var(--red)' }}>
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
