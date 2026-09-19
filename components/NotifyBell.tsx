'use client'

// กระดิ่งแจ้งเตือน (อยู่ทุกหน้า — หน้าภาพรวมวางในหัวหน้า หน้าอื่นลอยมุมขวาบนจาก SidebarLayout)
//   · ของค้างอนุมัติ: ใบลาที่ยังไม่มีใครตัดสิน + เคลมที่ยื่นอุทธรณ์แล้วยังไม่ได้ตัดสิน
//   · ความเคลื่อนไหวในหมวด "ตามงาน" 7 วันล่าสุด (หัวข้อใหม่/ตอบกลับ) — เลขแดงนับเฉพาะที่ยังไม่ได้เปิดกระดิ่งดู
// ‼️ อยู่ทุกหน้า = โหลดบ่อย → กรองที่ฐานข้อมูลก่อนเสมอ (ไม่ดึงทั้งตาราง) กิน egress น้อย
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { isApproved } from '@/lib/leave'
import { currentAuthor } from '@/lib/boardStore'
import { READ_ONLY } from '@/lib/readOnly'

// วันที่แบบไทยสั้นๆ (ชุดเดียวกับหน้างานเคลม)
const thaiDate = (v: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  return thaiDate(iso)
}

type LeaveRow = {
  id: string
  employee_nickname: string
  employee_name: string
  leave_date: string
  leave_type: string
  supervisor_approval: string
  hr_approval: string
  leave_status: string
}

type ClaimRow = {
  id: string
  fault_by: string | null
  claim_date: string | null
  original_order_number: string | null
  fault_review: string | null
  fault_appeal: string | null
  fault_appeal_at: string | null
}

type Kind = 'leave' | 'appeal' | 'board'
type Item = { key: string; href: string; who: string; what: string; when: string; kind: Kind; ts?: string }

// ของค้างอนุมัติ (ใบลา/อุทธรณ์เคลม) — ปิดไว้ก่อน user สั่ง 19ก.ย.69 "แจ้งแค่เรื่องมีคนโพสตามงานก่อน" · เปิดคืน = true
const SHOW_APPROVALS = false

const SEEN_KEY = 'dn-board-seen'   // เวลาที่เปิดกระดิ่งดูล่าสุด (ต่อเครื่อง) — ใหม่กว่านี้ = ยังไม่ได้อ่าน
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' } }
const writeSeen = (v: string) => { try { localStorage.setItem(SEEN_KEY, v) } catch { /* ปิดที่เก็บข้อมูล = ไม่จำ */ } }

const ICON: Record<Kind, { bg: string; ink: string; d: string }> = {
  leave: { bg: 'var(--cream)', ink: 'var(--brand)', d: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
  appeal: { bg: 'var(--red-bg)', ink: 'var(--red)', d: 'M12 9v3.75m9-1.5a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  board: { bg: '#EFE3D4', ink: '#6B4326', d: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
}

// ข้อมูลกระดิ่งอยู่ที่ NotifyProvider (ครอบทุกหน้าใน SidebarLayout) ตัวเดียว — เปลี่ยนหน้าไม่ต้องโหลดใหม่
// ปุ่มกระดิ่ง (NotifyBell) วางในหัวหน้าของแต่ละหน้า ข้างซ้ายปุ่มปริ้น/เพิ่มรายการ แล้วอ่านข้อมูลจากที่นี่
type NotifyState = { approvals: Item[]; board: Item[]; ready: boolean; seen: string; markSeen: () => string }
const NotifyCtx = createContext<NotifyState | null>(null)

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [approvals, setApprovals] = useState<Item[]>([])
  const [board, setBoard] = useState<Item[]>([])
  const [ready, setReady] = useState(false)
  const [seen, setSeen] = useState('')          // เวลาที่เปิดดูล่าสุด

  // ── ของค้างอนุมัติ ──
  const loadApprovals = useCallback(async () => {
    if (!SHOW_APPROVALS) return   // ไม่ดึงเลย = ไม่กิน egress
    const out: Item[] = []
    // ใบลา: ย้อนหลัง 120 วัน + ล่วงหน้า (ใบเก่ากว่านี้ที่ค้างไม่มีใครอนุมัติแล้ว ไม่ต้องดึงมาทุกรอบ)
    const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
    const { data: leaves } = await fetchAllRows<LeaveRow>(() =>
      supabase.from('leave_requests')
        .select('id, employee_nickname, employee_name, leave_date, leave_type, supervisor_approval, hr_approval, leave_status')
        .gte('leave_date', since)
        .order('leave_date', { ascending: false }))
    for (const l of (leaves ?? [])) {
      if (isApproved(l as never)) continue
      if (l.supervisor_approval === 'ไม่อนุมัติ' || l.hr_approval === 'ไม่อนุมัติ') continue
      out.push({
        key: 'l' + l.id, href: '/employees', kind: 'leave',
        who: l.employee_nickname || l.employee_name || 'พนักงาน',
        what: `ยื่น${l.leave_type || 'ใบลา'}`,
        when: thaiDate(l.leave_date),
      })
    }
    // เคลมที่ยื่นอุทธรณ์ — ดึงเฉพาะแถวที่มีคำอุทธรณ์ (คอลัมน์จาก sql/add_claim_fault_appeal.sql · ยังไม่รัน = ข้าม)
    const { data: claims, error: claimErr } = await fetchAllRows<ClaimRow>(() =>
      supabase.from('claims')
        .select('id, fault_by, claim_date, original_order_number, fault_review, fault_appeal, fault_appeal_at')
        .not('fault_appeal', 'is', null)
        .order('id', { ascending: false }))
    if (!claimErr) {
      for (const c of (claims ?? [])) {
        if (!(c.fault_appeal ?? '').trim()) continue
        if (c.fault_review === 'ตรวจสอบแล้วไม่พบความผิด') continue
        out.push({
          key: 'c' + c.id, href: '/staff/claims', kind: 'appeal',
          who: c.fault_by || 'พนักงาน',
          what: `ยื่นอุทธรณ์งานเคลม${c.original_order_number ? ' ' + c.original_order_number : ''}`,
          when: thaiDate(c.fault_appeal_at ?? c.claim_date),
        })
      }
    }
    setApprovals(out)
  }, [])

  // ── ตามงาน 7 วันล่าสุด (ไม่นับของตัวเอง) ──
  const loadBoard = useCallback(async () => {
    if (READ_ONLY) return   // โคลนเก็บกระดานในเบราว์เซอร์
    const me = currentAuthor()
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const [tp, cm] = await Promise.all([
      supabase.from('board_topics').select('id, title, author, category, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(40),
      supabase.from('board_comments').select('id, topic_id, author, created_at, board_topics(title)').gte('created_at', since).order('created_at', { ascending: false }).limit(60),
    ])
    const out: Item[] = []
    for (const t of (tp.data ?? []) as { id: string; title: string; author: string; category: string; created_at: string }[]) {
      if (t.author === me) continue
      out.push({ key: 'bt' + t.id, href: `/board?topic=${t.id}`, kind: 'board', who: t.author, what: `ตั้งหัวข้อ “${t.title}”`, when: ago(t.created_at), ts: t.created_at })
    }
    for (const c of (cm.data ?? []) as unknown as { id: string; topic_id: string; author: string; created_at: string; board_topics: { title: string } | null }[]) {
      if (c.author === me) continue
      out.push({ key: 'bc' + c.id, href: `/board?topic=${c.topic_id}`, kind: 'board', who: c.author, what: `ตอบใน “${c.board_topics?.title ?? 'หัวข้อ'}”`, when: ago(c.created_at), ts: c.created_at })
    }
    out.sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''))
    setBoard(out)
  }, [])

  useEffect(() => {
    setSeen(readSeen())   // eslint-disable-line react-hooks/set-state-in-effect
    const all = () => Promise.all([loadApprovals(), loadBoard()]).then(() => setReady(true))
    all()
    const t = setInterval(all, 120000)   // เช็กใหม่ทุก 2 นาที (ตามงานมี realtime ช่วยอีกทาง)
    const onBoard = () => { loadBoard() }
    window.addEventListener('board-activity', onBoard)
    return () => { clearInterval(t); window.removeEventListener('board-activity', onBoard) }
  }, [loadApprovals, loadBoard])

  const markSeen = useCallback(() => {
    const prev = seen
    const now = new Date().toISOString()
    setSeen(now); writeSeen(now)
    return prev
  }, [seen])

  return <NotifyCtx.Provider value={{ approvals, board, ready, seen, markSeen }}>{children}</NotifyCtx.Provider>
}

export default function NotifyBell() {
  const ctx = useContext(NotifyCtx)
  const [open, setOpen] = useState(false)
  const [seenAtOpen, setSeenAtOpen] = useState('')  // ค่าตอนเปิดกล่อง — ไว้ไฮไลต์อันที่เพิ่งเข้ามาระหว่างดู
  const boxRef = useRef<HTMLDivElement>(null)

  // คลิกนอกกล่องแล้วปิด
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!ctx) return null
  const { approvals, board, ready, seen, markSeen } = ctx
  const unread = board.filter(b => (b.ts ?? '') > seen)
  const badge = approvals.length + unread.length
  const toggle = () => {
    // เปิดดู = อ่านแล้ว · จำค่าก่อนหน้าไว้ไฮไลต์อันใหม่ในรอบนี้
    if (!open) setSeenAtOpen(markSeen())
    setOpen(o => !o)
  }
  const leaveCount = approvals.filter(i => i.kind === 'leave').length
  const appealCount = approvals.filter(i => i.kind === 'appeal').length

  const row = (it: Item, fresh = false) => (
    <Link key={it.key} href={it.href} onClick={() => setOpen(false)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 18px', textDecoration: 'none',
               borderBottom: '1px solid var(--border)', background: fresh ? '#F7F0E8' : 'transparent' }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: ICON[it.kind].bg, color: ICON[it.kind].ink,
                     display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={ICON[it.kind].d} /></svg>
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
          <b style={{ fontWeight: 600 }}>{it.who}</b> {it.what}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{it.when}</span>
      </span>
      {fresh && <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', marginTop: 8, flexShrink: 0 }} />}
    </Link>
  )
  const section = (label: string) => (
    <div style={{ padding: '10px 18px 6px', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-4)', background: 'var(--cream-2, var(--bg))', borderBottom: '1px solid var(--border)' }}>{label}</div>
  )

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={toggle} title="การแจ้งเตือน"
        style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)',
                 boxShadow: 'var(--shadow)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                 color: 'var(--brand)', flexShrink: 0, position: 'relative' }}>
        <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
        </svg>
        {/* จุดแดง = ของค้างอนุมัติ + ตามงานที่ยังไม่ได้เปิดดู */}
        {ready && badge > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, padding: '0 4px',
                         borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700,
                         display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 480, overflowY: 'auto',
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                      boxShadow: 'var(--shadow-md)', zIndex: 300 }}>
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>การแจ้งเตือน</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
              {!ready ? 'กำลังโหลด…' : SHOW_APPROVALS ? `ค้างอนุมัติ ${approvals.length} (ใบลา ${leaveCount} · อุทธรณ์ ${appealCount}) · ตามงาน 7 วัน ${board.length}` : `ความเคลื่อนไหวในตามงาน 7 วันล่าสุด · ${board.length} รายการ`}
            </div>
          </div>

          {ready && approvals.length === 0 && board.length === 0 && (
            <div style={{ padding: '24px 18px', fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>ไม่มีอะไรใหม่</div>
          )}

          {board.length > 0 && section('ตามงาน')}
          {board.slice(0, 30).map(it => row(it, (it.ts ?? '') > seenAtOpen))}

          {approvals.length > 0 && section('ของค้างอนุมัติ')}
          {approvals.slice(0, 40).map(it => row(it))}
          {approvals.length > 40 && (
            <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--ink-4)' }}>และอีก {approvals.length - 40} รายการ</div>
          )}
        </div>
      )}
    </div>
  )
}
