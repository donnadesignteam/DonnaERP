// ชิ้นส่วนหน้าตาโฟลเดอร์ลูกค้า ใช้ร่วมกัน 2 ที่: เดสก์ท็อป app/(admin)/customers + มือถือ components/mobile/MobileCustomer
// ‼️ แก้หน้าตาที่นี่ที่เดียว สองฝั่งจะเหมือนกันเสมอ

export const ICON_TOOL = 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085'
export const ICON_CART = 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z'
export const ICON_CHAT = 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z'
export const ICON_CLAIM = 'M8.25 9.75h4.875a2.625 2.625 0 010 5.25H12M8.25 9.75L10.5 7.5M8.25 9.75L10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z'
export const ICON_FOLDER = 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
export const SHIP_ICON = 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'

export const CLAIM_STATUS_COLOR: Record<string, string> = {
  'รอของคืน': '#C79A4B', 'ตัดผ้าแล้ว': '#30d158', 'เย็บแล้ว': '#5e9eff',
  'ตรวจสอบแล้ว': '#7B7FA3', 'รีดแล้ว': '#9A7BA0', 'แพ็คแล้ว': '#f43f5e', 'ส่งแล้ว': '#6F8F6A',
}
export const PO_STATUS_COLOR: Record<string, string> = { 'รอของ': '#C79A4B', 'ของเข้าแล้ว': '#B08A5A', 'จัดส่งแล้ว': '#6F8F6A' }

// แถบหัวสีน้ำตาลของแต่ละออเดอร์ (ลำดับ · เลขออเดอร์ · วันที่ · สถานะ · ยอด)
export function OrderHeadBar({ index, total, title, sub, status, price, right }: {
  index: number; total: number; title: string; sub: string; status?: string | null; price?: number | null; right?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 16px', background: 'linear-gradient(90deg, #9E6A49, #B8845F)', color: '#FFF8F0' }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, background: '#FFF8F0', color: '#8A5C3A', borderRadius: 999, padding: '2px 10px', whiteSpace: 'nowrap' }}>
        ออเดอร์ที่ {index}{total > 1 ? ` / ${total}` : ''}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</span>
      <span style={{ fontSize: 12, opacity: 0.85 }}>{sub}</span>
      <span style={{ flex: 1 }} />
      {status && (
        <span style={{ fontSize: 11.5, fontWeight: 600, background: 'rgba(255,248,240,0.2)', border: '1px solid rgba(255,248,240,0.35)', borderRadius: 999, padding: '1px 10px', whiteSpace: 'nowrap' }}>
          {status}
        </span>
      )}
      {typeof price === 'number' && (
        <span style={{ fontSize: 14.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>฿{price.toLocaleString('th-TH')}</span>
      )}
      {right}
    </div>
  )
}

// กรอบครีมของแต่ละออเดอร์ (ห่อแถบหัว + การ์ด)
export const orderSectionStyle: React.CSSProperties = {
  background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 6px 20px rgba(120,86,58,0.10)',
}

// การ์ดตัวเลขสรุปบนหัวโฟลเดอร์
export function SummaryTiles({ tiles }: { tiles: [string, string][] }) {
  return (
    <div className="cf-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '18px 0 24px' }}>
      {tiles.map(([label, val]) => (
        <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 18px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: label === 'งานเคลม' ? 'var(--red)' : 'var(--brand)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
        </div>
      ))}
    </div>
  )
}

// ── กล่องรายการท้ายโฟลเดอร์ (งานติดตั้ง / สั่งซื้อ / เคลม) — ธีมเดียวกับการ์ดออเดอร์ด้านบน ──
export function FolderGroup({ title, icon, count, children }: { title: string; icon: string; count: number; children: React.ReactNode }) {
  return (
    <section className="cf-group" style={{ marginTop: 36, background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 22, padding: '16px 18px 18px', boxShadow: '0 6px 20px rgba(120,86,58,0.10)' }}>
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

export function FolderItem({ title, tags, sub, status, statusColor, amount, body, note }: {
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
