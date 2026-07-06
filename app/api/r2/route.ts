// API เก็บรูปบน Cloudflare R2 (bucket packing-photos)
// - action 'sign'   → ออก presigned PUT URL ให้ browser อัพตรงเข้า R2 (เลี่ยงลิมิต body 4.5MB ของ Vercel)
// - action 'delete' → ลบไฟล์ใน R2 (เฉพาะ URL ใต้ R2_PUBLIC_URL — รูปเก่าใน Supabase ตอบ handled:false ให้ฝั่งเว็บลบเอง)
import { NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})
const BUCKET = process.env.R2_BUCKET || 'packing-photos'
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

export async function POST(req: Request) {
  if (!process.env.R2_ACCOUNT_ID || !PUBLIC_URL) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า R2 (R2_ACCOUNT_ID / R2_PUBLIC_URL)' }, { status: 500 })
  }
  try {
    const body = await req.json()

    if (body.action === 'sign') {
      const key = String(body.key || '')
      if (!key || key.includes('..')) return NextResponse.json({ error: 'key ไม่ถูกต้อง' }, { status: 400 })
      const uploadUrl = await getSignedUrl(r2,
        new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: String(body.contentType || 'image/jpeg') }),
        { expiresIn: 600 })
      return NextResponse.json({ uploadUrl, publicUrl: `${PUBLIC_URL}/${key}` })
    }

    if (body.action === 'delete') {
      const url = String(body.url || '')
      if (!url.startsWith(`${PUBLIC_URL}/`)) return NextResponse.json({ handled: false })
      const key = decodeURIComponent(url.slice(PUBLIC_URL.length + 1).split('?')[0])
      await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
      return NextResponse.json({ handled: true })
    }

    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
