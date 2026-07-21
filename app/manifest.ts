import type { MetadataRoute } from 'next'

// แอปเดียวรวมทุกเครื่องมือ — เปิดแล้วเข้าหน้า /hub เลือก ERP / สแกนงาน / อุปกรณ์ราง
// (เดิมแยกเป็น 2 แอป: manifest นี้ = Donna Admin + public/scan-app.webmanifest = สแกนงาน)
// ‼️ proxy.ts ต้องยกเว้น manifest.webmanifest จาก auth ไม่งั้นเบราว์เซอร์โหลด manifest ไม่ได้ → ชื่อ/ไอคอนแอปไม่ขึ้นบน Android
export default function manifest(): MetadataRoute.Manifest {
  // handle_links / launch_handler เป็นสเปก W3C ที่เบราว์เซอร์รองรับ แต่ type ของ Next ยังไม่มี → cast ผ่าน
  return {
    name: 'Donna Design',
    short_name: 'Donna Design',
    description: 'ระบบร้าน Donna Design — ออเดอร์ / สแกนงาน / อุปกรณ์ราง',
    start_url: '/hub',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#C47E3A',
    // ‼️ ให้ Android/Chrome ส่งลิงก์ในสโคป (เช่นลิงก์โฟลเดอร์ลูกค้าที่แชร์เข้า LINE) เข้าแอปที่ติดตั้งไว้แทนเบราว์เซอร์
    //    แอปที่ติดตั้ง = login ไว้แล้ว จึงเปิดโฟลเดอร์ได้เลยไม่เด้งหน้า login · navigate-existing = ถ้าแอปเปิดอยู่ให้ใช้หน้าต่างเดิม
    //    (iOS ไม่รองรับ handle_links — เป็นข้อจำกัดของตัว OS)
    handle_links: 'preferred',
    launch_handler: { client_mode: ['navigate-existing', 'auto'] },
    // ‼️ ไอคอน hub = โลโก้แบรนด์ (icon-hub-*) ไม่ใช่ icon-192/512 ที่เป็นธีม QR ของแอปสแกน
    //    maskable ต้องมีแยก + เว้น safe zone ไม่งั้น Android ครอปตัวหนังสือ DESIGN ทิ้ง
    icons: [
      { src: '/icon-hub-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-hub-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-hub-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  } as MetadataRoute.Manifest
}
