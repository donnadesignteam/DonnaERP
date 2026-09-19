'use client'

// เด้งแจ้งเตือนเมื่อมีคนโพสต์ในหมวด "ตามงาน" (หัวข้อใหม่ / ตอบกลับ) — อยู่ทุกหน้า (วางใน SidebarLayout)
// ใช้ Supabase Realtime (INSERT ของ board_topics / board_comments) ไม่ต้องโหลดซ้ำเป็นรอบ ๆ
// ‼️ ตารางต้องอยู่ใน publication supabase_realtime (sql/board_media_realtime.sql) ไม่งั้นจะไม่เด้ง
// โพสต์ของตัวเองไม่เด้ง · กดข้อความ = เปิดหัวข้อนั้น · ยิง event 'board-activity' ให้กระดิ่งโหลดใหม่
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { currentAuthor } from '@/lib/boardStore'
import { READ_ONLY } from '@/lib/readOnly'
import { markTopicRead } from './NotifyBell'

type Toast = { key: string; topicId: string; who: string; what: string; title: string; at: Date; out?: boolean }
const SHOW_MS = 7000

export default function BoardToast() {
  const router = useRouter()
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const close = useCallback((key: string) => {
    setToasts(ts => ts.map(t => (t.key === key ? { ...t, out: true } : t)))
    setTimeout(() => setToasts(ts => ts.filter(t => t.key !== key)), 260)
  }, [])

  const push = useCallback((t: Omit<Toast, 'key' | 'at'>) => {
    const key = Math.random().toString(36).slice(2)
    setToasts(ts => [...ts.slice(-2), { ...t, key, at: new Date() }])   // ซ้อนได้ 3 ใบ
    timers.current[key] = setTimeout(() => close(key), SHOW_MS)
  }, [close])

  useEffect(() => {
    if (READ_ONLY) return   // โคลนเก็บกระดานในเบราว์เซอร์ ไม่มี realtime
    const me = currentAuthor()
    const ch = supabase.channel('board_notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'board_topics' }, ({ new: row }) => {
        const r = row as { id: string; author: string; title: string; category: string }
        window.dispatchEvent(new Event('board-activity'))
        if (r.author === me) return
        push({ topicId: r.id, who: r.author, what: `ตั้งหัวข้อใหม่ · ${r.category}`, title: r.title })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'board_comments' }, async ({ new: row }) => {
        const r = row as { topic_id: string; author: string; body: string }
        window.dispatchEvent(new Event('board-activity'))
        if (r.author === me) return
        const { data } = await supabase.from('board_topics').select('title').eq('id', r.topic_id).maybeSingle()
        push({ topicId: r.topic_id, who: r.author, what: 'ตอบกลับ', title: (data as { title: string } | null)?.title || r.body || 'หัวข้อในตามงาน' })
      })
      .subscribe()
    const tm = timers.current
    return () => { supabase.removeChannel(ch); Object.values(tm).forEach(clearTimeout) }
  }, [push])

  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.key} className={`toast${t.out ? ' is-out' : ''}`}
          onClick={() => { close(t.key); markTopicRead(t.topicId); router.push(`/board?topic=${t.topicId}`) }} title="เปิดหัวข้อนี้">
          <span className="toast-icon" style={{ background: 'var(--cream)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <b style={{ fontWeight: 700 }}>{t.who}</b> <span style={{ color: 'var(--ink-3)' }}>{t.what}</span>
            </span>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {t.at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
