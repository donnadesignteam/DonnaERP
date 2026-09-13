// บีบอัดวิดีโอในเครื่องก่อนอัพขึ้น R2 — คลิปแกะพัสดุจากมือถือมักยาวและใหญ่มาก (1080p/4K หลายสิบ MB)
// ‼️ เบราว์เซอร์บีบอัดวิดีโอตรงๆ ไม่ได้ ต้อง "เล่นแล้วอัดใหม่" (MediaRecorder) → ใช้เวลาเท่าความยาวคลิป
//    เลยทำเฉพาะคลิปที่ใหญ่เกิน MIN_SIZE · ถ้าเบราว์เซอร์ไม่รองรับหรือพังกลางทาง = อัพไฟล์เดิมไป ไม่ทำให้ใช้งานไม่ได้
// รูปภาพใช้ compressImage ใน lib/packingPhotos.ts (คนละตัว)

const MIN_SIZE = 8 * 1024 * 1024   // เล็กกว่านี้ไม่ต้องเสียเวลาอัดใหม่
const MAX_EDGE = 720               // ย่อให้ด้านสั้นไม่เกิน 720px (อ่านสภาพของ/เลขพัสดุในคลิปยังชัด)
const VIDEO_BPS = 1_500_000
const AUDIO_BPS = 96_000

export async function compressVideo(file: File, onProgress?: (pct: number) => void): Promise<File> {
  if (!file.type.startsWith('video/') || file.size < MIN_SIZE) return file
  if (typeof MediaRecorder === 'undefined') return file

  let url = ''
  try {
    url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.src = url
    v.playsInline = true
    v.preload = 'auto'
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res()
      v.onerror = () => rej(new Error('อ่านไฟล์วิดีโอไม่ได้'))
    })
    if (!v.videoWidth || !v.videoHeight || !isFinite(v.duration)) return file

    const scale = Math.min(1, MAX_EDGE / Math.min(v.videoWidth, v.videoHeight))
    const w = Math.round(v.videoWidth * scale / 2) * 2
    const h = Math.round(v.videoHeight * scale / 2) * 2
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    const stream = canvas.captureStream(30)
    // เสียงจากคลิปเดิม — เอามารวมกับภาพที่ย่อแล้ว (เบราว์เซอร์ที่ทำไม่ได้ = ได้คลิปไม่มีเสียง)
    const withCapture = v as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }
    let srcStream: MediaStream | undefined
    try {
      srcStream = withCapture.captureStream?.() ?? withCapture.mozCaptureStream?.()
      srcStream?.getAudioTracks().forEach(t => stream.addTrack(t))
    } catch { /* ไม่มีเสียงก็ยังอัดภาพได้ */ }

    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m))
    if (!mime) return file

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS })
    const chunks: BlobPart[] = []
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    const stopped = new Promise<void>(res => { rec.onstop = () => res() })
    rec.start(1000)

    // เล่นคลิปให้จบ (ปิดเสียงลำโพงไม่ได้ ไม่งั้นแทร็กเสียงที่อัดจะเงียบไปด้วย — ตั้ง volume ต่ำสุดแทน)
    v.volume = 0.0001
    try { await v.play() } catch { v.muted = true; await v.play() }

    let raf = 0
    const draw = () => {
      ctx.drawImage(v, 0, 0, w, h)
      onProgress?.(Math.min(99, Math.round((v.currentTime / (v.duration || 1)) * 100)))
      raf = requestAnimationFrame(draw)
    }
    draw()
    await new Promise<void>(res => { v.onended = () => res() })
    cancelAnimationFrame(raf)
    rec.stop()
    await stopped
    srcStream?.getTracks().forEach(t => t.stop())

    const blob = new Blob(chunks, { type: 'video/webm' })
    if (!blob.size || blob.size >= file.size) return file   // อัดใหม่แล้วไม่เล็กลง = ใช้ของเดิม
    onProgress?.(100)
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webm', { type: 'video/webm' })
  } catch {
    return file
  } finally {
    if (url) URL.revokeObjectURL(url)
  }
}
