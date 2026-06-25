'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Change = { from: unknown; to: unknown }
type Log = {
  id: string
  table_name: string
  category: string
  action: 'insert' | 'update' | 'delete'
  row_id: string | null
  label: string | null
  changes: Record<string, Change> | null
  created_at: string
}

const PAGE = 50

// หมวด → สีป้าย
const CAT_COLOR: Record<string, string> = {
  'ออเดอร์': '#C47E3A',
  'เคลม': '#f43f5e',
  'งานติดตั้ง': '#ff9f0a',
  'สั่งซื้อ': '#5e9eff',
  'สต็อก': '#30d158',
  'ใบลา': '#bf5af2',
  'สแกนผลิต': '#5ac8fa',
  'ผู้จัดจำหน่าย': '#8e8e93',
}

// action → คำกริยา + สี
function actionLabel(a: Log['action'], table: string) {
  if (a === 'insert') return table === 'production_scans' ? { t: 'สแกน', c: '#5ac8fa' } : { t: 'เพิ่ม', c: '#30d158' }
  if (a === 'delete') return { t: 'ลบ', c: '#f43f5e' }
  return { t: 'แก้ไข', c: '#C47E3A' }
}

// ชื่อฟิลด์ → ภาษาไทย (ไม่เจอ = ใช้ชื่อดิบ)
const FIELD_TH: Record<string, string> = {
  order_status: 'สถานะงาน', status: 'สถานะ', deadline: 'กำหนดส่ง',
  shipping_datetime: 'วันส่ง', shipped_at: 'จัดส่งเมื่อ', customer_name: 'ลูกค้า',
  platform: 'แพลตฟอร์ม', notes: 'หมายเหตุ', price: 'ราคา', deposit: 'มัดจำ',
  payment_status: 'การชำระ', is_urgent: 'งานเสร็จ', items: 'รายการสินค้า',
  technician: 'ช่าง', admin_name: 'แอดมิน', courier: 'ขนส่ง', order_number: 'เลขออเดอร์',
  province: 'จังหวัด', phone: 'เบอร์โทร', installation_date: 'วันติดตั้ง',
  install_time: 'เวลานัด', work_type: 'ลักษณะงาน', location_link: 'ลิงก์โลเคชั่น',
  refund_amount: 'ยอดเงินคืน', money_status: 'สถานะเงิน', return_tracking: 'เลขพัสดุคืน',
  in_use_rolls: 'ม้วนที่ใช้', remaining_meters: 'เมตรคงเหลือ', stock_count: 'จำนวนสต็อก',
  color_name: 'ลาย/สี', fabric_code: 'รหัสผ้า', fabric_type: 'ชนิดผ้า',
  supplier: 'ผู้จัดจำหน่าย', leave_date: 'วันลา', leave_end_date: 'วันสิ้นสุดลา',
  leave_type: 'ประเภทลา', order_assigned: 'ผู้รับผิดชอบ',
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  if (typeof v === 'object') return 'อัปเดต' // jsonb/array เช่น รายการสินค้า
  const s = String(v)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diff === 0) return 'วันนี้'
  if (diff === 1) return 'เมื่อวาน'
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// สรุปการเปลี่ยนแปลงให้อยู่บรรทัดเดียว
function changeSummary(changes: Record<string, Change> | null): string {
  if (!changes) return ''
  const keys = Object.keys(changes)
  const parts = keys.slice(0, 2).map(k => `${FIELD_TH[k] || k}: ${fmtVal(changes[k].from)} → ${fmtVal(changes[k].to)}`)
  if (keys.length > 2) parts.push(`+${keys.length - 2}`)
  return parts.join(' · ')
}

// จัดกลุ่มตามวัน (logs เรียงใหม่→เก่าอยู่แล้ว)
function groupByDay(logs: Log[]): { key: string; label: string; items: Log[] }[] {
  const groups: { key: string; label: string; items: Log[] }[] = []
  let cur: { key: string; label: string; items: Log[] } | null = null
  for (const log of logs) {
    const k = dayKey(log.created_at)
    if (!cur || cur.key !== k) {
      cur = { key: k, label: dayLabel(log.created_at), items: [] }
      groups.push(cur)
    }
    cur.items.push(log)
  }
  return groups
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<Log[]>([])
  const [cat, setCat] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (reset: boolean) => {
    setLoading(true)
    setError(null)
    const offset = reset ? 0 : logs.length
    let q = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (cat) q = q.eq('category', cat)
    const { data, error } = await q
    if (error) {
      // ตารางยังไม่ถูกสร้าง = ยังไม่ได้รัน SQL
      setError(error.message.includes('activity_logs') || error.code === '42P01'
        ? 'ยังไม่ได้รัน scripts/add_activity_logs.sql ใน Supabase'
        : error.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as Log[]
    setHasMore(rows.length === PAGE)
    setLogs(reset ? rows : [...logs, ...rows])
    setLoading(false)
  }, [cat, logs])

  // โหลดใหม่เมื่อเปลี่ยนหมวด
  useEffect(() => { load(true) /* eslint-disable-next-line */ }, [cat])

  const cats = ['', 'ออเดอร์', 'เคลม', 'งานติดตั้ง', 'สั่งซื้อ', 'สต็อก', 'ใบลา', 'สแกนผลิต']

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>ประวัติการแก้ไข</h2>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>ทุกการเพิ่ม/แก้ไข/ลบ ในระบบ — เชื่อมทั้งร้านอัตโนมัติ</p>

      {/* ตัวกรองหมวด */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {cats.map(c => (
          <button key={c || 'all'} onClick={() => setCat(c)}
            style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
              border: '1px solid', borderColor: cat === c ? 'var(--blue)' : 'var(--border)',
              background: cat === c ? 'var(--blue)' : '#fff',
              color: cat === c ? '#fff' : 'var(--ink-3)', fontWeight: cat === c ? 600 : 400,
            }}>
            {c || 'ทั้งหมด'}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 14, borderRadius: 8, background: '#fff4f4', border: '1px solid #ffd4d4', color: 'var(--red)', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {!error && (
        <div>
          {groupByDay(logs).map(group => (
            <div key={group.key}>
              {/* หัววัน — เหมือน Chrome history */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', padding: '16px 4px 7px', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                {group.label}
              </div>
              {group.items.map(log => {
                const act = actionLabel(log.action, log.table_name)
                const summary = changeSummary(log.changes)
                return (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 42, flexShrink: 0, fontSize: 12, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' }}>{hhmm(log.created_at)}</span>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: CAT_COLOR[log.category] || '#8e8e93', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: act.c, fontWeight: 600 }}>{act.t}</span>
                      {' '}<span style={{ color: 'var(--ink-3)' }}>{log.category}</span>
                      {log.label && <span style={{ fontWeight: 600 }}> {log.label}</span>}
                      {summary && <span style={{ color: 'var(--ink-4)' }}> · {summary}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}

          {!loading && logs.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>ยังไม่มีประวัติ</div>
          )}

          {loading && <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>กำลังโหลด…</div>}

          {hasMore && !loading && (
            <button onClick={() => load(false)}
              style={{ marginTop: 12, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              โหลดเพิ่ม
            </button>
          )}
        </div>
      )}
    </div>
  )
}
