'use client'

// ค้นหาออเดอร์จากข้อมูลอะไรก็ได้ที่มีบนกล่อง/ในกล่อง — ใช้ตอนเพิ่มพัสดุส่งกลับ
// (พัสดุตีกลับส่วนใหญ่ไม่มีชื่อ user / เลขออเดอร์ / แพลตฟอร์ม มีแค่ชื่อจริง เบอร์ ที่อยู่ หรือรายการม่านในกล่อง)
// วางข้อความทั้งก้อน → แยกเป็นคำ แล้วให้คะแนนทุกออเดอร์ตามจำนวนคำที่ตรง · เบอร์โทรตรง = คะแนนสูงสุด
//   ขนาด (1.25*2.34 / 125x234) เทียบกับกว้าง/สูงของรายการ · รหัสผ้า/ชื่อ/ที่อยู่ เทียบแบบมีคำนั้นอยู่ข้างใน

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'

export type FoundOrder = {
  id: string
  customer_name: string | null
  phone: string | null
  address: string | null
  order_number: string | null
  platform: string | null
  entry_date: string | null
  order_status: string | null
  courier: string | null
  shipments: { no?: string; carrier?: string }[] | null
  items: RawItem[] | null
}

type Indexed = { o: FoundOrder; text: string; flat: string; phone: string; sizes: number[]; lines: string[] }

// โหลดครั้งเดียวต่อการเปิดหน้า (ออเดอร์ทั้งหมดหลายพันใบ — ไม่ดึงซ้ำทุกครั้งที่เปิดกล่อง)
let cache: Indexed[] | null = null

const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')

function index(o: FoundOrder): Indexed {
  const lines = formatItemLines(o.items)
  const text = norm([
    o.customer_name, o.address, o.order_number, o.platform,
    ...(o.shipments ?? []).map(s => s?.no),
    ...lines,
    ...(o.items ?? []).map(it => `${it.color_code ?? ''} ${it.color_name ?? ''}`),
  ].filter(Boolean).join(' | '))
  const sizes = (o.items ?? []).flatMap(it => [Number(it.width), Number(it.height)]).filter(n => n > 0)
  return { o, text, flat: text.replace(/\s+/g, ''), phone: digits(o.phone), sizes, lines }
}

// คำที่ไม่ช่วยแยกลูกค้า (คำนำหน้าที่อยู่/ชื่อ) — ตัดทิ้ง ไม่งั้นทุกใบได้คะแนน
const STOP = new Set(['ต.', 'อ.', 'จ.', 'ม.', 'ถ.', 'ซ.', 'ตำบล', 'อำเภอ', 'จังหวัด', 'หมู่', 'หมู่ที่', 'ซอย', 'ถนน', 'บ้านเลขที่', 'คุณ', 'นาย', 'นาง', 'นางสาว', 'เขต', 'แขวง', 'ผืน', 'ชุด', 'ม่าน', 'ผ้า', 'ราง'])

type Query = { words: string[]; phones: string[]; sizes: number[] }

function parseQuery(q: string): Query {
  const phones = (q.match(/\d[\d\s-]{7,}\d/g) ?? []).map(digits).filter(d => d.length >= 9)
  const sizes: number[] = []
  // ขนาดเขียนติดกัน 1.25*2.34 / 1.25x2.34 / 125x234 (ซม.)
  for (const m of q.matchAll(/(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/g)) {
    for (const v of [m[1], m[2]]) { const n = Number(v); sizes.push(n >= 20 ? n / 100 : n) }
  }
  // ทศนิยมเดี่ยวๆ (กว้าง 1.25 สูง 2.34)
  for (const m of q.matchAll(/(?<![\d.])(\d\.\d{1,3})(?![\d.])/g)) sizes.push(Number(m[1]))
  const words = [...new Set(q.replace(/(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/g, ' ')
    .split(/[\s,/|()[\]:;"'“”=+]+/).map(w => w.toLowerCase().trim())
    .filter(w => w.length >= 2 && !STOP.has(w) && !/^\d\.\d+$/.test(w) && !(phones.length && /^\d{9,}$/.test(w.replace(/-/g, '')))))]
  return { words, phones, sizes: [...new Set(sizes.map(n => Math.round(n * 1000) / 1000))] }
}

type Hit = { ix: Indexed; score: number; matched: string[] }

function search(list: Indexed[], q: Query): Hit[] {
  const hits: Hit[] = []
  for (const ix of list) {
    let score = 0
    const matched: string[] = []
    for (const p of q.phones) {
      if (ix.phone && (ix.phone.endsWith(p.slice(-9)) || p.endsWith(ix.phone.slice(-9)))) { score += 6; matched.push(p) }
    }
    for (const w of q.words) {
      if (ix.text.includes(w) || ix.flat.includes(w)) { score += w.length >= 4 ? 2 : 1; matched.push(w) }
    }
    for (const s of q.sizes) {
      if (ix.sizes.some(n => Math.abs(n - s) < 0.006)) { score += 1; matched.push(String(s)) }
    }
    if (score > 0) hits.push({ ix, score, matched })
  }
  return hits.sort((a, b) => b.score - a.score || String(b.ix.o.entry_date ?? '').localeCompare(String(a.ix.o.entry_date ?? ''))).slice(0, 30)
}

export default function OrderFinder({ onPick, onBack, onClose }: {
  onPick: (o: FoundOrder) => void
  onBack?: () => void
  onClose: () => void
}) {
  const [list, setList] = useState<Indexed[] | null>(cache)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)

  useEffect(() => {
    if (cache) return
    fetchAllRows<FoundOrder>(() => supabase.from('order_entries')
      .select('id, customer_name, phone, address, order_number, platform, entry_date, order_status, courier, shipments, items')
      .order('id', { ascending: true }))
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return }
        cache = data.map(index)
        setList(cache)
      })
  }, [])

  const q = useMemo(() => parseQuery(deferred), [deferred])
  const total = q.words.length + q.phones.length + q.sizes.length
  const hits = useMemo(() => (list && total ? search(list, q) : []), [list, q, total])

  const downOnBackdrop = useRef(false)

  return (
    <div onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); downOnBackdrop.current = false }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(61,43,31,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div className="sc-modal" style={{ maxWidth: 640, width: '100%', display: 'flex', flexDirection: 'column', maxHeight: '86vh', padding: '26px 28px' }}>
        <h3 className="sc-mtitle" style={{ marginBottom: 4 }}>ค้นหาออเดอร์</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 12px' }}>
          ใส่อะไรก็ได้ที่มีบนกล่อง/ในกล่อง — ชื่อจริง เบอร์ ที่อยู่ รหัสผ้า ขนาด (เช่น 1.25*2.34) · ยิ่งใส่เยอะยิ่งแม่น
        </p>
        <textarea autoFocus value={query} onChange={e => setQuery(e.target.value)} rows={3}
          placeholder={'เช่น\nสมหญิง ใจดี 081-234-5678 ต.ปากน้ำ อ.ละงู สตูล\nม่านจีบ M21 1.50*2.20'}
          style={{ width: '100%', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: 10, fontFamily: 'inherit' }} />

        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, marginBottom: 7 }}>
          {err ? <span style={{ color: 'var(--red)' }}>โหลดออเดอร์ไม่สำเร็จ: {err}</span>
            : !list ? 'กำลังโหลดออเดอร์ทั้งหมด…'
            : !total ? `พร้อมค้น ${list.length.toLocaleString()} ใบ`
            : `เจอ ${hits.length}${hits.length === 30 ? '+' : ''} ใบ (เรียงจากตรงมากสุด)`}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, border: '1px solid var(--border-2)', borderRadius: 16, background: 'var(--cream-2)' }}>
          {total > 0 && list && hits.length === 0 && (
            <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>ไม่เจอออเดอร์ที่ตรง — ลองใส่ข้อมูลอื่นเพิ่ม</div>
          )}
          {hits.map(({ ix, matched }, i) => {
            const o = ix.o
            return (
              <button key={o.id} type="button" onClick={() => onPick(o)}
                style={{ display: 'block', width: '100%', padding: '12px 14px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--ink)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{o.customer_name || '(ไม่มีชื่อ)'}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {[o.platform, o.order_number, o.entry_date, o.order_status].filter(Boolean).join(' · ')}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--brand)', whiteSpace: 'nowrap' }}>ตรง {matched.length}/{total}</span>
                </div>
                {(o.phone || o.address) && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[o.phone, o.address].filter(Boolean).join(' · ')}
                  </div>
                )}
                {ix.lines.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3 }}>
                    {ix.lines.slice(0, 3).map((l, k) => <div key={k} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</div>)}
                    {ix.lines.length > 3 && <div style={{ color: 'var(--ink-4)' }}>+ อีก {ix.lines.length - 3} รายการ</div>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                  {matched.map(m => (
                    <span key={m} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, background: 'rgba(158,106,73,0.14)', color: 'var(--brand)' }}>{m}</span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        <button type="button" onClick={onBack ?? onClose}
          className="sc-mcancel" style={{ marginTop: 10, width: '100%', cursor: 'pointer', fontSize: 13, border: 'none' }}>
          {onBack ? '← ย้อนกลับ' : 'ยกเลิก'}
        </button>
      </div>
    </div>
  )
}
