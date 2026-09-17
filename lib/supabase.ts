import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ‼️ ปิดระบบล็อกอินของ Supabase ทิ้ง — เว็บนี้ล็อกอินเองด้วย cookie (/api/login) ไม่เคยใช้ supabase.auth เลย
// ถ้าไม่ปิด supabase-js จะเรียก auth.getSession() "ก่อนทุกคำสั่ง" ซึ่งต้องไปจอง Web Lock + อ่าน localStorage
// บน Safari ขั้นนี้ค้างได้ (เปิดหลายแท็บ/สลับแอปแล้วกลับมา ล็อกไม่ถูกปล่อย) → คำสั่งบันทึกไม่ถูกส่งออกไปเลย
// ปุ่มเลยค้างคำว่า "กำลังบันทึก…" ทั้งที่เน็ตปกติ · ใส่ accessToken เอง = ข้ามขั้นนี้ทั้งหมด ยิงคำขอตรงเลย
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => supabaseAnonKey,
})
