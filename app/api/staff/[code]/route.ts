import { NextResponse } from 'next/server'
import { fetchStaff, fetchLeavesByCode } from '@/lib/staffSheet'
import { supabase } from '@/lib/supabase'

const PLATFORMS = ['Shopee', 'Tiktok', 'Lazada']
const categorize = (platform: string | null, isInstall: boolean) =>
  isInstall ? 'ติดตั้ง' : PLATFORMS.includes(platform || '') ? 'แพลตฟอร์ม' : 'งานนอก'

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const [staff, ld] = await Promise.all([fetchStaff(), fetchLeavesByCode(code)])
    const employee = staff.find((s) => s.code.toUpperCase() === code.toUpperCase()) || null
    if (!employee) return NextResponse.json({ error: 'ไม่พบพนักงาน' }, { status: 404 })

    // ===== งานที่ทำ =====
    // ช่าง: ออเดอร์ที่สแกน (production_scans by tech_code)
    const { data: scRaw } = await supabase
      .from('production_scans').select('order_number, stage, status, scanned_at').eq('tech_code', code)
    const scValid = (scRaw || []).filter((s) => s.order_number && !String(s.order_number).startsWith('http'))
    const scNums = [...new Set(scValid.map((s) => s.order_number))]
    const { data: scOe } = scNums.length
      ? await supabase.from('order_entries').select('order_number, customer_name, order_status').in('order_number', scNums)
      : { data: [] as any[] }
    const oeMap = new Map((scOe || []).map((o) => [o.order_number, o]))
    const scans = scNums.map((num) => {
      const items = scValid.filter((s) => s.order_number === num)
      const o = oeMap.get(num)
      return {
        order_number: num,
        customer_name: o?.customer_name || null,
        status: o?.order_status || items[items.length - 1]?.status || null,
        stages: [...new Set(items.map((s) => s.stage).filter(Boolean))],
        last: items.map((s) => s.scanned_at).sort().slice(-1)[0] || null,
      }
    }).sort((a, b) => String(b.last).localeCompare(String(a.last)))

    // แอดมิน: ออเดอร์ที่รับผิดชอบ (order_entries by admin_name = ชื่อเล่น)
    const nickname = employee.nickname
    const { data: aoRaw } = nickname
      ? await supabase.from('order_entries')
          .select('order_number, customer_name, platform, is_installation, order_status, deadline, updated_at')
          .eq('admin_name', nickname).order('updated_at', { ascending: false })
      : { data: [] as any[] }
    const orders = (aoRaw || [])
      .filter((o) => !String(o.platform || '').startsWith('เคลม:'))
      .map((o) => ({
        order_number: o.order_number, customer_name: o.customer_name,
        platform: o.platform, status: o.order_status,
        category: categorize(o.platform, !!o.is_installation),
      }))

    // เคลม: ผูกผ่านออเดอร์เดิมของแอดมิน (claims.original_order_number) — มีผลเมื่อกรอกเลขออเดอร์เดิม
    const orderNums = orders.map((o) => o.order_number).filter(Boolean)
    const { data: clRaw } = orderNums.length
      ? await supabase.from('claims')
          .select('original_order_number, customer_username, claim_type, status').in('original_order_number', orderNums)
      : { data: [] as any[] }
    const claims = (clRaw || []).map((c) => ({
      order_number: c.original_order_number, customer: c.customer_username, type: c.claim_type, status: c.status,
    }))

    return NextResponse.json({
      employee, startDate: ld.startDate, leaves: ld.leaves,
      work: { scans, orders, claims },
    })
  } catch (e) {
    return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ', detail: String(e) }, { status: 502 })
  }
}
