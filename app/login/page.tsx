'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/dashboard'

  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        router.replace(from)
      } else {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ')
      }
    } catch {
      setError('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

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
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/donna-logo.jpg"
            alt="Donna"
            style={{ width: 60, height: 60, borderRadius: 14, objectFit: 'cover', marginBottom: 14 }}
          />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1008' }}>Donna ERP</h1>
          <p style={{ fontSize: 13, color: '#7A6A58', marginTop: 4 }}>เข้าสู่ระบบเพื่อใช้งาน</p>
        </div>

        <label style={labelStyle}>ชื่อผู้ใช้</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoFocus
          autoComplete="username"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 14 }}>รหัสผ่าน</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          style={inputStyle}
        />

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
  fontSize: 14,
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
