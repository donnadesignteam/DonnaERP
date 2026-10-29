import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveTrackToken } from '@/lib/trackLink'
import { itemBlockLines, splitPullItems, pullRuns, type RawItem } from '@/lib/itemFormat'
import { carrierTrackUrl } from '@/lib/carriers'
import { thaiTrackStatus } from '@/lib/trackExtract'
import { PROD_STATUS_COLOR } from '@/lib/orderTabs'
import { ICON_CART, SHIP_ICON } from '@/components/CustomerFolderParts'
import ItemsPager from './ItemsPager'

// หน้าเช็คสถานะออเดอร์สำหรับลูกค้า (27ต.ค.69) — ลิงก์จากเมนู ··· → "ลิงก์เช็คสถานะ" ในหมวดออเดอร์ / ปุ่ม "ส่งลิงก์ลูกค้า" ในแอปมือถือ
// ไม่ต้อง login (proxy.ts ปล่อย /t/) · ดูได้อย่างเดียว ไม่มีปุ่มแก้อะไร · ไม่โชว์ราคา/เบอร์/ที่อยู่
// ลายเซ็นในลิงก์กันเดาออเดอร์คนอื่น (lib/trackLink.ts) · ดึงข้อมูลสดทุกครั้งที่เปิด
// หน้าตา: ธีมเดียวกับโฟลเดอร์ลูกค้าใน ERP · มือถือ = ขั้นตอนแนวตั้ง · คอม (≥860px) = ขั้นตอนแนวนอน การจัดส่ง/รายการสินค้าวางคู่กัน

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'สถานะออเดอร์ — Donna Design', robots: { index: false, follow: false } }

type Ev = { status: string; at: string }
type Shipment = { no: string; carrier: string; status?: string | null; events?: { time: string; desc: string }[] | null }

// ขั้นที่ลูกค้าเห็น — สถานะในร้าน (lib/orderTabs PROD_STATUSES) ยุบเป็นขั้นที่ลูกค้าเข้าใจ
const STEP_OF: Record<string, number> = {
  'รอดำเนินการ': 0,
  'ตัดผ้าแล้ว': 1, 'กำลังตัด': 1,
  'เย็บแล้ว': 2, 'กำลังเย็บ': 2,
  'ตรวจสอบแล้ว': 3, 'รีดแล้ว': 3, 'กำลังรีด': 3,
  'แพ็คแล้ว': 4, 'กำลังแพ็ค': 4, 'รอจัดส่ง': 4, 'งานเสร็จ': 4, 'รอติดตั้ง': 4,
  'จัดส่งแล้ว': 5,
}
const STEPS_SHIP = ['รับออเดอร์แล้ว', 'ตัดผ้า', 'เย็บผ้าม่าน', 'ตรวจสอบและรีด', 'แพ็คสินค้า', 'จัดส่งแล้ว']
const STEPS_INSTALL = ['รับออเดอร์แล้ว', 'ตัดผ้า', 'เย็บผ้าม่าน', 'ตรวจสอบและรีด', 'พร้อมติดตั้ง', 'ติดตั้งเรียบร้อย']

// ‼️ ก๊อปจาก BOX_ICON ใน OrderDetailModal — ไฟล์นั้นเป็น 'use client' import ค่าคงที่ (ไม่ใช่คอมโพเนนต์) มาใช้ในหน้าเซิร์ฟเวอร์ไม่ได้
const BOX_ICON = 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9'

const TZ = 'Asia/Bangkok'
const fmtDT = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return d.toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) + ' น.'
}
// วันที่แบบ YYYY-MM-DD (ไม่มีเวลา) — ประกอบเองกันเลื่อนวันจาก UTC
const fmtDay = (s: string | null) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s || ''
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const id = await resolveTrackToken(token)
  if (!id) notFound()

  const { data: r } = await supabase.from('order_entries')
    .select('id, order_number, serial_no, customer_name, order_status, is_urgent, is_installation, installation_date, install_time, install_status, status_history, shipments, items, created_at, done_at, shipped_at')
    .eq('id', id).maybeSingle()
  if (!r) notFound()

  const install = !!r.is_installation
  const steps = install ? STEPS_INSTALL : STEPS_SHIP
  const cancelled = r.order_status === 'ยกเลิก'
  let cur = STEP_OF[r.order_status ?? ''] ?? 0
  if (r.is_urgent) cur = Math.max(cur, 4)   // ติ๊ก "งานเสร็จ" = ผลิตเสร็จแล้ว
  if (install && r.install_status === 'ติดตั้งแล้ว') cur = 5
  const done = cur >= 5

  // เวลาที่ถึงแต่ละขั้น — จากประวัติสถานะ (ของหน้าสแกน/แก้สถานะ) เอาเวลาแรกที่เข้าขั้นนั้น
  const at: (string | null)[] = steps.map(() => null)
  at[0] = r.created_at
  const hist: Ev[] = Array.isArray(r.status_history) ? r.status_history : []
  for (const e of hist) {
    const i = STEP_OF[e?.status ?? '']
    if (i && i <= cur && !at[i]) at[i] = e.at
  }
  if (!at[4] && cur >= 4 && r.done_at) at[4] = r.done_at
  if (!at[5] && cur >= 5 && r.shipped_at) at[5] = r.shipped_at

  // รายการสินค้า — แบบเดียวกับโฟลเดอร์ออเดอร์ (OrderDetailBody) แต่ไม่มีราคา · ม่านพับ/มู่ลี่ซ้าย+ขวาผ้าเดียวกันรวมกล่องเดียว
  const groups = pullRuns(splitPullItems((Array.isArray(r.items) ? r.items : []) as RawItem[]))
  const shipments: Shipment[] = Array.isArray(r.shipments) ? r.shipments.filter((s: Shipment) => s?.no) : []
  // มีเลขออเดอร์ = โชว์เลข + ชื่อบรรทัดล่าง · ไม่มีเลข = โชว์แค่ชื่อลูกค้า (user 27ต.ค.69)
  const ref = String(r.order_number || '').trim()
  const name = r.customer_name ? String(r.customer_name).replace(/^คุณ\s*/, '') : ''
  const headline = cancelled ? 'ออเดอร์นี้ถูกยกเลิกแล้ว'
    : done ? (install ? 'ติดตั้งเรียบร้อยแล้ว' : 'จัดส่งสินค้าแล้ว')
    : cur === 4 ? (install ? 'ผลิตเสร็จแล้ว รอวันติดตั้ง' : 'ผลิตเสร็จแล้ว รอจัดส่ง')
    : cur === 0 ? 'รับออเดอร์แล้ว' : 'อยู่ในกระบวนการผลิต'
  // ป้ายสถานะบนแถบหัว = ชื่อขั้นที่ลูกค้าเห็น (ไม่ใช่สถานะภายในร้าน เช่น รีดแล้ว → ตรวจสอบและรีด)
  const statusLabel = cancelled ? 'ยกเลิก' : steps[Math.min(cur, 5)]
  const statusColor = cancelled ? 'var(--red)' : PROD_STATUS_COLOR[r.order_status ?? ''] ?? 'var(--yellow)'

  const TkCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <div className="tk-card">
      <div className="tk-card-h">
        <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
        <span>{title}</span>
      </div>
      {children}
    </div>
  )

  return (
    <main className="tk th-erp">
      <style>{CSS}</style>

      <section className="tk-frame">
        <div className="tk-bar">
          <div className="tk-bar-l">
            <div className="tk-bar-row">
              <span className="tk-chip">ออเดอร์</span>
              <span className="tk-title">{ref || (name ? `คุณ${name}` : 'สถานะออเดอร์')}</span>
            </div>
            {ref && name && <div className="tk-subt">คุณ{name}</div>}
          </div>
          <span className="tk-status">{statusLabel}</span>
        </div>

        <div className="tk-body">
          <TkCard title="สถานะการผลิต" icon={BOX_ICON}>
            <div className={`tk-head${cancelled ? ' is-cancel' : done ? ' is-done' : ''}`}>
              <i style={{ background: statusColor }} />
              <b>{headline}</b>
            </div>
            {install && r.installation_date && !cancelled && !done && (
              <div className="tk-appt">นัดติดตั้ง <b>{fmtDay(r.installation_date)}{r.install_time ? ` · ${r.install_time}` : ''}</b></div>
            )}
            {!cancelled && (
              <ol className="tk-steps">
                {steps.map((label, i) => {
                  const state = i < cur || (i === cur && done) ? 'done' : i === cur ? 'now' : 'todo'
                  return (
                    <li key={label} className={state}>
                      <span className="dot">{state === 'done' ? '✓' : i + 1}</span>
                      <div className="txt">
                        <b>{label}</b>
                        {state !== 'todo' && at[i] && <small>{fmtDT(at[i]!)}</small>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </TkCard>

          {(shipments.length > 0 || groups.length > 0) && <div className="tk-grid">
            {shipments.length > 0 && (
              <TkCard title="สถานะพัสดุ" icon={SHIP_ICON}>
                <div className="tk-parcels">
                  {shipments.map(s => {
                    const delivered = !!s.status && /เซ็นรับ|สำเร็จ|ถึงมือ|delivered/i.test(s.status)
                    return (
                      <div key={s.no} className="tk-parcel">
                        <div className="tk-parcel-row">
                          <span className="tk-carrier">{s.carrier || 'ขนส่ง'}</span>
                          <a href={carrierTrackUrl(s)} target="_blank" rel="noreferrer">{s.no} ↗</a>
                          {s.status && <span className={`tk-pill${delivered ? ' ok' : ''}`}>{delivered ? '✓ ' : ''}{thaiTrackStatus(s.status)}</span>}
                        </div>
                        {s.events?.[0]?.desc && (
                          <div className="tk-event">{s.events[0].desc}{s.events[0].time ? ` · ${fmtDT(s.events[0].time)}` : ''}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </TkCard>
            )}

            {groups.length > 0 && (
              <TkCard title={`รายการสินค้า (${groups.length})`} icon={ICON_CART}>
                <ItemsPager items={groups.map((group, i) => {
                    const it = group[0]
                    const qty = group.reduce((a, g) => a + (Number(g.quantity) || 0), 0) || null
                    const blocks = group.map(g => itemBlockLines(g, { hideNote: true }))   // ไม่โชว์หมายเหตุที่แอดมินพิมพ์ (อาจเป็นเรื่องภายใน)
                    const lines = group.length > 1 ? [...blocks[0].slice(0, -1), ...blocks.map(b => b[b.length - 1])] : blocks[0]
                    return (
                      <div key={i} className="tk-item">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          {lines.map((ln, li) => (
                            <div key={li} className={li === 0 ? 'tk-ln0' : ln.rail ? 'tk-ln rail' : 'tk-ln'}>{ln.t}</div>
                          ))}
                          {it.room ? <span className="tk-room">{String(it.room)}</span> : null}
                        </div>
                        <div className="tk-qty">
                          <div className="k">จำนวน</div>
                          <div className="v">{qty ?? '—'}</div>
                          {it.unit ? <div className="u">{String(it.unit)}</div> : null}
                        </div>
                      </div>
                    )
                  })} />
              </TkCard>
            )}
          </div>}
        </div>
      </section>

      <p className="tk-foot">สอบถามเพิ่มเติม ทักไลน์ <b>@donnadesign</b> · ข้อมูล ณ {fmtDT(new Date().toISOString())}</p>
    </main>
  )
}

// หน้าตาธีม ERP (กรอบครีม + แถบหัวน้ำตาล แบบโฟลเดอร์ลูกค้า) · 27ต.ค.69 ลองธีมเว็บร้าน/เว็บคำนวณแล้ว user เลือกกลับมาแบบนี้
// มือถือ = ตัวหนังสือใหญ่ (ค่าหลักด้านล่าง) · คอม = ขนาดเดิมแบบ ERP (ใน @media min-width 860px)ด้านล่าง
const CSS = `
  .tk.th-erp {
    --pg: var(--bg); --font: 'Prompt', -apple-system, sans-serif; --fw: 400;
    --tx: var(--ink); --tx2: var(--ink-2); --mute: var(--ink-3); --faint: var(--ink-4); --line: var(--hairline);
    --acc: var(--brand); --acc-soft: var(--blue-bg); --ok: var(--green);
    --frame-bg: var(--cream-2); --frame-bd: 1px solid var(--border-2); --frame-r: 22px; --frame-sh: 0 6px 20px rgba(120,86,58,.10); --frame-blur: none;
    --bar-bg: linear-gradient(90deg, #9E6A49, #B8845F); --bar-tx: #FFF8F0; --chip-bg: #FFF8F0; --chip-tx: #8A5C3A;
    --st-bg: rgba(255,248,240,.2); --st-bd: 1px solid rgba(255,248,240,.35); --st-tx: #FFF8F0;
    --card-bg: var(--surface); --card-bd: 1px solid var(--border); --card-r: 16px; --card-sh: none; --card-blur: none;
    --card-h: #74401E; --card-ic: #8A5C3A; --card-hw: 700;
    --item-bg: var(--cream-2); --item-r: 12px; --pill-bg: #EFE3D4; --pill-tx: #6B4326; --room-bg: var(--cream);
    --dot-r: 50%; --todo-bg: var(--cream-2); --todo-bd: var(--border-2);
  }
  body { background: var(--bg); }
  .tk { min-height: 100vh; background: var(--pg); color: var(--tx); font-family: var(--font); font-weight: var(--fw); -webkit-font-smoothing: antialiased;
    max-width: none; margin: 0 auto; padding: 12px 12px 0; }
  .tk > section, .tk > p { max-width: 560px; margin-left: auto; margin-right: auto; }
  .tk b, .tk strong { font-weight: 600; }

  .tk-frame { background: var(--frame-bg); border: var(--frame-bd); border-radius: var(--frame-r); box-shadow: var(--frame-sh); overflow: hidden;
    -webkit-backdrop-filter: var(--frame-blur); backdrop-filter: var(--frame-blur); }
  .tk-bar { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--bar-bg); color: var(--bar-tx); }
  .tk-bar-l { flex: 1; min-width: 0; }
  .tk-bar-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tk-chip { flex: none; font-size: 12.5px; font-weight: 600; background: var(--chip-bg); color: var(--chip-tx); border-radius: 999px; padding: 3px 12px; white-space: nowrap; }
  .tk-title { min-width: 0; font-size: 17px; font-weight: 700; letter-spacing: -.2px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tk-subt { font-size: 14px; opacity: .8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tk-status { flex: none; font-size: 13px; font-weight: 600; background: var(--st-bg); border: var(--st-bd); color: var(--st-tx); border-radius: 999px; padding: 5px 13px; white-space: nowrap; }
  .tk-body { padding: 16px 14px 14px; }

  .tk-card { background: var(--card-bg); border: var(--card-bd); border-radius: var(--card-r); box-shadow: var(--card-sh); padding: 18px 18px 20px; margin-bottom: 14px;
    -webkit-backdrop-filter: var(--card-blur); backdrop-filter: var(--card-blur); }
  .tk-body > :last-child, .tk-grid > :last-child { margin-bottom: 0; }
  .tk-card-h { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--card-ic); }
  .tk-card-h span { font-size: 15px; font-weight: var(--card-hw); color: var(--card-h); }

  .tk-head { display: flex; align-items: center; gap: 10px; font-size: 22px; color: var(--acc); }
  .tk-head.is-done { color: var(--ok); } .tk-head.is-cancel { color: #C0392B; }
  .tk-head i { width: 11px; height: 11px; border-radius: 50%; flex: none; background: currentColor; }
  .tk-head b { font-weight: 700; }
  .tk-appt { margin-top: 10px; background: var(--item-bg); border-radius: var(--item-r); padding: 11px 14px; font-size: 15px; color: var(--tx2); }

  .tk-steps { list-style: none; margin: 18px 0 0; padding: 18px 0 0; border-top: 1px solid var(--line); }
  .tk-steps li { position: relative; display: flex; gap: 14px; padding-bottom: 24px; }
  .tk-steps li:last-child { padding-bottom: 0; }
  .tk-steps li:not(:last-child)::before { content: ''; position: absolute; left: 16px; top: 38px; bottom: 2px; width: 2px; background: var(--todo-bd); }
  .tk-steps li.done:not(:last-child)::before { background: var(--acc); opacity: .45; }
  .tk-steps .dot { flex: none; width: 34px; height: 34px; border-radius: var(--dot-r); display: grid; place-items: center; font-size: 14px; font-weight: 600; background: var(--todo-bg); color: var(--faint); border: 1px solid var(--todo-bd); }
  .tk-steps li.done .dot { background: var(--acc); border-color: var(--acc); color: #fff; }
  .tk-steps li.now .dot { background: #fff; border: 2px solid var(--acc); color: var(--acc); box-shadow: 0 0 0 4px var(--acc-soft); }
  .tk-steps .txt { min-width: 0; padding-top: 5px; }
  .tk-steps b { display: block; font-size: 16px; color: var(--tx); }
  .tk-steps li.todo b { color: var(--faint); font-weight: 400; }
  .tk-steps li.now b { color: var(--acc); }
  .tk-steps small { display: block; font-size: 13px; color: var(--mute); margin-top: 3px; }

  .tk-parcels { display: flex; flex-direction: column; gap: 12px; }
  .tk-parcel-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; font-size: 14px; }
  .tk-carrier { color: var(--mute); min-width: 90px; }
  .tk-parcel a { font-weight: 600; color: var(--acc); text-decoration: none; font-variant-numeric: tabular-nums; }
  .tk-pill { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; background: var(--pill-bg); color: var(--pill-tx); }
  .tk-pill.ok { background: #E3F3E0; color: #1F8A3B; }
  .tk-event { font-size: 13px; color: var(--mute); margin-top: 4px; line-height: 1.5; }

  .tk-items { display: flex; flex-direction: column; gap: 6px; }
  .tk-items > .tk-off { display: none; }
  .tk-pager { margin-top: 12px; }
  .tk-item { display: flex; align-items: flex-start; gap: 16px; background: var(--item-bg); border-radius: var(--item-r); padding: 12px 16px; }
  .tk-ln0 { font-size: 16px; font-weight: 700; color: var(--tx); line-height: 1.5; word-break: break-word; }
  .tk-ln { font-size: 14.5px; color: var(--tx2); line-height: 1.5; word-break: break-word; }
  .tk-ln.rail { color: var(--acc); }
  .tk-room { display: inline-block; font-size: 13px; padding: 3px 12px; margin-top: 6px; border-radius: 999px; color: var(--tx2); background: var(--room-bg); }
  .tk-qty { flex-shrink: 0; min-width: 64px; text-align: right; color: var(--tx); }
  .tk-qty .k { font-size: 13px; color: var(--mute); }
  .tk-qty .v { font-size: 18px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .tk-qty .u { font-size: 12.5px; color: var(--faint); }

  .tk-foot { text-align: center; font-size: 13.5px; color: var(--mute); margin-top: 10px; margin-bottom: 0; padding-bottom: calc(6px + env(safe-area-inset-bottom)); }
  .tk-foot b { color: var(--acc); }

  /* คอม: เต็มจอ ขั้นตอนเรียงแนวนอน · สถานะพัสดุกับรายการสินค้าวางคู่กัน */
  @media (min-width: 860px) {
    .tk { padding: 24px 32px 0; }
    .tk > section, .tk > p { max-width: none; }
    .tk-bar { padding: 14px 22px; }
    .tk-body { padding: 20px; }
    .tk-card { padding: 22px 24px; }
    .tk-appt { display: inline-block; }
    .tk-steps { display: grid; grid-template-columns: repeat(6, 1fr); padding-top: 22px; }
    .tk-steps li { flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 0 4px; }
    .tk-steps li:not(:last-child)::before { left: calc(50% + 22px); right: calc(-50% + 22px); top: 16px; bottom: auto; width: auto; height: 2px; }
    .tk-steps .txt { padding-top: 0; }
    .tk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
    .tk-grid > * { margin-bottom: 0; }
    .tk-grid > :only-child { grid-column: 1 / -1; }
    .tk-bar { padding: 12px 20px; }
    .tk-chip { font-size: 11.5px; padding: 2px 10px; }
    .tk-title { font-size: 16px; }
    .tk-subt { font-size: 12.5px; margin-top: 3px; }
    .tk-status { font-size: 11.5px; padding: 3px 11px; }
    .tk-card { padding: 14px 18px 16px; }
    .tk-head { font-size: 20px; gap: 8px; }
    .tk-head i { width: 9px; height: 9px; }
    .tk-appt { font-size: 13px; padding: 8px 12px; }
    .tk-steps .dot { width: 26px; height: 26px; font-size: 12px; }
    .tk-steps li:not(:last-child)::before { left: calc(50% + 17px); right: calc(-50% + 17px); top: 12px; }
    .tk-steps b { font-size: 13.5px; }
    .tk-steps small { font-size: 11.5px; margin-top: 1px; }
    .tk-parcel-row { font-size: 13px; }
    .tk-event { font-size: 12.5px; }
    .tk-item { padding: 8px 14px; gap: 14px; }
    .tk-ln0 { font-size: 14.5px; } .tk-ln { font-size: 13px; }
    .tk-room { font-size: 11.5px; padding: 2px 10px; }
    .tk-qty .k { font-size: 11.5px; } .tk-qty .v { font-size: 15px; } .tk-qty .u { font-size: 11px; }
    .tk-foot { font-size: 12px; }
  }
`
