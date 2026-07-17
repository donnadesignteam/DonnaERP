import type { NextConfig } from "next";
import path from "path";

// เว็บอุปกรณ์ราง (โปรเจกต์ donna-rail) เสิร์ฟผ่านโดเมนเดียวกับ ERP ที่ /rail
// → อยู่ใน scope ของ PWA "Donna Design" กดจาก hub แล้วไม่เด้งออกเบราว์เซอร์
// ‼️ โค้ดยังอยู่ที่ repo donna-rail เหมือนเดิม (แก้ที่นั่น deploy ที่นั่น) ที่นี่แค่ proxy ต่อ — ไม่ก๊อปมาไว้ 2 ที่
const RAIL = process.env.NEXT_PUBLIC_RAIL_URL || 'https://donna-rail.vercel.app'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      { source: '/rail', destination: `${RAIL}/` },
      { source: '/rail/:path*', destination: `${RAIL}/:path*` },
      // หน้า rail เรียก API 2 ตัวนี้แบบ absolute (/api/...) — ต้อง proxy ให้ด้วย ไม่งั้น autocomplete + autofill ตายเงียบ
      // เช็กแล้วไม่ชนกับ API ของ ERP (donnaweb ไม่มี route ชื่อ suggest/order)
      { source: '/api/suggest', destination: `${RAIL}/api/suggest` },
      { source: '/api/order', destination: `${RAIL}/api/order` },
    ]
  },
};

export default nextConfig;
