// โหมดอ่านอย่างเดียว — เปิดเฉพาะเครื่องที่ใส่ NEXT_PUBLIC_READ_ONLY=1 ใน .env.local (โคลน donnaweb-design)
// เว็บจริงบน Vercel ไม่มีค่านี้ → เขียนฐาน/อัปรูปได้ตามปกติ · โค้ดชุดเดียวกันทั้งสองที่ ไม่ต้องถอดอะไรตอนขึ้นเว็บจริง
export const READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY === '1'
