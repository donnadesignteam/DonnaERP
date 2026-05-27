'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Installation = {
  id: string
  serial_no: string
  appointment_datetime: string
  work_type: string
  platform: string
  customer_id: string
  customer_real_name: string
  province: string
  phone: string
  work_details: string
  location_link: string
  price: number
  notes: string
  payment_status: string
  appointment_status: string
  production_status: string
  send_to_technician: string
  installation_status: string
  entered_by: string
  created_at: string
}

const PLATFORMS = ['Tiktok','Tiktok-Chat','Shopee','Shopee-Chat','Lazada','Facebook','LineOA',
  'Lineส่วนตัวยุน','Lineส่วนตัวสู้','Lineส่วนตัวเฟิร์น','หน้าร้าน',
  'เคลม:Shopee','เคลม:Lazada','เคลม:Tiktok','เคลม:Facebook','เคลม:หน้าร้าน',
  'เคลม:LineOA','เคลม:Lineส่วนตัวยุน','เคลม:Lineส่วนตัวสู้','เคลม:Lineส่วนตัวเฟิร์น']
const TIMES = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']
const ENTERED_BY = ['เก๋','หนูนา','สู้','ยุน']
const WORK_TYPES = ['งานติดตั้ง','งานวัดพื้นที่','งานแก้']
const INST_STATUS = ['รอการติดตั้ง','รอเช็คงาน/เหลือจ่ายเงิน','งานช่างนอกติดตั้งสำเร็จ','ติดตั้งสำเร็จ','ติดตั้ง50%','งานรอแก้']

const STATUS_COLOR: Record<string, string> = {
  'รอการติดตั้ง': '#34c759',
  'รอเช็คงาน/เหลือจ่ายเงิน': '#ff9f0a',
  'งานรอแก้': 'var(--red)',
  'ติดตั้งสำเร็จ': 'var(--blue)',
  'งานช่างนอกติดตั้งสำเร็จ': 'var(--blue)',
  'ติดตั้ง50%': '#bf5af2',
}

const DAYS = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']
const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function pad(n: number) { return String(n).padStart(4, '0') }

function Calendar({ year, month, installs, onDayClick }: {
  year: number; month: number; installs: Installation[]; onDayClick: (day: number) => void
}) {
  const dim = new Date(year, month + 1, 0).getDate()
  const first = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = i - first + 1
    return d > 0 && d <= dim ? d : null
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '6px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          const dayInstalls = day ? installs.filter(ins => {
            const dt = new Date(ins.appointment_datetime)
            return dt.getDate() === day && dt.getMonth() === month && dt.getFullYear() === year
          }) : []
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
          return (
            <div key={i} onClick={() => day && onDayClick(day)}
              style={{ minHeight: 90, background: day ? '#fff' : 'transparent', borderRadius: 8, padding: '6px 8px', cursor: day ? 'pointer' : 'default', border: isToday ? '2px solid var(--blue)' : '1px solid rgba(0,0,0,0.06)', transition: 'background 0.1s' }}>
              {day && (
                <>
                  <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--blue)' : 'var(--ink)', marginBottom: 4 }}>{day}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayInstalls.slice(0, 3).map(ins => {
                      const t = new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                      const bg = STATUS_COLOR[ins.installation_status] ?? 'var(--ink-3)'
                      return (
                        <div key={ins.id} style={{ background: bg + '22', borderLeft: `3px solid ${bg}`, borderRadius: 3, padding: '2px 5px', fontSize: 10, color: bg, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t} {ins.customer_real_name || ins.customer_id}
                        </div>
                      )
                    })}
                    {dayInstalls.length > 3 && <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>+{dayInstalls.length - 3}</div>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const emptyForm = (): Omit<Installation, 'id' | 'created_at' | 'serial_no'> => ({
  appointment_datetime: '', work_type: 'งานติดตั้ง', platform: '', customer_id: '',
  customer_real_name: '', province: '', phone: '', work_details: '', location_link: '',
  price: 0, notes: '', payment_status: 'รอมัดจำ', appointment_status: 'รอนัดหมาย',
  production_status: 'กำลังผลิต', send_to_technician: 'หน้าร้าน',
  installation_status: 'รอการติดตั้ง', entered_by: '',
})

export default function InstallationsPage() {
  const [installs, setInstalls] = useState<Installation[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<Installation> } | null>(null)
  const [dayModal, setDayModal] = useState<{ day: number; items: Installation[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('9:00')
  const [listFilter, setListFilter] = useState<'all' | string>('all')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('installations').select('*').order('appointment_datetime', { ascending: false })
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    setInstalls((data ?? []) as Installation[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const nextSerial = () => pad(installs.length + 1)

  const openAdd = () => {
    setApptDate('')
    setApptTime('9:00')
    setModal({ mode: 'add', data: emptyForm() })
  }

  const set = (k: string, v: string | number) => setModal(m => m ? { ...m, data: { ...m.data, [k]: v } } : null)

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const dt = apptDate && apptTime ? `${apptDate}T${apptTime.padStart(5, '0')}:00` : modal.data.appointment_datetime
    const d = modal.data
    const payload = { ...d, appointment_datetime: dt, serial_no: modal.mode === 'add' ? nextSerial() : d.serial_no }
    let err
    if (modal.mode === 'add') {
      const res = await supabase.from('installations').insert(payload)
      err = res.error
    } else {
      const res = await supabase.from('installations').update(payload).eq('id', d.id)
      err = res.error
    }
    setSaving(false)
    if (err) {
      setError(`บันทึกไม่สำเร็จ: ${err.message}`)
    } else {
      setModal(null)
      load()
    }
  }

  const del = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('installations').delete().eq('id', id)
    load()
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const displayed = listFilter === 'all' ? installs : installs.filter(ins => {
    const d = new Date(ins.appointment_datetime)
    return d.getMonth() === Number(listFilter.split('-')[1]) - 1 && d.getFullYear() === Number(listFilter.split('-')[0])
  })

  const sel = (label: string, key: string, options: string[]) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={String(modal?.data[key as keyof typeof modal.data] ?? '')} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none' }}>
        <option value="">— เลือก —</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )

  const inp = (label: string, key: string, type = 'text') => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={type} value={String(modal?.data[key as keyof typeof modal.data] ?? '')} onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px' }}>งานติดตั้ง</h1>
        <button onClick={openAdd}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3)' }}>
          + เพิ่มรายการ
        </button>
      </div>

      {error && (
        <div style={{ background: '#ff375f11', border: '1px solid #ff375f44', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Calendar */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={prevMonth} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, background: '#fff' }}>‹</button>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', flex: 1, textAlign: 'center' }}>
            {TH_MONTHS[month]} {year + 543}
          </h2>
          <button onClick={nextMonth} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, background: '#fff' }}>›</button>
        </div>
        <Calendar year={year} month={month} installs={installs} onDayClick={day => {
          const items = installs.filter(ins => {
            const d = new Date(ins.appointment_datetime)
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
          })
          setDayModal({ day, items })
        }} />
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {[['#34c759', 'รอการติดตั้ง'], ['#ff9f0a', 'รอเช็คงาน'], ['var(--red)', 'งานรอแก้'], ['var(--blue)', 'เสร็จแล้ว']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>รายการทั้งหมด</h2>
        <select value={listFilter} onChange={e => setListFilter(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 13, outline: 'none' }}>
          <option value="all">ทั้งหมด</option>
          {Array.from(new Set(installs.map(ins => {
            const d = new Date(ins.appointment_datetime)
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          }))).sort().reverse().map(m => (
            <option key={m} value={m}>{TH_MONTHS[Number(m.split('-')[1]) - 1]} {Number(m.split('-')[0]) + 543}</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>ไม่มีรายการ</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {['Serial','นัดหมาย','ลักษณะงาน','ลูกค้า','จังหวัด','เบอร์','สถานะติดตั้ง','ชำระเงิน',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(ins => {
                const bg = STATUS_COLOR[ins.installation_status] ?? 'var(--ink-3)'
                return (
                  <tr key={ins.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--blue)' }}>{ins.serial_no}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {ins.appointment_datetime ? new Date(ins.appointment_datetime).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>{ins.work_type}</td>
                    <td style={{ padding: '12px 14px' }}>{ins.customer_real_name || ins.customer_id || '-'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{ins.province || '-'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ink-3)' }}>{ins.phone || '-'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: bg + '22', color: bg, padding: '2px 8px', borderRadius: 980, fontWeight: 500, whiteSpace: 'nowrap', fontSize: 11 }}>{ins.installation_status}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--ink-3)' }}>{ins.payment_status}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => { setModal({ mode: 'edit', data: { ...ins } }); setApptDate(ins.appointment_datetime?.split('T')[0] ?? ''); setApptTime(ins.appointment_datetime ? new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '9:00') }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 11 }}>แก้ไข</button>
                        <button onClick={() => del(ins.id)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ff375f22', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}>ลบ</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Day modal */}
      {dayModal && (
        <div onClick={() => setDayModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>วันที่ {dayModal.day} {TH_MONTHS[month]} {year + 543}</h2>
              <button onClick={() => setDayModal(null)} style={{ border: 'none', background: 'rgba(0,0,0,0.10)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            {dayModal.items.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>ไม่มีนัดหมาย</p>
            ) : dayModal.items.map(ins => {
              const bg = STATUS_COLOR[ins.installation_status] ?? 'var(--ink-3)'
              return (
                <div key={ins.id} style={{ borderLeft: `4px solid ${bg}`, borderRadius: 10, padding: '14px 16px', background: 'var(--bg)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{ins.serial_no}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {ins.appointment_datetime ? new Date(ins.appointment_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{ins.customer_real_name || ins.customer_id}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{ins.work_type} · {ins.province}</div>
                  {ins.phone && <div style={{ fontSize: 13, marginTop: 4 }}>📞 {ins.phone}</div>}
                  {ins.location_link && <a href={ins.location_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--blue)', display: 'block', marginTop: 4 }}>📍 ดูแผนที่</a>}
                  <div style={{ marginTop: 8 }}>
                    <span style={{ background: bg + '22', color: bg, padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600 }}>{ins.installation_status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 28, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
              {modal.mode === 'add' ? '+ เพิ่มรายการติดตั้ง' : 'แก้ไขรายการ'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>วันที่นัดหมาย</label>
                <input type="date" lang="en-GB" value={apptDate} onChange={e => setApptDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>เวลานัด</label>
                <select value={apptTime} onChange={e => setApptTime(e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none' }}>
                  {TIMES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {sel('ลักษณะงาน', 'work_type', WORK_TYPES)}
              {sel('จาก', 'platform', PLATFORMS)}
              {sel('ผู้ลงข้อมูล', 'entered_by', ENTERED_BY)}
              {inp('ชื่อ ID', 'customer_id')}
              {inp('ชื่อจริงลูกค้า', 'customer_real_name')}
              {inp('จังหวัด', 'province')}
              {inp('เบอร์โทร', 'phone')}
              {inp('ราคา', 'price', 'number')}
              {sel('สถานะชำระเงิน', 'payment_status', ['รอมัดจำ','มัดจำแล้ว','ชำระครบ'])}
              {sel('การนัดหมาย', 'appointment_status', ['รอนัดหมาย','นัดหมายแล้ว','จัดส่งตามที่อยู่'])}
              {sel('สถานะการผลิต', 'production_status', ['กำลังผลิต','ผลิตเสร็จแล้ว'])}
              {sel('ส่งงานช่าง', 'send_to_technician', ['หน้าร้าน','พี่ฟอง','เชียงใหม่'])}
              {sel('สถานะการติดตั้ง', 'installation_status', INST_STATUS)}
            </div>
            {inp('ลิงค์โลเคชั่น', 'location_link')}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>รายละเอียดงาน</label>
              <textarea value={modal.data.work_details ?? ''} onChange={e => set('work_details', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>หมายเหตุ</label>
              <textarea value={modal.data.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
