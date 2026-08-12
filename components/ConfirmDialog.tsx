'use client'

// กล่องยืนยันของเว็บเอง — ใช้แทน window.confirm()
// เหตุผล: confirm() ของเบราว์เซอร์มีช่อง "ไม่ให้หน้านี้แสดงกล่องข้อความอีก"
// ถ้าผู้ใช้เผลอติ๊กครั้งเดียว หลังจากนั้น confirm() จะคืน false ทันทีตลอด
// = กดลบ/กดยกเลิกแล้วเงียบ ไม่มีอะไรเกิดขึ้น และไล่หาสาเหตุไม่ได้เลย
//
// วิธีใช้:
//   const { ask, confirmDialog } = useConfirm()
//   if (!(await ask('ลบรายการนี้?'))) return
//   ...แล้ววาง {confirmDialog} ไว้ท้าย JSX ของคอมโพเนนต์

import { useCallback, useEffect, useState } from 'react'

type AskOptions = {
  okText?: string      // ข้อความปุ่มยืนยัน (ค่าตั้งต้น "ตกลง")
  cancelText?: string  // ข้อความปุ่มยกเลิก (ค่าตั้งต้น "ยกเลิก")
  danger?: boolean     // ปุ่มยืนยันสีแดง (งานลบ/ยกเลิก)
}

type Pending = AskOptions & { message: string; resolve: (ok: boolean) => void }

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)

  const ask = useCallback(
    (message: string, opts: AskOptions = {}) =>
      new Promise<boolean>(resolve => setPending({ message, ...opts, resolve })),
    []
  )

  // Enter = ตกลง · Esc = ยกเลิก (ให้ความรู้สึกเหมือนกล่องของเบราว์เซอร์)
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); pending.resolve(false); setPending(null) }
      else if (e.key === 'Enter') { e.preventDefault(); pending.resolve(true); setPending(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null) }

  const confirmDialog = pending && (
    <div
      onClick={() => close(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000, padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: '22px 24px', width: '100%', maxWidth: 380 }}
      >
        {/* ข้อความอาจมีหลายบรรทัด (\n) → whiteSpace: pre-line ให้ขึ้นบรรทัดตามที่เขียน */}
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)', marginBottom: 20, whiteSpace: 'pre-line' }}>
          {pending.message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={() => close(false)}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {pending.cancelText || 'ยกเลิก'}
          </button>
          <button
            autoFocus
            onClick={() => close(true)}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: pending.danger ? 'var(--red)' : 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {pending.okText || 'ตกลง'}
          </button>
        </div>
      </div>
    </div>
  )

  return { ask, confirmDialog }
}
