// รันใน ISOLATED world ของหน้า tracking ทุกเจ้า (Flash/J&T/SPX/Kerry — ตัวเดียวใช้ร่วม)
// รอ JSON ที่ hook ดักได้ → เดาหา timeline → ส่งให้ background
// ถ้าไม่ได้ JSON เลย มี fallback อ่านจากตัวหนังสือบนหน้า (best-effort)

let pno = ''          // เลขพัสดุที่แท็บนี้กำลังเช็ค — ถาม background (แท็บนี้ background เป็นคนเปิด)
const buffered = []   // JSON ที่ดักได้ก่อนรู้ pno — เก็บไว้ประมวลทีหลัง
let sent = false

try {
  chrome.runtime.sendMessage({ type: 'WHOAMI' }, (res) => {
    pno = ((res && res.no) || '').trim().toUpperCase()
    buffered.splice(0).forEach(handleCaptured)
  })
} catch (_) {}

function send(ok, status, events) {
  if (sent) return
  sent = true
  try { chrome.runtime.sendMessage({ type: 'DATA', ok, status, events }) } catch (_) {}
}

function fmtTime(v) {
  if (typeof v === 'number') {
    const d = new Date(v < 1e12 ? v * 1000 : v)
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
      d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }
  return String(v)
}

// เดินทั้ง object หา array ของ event ที่มี field เวลา + ข้อความ (ไม่ผูกกับชื่อ endpoint/field ตายตัว)
function extractEvents(obj) {
  let best = null
  const visit = (node, depth) => {
    if (!node || depth > 8) return
    if (Array.isArray(node)) {
      if (node.length && node[0] && typeof node[0] === 'object' && !Array.isArray(node[0])) {
        const keys = Object.keys(node[0])
        const timeKey = keys.find((k) => /routed_?at|scan_?time|operate_?time|track_?time|created_?at|time_?stamp|^time$|^date$|_time$|_date$|_at$/i.test(k))
        const descKey = keys.find((k) => /message|_desc$|^desc|content|route_?action|state_?text|remark|detail|status_?name|tracking_?name/i.test(k))
        if (timeKey && descKey && (!best || node.length > best.arr.length)) best = { arr: node, timeKey, descKey }
      }
      node.forEach((x) => visit(x, depth + 1))
    } else if (typeof node === 'object') {
      Object.values(node).forEach((x) => visit(x, depth + 1))
    }
  }
  visit(obj, 0)
  if (!best) return null
  const events = best.arr
    .map((e) => ({ raw: e[best.timeKey], time: fmtTime(e[best.timeKey]), desc: String(e[best.descKey] ?? '').trim() }))
    .filter((e) => e.desc)
  if (events.length === 0) return null
  // เรียงใหม่ → เก่า ถ้าเวลาเป็นตัวเลขเทียบได้
  if (events.length > 1 && typeof events[0].raw === 'number' && events[0].raw < events[events.length - 1].raw) events.reverse()
  return events.map(({ time, desc }) => ({ time, desc }))
}

// หาข้อความสถานะรวม เช่น stateText จาก JSON (ถ้ามี)
function extractStateText(obj) {
  let found = ''
  const visit = (node, depth) => {
    if (!node || depth > 8 || found) return
    if (Array.isArray(node)) { node.forEach((x) => visit(x, depth + 1)); return }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string' && v.trim() && /state_?text|latest_?track|current_?status/i.test(k)) { found = v.trim(); return }
      }
      Object.values(node).forEach((x) => visit(x, depth + 1))
    }
  }
  visit(obj, 0)
  return found
}

function handleCaptured(data) {
  if (sent) return
  let json
  try { json = JSON.parse(data.body) } catch (_) { return }
  // เอาเฉพาะคำตอบที่เกี่ยวกับพัสดุเลขนี้ (กัน JSON อื่นๆ ของหน้า เช่น config/แปลภาษา)
  if (pno && !data.body.toUpperCase().includes(pno) && !/route|track|query|bill/i.test(data.url)) return
  const events = extractEvents(json)
  if (events) send(true, extractStateText(json) || events[0].desc, events)
}

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.source !== 'donna-track-hook' || sent) return
  if (!pno && buffered.length < 50) { buffered.push(e.data); return }
  handleCaptured(e.data)
})

// Fallback: อ่านจากตัวหนังสือบนหน้า — จับบรรทัดที่มีวันที่+เวลา
// คำอธิบายอาจอยู่: ท้ายบรรทัดเดียวกัน / บรรทัดถัดไป / บรรทัดก่อนหน้า (layout แต่ละเจ้าไม่เหมือนกัน)
const DT_RE = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})(.{0,10}\d{1,2}:\d{2}(:\d{2})?)?|\d{1,2}:\d{2}(:\d{2})?/
function domFallback() {
  if (sent) return false
  const lines = (document.body?.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean)
  const events = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(DT_RE)
    if (!m || !/\d{1,2}:\d{2}/.test(lines[i])) continue
    let desc = lines[i].replace(m[0], '').replace(/^[\s:·|,-]+|[\s:·|,-]+$/g, '')
    if (desc.length < 4) desc = lines[i + 1] && !DT_RE.test(lines[i + 1]) ? lines[i + 1] : ''
    if (desc.length < 4) desc = lines[i - 1] && !DT_RE.test(lines[i - 1]) && !events.some((e) => e.desc === lines[i - 1]) ? lines[i - 1] : ''
    if (desc && desc.length >= 4) events.push({ time: m[0], desc })
  }
  if (events.length) { send(true, events[0].desc, events); return true }
  return false
}

// บางเจ้า (J&T) เปิดหน้า track พร้อมเลขใน URL แล้วไม่ยิงค้นหาให้เอง — กรอกเลขลงช่อง + กดปุ่มค้นหาให้
// (ตั้งค่า value แล้ว dispatch 'input' ให้ framework (Vue/React) รับรู้) — เหลือแค่คนเลื่อนสไลด์ captcha
let filled = false
function autoSearch() {
  if (sent || filled || !pno) return
  if (!/jtexpress/i.test(location.hostname)) return
  // ปิดแบนเนอร์คุกกี้ก่อน (บังปุ่มค้นหา)
  const cookieBtn = [...document.querySelectorAll('button')].find((b) => b.offsetParent && /ยอมรับ|accept/i.test(b.textContent || ''))
  if (cookieBtn) cookieBtn.click()
  // ช่องกรอกจริงของ J&T = input.input_search — เผื่อเปลี่ยน class ใช้ช่อง text แรกที่มองเห็น
  const input = document.querySelector('input.input_search') ||
    [...document.querySelectorAll('textarea, input[type="text"], input:not([type])')].filter((el) => el.offsetParent)[0]
  if (!input) return
  filled = true
  const setter = Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')
  if (setter && setter.set) setter.set.call(input, pno)
  else input.value = pno
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  setTimeout(() => {
    // ปุ่มค้นหาของ J&T เป็นไอคอน <i class="iconfont icon-sousuo"> ไม่ใช่ <button>
    const btn = document.querySelector('i.icon-sousuo, [class*="sousuo"]') ||
      [...document.querySelectorAll('button, .q-btn, [role="button"], a, i')]
        .filter((el) => el.offsetParent && /ค้นหา|ติดตาม|track|search|ตรวจสอบ/i.test(((el.textContent || '') + ' ' + String(el.className || '')).trim()))[0]
    if (btn) btn.click()
    else { const form = input.closest('form'); if (form) { if (form.requestSubmit) form.requestSubmit(); else form.submit() } }
  }, 800)
}

// ให้เวลา SPA โหลด + ผ่าน anti-bot/captcha (บางเจ้าต้องรอคนเลื่อนสไลด์) — ลองกรอก/อ่าน DOM เป็นระยะ
// ไม่ต้องรีบส่ง fail เอง: background เป็นคนคุม timeout แล้วปิดแท็บ/ตอบไม่สำเร็จให้
setTimeout(autoSearch, 2500)
setTimeout(autoSearch, 5000)
setTimeout(autoSearch, 9000)
const iv = setInterval(() => { if (sent) { clearInterval(iv); return } domFallback() }, 5000)
setTimeout(() => { clearInterval(iv); if (!domFallback()) send(false, '', []) }, 150000)
