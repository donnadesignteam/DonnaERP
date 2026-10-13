'use client'

// ปลายทางของ QR บน "ใบใช้ของ" (lib/reuse.ts) — /use?uk=<parcel|stock|order>&u=<id>
// ‼️ แยกจากหน้า /scan (งานผลิต/งานเคลม/แพ็คราง/จัดส่ง): หน้านี้เขียนแค่ตาราง item_reuse ไม่เดินสถานะอะไรทั้งนั้น
// เปิดแล้วบันทึกทันทีว่าคนที่ล็อกอินอยู่เอาของชิ้นนี้ไปใช้ (แบบเดียวกับหน้า /scan ที่สแกนแล้วเดินสถานะเลย) · สแกนผิดกดยกเลิกได้
// แถวต้นทาง (พัสดุส่งกลับ / งานยกเลิก-ตีกลับ) จะย้ายไปช่อง "ใช้แล้ว"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { readStaffSession, type StaffSession } from '@/lib/staffSession'
import { formatItemLines, type RawItem } from '@/lib/itemFormat'
import { REUSE_TABLE, reuseErr, reuseWho, reuseWhen, undoReuse, type Reuse, type ReuseKind } from '@/lib/reuse'

const KIND_TH: Record<ReuseKind, string> = { parcel: 'พัสดุส่งกลับ', stock: 'งานยกเลิก-ตีกลับ', order: 'งานยกเลิก' }
type Info = { title: string; sub: string; lines: string[] }

const asItems = (v: unknown): RawItem[] => {
  if (Array.isArray(v)) return v as RawItem[]
  const t = String(v ?? '').trim()
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a } catch { /* ข้อความธรรมดา */ } }
  return t ? t.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => ({ type: l, quantity: '', unit: '' })) : []
}

async function loadInfo(kind: ReuseKind, id: string): Promise<Info | null> {
  if (kind === 'parcel') {
    const { data } = await supabase.from('return_parcels').select('serial_no, sender_name, items, orig_order_number').eq('id', id).maybeSingle()
    if (!data) return null
    return { title: data.sender_name || '(ไม่มีชื่อ)', sub: [data.serial_no, data.orig_order_number].filter(Boolean).join(' · '), lines: formatItemLines(asItems(data.items)) }
  }
  if (kind === 'stock') {
    const { data } = await supabase.from('stock_items').select('name, qty, unit, ref, source').eq('id', id).eq('category', 'returned').maybeSingle()
    if (!data) return null
    return { title: data.ref || data.source || 'งานยกเลิก-ตีกลับ', sub: `${data.qty ?? ''} ${data.unit ?? ''}`.trim(), lines: String(data.name ?? '').split(' · ').filter(Boolean) }
  }
  // ออเดอร์: รับเฉพาะใบที่ "ยกเลิก" แล้ว — กัน QR/ลิงก์ที่ชี้ออเดอร์ปกติหลุดมาถูกบันทึกเป็นใช้ของ
  const { data } = await supabase.from('order_entries').select('order_number, customer_name, platform, items').eq('id', id).eq('order_status', 'ยกเลิก').maybeSingle()
  if (!data) return null
  return { title: data.customer_name || '(ไม่มีชื่อ)', sub: [data.platform, data.order_number].filter(Boolean).join(' · '), lines: formatItemLines(asItems(data.items)) }
}

export default function UsePage() {
  const [staff, setStaff] = useState<StaffSession | null>(null)
  const [state, setState] = useState<'loading' | 'bad' | 'missing' | 'saved' | 'already' | 'undone' | 'error'>('loading')
  const [info, setInfo] = useState<Info | null>(null)
  const [used, setUsed] = useState<Reuse | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<{ kind: ReuseKind; id: string } | null>(null)
  const ran = useRef(false)   // กันบันทึกซ้ำ (effect รัน 2 รอบตอน dev)
  // &demo=saved | already = ดูหน้าตาเฉยๆ ไม่เขียนฐานข้อมูล (user ขอดูตัวอย่างหน้าตอนสแกน 13ต.ค.69)
  const [demo, setDemo] = useState(false)

  const record = async (s: StaffSession, kind: ReuseKind, id: string) => {
    const { data: had, error: e0 } = await supabase.from(REUSE_TABLE).select('*').eq('kind', kind).eq('ref_id', id).maybeSingle()
    if (e0) { setErr(reuseErr(e0.message)); setState('error'); return }
    if (had) { setUsed(had as Reuse); setState('already'); return }
    const { data, error } = await supabase.from(REUSE_TABLE)
      .insert({ kind, ref_id: id, used_by_code: s.code, used_by_name: s.nickname || s.code }).select().single()
    if (error) { setErr(reuseErr(error.message)); setState('error'); return }
    setUsed(data as Reuse); setState('saved')
    try { navigator.vibrate?.(120) } catch {}
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const p = new URLSearchParams(window.location.search)
    const kind = p.get('uk') as ReuseKind | null, id = p.get('u') ?? ''
    const s = readStaffSession()
    ;(async () => {
      setStaff(s)
      if (!kind || !(kind in KIND_TH) || !id || !s) { setState('bad'); return }
      setTarget({ kind, id })
      const i = await loadInfo(kind, id)
      if (!i) { setState('missing'); return }
      setInfo(i)
      const d = p.get('demo')
      if (d) {
        setDemo(true)
        const mine = d !== 'already'
        setUsed({ kind, ref_id: id, used_by_code: mine ? s.code : 'DN000', used_by_name: mine ? (s.nickname || s.code) : 'พี่ตัวอย่าง', used_at: new Date().toISOString() })
        setState(mine ? 'saved' : 'already')
        return
      }
      await record(s, kind, id)
    })()
  }, [])

  const undo = async () => {
    if (demo) { setUsed(null); setState('undone'); return }
    if (!target) return
    setBusy(true)
    const e = await undoReuse(target.kind, target.id)
    setBusy(false)
    if (e) { setErr(e); setState('error'); return }
    setUsed(null); setState('undone')
  }
  const redo = async () => {
    if (demo && staff && target) { setUsed({ kind: target.kind, ref_id: target.id, used_by_code: staff.code, used_by_name: staff.nickname || staff.code, used_at: new Date().toISOString() }); setState('saved'); return }
    if (!target || !staff) return
    setBusy(true)
    await record(staff, target.kind, target.id)
    setBusy(false)
  }

  const btn: React.CSSProperties = { border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
  const mine = !!used && !!staff && used.used_by_code === staff.code
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>ใช้ของ{target ? ` · ${KIND_TH[target.kind]}` : ''}{demo && <span style={{ marginLeft: 8, background: '#F9E0C3', color: '#6B4326', borderRadius: 999, padding: '2px 10px', fontSize: 11.5 }}>ตัวอย่าง ไม่บันทึกจริง</span>}</div>

        {state === 'loading' && <div style={{ padding: '28px 0', color: 'var(--ink-3)' }}>กำลังบันทึก…</div>}
        {state === 'bad' && <div style={{ padding: '20px 0', color: 'var(--ink)' }}>{staff ? 'QR ใบนี้ไม่ถูกต้อง' : 'ยังไม่ได้ล็อกอิน — ล็อกอินก่อนแล้วสแกนใหม่'}</div>}
        {state === 'missing' && <div style={{ padding: '20px 0', color: 'var(--ink)' }}>ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)</div>}
        {state === 'error' && <div style={{ margin: '16px 0', background: '#FDECEA', color: '#B3261E', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{err}</div>}

        {info && (
          <div style={{ margin: '12px 0 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35 }}>{info.title}</div>
            {info.sub && <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 2 }}>{info.sub}</div>}
            {info.lines.length > 0 && (
              <div style={{ marginTop: 12, background: 'var(--cream-2)', borderRadius: 12, padding: '10px 14px', maxHeight: '40dvh', overflowY: 'auto' }}>
                {info.lines.map((l, i) => <div key={i} style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>• {l}</div>)}
              </div>
            )}
          </div>
        )}

        {state === 'saved' && used && (
          <div style={{ background: '#E3F3E0', color: '#1F8A3B', borderRadius: 12, padding: '12px 14px', fontSize: 15, fontWeight: 600 }}>
            บันทึกแล้ว — {reuseWho(used)} เอาไปใช้
            <div style={{ fontSize: 12.5, fontWeight: 400, marginTop: 2 }}>{reuseWhen(used)} · ย้ายไปช่อง &quot;ใช้แล้ว&quot;</div>
          </div>
        )}
        {state === 'already' && used && (
          <div style={{ background: '#F9E0C3', color: '#6B4326', borderRadius: 12, padding: '12px 14px', fontSize: 15, fontWeight: 600 }}>
            ใบนี้ถูกเอาไปใช้แล้ว โดย {reuseWho(used)}
            <div style={{ fontSize: 12.5, fontWeight: 400, marginTop: 2 }}>{reuseWhen(used)}</div>
          </div>
        )}
        {state === 'undone' && <div style={{ background: 'var(--cream-2)', color: 'var(--ink-2)', borderRadius: 12, padding: '12px 14px', fontSize: 15 }}>ยกเลิกแล้ว — รายการกลับไปเป็น &quot;ยังไม่ใช้&quot;</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <Link href="/scan" style={{ ...btn, background: 'var(--brand)', color: '#FFF8F0', textDecoration: 'none', flex: 1, textAlign: 'center' }}>สแกนต่อ</Link>
          {(state === 'saved' || (state === 'already' && mine)) && (
            <button onClick={undo} disabled={busy} style={{ ...btn, background: 'var(--cream)', color: '#B3261E' }}>{busy ? '…' : 'ยกเลิก (สแกนผิด)'}</button>
          )}
          {state === 'undone' && <button onClick={redo} disabled={busy} style={{ ...btn, background: 'var(--cream)', color: '#6B4326' }}>{busy ? '…' : 'บันทึกใช้ของอีกครั้ง'}</button>}
        </div>
      </div>
    </div>
  )
}
