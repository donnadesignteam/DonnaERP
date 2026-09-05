// อัพโหลด/ลบไฟล์รูปแพ็ค — รูปใหม่เก็บบน Cloudflare R2, รูปเก่ายังอยู่ Supabase Storage (ลบได้ทั้งคู่)
// ใช้ร่วมกันหน้า /scan และโฟลเดอร์ลูกค้า (customers)
import { supabase } from '@/lib/supabase'

// ย่อรูปก่อนอัพ: จำกัดด้านยาวสุด 1024px + JPEG 70% — รูปมือถือ ~4MB เหลือ ~100-150KB
// ‼️ 5ก.ย.69 ลดจาก 1600px/80% (ได้ ~500KB/รูป กินโควต้า R2 ฟรีเดือนละ ~650MB) — เทียบภาพจริงแล้ว
//    ตัวหนังสือบนใบสั่งงาน/QR ยังคมอ่านออกครบ · รูปเก่าบน R2 ย่อย้อนหลังไปแล้ว (scripts/r2_shrink_all.mjs)
// แปลงไม่ได้ (เช่น HEIC บนบางเบราว์เซอร์) หรือย่อแล้วใหญ่กว่าเดิม → ใช้ไฟล์เดิม
export async function compressImage(file: File, maxDim = 1024, quality = 0.7): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

// อัพรูปเข้า R2: ขอ presigned URL จาก /api/r2 แล้ว PUT ตรงเข้า R2 — คืน public URL สำหรับเก็บลง packing_photos
export async function uploadPackingFile(file: File, key: string): Promise<string> {
  const ct = file.type || 'image/jpeg'
  const res = await fetch('/api/r2', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sign', key, contentType: ct }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.uploadUrl) throw new Error(j.error || 'ขอลิงก์อัพโหลดไม่สำเร็จ')
  const put = await fetch(j.uploadUrl, { method: 'PUT', headers: { 'Content-Type': ct }, body: file })
  if (!put.ok) throw new Error(`อัพโหลดเข้า R2 ไม่สำเร็จ (${put.status})`)
  return j.publicUrl as string
}

// ลบไฟล์ตามที่มาของ URL: R2 ผ่าน API (handled:true) / รูปเก่า Supabase ลบตรงจาก bucket
// ลบไฟล์ไม่สำเร็จไม่ throw — ให้ฝั่งเรียกเอา URL ออกจากออเดอร์ต่อได้เสมอ
export async function deletePackingFile(url: string) {
  try {
    const res = await fetch('/api/r2', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', url }),
    })
    const j = await res.json().catch(() => ({}))
    if (j.handled) return
  } catch {}
  const path = decodeURIComponent((url.split('/packing-photos/')[1] || '').split('?')[0])
  if (path) { try { await supabase.storage.from('packing-photos').remove([path]) } catch {} }
}
