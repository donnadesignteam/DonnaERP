import { NextResponse } from 'next/server'
import { fetchStaff } from '@/lib/staffSheet'

export async function GET() {
  try {
    const staff = await fetchStaff()
    return NextResponse.json({ staff, count: staff.length })
  } catch (e) {
    return NextResponse.json({ error: 'โหลดชีทไม่สำเร็จ', detail: String(e) }, { status: 502 })
  }
}
