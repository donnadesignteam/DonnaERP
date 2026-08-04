'use client'

// แถบรูป + ดูรูปเต็มจอ สำหรับหน้ามือถือ (ดูอย่างเดียว — เพิ่ม/ลบรูปทำที่เว็บคอม)
// ใช้กับรูปที่เก็บแบบ { url, caption } เหมือนกันทั้งงานติดตั้ง (installations.photos) และงานเคลม (claims.photos)
//   const pv = usePhotoViewer()
//   {pv.strip(j.photos)}   ← ในการ์ด
//   {pv.viewer()}          ← ท้ายหน้า (นอกการ์ด)
import { useState } from 'react'
import { useSheetBack } from './mobileUi'

export type Photo = { url: string; caption?: string }

export function usePhotoViewer() {
  const [photo, setPhoto] = useState<Photo | null>(null)
  useSheetBack(!!photo, () => setPhoto(null))

  const strip = (photos?: Photo[] | null) => {
    if (!Array.isArray(photos) || photos.length === 0) return null
    return (
      <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
        {photos.map(p => (
          // ‼️ preventDefault/stopPropagation — การ์ดเคลมทั้งใบเป็น <Link> ไปโฟลเดอร์ลูกค้า กดรูปต้องไม่เด้งออกจากหน้า
          <button key={p.url} type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setPhoto(p) }}
            aria-label={p.caption || 'ดูรูปเต็ม'} title={p.caption || ''}
            style={{ flexShrink: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0, WebkitTapHighlightColor: 'transparent' }}>
            {/* รูปมาจาก R2 หลายโดเมน — ใช้ img ตรงๆ เหมือนหน้าเดสก์ท็อป ไม่ผ่าน next/image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption || 'รูป'} loading="lazy" decoding="async"
              style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)' }} />
          </button>
        ))}
      </div>
    )
  }

  // รูปเต็มจอ — ปุ่ม back ของ Android ปิดได้ (useSheetBack)
  const viewer = () => photo && (
    <div onClick={() => setPhoto(null)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.caption || 'รูป'} style={{ maxWidth: '100%', maxHeight: photo.caption ? '82%' : '100%', objectFit: 'contain', borderRadius: 10 }} />
      {photo.caption && (
        <div style={{ color: '#fff', fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 1.5, maxWidth: 520 }}>{photo.caption}</div>
      )}
      <button onClick={() => setPhoto(null)} aria-label="ปิด"
        style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', right: 14, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
    </div>
  )

  return { strip, viewer }
}
