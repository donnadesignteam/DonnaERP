import type { NextConfig } from "next";
import path from "path";

// เว็บอุปกรณ์ราง (โปรเจกต์ donna-rail) เสิร์ฟผ่านโดเมนเดียวกับ ERP ที่ /rail
// → อยู่ใน scope ของ PWA "Donna Design" กดจาก hub แล้วไม่เด้งออกเบราว์เซอร์
// ‼️ โค้ดยังอยู่ที่ repo donna-rail เหมือนเดิม (แก้ที่นั่น deploy ที่นั่น) ที่นี่แค่ proxy ต่อ — ไม่ก๊อปมาไว้ 2 ที่
const RAIL = process.env.NEXT_PUBLIC_RAIL_URL || 'https://donna-rail.vercel.app'

// เว็บคำนวณราคาม่าน (repo prawattana/curtaincalculator.github.io-main บน GitHub Pages) — แนวเดียวกับ /rail
// ‼️ โค้ดอยู่ที่ repo เดิม แก้ที่นั่น deploy ที่นั่น ที่นี่แค่ proxy ต่อ
const CALC = process.env.NEXT_PUBLIC_CALC_URL || 'https://prawattana.github.io/curtaincalculator.github.io-main'

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
      // คำนวณราคาม่าน — ทุกไฟล์ที่หน้านั้นเรียก (styles.css / script.js / *.json) อ้างแบบสัมพัทธ์
      // จึงวิ่งมาที่ /calc/… แล้ว proxy ต่อไป GitHub Pages ทั้งก้อน
      { source: '/calc/:path*', destination: `${CALC}/:path*` },
    ]
  },
};

export default nextConfig;
