'use client'

import { useRef, useState, type ReactNode } from 'react'
import Pager from '@/components/Pager'

// รายการสินค้าในหน้าลูกค้า /t/ — แบ่งหน้าละ PER รายการ (ทั้งคอมและมือถือ) แถบเลขหน้าแบบเดียวกับรายการสินค้าใน OrderDetailModal
const PER = 6

export default function ItemsPager({ items }: { items: ReactNode[] }) {
  const [page, setPage] = useState(1)
  const top = useRef<HTMLDivElement>(null)
  const pages = Math.ceil(items.length / PER)
  const from = (page - 1) * PER

  return (
    <>
      <div ref={top} className="tk-items">
        {items.map((node, i) => (
          <div key={i} className={pages > 1 && (i < from || i >= from + PER) ? 'tk-off' : undefined}>{node}</div>
        ))}
      </div>
      {pages > 1 && (
        <div className="tk-pager">
          <Pager page={page} pageCount={pages}
            onPage={n => { setPage(n); requestAnimationFrame(() => { const el = top.current; if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }) }}
            label={`รายการที่ ${from + 1} - ${Math.min(from + PER, items.length)} จาก ${items.length}`} />
        </div>
      )}
    </>
  )
}
