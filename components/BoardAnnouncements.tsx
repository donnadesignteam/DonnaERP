'use client'

// ประกาศจากกระดานสนทนา — โชว์บนหน้าภาพรวม (ใต้คำทักทาย เหนือการ์ด 3 ใบ)
// ดึงเฉพาะหมวด "ประกาศ" ปักหมุดขึ้นก่อน แล้วใหม่ → เก่า สูงสุด 3 เรื่อง · ไม่มีประกาศ = ไม่แสดงอะไรเลย
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

  useEffect(() => {
    listTopics().then(list => setItems(
      list.filter(t => t.category === 'ประกาศ')
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))
    ))
  }, [])

  if (!items || items.length === 0) return null
  const top = items.slice(0, MAX)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow)', padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#F6DCD6', color: '#A0443A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={MEGAPHONE} /></svg>
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ประกาศ</span>
        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{items.length} เรื่อง</span>
        <Link href="/board?tab=ประกาศ" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>ดูทั้งหมด →</Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {top.map((t, i) => (
          <Link key={t.id} href={`/board?topic=${t.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', textDecoration: 'none', borderTop: i ? '1px solid var(--hairline, var(--border))' : 'none', borderRadius: 8 }}
            className="ba-row">
            {t.pinned ? <span title="ปักหมุด" style={{ fontSize: 13, width: 18, flexShrink: 0 }}>📌</span> : <span style={{ width: 18, flexShrink: 0, textAlign: 'center', color: 'var(--ink-4)' }}>•</span>}
            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0, maxWidth: '55%' }}>{t.title}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.body}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.author} · {ago(t.created_at)}{t.comments.length ? ` · 💬 ${t.comments.length}` : ''}</span>
          </Link>
        ))}
      </div>
      <style>{`.ba-row:hover { background: var(--cream-2); }`}</style>
    </div>
  )
}
