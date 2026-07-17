import { Suspense } from 'react'
import MobileCustomer from '@/components/mobile/MobileCustomer'

// useSearchParams ต้องอยู่ใน Suspense (ข้อบังคับของ Next)
export default function MobileCustomerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>}>
      <MobileCustomer />
    </Suspense>
  )
}
