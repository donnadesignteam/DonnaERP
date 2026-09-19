'use client'

// หมวด "ตามงาน" (เดิมชื่อกระดานสนทนา) — คุยกันเป็นหัวข้อตามงาน (แทนแชต: เรื่องไม่จมหาย, ผูกกับออเดอร์ได้, ไม่ต้องเปิด realtime ค้าง)
// ซ้าย = รายการหัวข้อ (ปักหมุดอยู่บนสุด แล้วเรียงตามความเคลื่อนไหวล่าสุด) · ขวา = หัวข้อที่เลือก + ความคิดเห็น
// ข้อมูล: เว็บจริงเก็บใน Supabase (ทุกคนเห็นเหมือนกัน) · โคลนโหมดอ่านอย่างเดียวเก็บในเบราว์เซอร์ — ดู lib/boardStore.ts
import { useEffect, useMemo, useRef, useState } from 'react'
import CreamSelect from '@/components/CreamSelect'
import OrderDetailModal from '@/components/OrderDetailModal'
import AnchoredMenu from '@/components/AnchoredMenu'
import { INSTALL_ICON_PATH } from '@/components/BrandMark'
import { supabase } from '@/lib/supabase'
import { fetchEmployeeOptions, type EmployeeOption } from '@/lib/staffDb'
import { uploadBoardMedia, MAX_MEDIA, type BoardMedia } from '@/lib/boardMedia'
import {
  BOARD_CATEGORIES, BOARD_STATUSES, currentAuthor,
  listTopics, createTopic, addComment, toggleLike, updateTopic, deleteTopic, deleteComment,
  type BoardTopic, type BoardCategory, type BoardStatus,
} from '@/lib/boardStore'

// สีป้ายหมวด (พาสเทลโทนเดียวกับป้ายสถานะทั้งเว็บ)
const CAT_STYLE: Record<string, { bg: string; ink: string; icon: string }> = {
  'ประกาศ':      { bg: '#F6DCD6', ink: '#A0443A', icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a1.125 1.125 0 01-1.51-.46 21.49 21.49 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46' },
  'งานทั่วไป':   { bg: '#EFE3D4', ink: '#6B4326', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
  'งานออเดอร์':  { bg: '#DDE6F4', ink: '#3D5A8A', icon: 'M9 12h6m-6 3h6M7.5 3h9A1.5 1.5 0 0118 4.5v15a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5v-15A1.5 1.5 0 017.5 3z' },
  'งานติดตั้ง':  { bg: '#DDEEDD', ink: '#2F6B3A', icon: INSTALL_ICON_PATH },
  'ปัญหา/แก้ไข': { bg: '#FBE3C8', ink: '#9A5B14', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  'ลูกค้า':      { bg: '#EBDDF0', ink: '#6E3F85', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
  'ไอเดีย':      { bg: '#F8EBC4', ink: '#8A6A12', icon: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18' },
}
// หมวดที่พิมพ์เอง (ไม่อยู่ในชุดตั้งต้น) → ป้ายครีม + ไอคอนป้ายแท็ก
const CUSTOM_CAT = { bg: '#EFE3D4', ink: '#6B4326', icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z' }
const catStyle = (c: string) => CAT_STYLE[c] ?? CUSTOM_CAT
const STATUS_STYLE: Record<BoardStatus, { bg: string; ink: string }> = {
  'รอตอบ':  { bg: '#FBE3C8', ink: '#9A5B14' },
  'กำลังทำ': { bg: '#DDE6F4', ink: '#3D5A8A' },
  'ปิดแล้ว': { bg: '#E3F3E0', ink: '#1F8A3B' },
}
const SORTS = [
  { value: 'recent', label: 'เรียงตามล่าสุด' },
  { value: 'comments', label: 'ความคิดเห็นมากสุด' },
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
  const [tab, setTab] = useState<string>('all')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftFiles, setDraftFiles] = useState<File[]>([])
  const [upStatus, setUpStatus] = useState('')
  const [menu, setMenu] = useState<{ rect: DOMRect } | null>(null)
  const [orderOpen, setOrderOpen] = useState<string | null>(null)
  const [orderMsg, setOrderMsg] = useState('')
  const [err, setErr] = useState('')
  // เขียนฐานไม่สำเร็จ (เน็ตหลุด/สิทธิ์) → ขึ้นแถบแดงบนหน้า แทนเงียบหายแล้วดูเหมือนบันทึกแล้ว
  const safe = async (fn: () => Promise<unknown>) => {
    try { setErr(''); await fn() } catch (e) { setErr(`บันทึกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const [me, setMe] = useState('แอดมิน')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listTopics().then(list => { setTopics(list); setLoaded(true) })
      .catch(e => { setErr(`โหลดหัวข้อไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`); setLoaded(true) })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMe(currentAuthor())
    // มาจากลิงก์ (เช่นประกาศบนหน้าภาพรวม): ?topic=<id> เปิดหัวข้อนั้น · ?tab=<หมวด> เปิดแท็บนั้น
    const p = new URLSearchParams(window.location.search)
    const tp = p.get('topic'), tb = p.get('tab')
    if (tp) setSelId(tp)
    if (tb) setTab(tb)
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: topics.length }
    for (const t of topics) c[t.category] = (c[t.category] ?? 0) + 1
    return c
  }, [topics])

  // หมวดตั้งต้น + หมวดที่มีคนพิมพ์เองไว้ (โชว์เป็นแท็บ + แนะนำตอนสร้างหัวข้อ)
  const categories = useMemo(() => [...new Set<string>([...BOARD_CATEGORIES, ...topics.map(t => t.category)])], [topics])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = topics.filter(t => tab === 'all' || t.category === tab)
    if (q) list = list.filter(t => [t.title, t.body, t.author, t.order_number ?? '', t.order_label ?? '', ...t.comments.map(c => c.body + ' ' + c.author)].join(' ').toLowerCase().includes(q))
    const key = (t: BoardTopic) => sort === 'comments' ? String(t.comments.length).padStart(6, '0') : t.last_activity_at
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || key(b).localeCompare(key(a)))
  }, [topics, tab, sort, search])

  const sel = topics.find(t => t.id === selId) ?? shown[0] ?? null

  // เลือกหัวข้ออื่น → ล้างกล่องพิมพ์ที่ค้าง
  const pick = (id: string) => { setSelId(id); setDraft(''); setDraftFiles([]); setOrderMsg('') }

  const send = async () => {
    if (!sel || upStatus || (!draft.trim() && !draftFiles.length)) return
    let ok = false
    await safe(async () => {
      // อัปรูป/คลิปก่อน (ขึ้น R2) แล้วค่อยบันทึกความคิดเห็นพร้อมลิงก์ — อัปไม่ผ่าน = ไม่บันทึก ข้อความยังอยู่ในกล่อง
      const media = draftFiles.length ? await uploadBoardMedia(draftFiles, setUpStatus) : []
      setTopics(await addComment(sel.id, draft, media)); ok = true
    })
    setUpStatus('')
    if (!ok) return
    setDraft('')
    setDraftFiles([])
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
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#4A3122', letterSpacing: '-0.5px' }}>ตามงาน</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 2 }}>พูดคุย แลกเปลี่ยนข้อมูล และติดตามงานของทีม</p>
        </div>
        <button onClick={() => setCreating(true)}
          style={{ background: 'var(--brand)', color: '#FFF8F0', border: 'none', borderRadius: 999, height: 46, padding: '0 26px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 3px 10px rgba(158,106,73,0.35)' }}>
          ＋ สร้างหัวข้อใหม่
        </button>
      </div>

      {err && (
        <div style={{ background: '#FBE3DF', color: '#A0443A', border: '1px solid #F0C0B7', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{err}</span>
          <button onClick={() => setErr('')} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(360px, 1fr)', gap: 20, alignItems: 'start' }} className="bd-grid">
        {/* ── ซ้าย: รายการหัวข้อ ── */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
              <svg width="17" height="17" fill="none" stroke="#8B7460" strokeWidth="1.8" viewBox="0 0 24 24" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาหัวข้อ, คีย์เวิร์ด, ชื่อพนักงาน หรือเลขออเดอร์…" className="ow-field"
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 999, height: 42, padding: '0 16px 0 42px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)' }} />
            </div>
            <CreamSelect value={sort} onChange={setSort} options={SORTS} className="ow-select" style={{ height: 42 }} align="right"
              renderValue={o => <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M3.5 16.5L7 20l3.5-3.5M14 6h7M14 11h5M14 16h3" /></svg>
                <span className="cs-value">{o?.label}</span>
                <svg className="cs-chev" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
              </>} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {['all', ...categories].map(k => (
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
                const cs = catStyle(t.category)
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
                  <Pill label={sel.category} bg={catStyle(sel.category).bg} ink={catStyle(sel.category).ink} />
                  {sel.status && (
                    <CreamSelect value={sel.status} onChange={v => safe(async () => setTopics(await updateTopic(sel.id, { status: v as BoardStatus })))}
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
                    <MediaGrid media={sel.media} />
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
                              <button onClick={() => safe(async () => setTopics(await deleteComment(sel.id, c.id)))} title="ลบความคิดเห็นนี้"
                                style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 11 }}>ลบ</button>
                            )}
                          </div>
                          {c.body && <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}><RichText text={c.body} /></div>}
                          <MediaGrid media={c.media} small />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                            <button onClick={() => safe(async () => setTopics(await toggleLike(sel.id, c.id)))} title={c.likes.length ? `ถูกใจโดย ${c.likes.join(', ')}` : 'ถูกใจ'}
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
                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '8px 10px 8px 14px' }}>
                  <PendingFiles files={draftFiles} onRemove={i => setDraftFiles(f => f.filter((_, k) => k !== i))} status={upStatus} />
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <AttachButton disabled={!!upStatus || draftFiles.length >= MAX_MEDIA} onFiles={fs => setDraftFiles(f => [...f, ...fs].slice(0, MAX_MEDIA))} />
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="พิมพ์ข้อความ… (พิมพ์ @ชื่อ เพื่อเรียกคน)"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                    style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }} />
                  <button onClick={send} disabled={!!upStatus || (!draft.trim() && !draftFiles.length)} title="ส่ง"
                    style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: (draft.trim() || draftFiles.length) && !upStatus ? 'var(--brand)' : 'var(--cream)', color: '#FFF8F0', cursor: (draft.trim() || draftFiles.length) && !upStatus ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" size={18} />
                  </button>
                  </div>
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
                <button key={it.label} onClick={() => { setMenu(null); void safe(async () => setTopics(await it.run())) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: it.danger ? 'var(--red)' : 'var(--ink)' }}>{it.label}</button>
              ))}
            </AnchoredMenu>
          </>
        )
      })()}

      {creating && <NewTopicModal onClose={() => setCreating(false)} categories={categories} defaultCategory={tab === 'all' ? 'งานทั่วไป' : tab}
        onCreate={t => safe(async () => { const created = await createTopic(t); setTopics(await listTopics()); setSelId(created.id); setCreating(false) })} />}

      {orderOpen && <OrderDetailModal id={orderOpen} onClose={() => setOrderOpen(null)} />}

      <style>{`
        @media (max-width: 1100px) { .bd-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 720px) { .bd-meta > span:nth-child(2) { display: none; } }
      `}</style>
    </div>
  )
}

function NewTopicModal({ onClose, onCreate, defaultCategory, categories }: {
  onClose: () => void
  onCreate: (t: { category: BoardCategory; title: string; body: string; order_number: string | null; order_id: string | null; order_label: string | null; media: BoardMedia[] }) => Promise<unknown> | void
  defaultCategory: BoardCategory
  categories: string[]
}) {
  const [category, setCategory] = useState<BoardCategory>(defaultCategory)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [order, setOrder] = useState<OrderHit | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [upStatus, setUpStatus] = useState('')
  const [upErr, setUpErr] = useState('')
  const [staff, setStaff] = useState<EmployeeOption[]>([])
  useEffect(() => { fetchEmployeeOptions().then(setStaff).catch(() => setStaff([])) }, [])
  const ok = title.trim().length > 0 && category.trim().length > 0 && !upStatus
  const submit = async () => {
    if (!ok) return
    setUpErr('')
    try {
      const media = files.length ? await uploadBoardMedia(files, setUpStatus) : []
      setUpStatus('กำลังโพสต์…')
      await onCreate({ category, title, body, order_number: order?.order_number ?? null, order_id: order?.id ?? null, order_label: order ? orderLabel(order) : null, media })
    } catch (e) {
      setUpErr(`อัปโหลดไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    }
    setUpStatus('')
  }
  const input: React.CSSProperties = { width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit' }
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }
  return (
    <div onClick={() => { if (!upStatus) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 560, maxWidth: '100%', padding: 26, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>สร้างหัวข้อใหม่</h3>
        <div style={{ marginBottom: 14 }}>
          <span style={label}>หมวด</span>
          <CategoryField value={category} onChange={setCategory} options={categories} inputStyle={input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={label}>หัวข้อ <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(พิมพ์เลขออเดอร์หรือชื่อลูกค้า จะลิงก์ออเดอร์ให้ · @ชื่อ เรียกคน)</span></span>
          <SmartField value={title} onChange={setTitle} staff={staff} order={order} onOrder={setOrder} autoFocus
            placeholder="เช่น ออเดอร์ 2609… ลูกค้าขอเปลี่ยนสีผ้า" style={input} />
          {order && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, border: '1px solid var(--brand-soft)', background: '#F4E9DD', borderRadius: 999, padding: '5px 12px', maxWidth: '100%' }}>
              <Icon d={CAT_STYLE['งานออเดอร์'].icon} size={14} color="var(--brand)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ลิงก์: {orderLabel(order)}</span>
              {order.order_status && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{order.order_status}</span>}
              <button onClick={() => setOrder(null)} title="เอาลิงก์ออก" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, padding: 0 }}>✕</button>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 22 }}>
          <span style={label}>รายละเอียด</span>
          <SmartField multiline value={body} onChange={setBody} staff={staff}
            placeholder="เล่าเรื่องให้คนอ่านเข้าใจ — พิมพ์ @ เพื่อเลือกชื่อพนักงาน" style={{ ...input, resize: 'vertical', lineHeight: 1.55 }} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <span style={label}>รูป / คลิป <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(ถ้ามี · สูงสุด {MAX_MEDIA} ไฟล์)</span></span>
          <PendingFiles files={files} onRemove={i => setFiles(f => f.filter((_, k) => k !== i))} status={upStatus} />
          <AttachButton label="แนบรูป / คลิป" disabled={!!upStatus || files.length >= MAX_MEDIA} onFiles={fs => setFiles(f => [...f, ...fs].slice(0, MAX_MEDIA))} />
          {upErr && <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 6 }}>{upErr}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 999, height: 42, padding: '0 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button disabled={!ok} onClick={submit}
            style={{ border: 'none', background: ok ? 'var(--brand)' : 'var(--cream)', color: '#FFF8F0', borderRadius: 999, height: 42, padding: '0 24px', fontSize: 14, fontWeight: 600, cursor: ok ? 'pointer' : 'default', fontFamily: 'inherit' }}>โพสต์หัวข้อ</button>
        </div>
      </div>
    </div>
  )
}

// ── รายการแนะนำใต้ช่องพิมพ์ (ใช้ร่วม: หมวด / @ชื่อ / ออเดอร์) — กดเลือก หรือ ↑↓ + Enter ──
type Sug = { key: string; main: string; sub?: string; side?: string; tag?: string }
function SuggestList({ items, active, onPick }: { items: Sug[]; active: number; onPick: (i: number) => void }) {
  if (!items.length) return null
  return (
    <div className="ow-drop" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', zIndex: 10, maxHeight: 260, overflowY: 'auto', padding: 4 }}>
      {items.map((it, i) => (
        // onMouseDown + preventDefault = เลือกได้ก่อนช่องพิมพ์เสียโฟกัส (ไม่งั้นรายการปิดก่อนคลิกติด)
        <button key={it.key} onMouseDown={e => { e.preventDefault(); onPick(i) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderRadius: 8, background: i === active ? 'var(--cream-2)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
          {it.tag !== undefined && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', width: 58, flexShrink: 0 }}>{it.tag || '—'}</span>}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.main}</span>
            {it.sub && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)' }}>{it.sub}</span>}
          </span>
          {it.side && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{it.side}</span>}
        </button>
      ))}
    </div>
  )
}

// ปุ่มลูกศร/Enter/Esc ของรายการแนะนำ — คืน true = จัดการแล้ว (กันไม่ให้ Enter ไปทำอย่างอื่น)
function useSuggestKeys(count: number, pick: (i: number) => void, close: () => void) {
  const [active, setActive] = useState(0)
  useEffect(() => { setActive(0) }, [count])   // eslint-disable-line react-hooks/set-state-in-effect
  const onKey = (e: React.KeyboardEvent) => {
    if (!count) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % count) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + count) % count) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  }
  return { active, onKey }
}

// ── หมวด: พิมพ์เองได้ · กดช่องแล้วขึ้นหมวดที่มีทั้งหมด · พิมพ์แล้วกรองตามที่พิมพ์ ──
function CategoryField({ value, onChange, options, inputStyle }: { value: string; onChange: (v: string) => void; options: string[]; inputStyle: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(false)   // ยังไม่พิมพ์ = โชว์ทุกหมวด (ค่าที่ตั้งไว้ไม่ใช่คำค้น)
  const q = value.trim().toLowerCase()
  const list = open ? options.filter(o => !typed || !q || o.toLowerCase().includes(q)) : []
  const items: Sug[] = list.map(o => ({ key: o, main: o }))
  const pick = (i: number) => { onChange(list[i]); setOpen(false) }
  const { active, onKey } = useSuggestKeys(items.length, pick, () => setOpen(false))
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={e => { onChange(e.target.value); setTyped(true); setOpen(true) }}
        onFocus={e => { setTyped(false); setOpen(true); e.currentTarget.select() }} onBlur={() => setOpen(false)} onKeyDown={onKey}
        placeholder="เลือกหรือพิมพ์หมวดใหม่" style={inputStyle} />
      <SuggestList items={items} active={active} onPick={pick} />
    </div>
  )
}

// ── ช่องพิมพ์ที่ช่วยเติม: @ → รายชื่อพนักงาน · (ถ้าส่ง onOrder) คำที่กำลังพิมพ์ → ค้นออเดอร์ให้ลิงก์ ──
// ค้นออเดอร์ = ชื่อลูกค้า / เลขออเดอร์ / Serial ในฐานจริง (อ่านอย่างเดียว) ทีละ 8 ใบ · รอพิมพ์หยุด 0.3 วิ
// พิมพ์เลขออเดอร์/Serial ตรงตัวพอดี → ลิงก์ให้เลยไม่ต้องกด · ลิงก์แล้วหยุดแนะนำออเดอร์ (กด ✕ ที่ป้ายเพื่อเปลี่ยน)
type OrderHit = { id: string; order_number: string | null; serial_no?: string | null; customer_name: string | null; order_status: string | null; created_at: string }
const orderLabel = (o: OrderHit) => [o.serial_no, o.customer_name, o.order_number ? '#' + o.order_number : ''].filter(Boolean).join(' · ') || 'ออเดอร์'

function SmartField({ value, onChange, staff, order, onOrder, multiline, style, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; staff: EmployeeOption[]
  order?: OrderHit | null; onOrder?: (o: OrderHit | null) => void
  multiline?: boolean; style: React.CSSProperties; placeholder?: string; autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const [hits, setHits] = useState<OrderHit[]>([])
  const [dismissed, setDismissed] = useState('')   // Esc แล้ว ไม่แนะนำคำเดิมซ้ำ

  // คำที่อยู่ตรงเคอร์เซอร์ (ตั้งแต่ช่องว่างก่อนหน้า ถึงเคอร์เซอร์)
  const before = value.slice(0, caret)
  const word = /[^\s]*$/.exec(before)?.[0] ?? ''
  const mention = word.startsWith('@') ? word.slice(1) : null
  const orderKw = !mention && word !== '@' && onOrder && !order ? word.replace(/[,()*%\\#]/g, '') : ''

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (orderKw.length < 2) { setHits([]); return }
    let alive = true
    const t = setTimeout(async () => {
      const base = 'id, order_number, customer_name, order_status, created_at'
      const run = (cols: string, fields: string[]) => supabase.from('order_entries').select(cols)
        .or(fields.map(f => `${f}.ilike.*${orderKw}*`).join(',')).order('created_at', { ascending: false }).limit(8)
      let r = await run(`${base}, serial_no`, ['customer_name', 'order_number', 'serial_no'])
      if (r.error) r = await run(base, ['customer_name', 'order_number'])   // ยังไม่มีคอลัมน์ serial_no
      if (!alive) return
      const list = r.error ? [] : ((r.data ?? []) as unknown as OrderHit[])
      // ตรงตัวพอดี 1 ใบ (เลขออเดอร์/Serial) → ลิงก์เลย
      const kw = orderKw.toLowerCase()
      const exact = list.filter(o => (o.order_number ?? '').toLowerCase() === kw || (o.serial_no ?? '').toLowerCase() === kw)
      if (exact.length === 1) { onOrder?.(exact[0]); setHits([]); return }
      setHits(list)
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [orderKw]) // eslint-disable-line react-hooks/exhaustive-deps

  const people = mention === null ? [] : staff
    .filter(s => s.nickname || s.realName)
    .filter(s => !mention || [s.nickname, s.realName].some(n => n.toLowerCase().includes(mention.toLowerCase())))
    .slice(0, 8)

  const showing = focused && word !== dismissed
  const mode: 'people' | 'orders' | null = !showing ? null : mention !== null ? (people.length ? 'people' : null) : hits.length ? 'orders' : null
  const items: Sug[] = mode === 'people'
    ? people.map(s => ({ key: s.code, main: '@' + (s.nickname || s.realName), sub: [s.realName !== s.nickname ? s.realName : '', s.role].filter(Boolean).join(' · ') || undefined }))
    : mode === 'orders'
      ? hits.map(o => ({ key: o.id, tag: o.serial_no ?? '', main: o.customer_name || '(ไม่ระบุชื่อลูกค้า)', sub: `${o.order_number ? '#' + o.order_number : 'ไม่มีเลขออเดอร์'} · ${new Date(o.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`, side: o.order_status ?? undefined }))
      : []

  // แทนคำตรงเคอร์เซอร์ด้วยข้อความใหม่ แล้ววางเคอร์เซอร์ต่อท้าย
  const replaceWord = (text: string) => {
    const start = caret - word.length
    const next = value.slice(0, start) + text + value.slice(caret)
    onChange(next)
    const pos = start + text.length
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); setCaret(pos) })
  }
  const pick = (i: number) => {
    if (mode === 'people') { const s = people[i]; replaceWord('@' + (s.nickname || s.realName) + ' ') }
    else if (mode === 'orders') { onOrder?.(hits[i]); setHits([]) }   // ลิงก์ออเดอร์ · คำที่พิมพ์คงไว้ในหัวข้อ
  }
  const { active, onKey } = useSuggestKeys(items.length, pick, () => setDismissed(word))

  const common = {
    ref, value, placeholder, autoFocus, style,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { onChange(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length) },
    onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart ?? 0),
    onFocus: () => setFocused(true), onBlur: () => setFocused(false), onKeyDown: onKey,
  }
  return (
    <div style={{ position: 'relative' }}>
      {multiline ? <textarea rows={5} {...common} /> : <input {...common} />}
      <SuggestList items={items} active={active} onPick={pick} />
    </div>
  )
}

// ── รูป/คลิปแนบ ──
const CLIP_ICON = 'M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13'

// ปุ่มแนบ (เลือกได้หลายไฟล์ · รูปและคลิป)
function AttachButton({ onFiles, disabled, label }: { onFiles: (f: File[]) => void; disabled?: boolean; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept="image/*,video/*" multiple hidden
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) onFiles(fs) }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={disabled} title="แนบรูป / คลิป"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0, height: 38, minWidth: 38, padding: label ? '0 14px' : 0,
          borderRadius: label ? 999 : 12, border: '1px solid var(--border)', background: 'var(--surface)', color: disabled ? 'var(--ink-4)' : 'var(--brand)',
          cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
        <Icon d={CLIP_ICON} size={17} />{label}
      </button>
    </>
  )
}

// ไฟล์ที่เลือกไว้ (ยังไม่อัป) — รูปย่อ/ป้ายคลิป + ปุ่มเอาออก · กำลังอัปโชว์ความคืบหน้า
function PendingFiles({ files, onRemove, status }: { files: File[]; onRemove: (i: number) => void; status: string }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const u = files.map(f => (f.type.startsWith('image/') ? URL.createObjectURL(f) : ''))
    setUrls(u)   // eslint-disable-line react-hooks/set-state-in-effect
    return () => u.forEach(x => x && URL.revokeObjectURL(x))
  }, [files])
  if (!files.length) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {files.map((f, i) => (
          <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'var(--cream)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {urls[i] ? <img src={urls[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', padding: 4 }}>🎬 คลิป</span>}
            {!status && (
              <button type="button" onClick={() => onRemove(i)} title="เอาออก"
                style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0 }}>✕</button>
            )}
          </div>
        ))}
      </div>
      {status && <div style={{ fontSize: 12, color: 'var(--brand)', marginTop: 6 }}>{status}</div>}
    </div>
  )
}

// รูป/คลิปที่โพสต์แล้ว — กดรูปดูเต็มจอ · คลิปเล่นในที่ (โหลดเมื่อกดเล่น ประหยัดเน็ต)
function MediaGrid({ media, small }: { media?: BoardMedia[]; small?: boolean }) {
  const [view, setView] = useState<string | null>(null)
  if (!media?.length) return null
  const size = small ? 96 : 140
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {media.map((m, i) => m.kind === 'video' ? (
          <video key={i} src={m.url} controls preload="none" playsInline
            style={{ width: small ? 200 : 260, maxWidth: '100%', borderRadius: 10, background: '#000' }} />
        ) : (
          <img key={i} src={m.url} alt={m.name ?? ''} loading="lazy" onClick={() => setView(m.url)}
            style={{ width: size, height: size, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', border: '1px solid var(--border)' }} />
        ))}
      </div>
      {view && (
        <div onClick={() => setView(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,14,10,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <img src={view} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </>
  )
}
