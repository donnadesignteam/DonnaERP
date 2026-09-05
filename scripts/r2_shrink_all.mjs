// ย่อรูปทั้งบัคเก็ต R2 ให้เป็น 1024px คุณภาพ 70 (สำรองต้นฉบับลงเครื่องก่อนทับเสมอ)
// วิธีใช้:  node scripts/r2_shrink_all.mjs            = ย่อจริง
//          node scripts/r2_shrink_all.mjs --dry-run   = ดูว่าจะย่อกี่ไฟล์ ไม่แตะของจริง
// ข้าม: ไฟล์ที่กว้าง <= 1024 อยู่แล้วและเล็กกว่า 200 KB · ไฟล์ที่ย่อแล้วไม่เล็กลง · ไฟล์ที่ไม่ใช่รูป
// รันซ้ำได้ ไฟล์ที่ย่อไปแล้วจะถูกข้ามเอง · ต้นฉบับสำรองที่ C:\Users\Com\Downloads\r2-backup-all
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const DRY = process.argv.includes('--dry-run')
const BACKUP = 'C:/Users/Com/Downloads/r2-backup-all'
const MAX_W = 1024, QUALITY = 70

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})
const B = env.R2_BUCKET

let token; const all = []
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: B, ContinuationToken: token }))
  for (const o of r.Contents ?? []) if (/\.(jpe?g|png|webp)$/i.test(o.Key)) all.push(o)
  token = r.IsTruncated ? r.NextContinuationToken : undefined
} while (token)
console.log(`ไฟล์รูปในบัคเก็ต ${all.length} ไฟล์ ${(all.reduce((s, o) => s + o.Size, 0) / 1048576).toFixed(0)} MB`)
if (DRY) console.log('(--dry-run: ไม่แตะของจริง)')

let done = 0, skipped = 0, failed = 0, before = 0, after = 0
for (const [i, o] of all.entries()) {
  try {
    const got = await s3.send(new GetObjectCommand({ Bucket: B, Key: o.Key }))
    const buf = Buffer.from(await got.Body.transformToByteArray())
    const meta = await sharp(buf).metadata()
    if (meta.width <= MAX_W && buf.length < 200 * 1024) { skipped++; continue }
    const small = await sharp(buf).rotate().resize({ width: MAX_W, withoutEnlargement: true }).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer()
    if (small.length >= buf.length) { skipped++; continue }
    if (!DRY) {
      const dest = path.join(BACKUP, o.Key)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, buf)
      await s3.send(new PutObjectCommand({ Bucket: B, Key: o.Key, Body: small, ContentType: 'image/jpeg' }))
    }
    before += buf.length; after += small.length; done++
  } catch (e) {
    failed++
    console.log(`  !! ${o.Key} — ${e.message}`)
  }
  if ((i + 1) % 50 === 0) console.log(`${i + 1}/${all.length}  ย่อแล้ว ${done} · ข้าม ${skipped} · พลาด ${failed} · ประหยัดไป ${((before - after) / 1048576).toFixed(0)} MB`)
}
console.log(`\nเสร็จ — ย่อ ${done} ไฟล์ · ข้าม ${skipped} · พลาด ${failed}`)
console.log(`${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB  (คืนพื้นที่ ${((before - after) / 1048576).toFixed(0)} MB)`)
if (!DRY) console.log(`ต้นฉบับสำรองที่ ${BACKUP}`)
