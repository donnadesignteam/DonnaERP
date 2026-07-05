// สะพานระหว่างหน้าเว็บ donnaweb ↔ extension
// หน้าเว็บส่ง {source:'donna-track', type:'CHECK', reqId, parcels:[{no, carrier}]} มา
// extension ตอบกลับ {source:'donna-track-ext', type:'RESULT', reqId, results:[{no, ok, status, events}]}

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.source !== 'donna-track') return
  if (e.data.type === 'PING') {
    window.postMessage({ source: 'donna-track-ext', type: 'READY' }, window.location.origin)
  } else if (e.data.type === 'CHECK') {
    chrome.runtime.sendMessage({ type: 'CHECK', reqId: e.data.reqId, parcels: e.data.parcels })
  }
})

// ผลลัพธ์จาก background → ส่งต่อให้หน้าเว็บ
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'RESULT') {
    window.postMessage({ source: 'donna-track-ext', type: 'RESULT', reqId: msg.reqId, results: msg.results }, window.location.origin)
  }
})

// ประกาศตัวตอนโหลดหน้า (เผื่อหน้าเว็บโหลดเสร็จก่อน extension)
window.postMessage({ source: 'donna-track-ext', type: 'READY' }, window.location.origin)
