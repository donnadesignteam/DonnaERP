'use client'

// กล่องยืนยันก่อนบันทึก "จัดส่งแล้ว" ในหน้าสแกน — ธีมแบรนด์ Donna (การ์ดครีม · ปุ่มแคปซูลน้ำตาล · ฟอนต์ Prompt)
// แยกจาก ConfirmDialog กลาง เพราะต้องโชว์ว่า "ใบไหน" ให้เห็นชัดก่อนกด (สแกนผิดใบแล้วแก้ยาก) — user ขอ 2ต.ค.69
//
// วิธีใช้:
//   const { askShip, shipDialog } = useShipConfirm()
//   if (!(await askShip({ title: '2609…', sub: 'คุณเอ' }))) return
//   ...แล้ววาง {shipDialog} ไว้ท้าย JSX

import { useCallback, useEffect, useState } from 'react'

type ShipInfo = { title: string; sub?: string; claim?: boolean }
type Pending = ShipInfo & { resolve: (ok: boolean) => void }

export function useShipConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)
  const askShip = useCallback((info: ShipInfo) => new Promise<boolean>(resolve => setPending({ ...info, resolve })), [])
  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null) }

  // Enter = ยืนยัน · Esc = ยกเลิก
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); pending.resolve(false); setPending(null) }
      else if (e.key === 'Enter') { e.preventDefault(); pending.resolve(true); setPending(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  const shipDialog = pending && (
    // ‼️ ไม่ปิดเมื่อแตะพื้นหลัง — มือถือแตะพลาดง่าย ต้องเลือกปุ่มใดปุ่มหนึ่งเท่านั้น
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'rgba(36,24,16,0.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      fontFamily: "'Prompt', 'Sarabun', sans-serif", animation: 'sc-fade .18s ease both',
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: '#FBF7F1', borderRadius: 28, padding: '28px 22px 20px', textAlign: 'center',
        boxShadow: '0 24px 60px rgba(20,12,6,0.45)', animation: 'sc-pop .22s cubic-bezier(.22,1,.36,1) both', color: '#3D2B1F',
      }}>
        {/* ไอคอนรถส่งของในวงกลมน้ำตาล */}
        <div style={{ width: 68, height: 68, borderRadius: 999, background: '#A87452', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(158,106,73,0.35)' }}>
          <svg width="34" height="34" fill="none" stroke="#FFF8F0" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.2px' }}>ยืนยันสแกน “จัดส่งแล้ว”</div>

        {/* ใบที่กำลังจะบันทึก */}
        <div style={{ marginTop: 18, background: '#F6E8DA', border: '1px solid #EBD8C4', borderRadius: 18, padding: '14px 16px', textAlign: 'left' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#A87452', marginBottom: 3 }}>{pending.claim ? 'งานเคลม' : 'ออเดอร์'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#3D2B1F', wordBreak: 'break-word', lineHeight: 1.35 }}>{pending.title || '—'}</div>
          {pending.sub && <div style={{ fontSize: 13.5, color: '#5C4534', marginTop: 3, wordBreak: 'break-word' }}>{pending.sub}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          <button onClick={() => close(true)} autoFocus style={{
            height: 52, borderRadius: 999, border: 'none', background: '#A87452', color: '#FFF8F0', fontSize: 16, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 18px rgba(158,106,73,0.35)', WebkitTapHighlightColor: 'transparent',
          }}>ยืนยัน จัดส่งแล้ว</button>
          <button onClick={() => close(false)} style={{
            height: 48, borderRadius: 999, border: '1.5px solid #D9B89A', background: 'transparent', color: '#8A5C3A', fontSize: 15, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>ยกเลิก</button>
        </div>
      </div>
    </div>
  )

  return { askShip, shipDialog }
}
