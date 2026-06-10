'use client'

export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.5px' }}>ตั้งค่า</h1>
      <p style={{ color: 'var(--ink-3)', marginBottom: 32, fontSize: 14 }}>ข้อมูลบัญชีที่เข้าใช้งาน</p>

      <div style={{ maxWidth: 380 }}>
        {/* Account info */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--ink)' }}>บัญชีที่เข้าใช้งาน</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--blue)22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Donna Design Admin</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>ระบบจัดการหลังบ้าน</div>
            </div>
          </div>
          <button style={{ marginTop: 20, width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #ff375f', background: '#fff', color: 'var(--red)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            🚪 Logout
          </button>
        </div>
      </div>
    </div>
  )
}
