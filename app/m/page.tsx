import { redirect } from 'next/navigation'

// เข้า /m เฉยๆ → ไปหน้าออเดอร์ (หน้าหลักของ ERP บนมือถือ)
export default function MobileHome() {
  redirect('/m/orders')
}
