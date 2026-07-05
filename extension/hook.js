// รันใน MAIN world ของหน้า tracking ทุกเจ้า (Flash/J&T/SPX/Kerry) ตั้งแต่ document_start
// ดัก fetch/XHR ทุกคำตอบที่เป็น JSON แล้วโยนให้ scraper (ISOLATED world) ทาง postMessage
// — โครงสร้าง API ภายในของแต่ละเจ้าเปลี่ยนได้เรื่อยๆ เลยดักแบบกว้างแล้วไปเดาโครงสร้างทีหลัง
(() => {
  const post = (url, text) => {
    try {
      if (typeof text === 'string' && text.length < 1000000) {
        window.postMessage({ source: 'donna-track-hook', url: String(url), body: text }, '*')
      }
    } catch (_) {}
  }

  const origFetch = window.fetch
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || ''
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json') || /track|route|order|parcel|query|bill/i.test(url)) {
        res.clone().text().then((t) => post(url, t)).catch(() => {})
      }
    } catch (_) {}
    return res
  }

  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__dtUrl = url
    return origOpen.call(this, method, url, ...rest)
  }
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      try {
        const ct = this.getResponseHeader('content-type') || ''
        if ((ct.includes('json') || /track|route|order|parcel|query|bill/i.test(this.__dtUrl || '')) && typeof this.responseText === 'string') {
          post(this.__dtUrl || '', this.responseText)
        }
      } catch (_) {}
    })
    return origSend.apply(this, args)
  }
})()
