'use client'

// หมวด "กระดานสนทนา" — คุยกันเป็นหัวข้อตามงาน (แทนแชต: เรื่องไม่จมหาย, ผูกกับออเดอร์ได้, ไม่ต้องเปิด realtime ค้าง)
// ซ้าย = รายการหัวข้อ (ปักหมุดอยู่บนสุด แล้วเรียงตามความเคลื่อนไหวล่าสุด) · ขวา = หัวข้อที่เลือก + ความคิดเห็น
// ‼️ ข้อมูลตอนนี้อยู่ในเบราว์เซอร์ (lib/boardStore.ts) — โคลนเขียนฐานจริงไม่ได้ · ตารางจริงเตรียมไว้ที่ sql/create_board.sql
import { useEffect, useMemo, useRef, useState } from 'react'
import CreamSelect from '@/components/CreamSelect'
import OrderDetailModal from '@/components/OrderDetailModal'
import AnchoredMenu from '@/components/AnchoredMenu'
import { INSTALL_ICON_PATH } from '@/components/BrandMark'
import { supabase } from '@/lib/supabase'
import {
  BOARD_CATEGORIES, BOARD_STATUSES, currentAuthor,
  listTopics, createTopic, addComment, toggleLike, updateTopic, deleteTopic, deleteComment,
  type BoardTopic, type BoardCategory, type BoardStatus,
} from '@/lib/boardStore'

// สีป้ายหมวด (พาสเทลโทนเดียวกับป้ายสถานะทั้งเว็บ)
const CAT_STYLE: Record<BoardCategory, { bg: string; ink: string; icon: string }> = {
  'ประกาศ':      { bg: '#F6DCD6', ink: '#A0443A', icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a1.125 1.125 0 01-1.51-.46 21.49 21.49 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46' },
  'งานทั่วไป':   { bg: '#EFE3D4', ink: '#6B4326', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
  'งานออเดอร์':  { bg: '#DDE6F4', ink: '#3D5A8A', icon: 'M9 12h6m-6 3h6M7.5 3h9A1.5 1.5 0 0118 4.5v15a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5v-15A1.5 1.5 0 017.5 3z' },
  'งานติดตั้ง':  { bg: '#DDEEDD', ink: '#2F6B3A', icon: INSTALL_ICON_PATH },
  'ปัญหา/แก้ไข': { bg: '#FBE3C8', ink: '#9A5B14', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  'ลูกค้า':      { bg: '#EBDDF0', ink: '#6E3F85', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
  'ไอเดีย':      { bg: '#F8EBC4', ink: '#8A6A12', icon: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18' },
}
const STATUS_STYLE: Record<BoardStatus, { bg: string; ink: string }> = {
  'รอตอบ':  { bg: '#FBE3C8', ink: '#9A5B14' },
  'กำลังทำ': { bg: '#DDE6F4', ink: '#3D5A8A' },
  'ปิดแล้ว': { bg: '#E3F3E0', ink: '#1F8A3B' },
}
const SORTS = [
  { value: 'recent', label: 'เรียงตามล่าสุด' },
  { value: 'comments', label: 'ความคิดเห็นมากสุด' },
  { value: 'open', label: 'เรื่องที่ยังไม่ปิด' },
]

// อวาตาร์ = ตัวอักษรแรกของชื่อบนวงกลมสี (สีคงที่ต่อชื่อ) · ข้ามสระหน้า เ แ โ ใ ไ (แอดมิน → อ)
const AVATAR_BG = ['#E8D2BD', '#D9C3E3', '#C9DCEB', '#CFE3CB', '#F1D1C4', '#E9DDB4', '#D6D0C8']
function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const h = [...name].reduce((s, c) => s + c.charCodeAt(0), 0)
  return (
    <span title={name} style={{ width: size, height: size, borderRadius: '50%', background: AVATAR_BG[h % AVATAR_BG.length], color: '#5C4534', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 700, flexShrink: 0 }}>
      {[...name].find(ch => !'เแโใไ'.includes(ch)) ?? '?'}
    </span>
  )
}

function Icon({ d, size = 18, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" stroke={color} strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
}

function Pill({ label, bg, ink }: { label: string; bg: string; ink: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 999, background: bg, color: ink, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
}

// "3 ชม. ที่แล้ว" — เกิน 7 วันโชว์วันที่
function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ชม. ที่แล้ว`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} วันที่แล้ว`
  return fullDate(iso, false)
}
function fullDate(iso: string, withTime = true): string {
  const d = new Date(iso)
  const s = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  return withTime ? `${s} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : s
}

// ไฮไลต์ @ชื่อ ในข้อความ
function RichText({ text }: { text: string }) {
  const parts = text.split(/(@[^\s@]+)/g)
  return <>{parts.map((p, i) => p.startsWith('@') ? <b key={i} style={{ color: 'var(--brand)' }}>{p}</b> : <span key={i}>{p}</span>)}</>
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--shadow)' }

export default function BoardPage() {
  const [topics, setTopics] = useState<BoardTopic[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<'all' | BoardCategory>('all')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState<{ rect: DOMRect } | null>(null)
  const [orderOpen, setOrderOpen] = useState<string | null>(null)
  const [orderMsg, setOrderMsg] = useState('')
  const [me, setMe] = useState('แอดมิน')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listTopics().then(list => { setTopics(list); setLoaded(true) })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMe(currentAuthor())
    // มาจากลิงก์ (เช่นประกาศบนหน้าภาพรวม): ?topic=<id> เปิดหัวข้อนั้น · ?tab=<หมวด> เปิดแท็บนั้น
    const p = new URLSearchParams(window.location.search)
    const tp = p.get('topic'), tb = p.get('tab')
    if (tp) setSelId(tp)
    if (tb && (BOARD_CATEGORIES as readonly string[]).includes(tb)) setTab(tb as BoardCategory)
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: topics.length }
    for (const t of topics) c[t.category] = (c[t.category] ?? 0) + 1
    return c
  }, [topics])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = topics.filter(t => tab === 'all' || t.category === tab)
    if (sort === 'open') list = list.filter(t => t.status && t.status !== 'ปิดแล้ว')
    if (q) list = list.filter(t => [t.title, t.body, t.author, t.order_number ?? '', t.order_label ?? '', ...t.comments.map(c => c.body + ' ' + c.author)].join(' ').toLowerCase().includes(q))
    const key = (t: BoardTopic) => sort === 'comments' ? String(t.comments.length).padStart(6, '0') : t.last_activity_at
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || key(b).localeCompare(key(a)))
  }, [topics, tab, sort, search])

  const sel = topics.find(t => t.id === selId) ?? shown[0] ?? null

  // เลือกหัวข้ออื่น → ล้างกล่องพิมพ์ที่ค้าง
  const pick = (id: string) => { setSelId(id); setDraft(''); setOrderMsg('') }

  const send = async () => {
    if (!sel || !draft.trim()) return
    setTopics(await addComment(sel.id, draft))
    setDraft('')
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }

  // กดเลขออเดอร์ → หา id ในฐานจริง (อ่านได้) แล้วเปิดรายละเอียดออเดอร์
  const openOrder = async (no: string) => {
    setOrderMsg('กำลังค้นหาออเดอร์…')
    const { data } = await supabase.from('order_entries').select('id').eq('order_number', no).limit(1)
    const id = (data as { id: string }[] | null)?.[0]?.id
    if (id) { setOrderMsg(''); setOrderOpen(id) } else setOrderMsg(`ไม่พบออเดอร์ ${no} ในระบบ`)
  }

  return (
    <div>
      {/* หัวหน้า — ชุดเดียวกับหน้าอื่นในธีม */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#4A3122', letterSpacing: '-0.5px' }}>กระดานสนทนา</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 2 }}>พูดคุย แลกเปลี่ยนข้อมูล และติดตามงานของทีม</p>
        </div>
        <button onClick={() => setCreating(true)}
          style={{ background: 'var(--brand)', color: '#FFF8F0', border: 'none', borderRadius: 999, height: 46, padding: '0 26px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 10px rgba(158,106,73,0.35)' }}>
          ＋ สร้างหัวข้อใหม่
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(360px, 1fr)', gap: 20, alignItems: 'start' }} className="bd-grid">
        {/* ── ซ้าย: รายการหัวข้อ ── */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
              <svg width="17" height="17" fill="none" stroke="#8B7460" strokeWidth="1.8" viewBox="0 0 24 24" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาหัวข้อ, คีย์เวิร์ด, ชื่อพนักงาน หรือเลขออเดอร์…" className="ow-field"
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 999, height: 42, padding: '0 16px 0 42px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)' }} />
            </div>
            <CreamSelect value={sort} onChange={setSort} options={SORTS} className="ow-select" style={{ height: 42 }} align="right" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {(['all', ...BOARD_CATEGORIES] as const).map(k => (
              <button key={k} className="ow-tab" data-active={tab === k ? '' : undefined} onClick={() => setTab(k)} style={{ height: 34, padding: '0 14px', fontSize: 13 }}>
                {k === 'all' ? 'ทั้งหมด' : k}
                {(counts[k] ?? 0) > 0 && <span className="ow-tab-n">{counts[k]}</span>}
              </button>
            ))}
          </div>

          {!loaded ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
          ) : shown.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
              {search ? 'ไม่พบหัวข้อที่ค้นหา' : 'ยังไม่มีหัวข้อในหมวดนี้ — กด "สร้างหัวข้อใหม่" เพื่อเริ่มคุย'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map(t => {
                const cs = CAT_STYLE[t.category]
                const active = sel?.id === t.id
                return (
                  <button key={t.id} onClick={() => pick(t.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${active ? 'var(--brand-soft)' : 'var(--hairline, var(--border))'}`, background: active ? '#F4E9DD' : t.pinned ? '#F7F0E8' : 'transparent' }}>
                    <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--cream)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#6B4326' }}>
                      <Icon d={cs.icon} size={19} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {t.pinned && <span title="ปักหมุด" style={{ fontSize: 12 }}>📌</span>}
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{t.title}</span>
                        <Pill label={t.category} bg={cs.bg} ink={cs.ink} />
                        {t.status && <Pill label={t.status} {...STATUS_STYLE[t.status]} />}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 12, color: 'var(--ink-3)' }} className="bd-meta">
                      <Avatar name={t.author} size={26} />
                      <span style={{ width: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.author}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: 36 }}>
                        <Icon d={CAT_STYLE['งานทั่วไป'].icon} size={14} />{t.comments.length}
                      </span>
                      <span style={{ width: 78, textAlign: 'right', whiteSpace: 'nowrap' }}>{ago(t.last_activity_at)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── ขวา: หัวข้อที่เลือก ── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', minHeight: 420 }}>
          {!sel ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, margin: 'auto' }}>เลือกหัวข้อทางซ้ายเพื่ออ่าน</div>
          ) : (
            <>
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--hairline, var(--border))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Pill label={sel.category} bg={CAT_STYLE[sel.category].bg} ink={CAT_STYLE[sel.category].ink} />
                  {sel.status && (
                    <CreamSelect value={sel.status} onChange={async v => setTopics(await updateTopic(sel.id, { status: v as BoardStatus }))}
                      options={BOARD_STATUSES.map(s => ({ value: s, label: s }))} title="สถานะเรื่อง"
                      style={{ height: 26, borderRadius: 999, padding: '0 10px', fontSize: 11.5, fontWeight: 700, background: STATUS_STYLE[sel.status].bg, color: STATUS_STYLE[sel.status].ink, border: 'none' }} />
                  )}
                  {sel.pinned && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>📌 ปักหมุด</span>}
                  <button onClick={e => setMenu({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })} title="ตัวเลือก"
                    style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)', lineHeight: 1, padding: '2px 6px' }}>···</button>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginTop: 10, lineHeight: 1.35 }}>{sel.title}</h2>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{fullDate(sel.created_at)} โดย {sel.author}</div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Avatar name={sel.author} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{sel.author} <span style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--ink-4)', marginLeft: 6 }}>{fullDate(sel.created_at)}</span></div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}><RichText text={sel.body} /></div>
                    {(sel.order_id || sel.order_number) && (
                      <button onClick={() => sel.order_id ? setOrderOpen(sel.order_id) : openOrder(sel.order_number!)}
                        style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--cream-2)', padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' }}>
                        <Icon d={CAT_STYLE['งานออเดอร์'].icon} size={16} color="var(--brand)" />
                        {sel.order_label || `ออเดอร์ #${sel.order_number}`}
                        <span style={{ color: 'var(--brand)', fontWeight: 600 }}>เปิดดู →</span>
                      </button>
                    )}
                    {orderMsg && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{orderMsg}</div>}
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', margin: '20px 0 10px' }}>ความคิดเห็น ({sel.comments.length})</div>
                {sel.comments.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '8px 0' }}>ยังไม่มีความคิดเห็น — เป็นคนแรกที่ตอบ</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sel.comments.map(c => {
                    const liked = c.likes.includes(me)
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                        <Avatar name={c.author} size={32} />
                        <div style={{ flex: 1, minWidth: 0, background: 'var(--cream-2)', borderRadius: 14, padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{c.author}</span>
                            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{fullDate(c.created_at)}</span>
                            {c.author === me && (
                              <button onClick={async () => setTopics(await deleteComment(sel.id, c.id))} title="ลบความคิดเห็นนี้"
                                style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 11 }}>ลบ</button>
                            )}
                          </div>
                          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}><RichText text={c.body} /></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                            <button onClick={async () => setTopics(await toggleLike(sel.id, c.id))} title={c.likes.length ? `ถูกใจโดย ${c.likes.join(', ')}` : 'ถูกใจ'}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${liked ? 'var(--brand-soft)' : 'var(--border)'}`, background: liked ? '#F4E9DD' : 'var(--surface)', borderRadius: 999, padding: '2px 10px', cursor: 'pointer', fontSize: 12, color: liked ? 'var(--brand)' : 'var(--ink-3)', fontFamily: 'inherit' }}>
                              👍 {c.likes.length || ''}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={endRef} />
                </div>
              </div>

              {/* กล่องตอบ — Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่ */}
              <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--hairline, var(--border))', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <Avatar name={me} size={32} />
                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '8px 10px 8px 14px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="พิมพ์ข้อความ… (พิมพ์ @ชื่อ เพื่อเรียกคน)"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                    style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }} />
                  <button onClick={send} disabled={!draft.trim()} title="ส่ง"
                    style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: draft.trim() ? 'var(--brand)' : 'var(--cream)', color: '#FFF8F0', cursor: draft.trim() ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {menu && sel && (() => {
        const items: { label: string; danger?: boolean; run: () => Promise<BoardTopic[]> }[] = [
          { label: sel.pinned ? 'เลิกปักหมุด' : '📌 ปักหมุดไว้บนสุด', run: () => updateTopic(sel.id, { pinned: !sel.pinned }) },
          ...(!sel.status ? [{ label: 'ติดตามสถานะ (รอตอบ/กำลังทำ/ปิดแล้ว)', run: () => updateTopic(sel.id, { status: 'รอตอบ' }) }] : []),
          ...(sel.status && sel.status !== 'ปิดแล้ว' ? [{ label: '✓ ปิดเรื่อง', run: () => updateTopic(sel.id, { status: 'ปิดแล้ว' }) }] : []),
          { label: 'ลบหัวข้อนี้', danger: true, run: () => { setSelId(null); return deleteTopic(sel.id) } },
        ]
        return (
          <>
            <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
            <AnchoredMenu rect={menu.rect} minWidth={220} className="ow-drop">
              {items.map(it => (
                <button key={it.label} onClick={async () => { setMenu(null); setTopics(await it.run()) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: it.danger ? 'var(--red)' : 'var(--ink)' }}>{it.label}</button>
              ))}
            </AnchoredMenu>
          </>
        )
      })()}

      {creating && <NewTopicModal onClose={() => setCreating(false)} defaultCategory={tab === 'all' ? 'งานทั่วไป' : tab}
        onCreate={async t => { const created = await createTopic(t); setTopics(await listTopics()); setSelId(created.id); setCreating(false) }} />}

      {orderOpen && <OrderDetailModal id={orderOpen} onClose={() => setOrderOpen(null)} />}

      <style>{`
        @media (max-width: 1100px) { .bd-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 720px) { .bd-meta > span:nth-child(2) { display: none; } }
      `}</style>
    </div>
  )
}

function NewTopicModal({ onClose, onCreate, defaultCategory }: {
  onClose: () => void
  onCreate: (t: { category: BoardCategory; title: string; body: string; order_number: string | null; order_id: string | null; order_label: string | null }) => void
  defaultCategory: BoardCategory
}) {
  const [category, setCategory] = useState<BoardCategory>(defaultCategory)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [order, setOrder] = useState<OrderHit | null>(null)
  const ok = title.trim().length > 0
  const input: React.CSSProperties = { width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit' }
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 560, maxWidth: '100%', padding: 26 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>สร้างหัวข้อใหม่</h3>
        <div style={{ marginBottom: 14 }}>
          <span style={label}>หมวด</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BOARD_CATEGORIES.map(c => (
              <button key={c} className="ow-tab" data-active={category === c ? '' : undefined} onClick={() => setCategory(c)} style={{ height: 32, padding: '0 13px', fontSize: 12.5 }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={label}>หัวข้อ</span>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น ออเดอร์ 2609… ลูกค้าขอเปลี่ยนสีผ้า" style={input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={label}>รายละเอียด</span>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="เล่าเรื่องให้คนอ่านเข้าใจ — พิมพ์ @ชื่อ เพื่อเรียกคนที่เกี่ยวข้อง" style={{ ...input, resize: 'vertical', lineHeight: 1.55 }} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <span style={label}>ออเดอร์ที่เกี่ยวข้อง <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(ถ้ามี — กดเปิดดูออเดอร์จากหัวข้อได้)</span></span>
          <OrderPicker value={order} onChange={setOrder} inputStyle={input} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 999, height: 42, padding: '0 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button disabled={!ok} onClick={() => onCreate({ category, title, body, order_number: order?.order_number ?? null, order_id: order?.id ?? null, order_label: order ? orderLabel(order) : null })}
            style={{ border: 'none', background: ok ? 'var(--brand)' : 'var(--cream)', color: '#FFF8F0', borderRadius: 999, height: 42, padding: '0 24px', fontSize: 14, fontWeight: 600, cursor: ok ? 'pointer' : 'default', fontFamily: 'inherit' }}>โพสต์หัวข้อ</button>
        </div>
      </div>
    </div>
  )
}

// ── ค้นหาออเดอร์ลูกค้า: พิมพ์ชื่อลูกค้า / เลขออเดอร์ / เลขที่ใบ (Serial เช่น DR0042) ──
// ค้นในฐานจริง (อ่านอย่างเดียว) ทีละ 8 ใบ ใหม่ → เก่า · รอพิมพ์หยุด 0.3 วิ ค่อยค้น (ไม่ยิงทุกตัวอักษร)
type OrderHit = { id: string; order_number: string | null; serial_no?: string | null; customer_name: string | null; order_status: string | null; created_at: string }
const orderLabel = (o: OrderHit) => [o.serial_no, o.customer_name, o.order_number ? '#' + o.order_number : ''].filter(Boolean).join(' · ') || 'ออเดอร์'

function OrderPicker({ value, onChange, inputStyle }: { value: OrderHit | null; onChange: (o: OrderHit | null) => void; inputStyle: React.CSSProperties }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<OrderHit[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const kw = q.trim().replace(/[,()*%\\]/g, '')   // ตัดอักขระที่ทำให้ตัวกรอง .or() พัง
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (kw.length < 2) { setHits([]); setErr(''); return }
    let alive = true
    const t = setTimeout(async () => {
      setBusy(true)
      const base = 'id, order_number, customer_name, order_status, created_at'
      const run = (cols: string, fields: string[]) => supabase.from('order_entries').select(cols)
        .or(fields.map(f => `${f}.ilike.*${kw}*`).join(',')).order('created_at', { ascending: false }).limit(8)
      let r = await run(`${base}, serial_no`, ['customer_name', 'order_number', 'serial_no'])
      if (r.error) r = await run(base, ['customer_name', 'order_number'])   // ยังไม่มีคอลัมน์ serial_no
      if (!alive) return
      setBusy(false)
      if (r.error) { setErr(r.error.message); setHits([]) } else { setErr(''); setHits((r.data ?? []) as unknown as OrderHit[]) }
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  if (value) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: '1px solid var(--brand-soft)', background: '#F4E9DD', borderRadius: 12, padding: '8px 12px', maxWidth: '100%' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orderLabel(value)}</span>
        {value.order_status && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{value.order_status}</span>}
        <button onClick={() => onChange(null)} title="เอาออก" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, padding: 0 }}>✕</button>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อลูกค้า / เลขออเดอร์ / Serial (เช่น DR0042)" style={inputStyle} />
      {q.trim().length >= 2 && (
        <div className="ow-drop" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', zIndex: 10, maxHeight: 280, overflowY: 'auto', padding: 4 }}>
          {busy && hits.length === 0 ? <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--ink-3)' }}>กำลังค้นหา…</div>
            : err ? <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--red)' }}>ค้นหาไม่สำเร็จ: {err}</div>
            : hits.length === 0 ? <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--ink-3)' }}>ไม่พบออเดอร์</div>
            : hits.map(o => (
              <button key={o.id} onClick={() => { onChange(o); setQ('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', width: 58, flexShrink: 0 }}>{o.serial_no || '—'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name || '(ไม่ระบุชื่อลูกค้า)'}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)' }}>{o.order_number ? '#' + o.order_number : 'ไม่มีเลขออเดอร์'} · {new Date(o.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                </span>
                {o.order_status && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{o.order_status}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
