'use client'

// ดูรูป/คลิปเต็มจอ — ใช้แทนปุ่ม ✕ ที่ติดมุมรูปจิ๋ว (user บอกกดโดนง่าย 29ก.ย.69)
// ใช้ร่วม: หน้าสแกน · โฟลเดอร์ลูกค้า (คอม+มือถือ) · พัสดุส่งกลับ
// ‼️ หน้าตาแบบแอปรูปภาพ (user เลือกแบบ B): × ปิดขวาบน · แถบทึบล่างสุด ซ้าย = รูปอะไร/ที่ไหน ขวา = ไอคอนถังขยะกลม
//    บนคอม (เมาส์) แถบเดียวกันแต่ลอยมนๆ แก้วเบลอ ไม่ปิดขอบล่างจนมิด (user ขอ 29ก.ย.69) — สไตล์อยู่ใน globals.css (.pv-*)
//    ปุ่มลบกับปุ่มปิดอยู่คนละขอบจอ กันกดผิด — อย่าย้ายมาใกล้กันอีก
// ‼️ ไม่ถามยืนยันเอง — onDelete ของแต่ละหน้าถาม/ลบ/ปิดตัวดูรูปเอง (บางหน้าไม่ต้องถาม เช่นพัสดุส่งกลับที่ Ctrl+Z ได้)
import { useEffect } from 'react'
import { isRealClick, rememberDown, rememberUp } from '@/lib/backdrop'

const TRASH_ICON = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'

export default function PhotoViewer({ url, video, title, subtitle, caption, onClose, onDelete, deleting, error }: {
  url: string
  video?: boolean
  title?: string             // บรรทัดบนในแถบล่าง เช่น "ภาพการแพ็ค"
  subtitle?: string          // บรรทัดล่าง เช่น "2609261MYA102F · รูปที่ 2 / 5"
  caption?: string           // คำอธิบายรูป (ถ้ามี) โชว์ใต้รูป
  onClose: () => void
  onDelete?: () => void      // ไม่ส่ง = ไม่มีปุ่มลบ (ดูอย่างเดียว)
  deleting?: boolean
  error?: string
}) {
  // Esc ปิด (ใช้บนคอม)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const hasBar = !!(onDelete || title || subtitle)

  return (
    // stopPropagation — บางหน้าวางตัวนี้ไว้ในแถวตารางที่กดได้ (พัสดุส่งกลับ) คลิกในนี้ต้องไม่ทะลุไปเปิดแถว
    // isRealClick — กดกับปล่อยคนละที่ (ลากเข้า/ออกรูป) ไม่นับเป็นคลิกปิด (lib/backdrop.ts)
    <div onMouseDownCapture={rememberDown} onMouseUpCapture={rememberUp} onClick={e => { e.stopPropagation(); if (isRealClick(e)) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      {/* รูป — กินพื้นที่ระหว่างปุ่มปิดกับแถบล่าง */}
      <div className="pv-stage">
        {video ? (
          <video src={url} controls autoPlay playsInline onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', minHeight: 0, borderRadius: 10 }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={caption || title || 'รูป'} style={{ maxWidth: '100%', maxHeight: '100%', minHeight: 0, objectFit: 'contain', borderRadius: 10 }} />
        )}
        {caption && <div style={{ flexShrink: 0, color: '#fff', fontSize: 13, textAlign: 'center', lineHeight: 1.5, maxWidth: 520 }}>{caption}</div>}
      </div>

      {/* ขวาบน: ปิด */}
      <button onClick={e => { e.stopPropagation(); onClose() }} aria-label="ปิด"
        style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', right: 14, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 20, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>×</button>

      {/* แถบล่าง: ข้อมูลรูป (ซ้าย) + ถังขยะ (ขวา) */}
      {hasBar && (
        <div className="pv-bar" onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, maxWidth: 720, margin: '0 auto', minHeight: 50 }}>
            <div style={{ minWidth: 0, lineHeight: 1.4 }}>
              {title && <div style={{ color: '#EDE3D8', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
              {subtitle && <div style={{ color: '#A99A8C', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
              {error && <div style={{ color: '#FFB4A6', fontSize: 12, marginTop: 2 }}>{error}</div>}
            </div>
            {onDelete && (
              <button className="pv-del" onClick={onDelete} disabled={deleting} aria-label="ลบ" title="ลบ">
                {deleting ? <span style={{ fontSize: 16 }}>…</span> : (
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d={TRASH_ICON} />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
