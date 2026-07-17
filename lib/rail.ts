// ทางเข้าเว็บอุปกรณ์ราง (โปรเจกต์ donna-rail) — เสิร์ฟผ่านโดเมนเดียวกับ ERP ด้วย rewrite ใน next.config.ts
// ‼️ ต้องลงท้าย /index.html เสมอ ห้ามใช้ '/rail' หรือ '/rail/' เฉยๆ:
//    - '/rail/'  → Next redirect 308 ทิ้ง / ปิดท้าย กลายเป็น '/rail'
//    - '/rail'   → base ของหน้ากลายเป็น '/' → ไฟล์ที่หน้าอ้างแบบสัมพัทธ์ (calc.js, parts/…) วิ่งไปหา /calc.js แล้ว 404
//    - '/rail/index.html' → base = '/rail/' → calc.js → /rail/calc.js ✓
// อยู่โดเมนเดียวกันแล้ว = อยู่ใน scope ของ PWA "Donna Design" กดจากแอปแล้วไม่เด้งออกเบราว์เซอร์
export const RAIL_PATH = '/rail/index.html'

export const railLink = (params?: Record<string, string>) =>
  params && Object.keys(params).length
    ? `${RAIL_PATH}?${new URLSearchParams(params).toString()}`
    : RAIL_PATH
