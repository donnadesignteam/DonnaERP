'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isOwnerLogin } from '@/lib/adminActor'

// แท็บของหมวดพนักงาน (user สั่ง 2 ส.ค. 69 · เพิ่มงานเคลม 17 ส.ค. 69)
// ownerOnly = เห็นเฉพาะคนที่ล็อกอินด้วยรหัสรวมของร้าน (พนักงานที่ล็อกอินด้วยรหัสตัวเองไม่เห็น)
const TABS = [
  { href: '/staff', label: 'ขาด ลา มาสาย', exact: true },
  { href: '/staff/admin', label: 'งานแอดมิน' },
  { href: '/staff/cutting', label: 'ยอดตัดผ้า' },
  { href: '/staff/claims', label: 'งานเคลม', ownerOnly: true },
]

export default function StaffTabs() {
  const pathname = usePathname()
  // เช็คหลัง mount เท่านั้น (คุกกี้อ่านได้ฝั่งเบราว์เซอร์) ไม่งั้น HTML ฝั่งเซิร์ฟเวอร์กับฝั่งเบราว์เซอร์ไม่ตรง
  const [owner, setOwner] = useState(false)
  useEffect(() => { setOwner(isOwnerLogin()) }, [])
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
      {TABS.filter(t => !t.ownerOnly || owner).map(t => {
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
