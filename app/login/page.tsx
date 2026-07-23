'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Mode = 'shop' | 'staff'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/dashboard'

  // ?staff=1 (ปุ่มในหน้า hub ส่งมา) = เปิดมาที่โหมดพนักงานเลย
  const [mode, setMode] = useState<Mode>(params.get('staff') === '1' ? 'staff' : 'shop')
  const [user, setUser] = useState('')
  const [code, setCode] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (m: Mode) => { setMode(m); setError(''); setPass('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'staff' ? { mode: 'staff', code, pass } : { user, pass }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        // เข้าด้วยรหัสพนักงานจากหน้าเปล่าๆ → พาไปแดชบอร์ดของตัวเองเลย
        router.replace(mode === 'staff' && from === '/dashboard' ? '/m/me' : from)
      } else {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ')
      }
    } catch {
      setError('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const staff = mode === 'staff'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1E1208 0%, #2E1C0E 100%)',
        padding: 20,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#FFFFFF',
          borderRadius: 14,
          padding: '36px 32px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/donna-logo.jpg"
            alt="Donna"
            style={{ width: 60, height: 60, borderRadius: 14, objectFit: 'cover', marginBottom: 14 }}
          />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1008' }}>Donna ERP</h1>
          <p style={{ fontSize: 13, color: '#7A6A58', marginTop: 4 }}>เข้าสู่ระบบเพื่อใช้งาน</p>
        </div>

        {/* สลับโหมด: รหัสรวมของร้าน (เหมือนเดิม) หรือ รหัสพนักงานรายคน */}
        <div style={{ display: 'flex', gap: 6, background: '#F4EFE8', borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {([['shop', 'รหัสร้าน'], ['staff', 'พนักงาน']] as [Mode, string][]).map(([m, label]) => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: mode === m ? 700 : 500,
                background: mode === m ? '#FFFFFF' : 'transparent',
                color: mode === m ? '#9D6025' : '#7A6A58',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>{staff ? 'รหัสพนักงาน' : 'ชื่อผู้ใช้'}</label>
        <input
          value={staff ? code : user}
          onChange={(e) => (staff ? setCode(e.target.value) : setUser(e.target.value))}
          autoFocus
          autoComplete="username"
          autoCapitalize="characters"
          placeholder={staff ? 'เช่น DN015' : ''}
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 14 }}>รหัสผ่าน</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          inputMode={staff ? 'numeric' : undefined}
          placeholder={staff ? 'วันและเดือนที่เริ่มงาน' : ''}
          style={inputStyle}
        />
        {staff && (
          <p style={{ fontSize: 11.5, color: '#8A7A66', marginTop: 6, lineHeight: 1.5 }}>
            รหัสผ่าน = วันและเดือนที่เริ่มงาน เช่น เริ่ม 31 มี.ค. → <b style={{ color: '#5A4A38' }}>313</b>
          </p>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              color: '#DC2626',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 22,
            width: '100%',
            padding: '11px 0',
            borderRadius: 9,
            border: 'none',
            background: loading ? '#B8915F' : 'linear-gradient(135deg, #C47E3A, #9D6025)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#3D2E1E',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #D9D2C8',
  borderRadius: 9,
  fontSize: 16, // 16px = Safari บนมือถือไม่ซูมเองตอนโฟกัส
  outline: 'none',
  color: '#1A1008',
  background: '#FFFFFF',
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
