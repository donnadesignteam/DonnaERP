'use client'

// ลายน้ำบนรูปที่อัพจากเว็บ (22ต.ค.69 user สั่ง) — แถบดำโปร่งมุมล่างซ้าย 2 บรรทัด
//   ติว · แพ็ค
//   22/10/69 14:35
// บรรทัดแรก = ชื่อเล่นคนที่ล็อกอิน (คุกกี้ donna_staff) · แผนก
//   แผนก: หน้าสแกน = แผนกที่เลือกสแกน (ตัด/เย็บ/รีด/แพ็ค…) · ที่อื่น = ตำแหน่งในตาราง staff (เช่น แอดมิน)
//   ล็อกอินรหัสรวมของร้าน (ไม่รู้ว่าใคร) → มีแค่บรรทัดวันเวลา
// เวลา = ตอนเลือกรูปอัพ (ไม่ใช่เวลาถ่าย) · ใส่ตอนย่อรูปใน compressImage → ติดในไฟล์ถาวร
import { readStaffSession } from './staffSession'
import { supabase } from './supabase'
import { EMPLOYEES } from './staff'

export type StampOpts = { dept?: string }

let posCache: { code: string; pos: string } | null = null

async function positionOf(code: string): Promise<string> {
  if (posCache?.code === code) return posCache.pos
  let pos = ''
  try {
    const { data } = await supabase.from('staff').select('position').eq('code', code).maybeSingle()
    pos = String(data?.position || '').trim()
  } catch {}
  if (!pos) pos = EMPLOYEES.find(e => e.code === code)?.role || ''
  posCache = { code, pos }
  return pos
}

// วันที่แบบไทย 22/10/69 14:35
function stampTime(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear() + 543).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export async function stampLines(opts?: StampOpts): Promise<string[]> {
  const s = readStaffSession()
  const lines: string[] = []
  if (s) {
    const name = s.nickname || s.code
    const dept = opts?.dept || await positionOf(s.code)
    lines.push(dept ? `${name} · ${dept}` : name)
  }
  lines.push(stampTime())
  return lines
}

// วาดแถบข้อความลงแคนวาส (ขนาดตัวอักษรตามด้านสั้นของรูป ให้อ่านออกทั้งรูปแนวตั้ง/แนวนอน)
export function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[]) {
  if (!lines.length) return
  const size = Math.max(12, Math.round(Math.min(w, h) * 0.028))   // 22ต.ค. user ขอเล็กลง (เดิม 0.04)
  const pad = Math.round(size * 0.55), gap = Math.round(size * 0.3)
  let family = 'sans-serif'
  try { family = getComputedStyle(document.body).fontFamily || family } catch {}
  ctx.font = `600 ${size}px ${family}`
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width))
  const bw = Math.ceil(tw + pad * 2), bh = lines.length * size + (lines.length - 1) * gap + pad * 2
  const m = Math.round(size * 0.6)
  const x = m, y = h - m - bh
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(x, y, bw, bh)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + i * (size + gap)))
}
