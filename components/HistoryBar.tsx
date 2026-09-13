'use client'

// ปุ่ม ↶ ↷ เลิกทำ/ทำซ้ำ แบบ Google Sheets — ลอยมุมล่างซ้าย โชว์ทุกหน้า
// + คีย์ลัด Ctrl+Z (undo) / Ctrl+Y หรือ Ctrl+Shift+Z (redo)
// ไม่ดักคีย์ตอนพิมพ์อยู่ในช่องกรอก (ปล่อยให้ undo ข้อความปกติของเบราว์เซอร์ทำงาน)

import { useEffect, useState, useCallback } from 'react'
import { subscribeHistory, historySnapshot, performUndo, performRedo } from '@/lib/history'

export default function HistoryBar() {
  const [snap, setSnap] = useState(historySnapshot())

  useEffect(() => {
    const update = () => setSnap(historySnapshot())
    update()
    return subscribeHistory(update)
  }, [])

  const doUndo = useCallback(() => { performUndo().catch(e => alert('เลิกทำไม่สำเร็จ: ' + (e?.message || e))) }, [])
  const doRedo = useCallback(() => { performRedo().catch(e => alert('ทำซ้ำไม่สำเร็จ: ' + (e?.message || e))) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const el = document.activeElement as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return   // กำลังพิมพ์ → ปล่อย undo ข้อความปกติ
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo() }
      else if ((k === 'y') || (k === 'z' && e.shiftKey)) { e.preventDefault(); doRedo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo])

  return (
    <div style={{ position: 'fixed', left: 76, bottom: 18, zIndex: 500, display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
        <button onClick={doUndo} disabled={!snap.canUndo}
          title={snap.undoLabel ? `เลิกทำ: ${snap.undoLabel}  (Ctrl+Z)` : 'ไม่มีอะไรให้เลิกทำ'}
          style={{ border: 'none', background: 'transparent', cursor: snap.canUndo ? 'pointer' : 'default', color: snap.canUndo ? 'var(--ink)' : 'var(--ink-4)', opacity: snap.canUndo ? 1 : 0.4, fontSize: 16, fontWeight: 700, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 6 }}>
          ↶
        </button>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <button onClick={doRedo} disabled={!snap.canRedo}
          title={snap.redoLabel ? `ทำซ้ำ: ${snap.redoLabel}  (Ctrl+Y)` : 'ไม่มีอะไรให้ทำซ้ำ'}
          style={{ border: 'none', background: 'transparent', cursor: snap.canRedo ? 'pointer' : 'default', color: snap.canRedo ? 'var(--ink)' : 'var(--ink-4)', opacity: snap.canRedo ? 1 : 0.4, fontSize: 16, fontWeight: 700, padding: '9px 13px' }}>
          ↷
        </button>
      </div>
    </div>
  )
}
