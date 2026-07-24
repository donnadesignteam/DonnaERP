import type { MetadataRoute } from 'next'

// แอปเดียวรวมทุกเครื่องมือ — เปิดแล้วเข้าหน้า /hub เลือก ERP / สแกนงาน / อุปกรณ์ราง
// (เดิมแยกเป็น 2 แอป: manifest นี้ = Donna Admin + public/scan-app.webmanifest = สแกนงาน)
// ‼️ proxy.ts ต้องยกเว้น manifest.webmanifest จาก auth ไม่งั้นเบราว์เซอร์โหลด manifest ไม่ได้ → ชื่อ/ไอคอนแอปไม่ขึ้นบน Android
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Donna Design',
    short_name: 'Donna Design',
    description: 'ระบบร้าน Donna Design — ออเดอร์ / สแกนงาน / อุปกรณ์ราง',
    start_url: '/hub',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#C47E3A',
    // ‼️ user สั่งกลับมาใช้รูปโลโก้เดิม (donna-logo.jpg) — icon-hub-*.png ที่เคยทำให้
    //    มีเส้นขาวของกรอบโลโก้ขึ้นบนไอคอน อย่าเสนอเปลี่ยนกลับ
    //    (icon-192/512.png ในโฟลเดอร์ public เป็นธีม QR ของแอปสแกน ห้ามเอามาใช้กับ hub)
    icons: [
      {
        src: '/donna-logo.jpg',
        sizes: 'any',
        type: 'image/jpeg',
        purpose: 'any',
      },
    ],
  }
}
