'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ปุ่มสแกน QR เล็กๆ มุมขวาของช่องค้นหา (มือถือ) → สแกนแล้วเด้งเข้าโฟลเดอร์ลูกค้าของออเดอร์นั้น
// ‼️ ไม่เกี่ยวกับหน้า /scan (ของทีมผลิต ที่สแกนแล้วเดินสถานะงาน) — อันนี้แค่ "เปิดดู" ไม่แตะข้อมูล

// QR ที่พิมพ์ติดออเดอร์ = URL .../scan?id=<id>&o=<order_number>
function extractId(text: string): string {
  try { const u = new URL(text); const id = u.searchParams.get('id'); if (id) return id } catch {}
  const m = String(text).match(/[?&]id=([^&\s]+)/); if (m) return decodeURIComponent(m[1])
  return ''
}
// ไม่มี ?o= และเป็น URL → คืนค่าว่าง (ห้ามเอา URL ทั้งอันไปค้นเป็นเลขออเดอร์)
function extractOrder(text: string): string {
  const t = String(text).trim()
  const m = t.match(/[?&]o=([^&\s]+)/); if (m) return decodeURIComponent(m[1])
  if (/^https?:\/\//i.test(t)) return ''
  return t
}

type Found = { id: string; order_number: string | null; customer_name: string | null }

async function findOrder(id: string, ord: string): Promise<Found | null> {
  const sel = 'id, order_number, customer_name'
  // id แม่นสุด — แต่ถ้าชนิดคอลัมน์ไม่ตรง (uuid vs เลข) จะ error เฉยๆ ให้ตกไปหาด้วยเลขออเดอร์แทน
  if (id) {
    const { data } = await supabase.from('order_entries').select(sel).eq('id', id).maybeSingle()
    if (data) return data as Found
  }
  if (ord) {
    const { data } = await supabase.from('order_entries').select(sel).ilike('order_number', ord).limit(1)
    if (data?.[0]) return data[0] as Found
    const { data: d2 } = await supabase.from('order_entries').select(sel).ilike('order_number', `%${ord}%`).limit(1)
    if (d2?.[0]) return d2[0] as Found
  }
  return null
}

export default function ScanFolderButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const scannerRef = useRef<any>(null)
  const busyRef = useRef(false)

  const stop = async () => {
    const s = scannerRef.current
    scannerRef.current = null
    if (s) { try { await s.stop() } catch {} try { s.clear() } catch {} }
  }

  const close = () => { setOpen(false); setMsg(''); busyRef.current = false; stop() }

  // ปุ่มย้อนกลับของ Android ต้องปิดกล้อง ไม่ใช่เด้งออกจากหน้า (แนวเดียวกับ bottom sheet หน้าอื่น)
  useEffect(() => {
    if (!open) return
    history.pushState({ scanner: 1 }, '')
    const onPop = () => close()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])

  useEffect(() => {
    if (!open) return
    let dead = false
    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (dead) return
        const html5 = new Html5Qrcode('folder-qr-reader', { verbose: false } as any)
        scannerRef.current = html5
        await html5.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded: string) => onDecode(decoded),
          () => {}, // ละเว้น error รายเฟรม
        )
      } catch {
        if (!dead) setMsg('เปิดกล้องไม่ได้ — ตรวจสิทธิ์กล้องของแอป/เบราว์เซอร์')
      }
    })()
    return () => { dead = true; stop() }
  }, [open])

  const onDecode = async (decoded: string) => {
    if (busyRef.current) return
    busyRef.current = true
    try { scannerRef.current?.pause(true) } catch {}
    setMsg('กำลังเปิดโฟลเดอร์…')
    const row = await findOrder(extractId(decoded), extractOrder(decoded))
    if (!row) {
      setMsg('ไม่เจอออเดอร์จาก QR นี้')
    } else if (!row.customer_name) {
      setMsg(`เจอออเดอร์ ${row.order_number || row.id} แต่ไม่มีชื่อลูกค้า เปิดโฟลเดอร์ไม่ได้`)
    } else {
      await stop()
      setOpen(false)
      router.push(`/m/customers?name=${encodeURIComponent(row.customer_name)}`)
      return
    }
    // สแกนใหม่ได้อีกครั้งหลังขึ้นข้อความ
    setTimeout(() => { busyRef.current = false; try { scannerRef.current?.resume() } catch {} }, 1400)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="สแกน QR เปิดโฟลเดอร์"
        style={{
          position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)',
          width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--ink-3)',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', padding: 0,
        }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 17v4" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: '#0b1220', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 10px' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>สแกน QR เปิดโฟลเดอร์</span>
            <button onClick={close} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: '6px 4px' }}>ปิด</button>
          </div>
          <div id="folder-qr-reader" style={{ width: '100%', maxWidth: 480 }} />
          <div style={{ fontSize: 13.5, opacity: 0.9, padding: '14px 20px', textAlign: 'center', lineHeight: 1.5 }}>
            {msg || 'ส่อง QR บนใบออเดอร์'}
          </div>
        </div>
      )}
    </>
  )
}
