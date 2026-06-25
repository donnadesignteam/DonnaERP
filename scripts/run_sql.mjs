// run_sql.mjs — รันไฟล์ .sql เข้า Supabase Postgres ตรงๆ (เลี่ยงปัญหา copy-paste ใน SQL Editor)
//
// เตรียม 1 ครั้ง: เพิ่มบรรทัดนี้ใน .env.local (เอา connection string จาก
//   Supabase → Project Settings → Database → Connection string → URI, เลือก "Session pooler")
//   SUPABASE_DB_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-...pooler.supabase.com:5432/postgres
//
// วิธีใช้:
//   node scripts/run_sql.mjs scripts/add_activity_logs.sql

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---------- โหลด .env.local ----------
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.trim().match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const dbUrl = env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('❌ ไม่พบ SUPABASE_DB_URL ใน .env.local')
  console.error('   เอา connection string (URI, Session pooler) จาก Supabase → Settings → Database')
  console.error('   แล้วเพิ่มบรรทัด:  SUPABASE_DB_URL=postgresql://postgres.xxxx:[PASSWORD]@...:5432/postgres')
  process.exit(1)
}

const sqlPath = process.argv[2]
if (!sqlPath) {
  console.error('❌ ระบุไฟล์ SQL:  node scripts/run_sql.mjs scripts/add_activity_logs.sql')
  process.exit(1)
}

const sql = readFileSync(join(root, sqlPath), 'utf8')

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  console.log(`▶ กำลังรัน ${sqlPath} ...`)
  await client.query(sql)
  console.log('✅ รันสำเร็จ')
} catch (e) {
  console.error('❌ error:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
