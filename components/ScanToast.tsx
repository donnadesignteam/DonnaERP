'use client'

// แจ้งเตือนแบบข้อความเด้งบนหัวจอ (เหมือน push notification ในมือถือ)
// ใช้ตอนช่างสแกนงานผ่านขั้นผลิต — เด้งบอกว่า "แผนกไหน สแกนใบไหน เป็นสถานะอะไร"
//
// ‼️ โคลนตัวนี้ยังไม่มีช่างสแกนจริง จึงมีปุ่ม "ทดสอบ" ให้ยิงแจ้งเตือนสุ่มขึ้นมาดูก่อน
//    ของจริงให้เรียก window.dispatchEvent(new CustomEvent('scan-toast', { detail: {...} }))
//    จากจุดที่บันทึกผลสแกน แล้วลบปุ่มทดสอบทิ้ง

import { useState, useEffect, useRef, useCallback } from 'react'
import { READ_ONLY } from '@/lib/readOnly'

export type ScanEvent = {
  dept: string          // แผนกที่สแกน
  status: string        // สถานะที่เปลี่ยนเป็น
  orderNumber: string
  customer: string
}

type Toast = ScanEvent & { key: number; at: Date; out?: boolean }

const MAX_ON_SCREEN = 2      // ซ้อนได้ไม่เกิน 2 ใบ ที่เกินมาต่อคิวรอจนกว่าจะมีที่ว่าง
const HOLD_MS = 5000         // ค้างบนจอก่อนเริ่มเลื่อนออก
const OUT_MS = 300           // ระยะเวลาอนิเมชั่นออก

// แผนก -> สถานะที่สแกนแล้วได้ (ใช้ทั้งของจริงและตอนสุ่มทดสอบ)
const STEPS: { dept: string; status: string }[] = [
  { dept: 'แผนกตัดผ้า',     status: 'ตัดผ้าแล้ว' },
  { dept: 'แผนกเย็บผ้า',    status: 'เย็บแล้ว' },
  { dept: 'ผู้ช่วยช่าง',     status: 'ตรวจสอบแล้ว' },
  { dept: 'แผนกรีดผ้า',     status: 'รีดแล้ว' },
  { dept: 'แผนกแพ็คสินค้า', status: 'แพ็คแล้ว' },
]

export default function ScanToast({ orders = [] }: { orders?: { order_number?: string | null; customer_name?: string | null }[] }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [auto, setAuto] = useState(false)
  const [pump, setPump] = useState(0)      // กระตุ้นให้ effect ดึงใบถัดไปจากคิวมาแสดง
  const queue = useRef<ScanEvent[]>([])
  const timers = useRef<number[]>([])
  const seq = useRef(0)
  const ordersRef = useRef(orders)
  ordersRef.current = orders

  // เข้าคิวไว้ก่อนเสมอ — effect ด้านล่างจะทยอยหยิบมาแสดงทีละใบเมื่อมีที่ว่าง
  const push = useCallback((e: ScanEvent) => {
    queue.current.push(e)
    setPump(p => p + 1)
  }, [])

  // มีที่ว่าง (ยังไม่ครบ 2 ใบ) และมีของรอคิว -> หยิบขึ้นมาแสดง 1 ใบ
  // ‼️ ตัวจับเวลาปิดต้องเก็บไว้ใน ref แล้วเคลียร์ตอน unmount เท่านั้น
  //    ห้าม return cleanup ที่ clearTimeout ใน effect นี้ เพราะ effect ผูกกับ toasts
  //    พอเพิ่มใบใหม่ toasts เปลี่ยน -> cleanup ยิงทันที -> ตัวจับเวลาโดนล้าง ข้อความเลยค้างไม่หาย
  useEffect(() => {
    if (toasts.length >= MAX_ON_SCREEN || queue.current.length === 0) return
    const e = queue.current.shift()!
    const key = ++seq.current
    setToasts(t => [...t, { ...e, key, at: new Date() }])
    timers.current.push(
      window.setTimeout(() => setToasts(t => t.map(x => x.key === key ? { ...x, out: true } : x)), HOLD_MS),
      window.setTimeout(() => {
        setToasts(t => t.filter(x => x.key !== key))
        setPump(p => p + 1)                // ว่างแล้ว ดึงใบที่รอคิวขึ้นมาต่อ
      }, HOLD_MS + OUT_MS),
    )
  }, [toasts, pump])

  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const close = (key: number) => {
    setToasts(t => t.filter(x => x.key !== key))
    setPump(p => p + 1)
  }

  // ของจริง: ยิง event นี้จากจุดที่บันทึกผลสแกน
  useEffect(() => {
    const onScan = (ev: Event) => push((ev as CustomEvent<ScanEvent>).detail)
    window.addEventListener('scan-toast', onScan)
    return () => window.removeEventListener('scan-toast', onScan)
  }, [push])

  // สุ่มออเดอร์จริงบนหน้ามาทำเป็นตัวอย่าง (ถ้ายังไม่มีข้อมูลใช้เลขสมมติ)
  const fireRandom = useCallback(() => {
    const list = ordersRef.current
    const o = list.length ? list[Math.floor(Math.random() * list.length)] : null
    const step = STEPS[Math.floor(Math.random() * STEPS.length)]
    push({
      dept: step.dept,
      status: step.status,
      orderNumber: o?.order_number || '2609' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      customer: o?.customer_name || 'ลูกค้าทดสอบ',
    })
  }, [push])

  // เปิดหน้าด้วย ?scan=1 แล้วเด้งให้ดูทันที (ยิงรวด 4 ใบ จะได้เห็นว่าเกิน 2 แล้วต่อคิวรอ)
  useEffect(() => {
    if (!READ_ONLY || !new URLSearchParams(window.location.search).has('scan')) return
    const t = setTimeout(() => { for (let i = 0; i < 4; i++) fireRandom() }, 700)
    return () => clearTimeout(t)
  }, [fireRandom])

  // โหมดทดสอบอัตโนมัติ — เด้งเองทุก 8 วินาที
  useEffect(() => {
    if (!auto) return
    const t = setInterval(fireRandom, 8000)
    return () => clearInterval(t)
  }, [auto, fireRandom])

  return (
    <>
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.key} className={`toast${t.out ? ' is-out' : ''}`} onClick={() => close(t.key)}>
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                           fontSize: 13.5, color: 'var(--ink)' }}>
              {t.orderNumber || t.customer}
              <b style={{ fontWeight: 700, color: 'var(--brand)', marginLeft: 10 }}>{t.status}</b>
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t.at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      {/* ── แผงทดสอบ (โคลนยังไม่มีช่างสแกนจริง) ลบทิ้งได้เมื่อต่อของจริงแล้ว ── */}
      {READ_ONLY && (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1900, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={fireRandom} className="dn-ctrl" style={{ height: 38, fontSize: 12.5 }}>
            ทดสอบแจ้งเตือนสแกน
          </button>
          <button onClick={() => setAuto(a => !a)} className={`dn-ctrl${auto ? ' is-on' : ''}`}
            style={{ height: 38, fontSize: 12.5 }} title="เด้งเองทุก 8 วินาที">
            {auto ? 'หยุดเด้งเอง' : 'เด้งเองอัตโนมัติ'}
          </button>
        </div>
        )}
    </>
  )
}
