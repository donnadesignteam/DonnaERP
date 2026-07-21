'use client'

import { useEffect } from 'react'

// ลงทะเบียน service worker (public/sw.js) ให้แอปเปิดออฟไลน์ได้ + โหลดไฟล์คงที่เร็วขึ้น
// ‼️ ข้าม localhost — กัน cache ค้างกวน dev/HMR ตอนแก้โค้ด
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return
    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }
    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])
  return null
}
