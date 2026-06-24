'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EMPLOYEES, STAGES, stageByKey, canAdvance } from '@/lib/staff'

const LS_KEY = 'donna-scan-tech'
type Tech = { code: string; name: string; stageKey: string }
type Phase = 'scanning' | 'working' | 'done' | 'already' | 'noorder' | 'error'

function loadTech(): Tech | null {
  try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null } catch { return null }
}

// ดึงเลขออเดอร์จาก QR (รองรับทั้ง URL .../scan?o=XXX และข้อความเลขเปล่า)
function extractOrder(text: string): string {
  try { const u = new URL(text); const o = u.searchParams.get('o'); if (o) return o } catch {}
  const m = String(text).match(/[?&]o=([^&\s]+)/); if (m) return decodeURIComponent(m[1])
  return String(text).trim()
}

// ดึง id ของแถวจาก QR (QR ใหม่ฝัง ?id=NNN — แม่นยำกว่า order_number)
function extractId(text: string): string {
  try { const u = new URL(text); const id = u.searchParams.get('id'); if (id) return id } catch {}
  const m = String(text).match(/[?&]id=([^&\s]+)/); if (m) return decodeURIComponent(m[1])
  return ''
}

const wrap: React.CSSProperties = { minHeight: '100dvh', background: '#0b1220', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0, fontFamily: 'Sarabun, -apple-system, "Segoe UI", sans-serif', textAlign: 'center' }
const centerWrap: React.CSSProperties = { ...wrap, justifyContent: 'center', padding: 24 }
const card: React.CSSProperties = { background: '#fff', color: '#1a1a1a', borderRadius: 18, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }

function ScanContent() {
  const sp = useSearchParams()
  const urlOrder = (sp.get('o') || '').trim()
  const urlId = (sp.get('id') || '').trim()

  const [tech, setTech] = useState<Tech | null>(null)
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<Phase>('scanning')
  const [order, setOrder] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [camState, setCamState] = useState<'idle' | 'starting' | 'on' | 'error'>('idle')
  const [camErr, setCamErr] = useState('')

  // login form
  const [q, setQ] = useState('')
  const [pickCode, setPickCode] = useState('')
  const [pickStage, setPickStage] = useState('')

  const scannerRef = useRef<any>(null)
  const busyRef = useRef(false)
  const startedRef = useRef(false)

  useEffect(() => { setTech(loadTech()); setReady(true) }, [])

  // พื้นหลังหน้า /scan เป็นสีเข้ม (กัน iOS bounce โชว์ขอบขาว) + กัน overscroll — คืนค่าเดิมตอนออกจากหน้า
  useEffect(() => {
    const html = document.documentElement, body = document.body
    const prev = { htmlBg: html.style.background, bodyBg: body.style.background, htmlOver: html.style.overscrollBehavior, bodyOver: body.style.overscrollBehavior }
    html.style.background = '#0b1220'
    body.style.background = '#0b1220'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    return () => {
      html.style.background = prev.htmlBg; body.style.background = prev.bodyBg
      html.style.overscrollBehavior = prev.htmlOver; body.style.overscrollBehavior = prev.bodyOver
    }
  }, [])

  // กรณีเปิดจากลิงก์ที่มี id/เลขออเดอร์ (เช่นสแกนด้วยแอปกล้องของเครื่อง) → อัปเดตครั้งเดียว
  useEffect(() => {
    if (!ready || !tech || (!urlOrder && !urlId)) return
    runScan(tech, urlId, urlOrder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tech, urlOrder, urlId])

  // โหมดสแกนในแอป: เปิดกล้องสแกนต่อเนื่อง (เมื่อ login แล้ว และไม่ได้มาจากลิงก์)
  async function startCamera() {
    if (startedRef.current || !tech) return
    startedRef.current = true
    setCamState('starting'); setCamErr('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const html5 = new Html5Qrcode('qr-reader', { verbose: false } as any)
      scannerRef.current = html5
      await html5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded: string) => {
          if (busyRef.current) return
          busyRef.current = true
          try { await html5.pause(true) } catch {}
          await runScan(tech!, extractId(decoded), extractOrder(decoded))
          setTimeout(() => { try { html5.resume() } catch {}; busyRef.current = false; setPhase('scanning') }, 2600)
        },
        () => {} // ละเว้น error รายเฟรม
      )
      setCamState('on')
    } catch (e: any) {
      startedRef.current = false
      setCamState('error'); setCamErr(e?.message || String(e))
    }
  }

  useEffect(() => {
    if (!ready || !tech || urlOrder || urlId) return
    startCamera()
    return () => {
      const s = scannerRef.current
      if (s) { try { s.stop().then(() => s.clear()).catch(() => {}) } catch {} ; scannerRef.current = null; startedRef.current = false }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tech, urlOrder, urlId])

  // ค้นออเดอร์: id ก่อน (แม่นสุด) → order_number แบบไม่สนตัวพิมพ์ → contains (เผื่อช่องว่าง/QR เก่า)
  async function findOrder(id: string, ord: string) {
    const cols = 'id, order_number, customer_name, order_status'
    if (id) {
      const { data } = await supabase.from('order_entries').select(cols).eq('id', id).limit(1)
      if (data && data[0]) return data[0]
    }
    const term = ord.trim()
    if (term) {
      const exact = await supabase.from('order_entries').select(cols).ilike('order_number', term).order('id', { ascending: false }).limit(1)
      if (exact.data && exact.data[0]) return exact.data[0]
      const like = await supabase.from('order_entries').select(cols).ilike('order_number', `%${term}%`).order('id', { ascending: false }).limit(1)
      if (like.data && like.data[0]) return like.data[0]
    }
    return null
  }

  async function runScan(t: Tech, id: string, ord: string) {
    const stage = stageByKey(t.stageKey)
    if (!stage) { setPhase('error'); setMsg('ไม่พบแผนกของผู้ใช้ กรุณาตั้งค่าใหม่'); return }
    if (!id && !ord) { setPhase('noorder'); setMsg(''); return }
    setPhase('working')
    const o = await findOrder(id, ord)
    if (!o) { setOrder({ order_number: ord || `id:${id}` }); setPhase('noorder'); return }
    setOrder(o)

    if (!canAdvance(o.order_status, stage.status)) {
      setPhase('already'); setMsg(`สถานะปัจจุบัน: ${o.order_status || 'รอดำเนินการ'}`); return
    }

    const now = new Date().toISOString()
    const { error } = await supabase.from('order_entries').update({ order_status: stage.status, updated_at: now }).eq('id', o.id)
    if (error) { setPhase('error'); setMsg(error.message); return }

    try {
      const term = o.order_number || o.customer_name
      if (term) {
        const { data: matches } = await supabase.from('work_status').select('id').or(`order_number.ilike.%${term}%,order_number.ilike.%${o.customer_name}%`)
        if (matches && matches.length > 0) await supabase.from('work_status').update({ status: stage.status, status_updated_at: now }).in('id', matches.map((m: any) => m.id))
      }
    } catch {}
    try { await supabase.from('production_scans').insert({ order_number: o.order_number || ord, stage: stage.label, status: stage.status, tech_code: t.code, tech_name: t.name, scanned_at: now }) } catch {}

    setOrder({ ...o, order_status: stage.status })
    setPhase('done')
  }

  function saveLogin() {
    const emp = EMPLOYEES.find(e => e.code === pickCode)
    if (!emp || !pickStage) return
    localStorage.setItem(LS_KEY, JSON.stringify({ code: emp.code, name: `${emp.nickname} (${emp.code})`, stageKey: pickStage }))
    setTech(loadTech())
  }

  function logout() {
    const s = scannerRef.current
    if (s) { try { s.stop().catch(() => {}) } catch {} }
    localStorage.removeItem(LS_KEY); setTech(null); startedRef.current = false; setCamState('idle')
    setQ(''); setPickCode(''); setPickStage('')
  }

  if (!ready) return <div style={centerWrap}><div style={{ opacity: 0.6 }}>กำลังโหลด…</div></div>

  // ---------- ตั้งค่าครั้งแรก ----------
  if (!tech) {
    const matches = q.trim() ? EMPLOYEES.filter(e => e.nickname.includes(q) || e.realName.includes(q) || e.code.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
    const picked = EMPLOYEES.find(e => e.code === pickCode)
    return (
      <div style={centerWrap}>
        <div style={card}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>ตั้งค่าเครื่องสแกน</h1>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>ทำครั้งเดียวต่อมือถือ — เลือกชื่อและแผนกของคุณ</p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, textAlign: 'left', marginBottom: 6 }}>1. ชื่อพนักงาน</label>
          {picked ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #2563eb', background: '#eff6ff', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
              <span style={{ fontWeight: 700 }}>{picked.nickname} · {picked.realName} <span style={{ color: '#2563eb' }}>({picked.code})</span></span>
              <button onClick={() => { setPickCode(''); setQ('') }} style={{ border: 'none', background: 'transparent', color: '#666', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์ชื่อเล่น / ชื่อจริง / รหัส"
                style={{ width: '100%', border: '1px solid #ccc', borderRadius: 10, padding: '11px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              {matches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 10, marginTop: 4, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', zIndex: 10, overflow: 'hidden', textAlign: 'left' }}>
                  {matches.map(e => (
                    <div key={e.code} onClick={() => { setPickCode(e.code); setQ('') }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0f0f0' }}>
                      <b>{e.nickname}</b> · {e.realName} <span style={{ color: '#2563eb' }}>{e.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, textAlign: 'left', marginBottom: 6 }}>2. แผนกของคุณ</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
            {STAGES.map(s => (
              <button key={s.key} onClick={() => setPickStage(s.key)}
                style={{ padding: 14, borderRadius: 12, border: pickStage === s.key ? '2px solid #2563eb' : '1px solid #ccc', background: pickStage === s.key ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                {s.label}<div style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>→ {s.status}</div>
              </button>
            ))}
          </div>
          <button onClick={saveLogin} disabled={!pickCode || !pickStage}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: (!pickCode || !pickStage) ? '#c7c7c7' : '#2563eb', color: '#fff', fontSize: 16, fontWeight: 700, cursor: (!pickCode || !pickStage) ? 'not-allowed' : 'pointer' }}>บันทึก</button>
        </div>
      </div>
    )
  }

  const stage = stageByKey(tech.stageKey)
  const stageColor = '#2563eb'

  // ---------- โหมดลิงก์ (มาจากแอปกล้องของเครื่อง) ----------
  if (urlOrder || urlId) {
    return (
      <div style={centerWrap}>
        <div style={card}>
          <Identity tech={tech} stageLabel={stage?.label} onLogout={logout} />
          <Result phase={phase} order={order} msg={msg} stage={stage} />
          <a href="/scan" style={{ display: 'inline-block', marginTop: 18, color: stageColor, fontSize: 14, fontWeight: 600 }}>เปิดกล้องสแกนต่อ →</a>
        </div>
      </div>
    )
  }

  // ---------- โหมดสแกนในแอป ----------
  const showOverlay = phase !== 'scanning'
  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 480, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ textAlign: 'left', fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>{tech.name}</div>
          <div style={{ color: '#7dd3fc' }}>แผนก {stage?.label} → {stage?.status}</div>
        </div>
        <button onClick={logout} style={{ border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>เปลี่ยน</button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, flex: 1 }}>
        <div id="qr-reader" style={{ width: '100%' }} />

        {camState !== 'on' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {camState === 'error' ? (
              <>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📷</div>
                <p style={{ fontSize: 14, color: '#fca5a5', marginBottom: 14 }}>เปิดกล้องไม่ได้ — โปรดอนุญาตให้เว็บใช้กล้อง<br /><span style={{ fontSize: 12, color: '#94a3b8' }}>{camErr}</span></p>
                <button onClick={() => { startedRef.current = false; startCamera() }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>ลองอีกครั้ง</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📷</div>
                <button onClick={() => { startedRef.current = false; startCamera() }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                  {camState === 'starting' ? 'กำลังเปิดกล้อง…' : 'แตะเพื่อเปิดกล้อง'}
                </button>
              </>
            )}
          </div>
        )}

        {camState === 'on' && !showOverlay && (
          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 15, color: '#fff', textShadow: '0 1px 4px #000' }}>
            จ่อ QR บนใบออเดอร์ให้อยู่ในกรอบ
          </div>
        )}

        {showOverlay && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,18,32,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ ...card, maxWidth: 380 }}>
              <Result phase={phase} order={order} msg={msg} stage={stage} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Identity({ tech, stageLabel, onLogout }: { tech: Tech; stageLabel?: string; onLogout: () => void }) {
  return (
    <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
      {tech.name} · แผนก <b style={{ color: '#1a1a1a' }}>{stageLabel}</b>
      <button onClick={onLogout} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>เปลี่ยน</button>
    </div>
  )
}

function Result({ phase, order, msg, stage }: { phase: Phase; order: any; msg: string; stage: any }) {
  if (phase === 'working') return <div style={{ fontSize: 16, padding: '24px 0' }}>⏳ กำลังอัปเดต…</div>
  if (phase === 'done') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>✅</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: '#16a34a' }}>{stage?.status}</h1>
      <p style={{ fontSize: 15 }}>ออเดอร์ <b>{order?.order_number}</b></p>
      <p style={{ fontSize: 14, color: '#666' }}>{order?.customer_name}</p>
    </>
  )
  if (phase === 'already') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>ℹ️</div>
      <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#d97706' }}>ไม่อัปเดต (กันข้ามขั้น)</h1>
      <p style={{ fontSize: 15 }}>ออเดอร์ <b>{order?.order_number}</b></p>
      <p style={{ fontSize: 14, color: '#666' }}>{msg}</p>
    </>
  )
  if (phase === 'noorder') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>❓</div>
      <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#dc2626' }}>ไม่พบออเดอร์</h1>
      <p style={{ fontSize: 14, color: '#666' }}>{order?.order_number || 'QR ไม่ถูกต้อง'}</p>
    </>
  )
  if (phase === 'error') return (
    <>
      <div style={{ fontSize: 54, marginBottom: 8 }}>⚠️</div>
      <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#dc2626' }}>เกิดข้อผิดพลาด</h1>
      <p style={{ fontSize: 13, color: '#666' }}>{msg}</p>
    </>
  )
  return null
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div style={centerWrap}><div style={{ opacity: 0.6 }}>กำลังโหลด…</div></div>}>
      <ScanContent />
    </Suspense>
  )
}
