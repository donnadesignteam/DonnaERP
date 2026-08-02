'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// แท็บของหมวดพนักงาน — 3 หน้า (user สั่ง 2 ส.ค. 69)
const TABS = [
  { href: '/staff', label: 'ขาด ลา มาสาย', exact: true },
  { href: '/staff/admin', label: 'งานแอดมิน' },
  { href: '/staff/cutting', label: 'ยอดตัดผ้า' },
]

export default function StaffTabs() {
  const pathname = usePathname()
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
      {TABS.map(t => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
            border: '1px solid ' + (active ? 'transparent' : 'var(--border-2)'),
            background: active ? 'var(--ink)' : 'var(--surface)',
            color: active ? 'var(--surface)' : 'var(--ink-2)',
          }}>{t.label}</Link>
        )
      })}
    </div>
  )
}
