'use client'

// ส่วน "รายงานและข้อมูล" ของหน้าวิเคราะห์ — การ์ดตัวเลข / กราฟแนวโน้ม / โดนัทแพลตฟอร์ม /
// สถานะออเดอร์ / สินค้ายอดนิยม / ออเดอร์ล่าสุด / สรุปภาพรวม
// แยกไฟล์ออกมาเพื่อให้ page.tsx ไม่ยาวเกินอ่าน — ใช้ข้อมูลชุดเดียวกับหน้าวิเคราะห์

import Link from 'next/link'
import { PlatformIcon } from '@/components/BrandMark'

export type ReportOrder = {
  id: string
  order_number: string
  order_status: string
  created_at: string
  shipped_at: string | null
  price: number | null
  platform: string | null
  is_installation: boolean
  customer_name?: string | null
  items?: { type?: string; quantity?: number | string }[] | null
}

const fmtBaht = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' ฿'
const fmtNum = (n: number) => n.toLocaleString('th-TH')

// ── การ์ดตัวเลขหลัก ──
// ❗ ไม่มีเส้นกราฟเล็กๆ ในการ์ดแล้ว — user สั่งเอากราฟออก เอาเฉพาะตัวเลขที่อ่านแล้วใช้งานได้จริง
export function KpiCard({ label, value, unit, delta, icon }: {
  label: string; value: string; unit?: string
  delta: number | null            // % เทียบเดือนก่อน (null = ไม่มีข้อมูลเทียบ)
  icon: React.ReactNode
}) {
  const up = (delta ?? 0) >= 0
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 20, boxShadow: '0 4px 16px rgba(120,86,58,0.10)', padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--cream)', color: 'var(--brand)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums' }}>
          {value}{unit && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginLeft: 4 }}>{unit}</span>}
        </div>
      </div>
      <div style={{ fontSize: 11.5, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {delta == null
          ? <span style={{ color: 'var(--ink-4)' }}>รวมทุก<br />เดือน</span>
          : <>
              <div style={{ color: up ? '#1F8A3B' : '#C0563F', fontWeight: 700, fontSize: 13 }}>{up ? '↑' : '↓'} {up ? '+' : ''}{delta.toFixed(1)}%</div>
              <div style={{ color: 'var(--ink-4)' }}>จากเดือนก่อน</div>
            </>}
      </div>
    </div>
  )
}

// ── ตารางตัวเลขรายเดือน (แทนกราฟแท่ง — อ่านค่าได้ตรงๆ) ──
export function MonthTable({ rows, unit }: { rows: { label: string; value: number | null }[]; unit: string }) {
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 2px', borderTop: i ? '1px solid var(--hairline)' : 'none', fontSize: 12.5 }}>
          <span style={{ color: 'var(--ink-2)' }}>{r.label}</span>
          <span style={{ fontWeight: 700, color: r.value == null ? 'var(--ink-4)' : 'var(--ink)' }}>
            {r.value == null ? '—' : `${r.value.toLocaleString('th-TH')} ${unit}`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── โดนัทสัดส่วนยอดขายตามแพลตฟอร์ม ──
export function Donut({ parts, total }: { parts: { label: string; value: number; color: string }[]; total: number }) {
  const R = 74, SW = 26, C = 2 * Math.PI * R
  // คิดจุดเริ่มของแต่ละชิ้นแบบไม่แก้ตัวแปรระหว่าง render (React 19 ห้าม — ดู eslint react-hooks)
  const fracs = parts.map(p => (total > 0 ? p.value / total : 0))
  const segs = parts.map((p, i) => ({
    ...p,
    frac: fracs[i],
    offset: fracs.slice(0, i).reduce((t, f) => t + f, 0),
  }))
  return (
    <svg viewBox="0 0 180 180" style={{ width: 180, height: 180, flexShrink: 0 }}>
      <g transform="translate(90,90) rotate(-90)">
        <circle r={R} fill="none" stroke="var(--cream-2)" strokeWidth={SW} />
        {segs.map((sg, i) => (
          <circle key={i} r={R} fill="none" stroke={sg.color} strokeWidth={SW}
            strokeDasharray={`${(sg.frac * C).toFixed(2)} ${(C - sg.frac * C).toFixed(2)}`}
            strokeDashoffset={(-sg.offset * C).toFixed(2)} />
        ))}
      </g>
      <text x="90" y="82" textAnchor="middle" fontSize="10.5" fill="var(--ink-3)">รวมทั้งหมด</text>
      {/* ❗ โชว์เลขเต็ม ไม่ย่อเป็น M — จะได้อ่านเทียบกับตัวเลขในรายการข้างๆ ได้ตรงๆ */}
      <text x="90" y="101" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--ink)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {total.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
      </text>
      <text x="90" y="115" textAnchor="middle" fontSize="10" fill="var(--ink-3)">บาท</text>
    </svg>
  )
}

// ── ป้ายสถานะออเดอร์ ──
export function StatusTile({ label, count, pct, bg, active, icon }: {
  label: string; count: number; pct?: string; bg: string; active?: boolean; icon: React.ReactNode
}) {
  return (
    <div style={{
      flex: '1 1 110px', minWidth: 110, borderRadius: 16, padding: '12px 10px 10px', textAlign: 'center',
      background: active ? 'var(--brand)' : bg, color: active ? '#FFF8F0' : 'var(--ink)',
      border: active ? 'none' : '1px solid var(--hairline)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, opacity: active ? 0.95 : 0.75 }}>{icon}</div>
      <div style={{ fontSize: 11.5, fontWeight: 500, opacity: active ? 0.9 : 0.75 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>{fmtNum(count)}</div>
      {pct && <div style={{ fontSize: 10.5, opacity: 0.65 }}>({pct})</div>}
    </div>
  )
}

// ── สินค้ายอดนิยม ──
export function TopProducts({ rows, total }: { rows: { name: string; count: number }[]; total: number }) {
  const max = Math.max(...rows.map(r => r.count), 1)
  if (!rows.length) return <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ยังไม่มีรายการสินค้าในช่วงนี้</p>
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
          <span style={{ width: 15, fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>{i + 1}</span>
          {/* ❗ ชื่อกว้างตามข้อความ แล้วให้แถบกินที่ว่างที่เหลือ — ไม่งั้นจะมีช่องว่างกลางกว้างๆ */}
          <span style={{ flexShrink: 0, maxWidth: 190, fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
          <span style={{ flex: 1, minWidth: 40, height: 8, background: 'var(--cream-2)', borderRadius: 999, overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${Math.max(4, (r.count / max) * 100)}%`, height: '100%', background: 'var(--brand-soft)', borderRadius: 999 }} />
          </span>
          <span style={{ width: 52, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{r.count.toLocaleString('th-TH')}</span>
          <span style={{ width: 44, textAlign: 'right', fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {total ? `${((r.count / total) * 100).toFixed(1)}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── ออเดอร์ล่าสุด ──
export function RecentOrders({ rows, pill }: { rows: ReportOrder[]; pill: (st: string) => { bg: string; ink: string } }) {
  if (!rows.length) return <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ยังไม่มีออเดอร์ในช่วงนี้</p>
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['วันที่สั่งซื้อ', 'เลขที่ออเดอร์', 'ชื่อลูกค้า', 'แพลตฟอร์ม', 'ยอดรวม', 'สถานะ'].map((h, i) => (
                <th key={h} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '6px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(o => {
              const p = pill(o.order_status)
              return (
                <tr key={o.id} style={{ borderTop: '1px solid var(--hairline)' }}>
                  <td style={{ padding: '9px 10px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                    {new Date(o.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '9px 10px', color: 'var(--ink-2)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.order_number || '-'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer_name || '-'}</td>
                  <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <PlatformIcon name={o.is_installation ? null : o.platform} size={16} />
                      {o.is_installation ? 'งานติดตั้ง' : (o.platform || '-')}
                    </span>
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{o.price != null ? fmtBaht(o.price) : '-'}</td>
                  <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ background: p.bg, color: p.ink, borderRadius: 999, padding: '3px 12px', fontSize: 11.5, fontWeight: 600 }}>{o.order_status || '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Link href="/order-entry" style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>
        ดูออเดอร์ทั้งหมด →
      </Link>
    </>
  )
}

// ── ผลงานพนักงาน: การ์ดคนละใบ โชว์เฉพาะขั้นที่ทำจริง ──
// ❗ เดิมเป็นตารางกว้างเต็มหน้าจอ ช่องส่วนใหญ่เป็น "-" อ่านยาก
export function TechCards({ techs, cols }: {
  techs: { name: string; rec: Record<string, number>; total: number }[]
  cols: { status: string; label: string; color: string }[]
}) {
  if (!techs.length) return <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ไม่มีข้อมูล</p>
  const top = Math.max(...techs.map(t => t.total), 1)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
      {techs.map(t => {
        const done = cols.filter(c => t.rec[c.status])
        return (
          <div key={t.name} style={{ background: 'var(--cream-2)', border: '1px solid var(--hairline)', borderRadius: 16, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--brand)', whiteSpace: 'nowrap' }}>{t.total.toLocaleString('th-TH')}</span>
            </div>
            <div style={{ height: 5, background: 'var(--surface)', borderRadius: 999, overflow: 'hidden', margin: '7px 0 9px' }}>
              <div style={{ width: `${Math.max(4, (t.total / top) * 100)}%`, height: '100%', background: 'var(--brand-soft)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {done.map(c => (
                <span key={c.status} title={`${c.label} ${t.rec[c.status].toLocaleString('th-TH')} งาน`}
                  style={{ fontSize: 10.5, borderRadius: 999, padding: '2px 9px', background: 'var(--surface)',
                    border: '1px solid var(--hairline)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                  {c.label} <b style={{ color: 'var(--ink)' }}>{t.rec[c.status].toLocaleString('th-TH')}</b>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── รายการอันดับแบบอ่านง่าย (ลำดับ + ชื่อ + ค่า + หมายเหตุ) ──
// ❗ ไม่ใช้แท่ง — ค่าต่างกันมาก (1 วัน vs 33 นาที) แท่งจะเห็นอันเดียวยาวที่เหลือจิ๋มเดียว
export function RankList({ rows }: { rows: { name: string; value: string; note?: string; tag?: string }[] }) {
  if (!rows.length) return <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ยังไม่มีข้อมูล</p>
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
          borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
          <span style={{ width: 20, height: 20, borderRadius: 7, background: 'var(--cream)', color: '#8A6142', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.name}
            {r.tag && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: '#B5581F', background: '#FBEAD7', borderRadius: 999, padding: '1px 7px' }}>{r.tag}</span>}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
          {r.note && <span style={{ width: 62, textAlign: 'right', fontSize: 11, color: 'var(--ink-4)', flexShrink: 0, whiteSpace: 'nowrap' }}>{r.note}</span>}
        </div>
      ))}
    </div>
  )
}

// ── การ์ดตัวเลขเล็กๆ เรียงติดกัน (ใช้กับปริมาณงานรายเดือน) ──
export function MiniStats({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(it => (
        <div key={it.label} style={{ flex: '1 1 90px', minWidth: 90, background: 'var(--cream-2)', border: '1px solid var(--hairline)',
          borderRadius: 14, padding: '9px 11px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{it.label}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }}>{it.value}</div>
          {it.sub && <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{it.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ── ผลงานผลิต แยกตามแผนก — ดูง่ายกว่าแยกตามคน เพราะคนหนึ่งทำแค่ 1-2 ขั้น ──
export function DeptCards({ depts }: {
  depts: { label: string; color: string; total: number; people: { name: string; n: number }[] }[]
}) {
  const shown = depts.filter(d => d.total > 0)
  if (!shown.length) return <p style={{ color: 'var(--ink-3)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>ไม่มีข้อมูล</p>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
      {shown.map(d => {
        const top = d.people[0]?.n ?? 1
        return (
          <div key={d.label} style={{ background: 'var(--cream-2)', border: '1px solid var(--hairline)', borderRadius: 16, padding: '13px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                <i style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: 'inline-block' }} />
                {d.label}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{d.total.toLocaleString('th-TH')}</span>
            </div>
            {d.people.slice(0, 5).map(pp => (
              <div key={pp.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pp.name}</span>
                <span style={{ width: 54, height: 6, background: 'var(--surface)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
                  <span style={{ display: 'block', width: `${Math.max(6, (pp.n / top) * 100)}%`, height: '100%', background: d.color, borderRadius: 999, opacity: 0.85 }} />
                </span>
                <span style={{ width: 44, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--ink)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{pp.n.toLocaleString('th-TH')}</span>
              </div>
            ))}
            {d.people.length > 5 && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>+ อีก {d.people.length - 5} คน</div>}
          </div>
        )
      })}
    </div>
  )
}
