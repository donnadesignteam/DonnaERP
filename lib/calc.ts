// ทางเข้าเว็บคำนวณราคาม่าน (repo prawattana/curtaincalculator.github.io-main บน GitHub Pages)
// เสิร์ฟผ่านโดเมนเดียวกับ ERP ด้วย rewrite ใน next.config.ts → อยู่ใน scope ของ PWA "Donna Design"
// ‼️ ต้องเป็น '/calc/Index.html' เท่านั้น (เหตุผลเดียวกับ lib/rail.ts):
//    - ตัว I ใหญ่ — บน GitHub Pages มีแต่ Index.html ส่วน index.html / ท้าย / เปล่าๆ ได้ 404
//    - ต้องมีไฟล์ปิดท้าย ไม่งั้น base ของหน้ากลายเป็น '/' แล้ว styles.css / script.js / *.json วิ่งไปหา root แล้ว 404
// หน้านั้นมีปุ่ม "เครื่องมือ" กลับ /hub?pick=1 แล้ว (โผล่เฉพาะตอนเปิดจากแอปที่ติดตั้ง) — แก้ที่ repo curtaincalculator
export const CALC_PATH = '/calc/Index.html'
