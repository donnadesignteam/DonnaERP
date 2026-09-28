// แถบบอกว่า "กำลังอ่านไฟล์" ตอนดรอปไฟล์แล้วต้องรอ (อ่าน PDF + AI แปลงใช้เวลา 10-40 วิ) — กันคนคิดว่าเว็บค้าง
export default function ReadingNotice({ text, sub }: { text: string; sub?: string }) {
  return (
    <div role="status" aria-live="polite"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 14, borderRadius: 14,
        background: 'var(--cream-2)', border: '1px solid var(--border-2)', color: 'var(--ink)' }}>
      <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 999, border: '2.5px solid var(--brand-soft)', borderTopColor: 'var(--brand)', animation: 'm-spin 0.8s linear infinite' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, animation: 'm-pulse 1.6s ease-in-out infinite' }}>{text}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}
