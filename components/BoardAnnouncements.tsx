'use client'

// ประกาศจากกระดานสนทนา — โชว์บนหน้าภาพรวม (ใต้คำทักทาย เหนือการ์ด 3 ใบ)
// ดึงเฉพาะหมวด "ประกาศ" ปักหมุดขึ้นก่อน แล้วใหม่ → เก่า สูงสุด 3 เรื่อง · แถบบรรทัดเดียว ตัวใหญ่ สลับเรื่องเอง · ไม่มีประกาศ = ไม่แสดงอะไรเลย
// กดเรื่องไหน → เปิดหัวข้อนั้นในหน้ากระดานสนทนา
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listTopics, type BoardTopic } from '@/lib/boardStore'

const MAX = 3

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return m < 1 ? 'เมื่อสักครู่' : `${m} นาทีที่แล้ว`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ชม. ที่แล้ว`
  const d = Math.round(h / 24)
  return d < 7 ? `${d} วันที่แล้ว` : new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

const MEGAPHONE = 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a1.125 1.125 0 01-1.51-.46 21.49 21.49 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46'

export default function BoardAnnouncements() {
  const [items, setItems] = useState<BoardTopic[] | null>(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    listTopics().then(list => setItems(
      list.filter(t => t.category === 'ประกาศ')
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))
    ))
  }, [])

  // หลายเรื่อง = สลับโชว์ทีละเรื่องทุก 6 วิ (บรรทัดเดียว ตัวใหญ่) · กดตัวนับเพื่อไปเรื่องถัดไปเอง
  const top = (items ?? []).slice(0, MAX)
  const cur = top.length ? top[idx % top.length] : null
  useEffect(() => {
    if (top.length < 2) return
    const t = setInterval(() => setIdx(i => i + 1), 6000)
    return () => clearInterval(t)
  }, [top.length])

  if (!cur) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: 'var(--shadow)', padding: '0 18px', height: 58, marginBottom: 20 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 14px 0 10px', borderRadius: 999, background: '#F6DCD6', color: '#A0443A', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
        <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={MEGAPHONE} /></svg>
        ประกาศ
      </span>
      {/* หัวข้อ (ตัวใหญ่) + รายละเอียด (ตัวเล็กสีอ่อน) อยู่บรรทัดเดียวกัน — ยาวเกินตัดท้ายรายละเอียดก่อน หัวข้อกินได้ไม่เกินครึ่ง */}
      <Link key={cur.id} href={`/board?topic=${cur.id}`} className="ba-line" title={`${cur.title}\n${cur.body}`}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 12, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span className="ba-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0, maxWidth: '50%' }}>
          {cur.pinned && '📌 '}{cur.title}
        </span>
        {cur.body && (
          <span style={{ fontSize: 14.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{cur.body.replace(/\s*\n+\s*/g, ' ')}</span>
        )}
      </Link>
      {top.length > 1 && (
        <button onClick={() => setIdx(i => i + 1)} title="เรื่องถัดไป"
          style={{ border: '1px solid var(--border)', background: 'var(--cream-2)', borderRadius: 999, height: 28, padding: '0 10px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {(idx % top.length) + 1}/{top.length} ›
        </button>
      )}
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{cur.author} · {ago(cur.created_at)}</span>
      <Link href="/board?tab=ประกาศ" style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>ดูทั้งหมด →</Link>
      <style>{`.ba-line { animation: ba-in 380ms ease; } .ba-line:hover .ba-title { color: var(--brand) !important; } @keyframes ba-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  )
}
