import SidebarLayout from '@/components/SidebarLayout'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>
}
