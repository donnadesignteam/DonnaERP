// Service worker — ให้แอปมือถือ (PWA) เปิดได้ตอนออฟไลน์ + โหลดไฟล์คงที่เร็วขึ้น
// ‼️ ไม่ cache ข้อมูล Supabase ที่นี่ (ข้ามไป ปล่อยเบราว์เซอร์จัดการ) — ข้อมูลออฟไลน์ใช้ localStorage ใน lib/pageCache แทน
//    เลี่ยงปัญหา opaque response + ข้อมูลเก่าค้างไม่ยอมอัปเดต
const CACHE = 'donna-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return   // ข้าม Supabase/ฟอนต์/R2 — ปล่อยเบราว์เซอร์จัดการ

  // หน้าเว็บ (นำทาง): เอาของใหม่จากเน็ตก่อน สำเร็จก็เก็บลง cache · เน็ตล่ม → คืนหน้าที่เคยเปิด (เปิดแอปออฟไลน์ได้)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/m/orders')))
    )
    return
  }

  // ไฟล์คงที่ (JS/CSS/ไอคอน): cache-first แล้วอัปเดตเบื้องหลัง (stale-while-revalidate)
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icon-') || url.pathname === '/donna-logo.jpg') {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          })
          .catch(() => cached)
        return cached || net
      })
    )
  }
})
