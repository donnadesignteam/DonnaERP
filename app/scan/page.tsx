'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EMPLOYEES, STAGES, stageByKey, canAdvance, statusRank } from '@/lib/staff'

const LS_KEY = 'donna-scan-tech'
type Tech = { code: string; name: string; stageKey: string }

function loadTech(): Tech | null {
  try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null } catch { return null }
}

const wrap: React.CSSProperties = { minHeight: '100dvh', background: '#0b1220', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Sarabun, -apple-system, "Segoe UI", sans-serif', textAlign: 'center' }
const card: React.CSSProperties = { background: '#fff', color: '#1a1a1a', borderRadius: 18, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }

function ScanContent() {
  const sp = useSearchParams()
  const orderNo = (sp.get('o') || '').trim()

  const [tech, setTech] = useState<Tech | null>(null)
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'already' | 'error' | 'noorder'>('idle')
  const [order, setOrder] = useState<any>(null)
  const [msg, setMsg] = useState('')

  // login form
  const [q, setQ] = useState('')
  const [pickCode, setPickCode] = useState('')
  const [pickStage, setPickStage] = useState('')

  useEffect(() => { setTech(loadTech()); setReady(true) }, [])

  // เมื่อมี tech + เลขออเดอร์ → ดำเนินการสแกนอัตโนมัติ
  useEffect(() => {
    if (!ready || !tech || !orderNo || phase !== 'idle') return
    runScan(tech)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tech, orderNo])

  async function runScan(t: Tech) {
    const stage = stageByKey(t.stageKey)
    if (!stage) { setPhase('error'); setMsg('ไม่พบแผนกของผู้ใช้ กรุณาตั้งค่าใหม่'); return }
    setPhase('working')
    // ใช้ตาราง order_entries (ตารางจริงของหน้าออเดอร์)
    const { data } = await supabase.from('order_entries').select('id, order_number, customer_name, order_status').eq('order_number', orderNo).order('id', { ascending: false }).limit(1)
    const o = data && data[0]
    if (!o) { setPhase('noorder'); return }
    setOrder(o)

    if (!canAdvance(o.order_status, stage.status)) {
      // อยู่ขั้นเท่ากันหรือเลยไปแล้ว → ไม่ถอยหลัง
      setPhase('already'); setMsg(`สถานะปัจจุบัน: ${o.order_status || 'รอดำเนินการ'}`); return
    }

    const now = new Date().toISOString()
    const { error } = await supabase.from('order_entries').update({ order_status: stage.status, updated_at: now }).eq('order_number', orderNo)
    if (error) { setPhase('error'); setMsg(error.message); return }

    // sync ไปตาราง work_status (เหมือน UI แอดมิน) — best-effort
    try {
      const term = o.order_number || o.customer_name
      if (term) {
        const { data: matches } = await supabase.from('work_status').select('id')
          .or(`order_number.ilike.%${term}%,order_number.ilike.%${o.customer_name}%`)
        if (matches && matches.length > 0) {
          await supabase.from('work_status').update({ status: stage.status, status_updated_at: now }).in('id', matches.map((m: any) => m.id))
        }
      }
    } catch {}

    // บันทึก log การสแกน (best-effort — ถ้าไม่มีตารางก็ข้าม)
    try { await supabase.from('production_scans').insert({ order_number: orderNo, stage: stage.label, status: stage.status, tech_code: t.code, tech_name: t.name, scanned_at: now }) } catch {}

    setOrder({ ...o, order_status: stage.status })
    setPhase('done')
  }

  function saveLogin() {
    const emp = EMPLOYEES.find(e => e.code === pickCode)
    if (!emp || !pickStage) return
    const t: Tech = { code: emp.code, name: `${emp.nickname} (${emp.code})`, stageKey: pickStage }
    localStorage.setItem(LS_KEY, JSON.stringify(t))
    setTech(t); setPhase('idle')
  }

  function logout() { localStorage.removeItem(LS_KEY); setTech(null); setPhase('idle'); setQ(''); setPickCode(''); setPickStage('') }

  if (!ready) return <div style={wrap}><div style={{ opacity: 0.6 }}>กำลังโหลด…</div></div>

  // ---- ยังไม่ได้ login บนเครื่องนี้ ----
  if (!tech) {
    const matches = q.trim()
      ? EMPLOYEES.filter(e => e.nickname.includes(q) || e.realName.includes(q) || e.code.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
      : []
    const picked = EMPLOYEES.find(e => e.code === pickCode)
    return (
      <div style={wrap}>
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
                style={{ padding: '14px', borderRadius: 12, border: pickStage === s.key ? '2px solid #2563eb' : '1px solid #ccc', background: pickStage === s.key ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                {s.label}<div style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>→ {s.status}</div>
              </button>
            ))}
          </div>

          <button onClick={saveLogin} disabled={!pickCode || !pickStage}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: (!pickCode || !pickStage) ? '#c7c7c7' : '#2563eb', color: '#fff', fontSize: 16, fontWeight: 700, cursor: (!pickCode || !pickStage) ? 'not-allowed' : 'pointer' }}>
            บันทึก
          </button>
        </div>
      </div>
    )
  }

  // ---- login แล้ว ----
  const stage = stageByKey(tech.stageKey)
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          {tech.name} · แผนก <b style={{ color: '#1a1a1a' }}>{stage?.label}</b>
          <button onClick={logout} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>เปลี่ยน</button>
        </div>

        {!orderNo ? (
          <>
            <div style={{ fontSize: 54, marginBottom: 8 }}>📷</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>พร้อมสแกน</h1>
            <p style={{ fontSize: 14, color: '#666' }}>ใช้กล้องมือถือสแกน QR บนใบออเดอร์ สถานะจะเปลี่ยนเป็น <b>{stage?.status}</b> อัตโนมัติ</p>
          </>
        ) : phase === 'working' ? (
          <div style={{ fontSize: 16, padding: '24px 0' }}>⏳ กำลังอัปเดต…</div>
        ) : phase === 'done' ? (
          <>
            <div style={{ fontSize: 54, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: '#16a34a' }}>{stage?.status}</h1>
            <p style={{ fontSize: 15 }}>ออเดอร์ <b>{order?.order_number}</b></p>
            <p style={{ fontSize: 14, color: '#666' }}>{order?.customer_name}</p>
          </>
        ) : phase === 'already' ? (
          <>
            <div style={{ fontSize: 54, marginBottom: 8 }}>ℹ️</div>
            <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#d97706' }}>ไม่อัปเดต (กันข้ามขั้น)</h1>
            <p style={{ fontSize: 15 }}>ออเดอร์ <b>{order?.order_number}</b></p>
            <p style={{ fontSize: 14, color: '#666' }}>{msg}</p>
            <p style={{ fontSize: 13, color: '#999', marginTop: 6 }}>แผนก{stage?.label} → {stage?.status} อยู่ก่อน/เท่ากับสถานะปัจจุบัน</p>
          </>
        ) : phase === 'noorder' ? (
          <>
            <div style={{ fontSize: 54, marginBottom: 8 }}>❓</div>
            <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#dc2626' }}>ไม่พบออเดอร์</h1>
            <p style={{ fontSize: 14, color: '#666' }}>เลขออเดอร์: {orderNo}</p>
          </>
        ) : phase === 'error' ? (
          <>
            <div style={{ fontSize: 54, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, color: '#dc2626' }}>เกิดข้อผิดพลาด</h1>
            <p style={{ fontSize: 13, color: '#666' }}>{msg}</p>
          </>
        ) : (
          <div style={{ fontSize: 16, padding: '24px 0' }}>⏳ กำลังโหลด…</div>
        )}
      </div>
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div style={wrap}><div style={{ opacity: 0.6 }}>กำลังโหลด…</div></div>}>
      <ScanContent />
    </Suspense>
  )
}
