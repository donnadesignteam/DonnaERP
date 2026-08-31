'use client'

// "เครื่องที่เปิดอยู่เป็นมือถือไหม" — ใช้ร่วมกันทุกที่ที่ต้องเลือกระหว่างหน้าเดสก์ท็อปกับหน้ามือถือ
// ‼️ ย้ายมาจาก app/login/page.tsx — ห้ามก๊อปเงื่อนไขไปเขียนซ้ำที่อื่น เดี๋ยว 2 ที่ตัดสินไม่ตรงกัน
export function onPhone(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return true
  // ‼️ จอแคบอย่างเดียวไม่พอ — คอมที่ย่อหน้าต่าง/แบ่งครึ่งจอก็แคบได้ แล้วโดนเด้งไปหน้ามือถือ
  //    ต้องเป็นจอสัมผัสด้วย (pointer: coarse) คอมที่ใช้เมาส์/แทร็กแพดจะไม่เข้าเงื่อนไขนี้
  return window.matchMedia('(max-width: 820px)').matches
    && window.matchMedia('(pointer: coarse)').matches
}

// ปุ่ม "เปิดเวอร์ชันคอม" บนมือถือ — จำไว้ในเครื่องนั้น จะได้ไม่โดนเด้งกลับหน้ามือถืออีก
const DESKTOP_KEY = 'donna_force_desktop'

export function wantsDesktop(): boolean {
  if (typeof window === 'undefined') return false
  // ?desktop=1 = เพิ่งกดปุ่มมา → จำไว้เลย
  if (new URLSearchParams(window.location.search).get('desktop') === '1') {
    try { localStorage.setItem(DESKTOP_KEY, '1') } catch {}
    return true
  }
  try { return localStorage.getItem(DESKTOP_KEY) === '1' } catch { return false }
}

export function clearDesktopPreference() {
  try { localStorage.removeItem(DESKTOP_KEY) } catch {}
}

// หน้าปลายทางของเครื่องนี้ เมื่อไม่ได้ตั้งใจจะไปหน้าไหนเป็นพิเศษ
// staff = ล็อกอินด้วยรหัสพนักงาน (ไม่ใช่รหัสรวมของร้าน)
export function landingPath(staff: boolean): string {
  if (!onPhone() || wantsDesktop()) return '/dashboard'   // คอม = หน้าเดสก์ท็อปเสมอ
  return staff ? '/m/me' : '/hub'
}
