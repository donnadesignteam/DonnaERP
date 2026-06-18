import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const statusColor: Record<string, string> = {
  'รอคิว': '#ff9f0a',
  'รอดำเนินการ': '#ff9f0a',
  'ตัดผ้าแล้ว': '#30d158',
  'เย็บแล้ว': 'var(--blue)',
  'รีดแล้ว': '#bf5af2',
  'แพ็คแล้ว': 'var(--red)',
  'สำเร็จ': '#34c759',
  'ยกเลิก': '#8e8e93',
}

async function getOrder(orderNumber: string) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .single()
  return data
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500 }}>{value ?? '-'}</div>
    </div>
  )
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)

  if (!order) notFound()

  const isOverdue = order.deadline && new Date(order.deadline) < new Date() && order.status !== 'สำเร็จ'

  const knownFields = ['id', 'order_number', 'customer_name', 'customer_phone', 'status', 'deadline', 'created_at', 'updated_at', 'notes', 'total_price', 'deposit', 'address', 'items']
  const extraFields = Object.entries(order).filter(([k]) => !knownFields.includes(k))

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/orders" style={{ color: 'var(--blue)', fontSize: 13, textDecoration: 'none' }}>
          ← กลับ
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {order.order_number}
          </h1>
          <span style={{
            background: (statusColor[order.status] ?? 'var(--ink-3)') + '22',
            color: statusColor[order.status] ?? 'var(--ink-3)',
            padding: '4px 12px', borderRadius: 980, fontSize: 13, fontWeight: 600,
          }}>{order.status}</span>
        </div>
        {isOverdue && (
          <div style={{
            background: '#ff375f22', color: 'var(--red)',
            padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          }}>เกิน Deadline</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: 'var(--ink)' }}>ข้อมูลลูกค้า</h2>
          <Field label="ชื่อลูกค้า" value={order.customer_name} />
          <Field label="เบอร์โทร" value={order.customer_phone} />
          <Field label="ที่อยู่" value={order.address} />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: 'var(--ink)' }}>ข้อมูลออเดอร์</h2>
          <Field label="กำหนดส่ง" value={order.deadline ? new Date(order.deadline).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined} />
          <Field label="วันที่สั่ง" value={order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined} />
          <Field label="ราคารวม" value={order.total_price != null ? `฿${Number(order.total_price).toLocaleString()}` : undefined} />
          <Field label="มัดจำ" value={order.deposit != null ? `฿${Number(order.deposit).toLocaleString()}` : undefined} />
        </div>

        {order.notes && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '28px', gridColumn: '1 / -1' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--ink)' }}>หมายเหตุ</h2>
            <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{order.notes}</p>
          </div>
        )}

        {order.items && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '28px', gridColumn: '1 / -1' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--ink)' }}>รายการสินค้า</h2>
            <pre style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {typeof order.items === 'string' ? order.items : JSON.stringify(order.items, null, 2)}
            </pre>
          </div>
        )}

        {extraFields.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '28px', gridColumn: '1 / -1' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: 'var(--ink)' }}>ข้อมูลเพิ่มเติม</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {extraFields.map(([k, v]) => (
                <Field key={k} label={k} value={v != null ? String(v) : undefined} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
