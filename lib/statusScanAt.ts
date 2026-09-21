// วันเวลาที่สแกนเข้าสถานะปัจจุบัน (โชว์ใต้ป้ายสถานะ) — สูตรเดียวกับ statusScanAt ในหมวดออเดอร์ (components/OrderWorkspace.tsx)
// หาครั้งแรกสุดที่เข้าสถานะนี้ (ไล่ status_history จากท้ายย้อนขึ้นไปจนสถานะเปลี่ยน)
export function statusScanAt(status: string | null | undefined, history: unknown): string {
  const cur = status || ''
  const h = Array.isArray(history) ? (history as { status?: string; at?: string }[]) : []
  let at: string | null = null
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i]?.status !== cur) break
    if (h[i]?.at) at = h[i].at!
  }
  if (!at) return ''
  const d = new Date(at)
  if (isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
}
