// ดูว่าอัปรูปขึ้น R2 เดือนละกี่ MB — ไล่ลิสต์ไฟล์ทั้งบัคเก็ตแล้วรวมตามเดือนที่อัป
// วิธีใช้:  node scripts/r2_usage.mjs      (อ่านคีย์จาก .env.local)
// โควต้าฟรี R2 = พื้นที่ 10 GB · Class A (เขียน/ลิสต์) 1 ล้านครั้ง/เดือน · Class B (อ่าน) 10 ล้านครั้ง/เดือน
import fs from 'fs'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

let token, total = 0, count = 0
const byMonth = {}
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, ContinuationToken: token }))
  for (const o of r.Contents ?? []) {
    total += o.Size; count++
    const m = new Date(o.LastModified).toISOString().slice(0, 7)
    byMonth[m] = byMonth[m] || { n: 0, bytes: 0 }
    byMonth[m].n++; byMonth[m].bytes += o.Size
  }
  token = r.IsTruncated ? r.NextContinuationToken : undefined
} while (token)

const MB = b => (b / 1048576).toFixed(1).padStart(8)
console.log(`\nรวมทั้งบัคเก็ต ${count} ไฟล์ ${MB(total)} MB  (โควต้าฟรี 10,240 MB — ใช้ไป ${(total / 1048576 / 10240 * 100).toFixed(1)}%)\n`)
console.log('เดือนที่อัป  ไฟล์        MB')
const months = Object.keys(byMonth).sort()
for (const k of months) console.log(`${k}     ${String(byMonth[k].n).padStart(5)}  ${MB(byMonth[k].bytes)}`)

// คาดการณ์: ใช้ค่าเฉลี่ยของเดือนเต็มที่ผ่านมา (ไม่รวมเดือนปัจจุบันที่ยังไม่จบ)
const full = months.slice(0, -1).filter(k => byMonth[k].bytes > 1048576 * 50)
if (full.length) {
  const avg = full.reduce((s, k) => s + byMonth[k].bytes, 0) / full.length
  const left = 10240 * 1048576 - total
  console.log(`\nเฉลี่ยเดือนละ ${MB(avg)} MB → พื้นที่ฟรีเหลืออีก ${(left / 1048576 / (avg / 1048576)).toFixed(0)} เดือน`)
}
