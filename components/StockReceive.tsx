'use client'

// รับของเข้า (หน้าภาพรวมสต็อก → "+ เพิ่มรายการ") — ลงของที่เข้ามาหลายรายการในรอบเดียว
// 1) บริษัท/ร้าน (แนะนำจากร้านที่เคยมี) 2) วันที่ของเข้า 3) หมวด 4) รายการ + จำนวน (แนะนำจากของที่มีในสต็อก โชว์คงเหลือ → หลังเพิ่ม)
// ของที่มีอยู่แล้ว = บวกเพิ่มเข้าแถวเดิม · ของใหม่ = เพิ่มแถวใหม่ · มีแค่ 3 หมวด (งานนอก/ยกเลิก-ตีกลับ ไม่ลงที่นี่ — user 22ก.ย.69)
//   สต็อกผ้า: บวกความยาว (หลา/เมตร → เก็บเป็นเมตร) ไม่ยุ่งจำนวนม้วน · สถานะคิดใหม่จากหลาคงเหลือ (lib/fabricStatus.ts)
//   อุปกรณ์ราง/สำนักงาน: บวกคงเหลือ · หน่วยเติมตามรายการในสต็อก แก้ได้ (แก้แล้วเปลี่ยนหน่วยของรายการนั้นด้วย)
// ช่องแนะนำใช้ SuggestInput/ThemedSelect (components/ItemInputs.tsx) ให้เข้ากับธีม — ไม่ใช้ datalist ของเบราว์เซอร์

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { tInsert, tUpdate, prevOf } from '@/lib/trackedDb'
import { fabricStatus, YARD } from '@/lib/fabricStatus'
import { SuggestInput, ThemedSelect } from '@/components/ItemInputs'

type Cat = 'fabric' | 'rail' | 'office'
const CATS: { id: Cat; label: string }[] = [
  { id: 'fabric', label: 'สต็อกผ้า' }, { id: 'rail', label: 'อุปกรณ์ราง' }, { id: 'office', label: 'อุปกรณ์สำนักงาน' },
]

type Fabric = { id: string; fabric_code: string; color_name: string | null; remaining_meters: number | null; shop_name: string | null; suppliers?: { shop_code?: string; shop_name?: string }[] | null }
type SItem = { id: string; category: string; name: string; qty: number; unit: string | null; vendor: string | null }
type Line = { name: string; qty: string; unit: string }

const today = () => new Date().toLocaleDateString('sv-SE')
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const fabricLabel = (f: Fabric) => [f.fabric_code, f.color_name].filter(Boolean).join(' ')
const emptyLine = (cat: Cat): Line => ({ name: '', qty: '', unit: cat === 'fabric' ? 'หลา' : cat === 'rail' ? 'ตัว' : 'ชิ้น' })
const round2 = (n: number) => Math.round(n * 100) / 100

const input: React.CSSProperties = { width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 14, background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--ink)', fontWeight: 700, display: 'block', marginBottom: 5 }

export default function StockReceive({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [vendor, setVendor] = useState('')
  const [date, setDate] = useState(today())
  const [cat, setCat] = useState<Cat | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [sitems, setSitems] = useState<SItem[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('stock').select('*').then(({ data }) => setFabrics((data ?? []) as Fabric[]))
    supabase.from('stock_items').select('id, category, name, qty, unit, vendor').then(({ data }) => setSitems((data ?? []) as SItem[]))
  }, [])

  // ร้านที่เคยมี: ซัพพลายเออร์ผ้า + ร้านของงานนอก/อุปกรณ์
  const vendors = useMemo(() => [...new Set([
    ...fabrics.flatMap(f => [f.shop_name, ...(f.suppliers ?? []).map(s => s?.shop_name)]),
    ...sitems.map(s => s.vendor),
  ].map(v => String(v ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')), [fabrics, sitems])

  // ของในสต็อกของหมวดที่เลือก — ผ้าของร้านที่เลือกขึ้นก่อน
  const options = useMemo(() => {
    if (cat === 'fabric') {
      const v = norm(vendor)
      const fromVendor = (f: Fabric) => !!v && [f.shop_name, ...(f.suppliers ?? []).map(s => s?.shop_name)].some(n => norm(String(n ?? '')) === v)
      return [...fabrics].sort((a, b) => Number(fromVendor(b)) - Number(fromVendor(a)) || a.fabric_code.localeCompare(b.fabric_code)).map(fabricLabel)
    }
    return [...new Set(sitems.filter(s => s.category === cat).map(s => s.name))]
  }, [cat, fabrics, sitems, vendor])

  // หน่วยที่หมวดนี้เคยใช้ (แนะนำในช่องหน่วย)
  const units = useMemo(() => [...new Set(sitems.filter(s => s.category === cat).map(s => s.unit ?? '').filter(Boolean))], [cat, sitems])

  const findFabric = (name: string) => {
    const code = norm(name).split(' ')[0]
    return fabrics.find(f => norm(fabricLabel(f)) === norm(name)) ?? fabrics.find(f => norm(f.fabric_code) === code)
  }
  const findItem = (name: string) => cat === 'fabric' ? undefined : sitems.find(s => s.category === cat && norm(s.name) === norm(name))

  const pickCat = (c: Cat) => { setCat(c); setLines([emptyLine(c)]); setErr('') }
  const upd = (i: number, patch: Partial<Line>) => setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
  // ชื่อตรงกับของในสต็อก → หน่วยเปลี่ยนตามรายการนั้น (แก้ต่อเองได้)
  const setName = (i: number, name: string) => {
    const it = findItem(name)
    upd(i, it?.unit ? { name, unit: it.unit } : { name })
  }

  // ข้อความ "มีในสต็อก X → หลังเพิ่ม Y" ของแต่ละบรรทัด
  const preview = (l: Line): { text: string; isNew: boolean } | null => {
    if (!l.name.trim()) return null
    const n = Number(l.qty) || 0
    if (cat === 'fabric') {
      const f = findFabric(l.name)
      if (!f) return { text: 'ยังไม่มีในสต็อก — จะเพิ่มเป็นผ้ารายการใหม่', isNew: true }
      const curYd = round2((Number(f.remaining_meters) || 0) / YARD)
      const after = round2(curYd + (l.unit === 'เมตร' ? n / YARD : n))
      return { text: `มีในสต็อก ${curYd.toLocaleString()} หลา → หลังเพิ่ม ${after.toLocaleString()} หลา (${fabricStatus(after * YARD)})`, isNew: false }
    }
    const it = findItem(l.name)
    if (!it) return { text: 'ยังไม่มีในสต็อก — จะเพิ่มเป็นรายการใหม่', isNew: true }
    const u = l.unit.trim() || it.unit || ''
    return { text: `มีในสต็อก ${it.qty} ${it.unit ?? ''} → หลังเพิ่ม ${Number(it.qty) + n} ${u}${it.unit && u !== it.unit ? ` (เปลี่ยนหน่วยเป็น ${u})` : ''}`, isNew: false }
  }

  const valid = lines.filter(l => l.name.trim() && Number(l.qty) > 0)

  const save = async () => {
    if (!cat || !valid.length) return
    setSaving(true); setErr('')
    const now = new Date().toISOString()
    const v = vendor.trim() || null
    try {
      for (const l of valid) {
        const n = Number(l.qty) || 0
        if (cat === 'fabric') {
          const f = findFabric(l.name)
          const addM = round2(l.unit === 'เมตร' ? n : n * YARD)
          if (f) {
            const meters = round2((Number(f.remaining_meters) || 0) + addM)
            const patch = { remaining_meters: meters, status: fabricStatus(meters), ordered_at: null, updated_at: now }
            await tUpdate('stock', f.id, patch, prevOf(f as unknown as Record<string, unknown>, patch), `รับผ้าเข้า ${fabricLabel(f)} +${n} ${l.unit}`, async () => onSaved())
            Object.assign(f, patch)   // รหัสเดียวกันหลายบรรทัดในรอบเดียว → บรรทัดถัดไปบวกต่อจากยอดใหม่
          } else {
            const [code, ...rest] = l.name.trim().split(/\s+/)
            await tInsert('stock', {
              fabric_code: code.toUpperCase(), color_name: rest.join(' '), fabric_type: '', shop_code: '', shop_name: v ?? '',
              suppliers: v ? [{ shop_code: '', shop_name: v }] : [],
              roll_count: 0, unused_rolls: 0, in_use_rolls: 0, remaining_meters: addM, status: fabricStatus(addM), updated_at: now,
            }, `เพิ่มผ้าใหม่ ${l.name.trim()}`, async () => onSaved())
          }
        } else {
          const it = findItem(l.name)
          const u = l.unit.trim()
          if (it) {
            const patch = { qty: Number(it.qty) + n, ...(u && u !== (it.unit ?? '') ? { unit: u } : {}), updated_at: now }
            await tUpdate('stock_items', it.id, patch, prevOf(it as unknown as Record<string, unknown>, patch), `รับของเข้า ${it.name} +${n}`, async () => onSaved())
            Object.assign(it, patch)
          } else {
            await tInsert('stock_items', {
              category: cat, name: l.name.trim(), qty: n, unit: u || null, vendor: v,
              notes: `ของเข้า ${date}${v ? ` จาก ${v}` : ''}`, updated_at: now,
            }, `รับของเข้า ${l.name.trim()}`, async () => onSaved())
          }
        }
      }
      onSaved(); onClose()
    } catch (e) {
      setErr(`บันทึกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(40,28,20,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="sc-modal" style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>เพิ่มรายการ (รับของเข้า)</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={lbl}>บริษัท/ร้าน</label>
            <SuggestInput value={vendor} onChange={setVendor} suggestions={vendors} style={input} />
          </div>
          <div>
            <label style={lbl}>วันที่ของเข้า</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
          </div>
        </div>

        <label style={lbl}>ของเข้าหมวดไหน</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {CATS.map(c => (
            <button key={c.id} type="button" onClick={() => pickCat(c.id)}
              style={{ border: '1px solid ' + (cat === c.id ? 'var(--brand)' : 'var(--border)'), background: cat === c.id ? 'var(--brand)' : 'var(--surface)', color: cat === c.id ? '#FFF8F0' : 'var(--ink-2)', borderRadius: 999, padding: '8px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {c.label}
            </button>
          ))}
        </div>

        {cat && (<>
          <label style={lbl}>รายการที่เข้า</label>
          {lines.map((l, i) => {
            const pv = preview(l)
            return (
              <div key={i} style={{ background: 'var(--cream-2)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 96px 32px', gap: 8, alignItems: 'center' }}>
                  <SuggestInput value={l.name} onChange={v => setName(i, v)} suggestions={options} style={input} />
                  <input type="number" min={0} step="0.01" value={l.qty} onChange={e => upd(i, { qty: e.target.value })} placeholder="จำนวน" style={input} />
                  {cat === 'fabric'
                    ? <ThemedSelect value={l.unit} options={['หลา', 'เมตร']} onChange={v => upd(i, { unit: v })} style={{ ...input, width: '100%' }} />
                    : <SuggestInput value={l.unit} onChange={v => upd(i, { unit: v })} suggestions={units} style={input} />}
                  <button type="button" onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : [emptyLine(cat)])}
                    style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>ลบ</button>
                </div>
                {pv && <div style={{ fontSize: 12, marginTop: 6, color: pv.isNew ? '#B5715A' : 'var(--ink-3)' }}>{pv.text}</div>}
              </div>
            )
          })}
          <button type="button" onClick={() => setLines(ls => [...ls, emptyLine(cat)])}
            style={{ fontSize: 12, padding: '6px 16px', border: '1px solid var(--border-2)', borderRadius: 999, color: 'var(--brand)', background: 'var(--cream-2)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
            + เพิ่มรายการ
          </button>
        </>)}

        {err && <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 12 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={saving} className="sc-mcancel" style={{ padding: '10px 22px', border: 'none', cursor: 'pointer', fontSize: 14 }}>ยกเลิก</button>
          <button onClick={save} disabled={saving || !cat || !valid.length} className="sc-msave"
            style={{ padding: '10px 22px', border: 'none', cursor: saving || !cat || !valid.length ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, opacity: !cat || !valid.length ? 0.5 : 1 }}>
            {saving ? 'กำลังบันทึก…' : `บันทึก ${valid.length || ''} รายการ`}
          </button>
        </div>
      </div>
    </div>
  )
}
