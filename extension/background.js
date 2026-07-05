// รับคำสั่ง CHECK จาก bridge → เปิดแท็บเบื้องหลังไปหน้า tracking ของเจ้าขนส่งทีละเลข
// (URL มากับ parcel จากเว็บ donnaweb — ความรู้เรื่อง URL อยู่ที่เว็บที่เดียว แก้ง่าย)
// → รอ scraper ส่งข้อมูล → ปิดแท็บ → ตอบกลับ

const PER_PARCEL_TIMEOUT = 45000        // แท็บเบื้องหลัง (Flash/Kerry)
const ACTIVE_PARCEL_TIMEOUT = 160000    // แท็บจริงที่ต้องรอคนเลื่อนสไลด์ captcha (J&T)
const ALLOWED_HOSTS = [
  'www.flashexpress.com', 'flashexpress.com', 'www.flashexpress.co.th',
  'www.jtexpress.co.th', 'jtexpress.co.th',
  'spx.co.th', 'www.spx.co.th',
  'th.kerryexpress.com', 'www.kerryexpress.com',
]
const pending = new Map() // tabId -> { no, done, timer }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !sender.tab) return
  if (msg.type === 'CHECK') {
    handleCheck(msg, sender.tab.id)
  } else if (msg.type === 'WHOAMI') {
    // scraper ถามว่าแท็บนี้กำลังเช็คเลขอะไรอยู่
    const p = pending.get(sender.tab.id)
    sendResponse({ no: p ? p.no : '' })
  } else if (msg.type === 'DATA') {
    const p = pending.get(sender.tab.id)
    if (p) {
      pending.delete(sender.tab.id)
      clearTimeout(p.timer)
      chrome.tabs.remove(sender.tab.id).catch(() => {})
      p.done(msg)
    }
  }
})

async function handleCheck(msg, bridgeTabId) {
  const results = []
  for (const parcel of msg.parcels || []) {
    results.push(await checkOne(parcel))
  }
  chrome.tabs.sendMessage(bridgeTabId, { type: 'RESULT', reqId: msg.reqId, results }).catch(() => {})
}

function checkOne(parcel) {
  return new Promise((resolve) => {
    const fail = () => resolve({ no: parcel.no, ok: false, status: '', events: [] })
    let host = ''
    try { host = new URL(parcel.url).hostname } catch (_) { return fail() }
    if (!ALLOWED_HOSTS.includes(host)) return fail()
    // active = เปิดแท็บให้เห็นจริง (เจ้าที่มี captcha ให้คนเลื่อนเอง เช่น J&T)
    chrome.tabs.create({ url: parcel.url, active: !!parcel.active }, (tab) => {
      const timer = setTimeout(() => {
        pending.delete(tab.id)
        chrome.tabs.remove(tab.id).catch(() => {})
        fail()
      }, parcel.active ? ACTIVE_PARCEL_TIMEOUT : PER_PARCEL_TIMEOUT)
      pending.set(tab.id, {
        no: parcel.no,
        timer,
        done: (data) => resolve({ no: parcel.no, ok: !!data.ok, status: data.status || '', events: data.events || [] }),
      })
    })
  })
}
