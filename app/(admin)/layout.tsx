import SidebarLayout from '@/components/SidebarLayout'
import PhoneRedirect from '@/components/PhoneRedirect'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* เปิดหน้าเดสก์ท็อปจากมือถือ → พาไปเวอร์ชันมือถือให้ (components/PhoneRedirect.tsx) */}
      <PhoneRedirect />
      <SidebarLayout>{children}</SidebarLayout>
    </>
  )
}
