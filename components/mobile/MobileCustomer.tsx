'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { thaiTrackStatus } from '@/lib/trackExtract'
import { carrierTrackUrl } from '@/lib/carriers'
import { PROD_STATUS_COLOR } from '@/lib/orderTabs'
import { INSTALL_STATUS_COLOR } from '@/lib/shopCalendar'

// โฟลเดอร์ออเดอร์ของลูกค้า เวอร์ชันมือถือ — ดูอย่างเดียว
// เดสก์ท็อป = app/(admin)/customers (มีลบรูปแพ็คได้ด้วย) · ที่นี่ดึงข้อมูลชุดเดียวกันเป๊ะ
type Shipment = { no: string; carrier: string; status: string; checked_at: string | null }
type Order = {
  id: string
  entry_date: string | null
  order_number: string | null
  platform: string | null
  order_status: string | null
  payment_status: string | null
  price: number | null
  items: RawItem[] | null
  notes: string | null
  packing_photos?: string[] | null
  shipments?: Shipment[] | null
}
type Claim = { id: string; claim_date: string | null; claim_type: string | null; cause: string | null; refund_amount: number | null; money_direction: string | null; status: string }
type Install = { id: string; serial_no: string | null; appointment_datetime: string | null; work_type: string | null; work_details: string | null; installation_status: string | null; price: number | null }
type PO = { id: string; order_number: string | null; supplier: string | null; status: string; created_at: string }

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

export default function MobileCustomer() {
  const params = useSearchParams()
  const name = params.get('name') ?? ''
  const [orders, setOrders] = useState<Order[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [installs, setInstalls] = useState<Install[]>([])
  const [pos, setPos] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ไม่มีชื่อใน URL = ไม่มีอะไรให้โหลด ปิดสถานะกำลังโหลดทันที
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!name) { setLoading(false); return }
    ;(async () => {
      setLoading(true)
      // query ชุดเดียวกับหน้าเดสก์ท็อป (app/(admin)/customers) — จับคู่ด้วยชื่อลูกค้าเหมือนกัน
      const { data } = await supabase.from('order_entries')
        .select('id, entry_date, order_number, platform, order_status, payment_status, price, items, notes, packing_photos, shipments')
        .eq('customer_name', name)
        .order('entry_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      setOrders((data as Order[]) ?? [])
      const { data: cls } = await supabase.from('claims')
        .select('id, claim_date, claim_type, cause, refund_amount, money_direction, status')
        .eq('customer_username', name).order('claim_date', { ascending: false, nullsFirst: false })
      setClaims((cls as Claim[]) ?? [])
      const { data: ins } = await supabase.from('installations')
        .select('id, serial_no, appointment_datetime, work_type, work_details, installation_status, price')
        .or(`customer_real_name.eq.${JSON.stringify(name)},customer_id.eq.${JSON.stringify(name)}`)
        .order('appointment_datetime', { ascending: false, nullsFirst: false })
      setInstalls((ins as Install[]) ?? [])
      const { data: po } = await supabase.from('purchase_orders')
        .select('id, order_number, supplier, status, created_at')
        .eq('customer_name', name).order('created_at', { ascending: false })
      setPos((po as PO[]) ?? [])
      setLoading(false)
    })()
  }, [name])

  const total = orders.reduce((s, o) => s + (o.price ?? 0), 0)

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '10px 14px 4px' }}>
          <Link href="/m/orders" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none' }}>← กลับไปออเดอร์</Link>
        </div>
        <div style={{ padding: '2px 14px 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 22 }}>📁</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || 'ไม่ระบุชื่อลูกค้า'}
          </h1>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
      ) : (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* สรุป */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              ['ออเดอร์', `${orders.length}`, 'var(--blue)'],
              ['ยอดรวม', `${total.toLocaleString('th-TH')} ฿`, 'var(--blue)'],
              ...(installs.length ? [['ติดตั้ง', `${installs.length}`, '#ff9f0a']] : []),
              ...(pos.length ? [['สั่งซื้อ', `${pos.length}`, 'var(--blue)']] : []),
              ...(claims.length ? [['งานเคลม', `${claims.length}`, 'var(--red)']] : []),
            ] as [string, string, string][]).map(([label, val, color]) => (
              <div key={label} style={{ flex: '1 1 auto', minWidth: 88, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {orders.length === 0 && claims.length === 0 && installs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              ไม่พบประวัติของลูกค้านี้
            </div>
          ) : null}

          {orders.length > 0 && (
            <section>
              <h2 style={sectionTitle}>ออเดอร์ <span style={countPill}>{orders.length}</span></h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {orders.map(o => {
                  const lines = formatItemLines(o.items)
                  const c = PROD_STATUS_COLOR[o.order_status ?? ''] ?? 'var(--ink-4)'
                  return (
                    <div key={o.id} style={cardBox}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{o.order_number || 'ไม่มีเลขออเดอร์'}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>{fmtDate(o.entry_date)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                        {[o.platform, o.payment_status].filter(Boolean).join(' · ')}
                      </div>
                      {lines.length > 0 && (
                        <div style={{ margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {lines.map((l, i) => (
                            <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, display: 'flex', gap: 6 }}>
                              <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>•</span><span>{l}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {o.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>หมายเหตุ: {o.notes}</div>}

                      {Array.isArray(o.shipments) && o.shipments.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {o.shipments.map((s, i) => (
                            <a key={i} href={carrierTrackUrl(s)} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 9px', background: 'var(--bg)' }}>
                              <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--blue)' }}>{s.no}</span>
                              <span style={{ fontSize: 11, color: /เซ็นรับ|สำเร็จ|ถึงมือ|delivered/i.test(s.status || '') ? 'var(--green)' : 'var(--ink-3)', flexShrink: 0 }}>
                                {s.status ? thaiTrackStatus(s.status) : s.carrier}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}

                      {Array.isArray(o.packing_photos) && o.packing_photos.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
                          {o.packing_photos.map(url => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                              {/* รูปมาจาก R2/Supabase หลายโดเมน — ใช้ img ตรงๆ เหมือนหน้าเดสก์ท็อป ไม่ผ่าน next/image */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="รูปแพ็ค" style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 7, border: '1px solid var(--border)' }} />
                            </a>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: c }}>{o.order_status || '—'}</span>
                        </span>
                        {o.price != null && <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{o.price.toLocaleString('th-TH')} ฿</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {installs.length > 0 && (
            <section>
              <h2 style={sectionTitle}>งานติดตั้ง / วัดหน้างาน <span style={countPill}>{installs.length}</span></h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {installs.map(ins => {
                  const c = INSTALL_STATUS_COLOR[ins.installation_status ?? ''] ?? 'var(--ink-4)'
                  return (
                    <div key={ins.id} style={{ ...cardBox, borderLeft: `3px solid ${c}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{ins.work_type || 'งานติดตั้ง'}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: c, flexShrink: 0 }}>{ins.installation_status || '—'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                        {[ins.serial_no && `#${ins.serial_no}`, ins.appointment_datetime ? fmtDate(ins.appointment_datetime) : 'ยังไม่นัด'].filter(Boolean).join(' · ')}
                      </div>
                      {ins.work_details && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.45 }}>{ins.work_details}</div>}
                      {ins.price != null && ins.price > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 6 }}>{ins.price.toLocaleString('th-TH')} ฿</div>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {claims.length > 0 && (
            <section>
              <h2 style={sectionTitle}>งานเคลม <span style={{ ...countPill, color: 'var(--red)', background: 'var(--red-bg)' }}>{claims.length}</span></h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {claims.map(cl => (
                  <div key={cl.id} style={cardBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{cl.claim_type || 'เคลม'}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>{fmtDate(cl.claim_date)}</span>
                    </div>
                    {cl.cause && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.45 }}>{cl.cause}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{cl.status}</span>
                      {cl.refund_amount != null && (
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: cl.money_direction === 'เก็บลูกค้า' ? 'var(--green)' : 'var(--red)' }}>
                          {cl.money_direction === 'เก็บลูกค้า' ? '+' : '−'}{Number(cl.refund_amount).toLocaleString('th-TH')} ฿
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pos.length > 0 && (
            <section>
              <h2 style={sectionTitle}>รายการสั่งซื้อ <span style={countPill}>{pos.length}</span></h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {pos.map(p => (
                  <div key={p.id} style={cardBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{p.supplier || 'ไม่ระบุร้าน'}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: p.status === 'ของเข้าแล้ว' ? 'var(--green)' : '#ff9f0a', flexShrink: 0 }}>{p.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                      {[p.order_number, fmtDate(p.created_at)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

const cardBox: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
  padding: '11px 12px', boxShadow: 'var(--shadow)',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8,
  display: 'flex', alignItems: 'center', gap: 7,
}
const countPill: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-bg)',
  borderRadius: 10, padding: '1px 8px',
}
