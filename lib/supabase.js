import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ดูเหตุผลที่ปิด auth ใน lib/supabase.ts (ไฟล์นี้เป็นของเก่า เก็บให้ตรงกันไว้)
export const supabase = createClient(supabaseUrl, supabaseKey, { accessToken: async () => supabaseKey })