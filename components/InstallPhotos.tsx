'use client'

// รูปหน้างานของงานติดตั้ง (คอลัมน์ installations.photos) — ใช้ร่วมกัน 2 ที่:
//   1) หน้างานติดตั้ง: โมดัลเพิ่ม/แก้ไขรายการ + ป๊อปอัปรายการสินค้าของแถวที่มาจากออเดอร์
//   2) หมวดออเดอร์: ป๊อปอัปรายการสินค้าของออเดอร์ที่เป็นงานติดตั้ง
// ไฟล์เก็บบน Cloudflare R2 (โฟลเดอร์ installations/) เหมือนรูปแพ็ค — ดู lib/packingPhotos.ts
//
// จังหวะการบันทึก: อัพไฟล์ขึ้น R2 ทันทีที่เลือก แต่ URL เขียนลงฐานตอนกดบันทึกของหน้าต่างที่เรียกใช้
//   begin()  = เปิดหน้าต่าง → ตั้งรายการรูปตั้งต้น + โฟลเดอร์ไฟล์
//   commit() = บันทึกสำเร็จ → ลบไฟล์ของรูปที่เอาออก
//   cancel() = ปิดโดยไม่บันทึก → ลบไฟล์ที่เพิ่งอัพ (ไม่มีอะไรอ้างถึง)
import { useRef, useState } from 'react'
import { compressImage, uploadPackingFile, deletePackingFile } from '@/lib/packingPhotos'

export type InstallPhoto = { url: string; caption: string }

// ข้อความ error ตอนบันทึกรูป — ถ้ายังไม่ได้เพิ่มคอลัมน์ในฐานข้อมูล บอกให้ตรงจุดแทนข้อความดิบของ Postgres
export const photoSaveError = (msg: string, sqlFile = 'migrations/add_installation_photos.sql') =>
  /photos/.test(msg) && /does not exist/i.test(msg)
    ? `บันทึกรูปไม่ได้ — ฐานข้อมูลยังไม่มีคอลัมน์ photos ให้รันไฟล์ ${sqlFile} ใน Supabase ก่อน`
    : `บันทึกรูปหน้างานไม่สำเร็จ: ${msg}`

// opts.prefix = โฟลเดอร์บน R2 (งานติดตั้ง = installations/ · งานเคลม = claims/)
// opts.title  = หัวข้อที่โชว์ในแถบสรุป/แผงรูป
export function useInstallPhotos(opts?: { prefix?: string; title?: string }) {
  const prefix = opts?.prefix || 'installations'
  const title = opts?.title || 'รูปหน้างาน'
  const [photos, setPhotos] = useState<InstallPhoto[]>([])
  const [open, setOpen] = useState(false)     // แผงรูปที่โผล่ข้างๆ หน้าต่างหลัก
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const folder = useRef('new')
  const added = useRef<string[]>([])
  const removed = useRef<string[]>([])
  const input = useRef<HTMLInputElement>(null)

  const begin = (list?: InstallPhoto[] | null, folderId?: string | null) => {
    setPhotos(Array.isArray(list) ? list : [])
    folder.current = folderId || `new-${Date.now()}`
    added.current = []; removed.current = []
    setOpen(false); setErr('')
  }
  const commit = () => {
    removed.current.forEach(u => { void deletePackingFile(u) })
    added.current = []; removed.current = []
    setOpen(false); setErr('')
  }
  const cancel = () => {
    added.current.forEach(u => { void deletePackingFile(u) })
    added.current = []; removed.current = []
    setOpen(false); setErr('')
  }

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setErr('')
    const list: InstallPhoto[] = []
    try {
      for (const file of Array.from(files)) {
        const small = await compressImage(file)   // ย่อ 1024px / JPEG 70%
        const ext = (small.name.split('.').pop() || 'jpg').toLowerCase()
        const key = `${prefix}/${folder.current}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const url = await uploadPackingFile(small, key)
        added.current.push(url)
        list.push({ url, caption: '' })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    if (list.length) setPhotos(prev => [...prev, ...list])
    setBusy(false)
  }

  const setCaption = (i: number, v: string) => setPhotos(prev => prev.map((p, k) => k === i ? { ...p, caption: v } : p))
  const remove = (i: number) => setPhotos(prev => {
    if (prev[i]) removed.current.push(prev[i].url)
    return prev.filter((_, k) => k !== i)
  })

  // แถบสรุปในหน้าต่างหลัก — จำนวนรูป + รูปจิ๋ว + ปุ่มเปิดแผง
  const trigger = () => (
    <div style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
          {title} {photos.length
            ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>({photos.length} รูป)</span>
            : <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>— ยังไม่มีรูป</span>}
        </label>
        <button type="button" onClick={() => setOpen(true)}
          style={{ border: 'none', background: 'var(--blue)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {photos.length ? 'เพิ่ม / จัดการรูป' : '+ เพิ่มรูป'}
        </button>
      </div>
      {photos.length > 0 && (
        <div onClick={() => setOpen(true)} title="จิ้มเพื่อเปิดแผงรูป" style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', cursor: 'pointer' }}>
          {photos.slice(0, 8).map(p => (
            <img key={p.url} src={p.url} alt={p.caption || 'รูปหน้างาน'}
              style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
          ))}
          {photos.length > 8 && <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--ink-3)' }}>+{photos.length - 8}</span>}
        </div>
      )}
    </div>
  )

  // แผงรูป — วางเป็นการ์ดพี่น้องของหน้าต่างหลัก (โผล่ข้างๆ กัน) เรียกใช้เมื่อ open = true
  const panel = () => (
    <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', flex: '0 1 440px', minWidth: 340, maxHeight: '90vh', overflowY: 'auto', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>
          {title} {photos.length > 0 &&<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-3)' }}>({photos.length} รูป)</span>}
        </h2>
        <button type="button" onClick={() => setOpen(false)} title="ปิดแผงรูป"
          style={{ border: 'none', background: 'transparent', fontSize: 18, lineHeight: 1, color: 'var(--ink-3)', cursor: 'pointer' }}>✕</button>
      </div>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        style={{ width: '100%', border: '1px dashed var(--border-2)', background: 'var(--bg)', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, color: busy ? 'var(--ink-3)' : 'var(--blue)', cursor: busy ? 'default' : 'pointer' }}>
        {busy ? 'กำลังอัพโหลด…' : '+ เพิ่มรูป (เลือกได้ทีละหลายรูป)'}
      </button>
      <input ref={input} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { void add(e.target.files); e.target.value = '' }} />
      {err && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>อัพโหลดรูปไม่สำเร็จ: {err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
        {photos.map((p, i) => (
          <div key={p.url} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8, background: 'var(--bg)' }}>
            <div style={{ position: 'relative' }}>
              <a href={p.url} target="_blank" rel="noreferrer" title="เปิดรูปขนาดเต็ม">
                <img src={p.url} alt={p.caption || 'รูปหน้างาน'}
                  style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              </a>
              <button type="button" onClick={() => remove(i)} title="เอารูปนี้ออก"
                style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.7)', color: '#fff', fontSize: 13, lineHeight: 1, cursor: 'pointer' }}>✕</button>
            </div>
            <input value={p.caption} onChange={e => setCaption(i, e.target.value)} placeholder="คำอธิบายรูป เช่น หน้าต่างห้องนอน ฝั่งซ้าย"
              style={{ width: '100%', marginTop: 8, border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        {photos.length === 0 && !busy && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', textAlign: 'center', padding: '18px 0' }}>
            ยังไม่มีรูป — กดปุ่มด้านบนเพื่อเลือกรูปจากเครื่อง
          </div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 14, lineHeight: 1.6 }}>
        รูปจะถูกบันทึกจริงเมื่อกดปุ่มบันทึกในหน้าต่างข้างๆ
      </div>
    </div>
  )

  return { photos, open, busy, begin, commit, cancel, trigger, panel }
}
