// ยังไม่ได้ทำหน้ามือถือของปฏิทิน (เฟส 3) — กันกดจากแถบเมนูแล้วเจอ 404
export default function Page() {
  return (
    <div style={{ minHeight: '60dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 34 }}>🚧</div>
      <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>ปฏิทินร้าน</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>ยังทำหน้าสำหรับมือถือไม่เสร็จ<br/>ตอนนี้ดูได้ที่คอมก่อนนะคะ</p>
    </div>
  )
}
