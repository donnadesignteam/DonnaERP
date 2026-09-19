// รูป/คลิปในหมวด "ตามงาน" — อัปขึ้น Cloudflare R2 (ไม่กิน egress ของ Supabase · ในตารางเก็บแค่ลิงก์)
// ย่อก่อนอัปเสมอ: รูปใช้ compressImage (1024px) · คลิปใหญ่เกิน 8MB อัดใหม่ 720p ด้วย compressVideo
import { compressImage } from './packingPhotos'
import { compressVideo } from './videoCompress'

export type BoardMedia = { url: string; kind: 'image' | 'video'; name?: string }

export const MAX_MEDIA = 10   // ต่อโพสต์/ความคิดเห็น

// ขอลิงก์อัปจาก /api/r2 แล้วอัปตรงจากเบราว์เซอร์เข้า R2 (เลี่ยงลิมิตขนาด body ของ Vercel) พร้อมบอก %
async function putR2(file: File, key: string, onProgress: (pct: number) => void): Promise<string> {
  const ct = file.type || 'application/octet-stream'
  const res = await fetch('/api/r2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sign', key, contentType: ct }) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.uploadUrl) throw new Error(j.error || 'ขอลิงก์อัปโหลดไม่สำเร็จ')
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', j.uploadUrl)
    xhr.setRequestHeader('Content-Type', ct)
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`อัปโหลดไม่สำเร็จ (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('อัปโหลดไม่สำเร็จ — เน็ตหลุด?'))
    xhr.send(file)
  })
  return j.publicUrl as string
}

// อัปหลายไฟล์ทีละไฟล์ · onStatus บอกข้อความความคืบหน้า เช่น "2/3 · ย่อคลิป 40%"
export async function uploadBoardMedia(files: File[], onStatus: (msg: string) => void): Promise<BoardMedia[]> {
  const out: BoardMedia[] = []
  for (let i = 0; i < files.length; i++) {
    const src = files[i]
    const pre = files.length > 1 ? `${i + 1}/${files.length} · ` : ''
    const isVideo = src.type.startsWith('video/')
    if (!isVideo && !src.type.startsWith('image/')) continue
    const f = isVideo ? await compressVideo(src, pct => onStatus(`${pre}ย่อคลิป ${pct}%`)) : await compressImage(src)
    const ext = (f.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase()
    const key = `board/${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const url = await putR2(f, key, pct => onStatus(`${pre}อัปโหลด ${pct}%`))
    out.push({ url, kind: isVideo ? 'video' : 'image', name: src.name })
  }
  return out
}
