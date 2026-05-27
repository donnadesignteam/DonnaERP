'use client'

import { useState, useEffect } from 'react'

const SunIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4"/><path strokeLinecap="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
)

export default function TopBar() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme') === 'dark'
    setDark(saved)
    if (saved) document.documentElement.classList.add('dark')
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <div style={{
      height: 52,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 36px',
      gap: 8,
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={dark ? 'สลับเป็น Light mode' : 'สลับเป็น Dark mode'}
        style={{
          width: 34, height: 34,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--ink-3)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default' }}>
        <div style={{
          width: 30, height: 30,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 12, fontWeight: 700,
          boxShadow: '0 1px 4px rgba(79,70,229,0.4)',
          flexShrink: 0,
        }}>
          D
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', userSelect: 'none' }}>แอดมิน</span>
      </div>
    </div>
  )
}
