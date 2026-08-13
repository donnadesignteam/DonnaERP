'use client'

// อัปเดตแอปให้เป็นเวอร์ชันล่าสุด — ล้างไฟล์เก่าที่ค้างในเครื่องแล้วโหลดใหม่
// ‼️ ต้องล้าง cache + service worker ก่อน reload ไม่งั้น PWA หยิบไฟล์เดิมมาใช้ต่อ (เจอกับแอดมินที่ค้างเวอร์ชันเก่าหลายวัน)
// ใช้ทั้งในแถบแจ้งอัปเดต (components/UpdateBanner.tsx) และปุ่ม "อัปเดตแอป" ในแอปมือถือ
export async function forceUpdate() {
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
