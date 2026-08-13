'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { readStaffSession } from '@/lib/staffSession'

// แถบ "มีอัปเดตใหม่" — แก้ปัญหาแอดมินบางคนยังรันโค้ดเก่าค้างอยู่หลายวัน
// (เปิดแท็บ/แอปทิ้งไว้ไม่เคยรีเฟรช หรือ PWA ยังใช้ไฟล์เก่าใน cache)
// วิธีทำงาน: จำเวอร์ชันตอนเปิดหน้าไว้ แล้วถามซ้ำเป็นระยะ + ทุกครั้งที่สลับกลับมาที่แท็บ
// ถ้าเวอร์ชันบนเซิร์ฟเวอร์เปลี่ยน = มี deploy ใหม่ → ขึ้นแถบให้กดอัปเดต (ล้าง cache + service worker แล้วโหลดใหม่)
const CHECK_MS = 5 * 60 * 1000

const fetchVersion = async (): Promise<string | null> => {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.version === 'string' ? data.version : null
  } catch {
    return null   // เน็ตหลุด/ออฟไลน์ — ไม่ต้องรบกวน ค่อยเช็กรอบหน้า
  }
}

// รหัสประจำเบราว์เซอร์เครื่องนี้ — ไว้ให้หน้าตั้งค่ารู้ว่าเครื่องไหนใช้เวอร์ชันอะไร (1 เครื่อง = 1 แถว)
const CLIENT_ID_KEY = 'donna_client_id'
const clientId = (): string => {
  let id = localStorage.getItem(CLIENT_ID_KEY)
  if (!id) {
    id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2)) as string
    localStorage.setItem(CLIENT_ID_KEY, id)
  }
  return id
}

// บันทึกว่าเครื่องนี้/คนนี้กำลังรันเวอร์ชันอะไร (ตาราง client_versions — ต้องรัน sql/add_client_versions.sql ก่อน)
// เขียนไม่ได้ก็ไม่เป็นไร ปล่อยเงียบ ไม่ให้กระทบการใช้งาน
const reportVersion = async (version: string) => {
  try {
    const s = readStaffSession()
    await supabase.from('client_versions').upsert({
      client_id: clientId(),
      staff_code: s?.code ?? null,
      staff_name: s?.nickname ?? null,
      version,
      user_agent: navigator.userAgent.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
  } catch { /* ไม่มีตาราง/ออฟไลน์ — ข้ามไป */ }
}

export default function UpdateBanner() {
  const [stale, setStale] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let current: string | null = null
    let stopped = false

    const check = async () => {
      const v = await fetchVersion()
      if (stopped || !v) return
      if (current === null) {
        current = v
        reportVersion(v)          // เวอร์ชันที่หน้านี้โหลดมา = เวอร์ชันที่เครื่องนี้ใช้อยู่จริง
      } else if (v !== current) {
        setStale(true)
        reportVersion(current)    // ย้ำว่ายังค้างของเก่า (เวลาอัปเดตล่าสุดจะได้ขยับ)
      }
    }

    check()
    const timer = setInterval(check, CHECK_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  const update = async () => {
    setUpdating(true)
    // ล้างของเก่าให้หมดก่อนโหลดใหม่ ไม่งั้น PWA หยิบไฟล์เดิมใน cache มาใช้ต่อ
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
    } catch { /* ล้างไม่ได้ก็ยังโหลดใหม่ให้ */ }
    location.reload()
  }

  if (!stale) return null

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 3000,
      background: 'var(--ink, #1f2937)', color: '#fff',
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      fontSize: 14, boxShadow: '0 -2px 12px rgba(0,0,0,0.18)',
    }}>
      <span>มีอัปเดตใหม่ของระบบ — กดอัปเดตเพื่อใช้เวอร์ชันล่าสุด</span>
      <button onClick={update} disabled={updating}
        style={{
          border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 14, fontWeight: 700,
          background: updating ? 'rgba(255,255,255,0.35)' : '#fff', color: '#1f2937',
          cursor: updating ? 'default' : 'pointer', whiteSpace: 'nowrap',
        }}>
        {updating ? 'กำลังอัปเดต…' : 'อัปเดต'}
      </button>
    </div>
  )
}
