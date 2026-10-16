// Supabase ตัดผลลัพธ์ที่ 1,000 แถวต่อ query — ดึงเป็นหน้าละ 1,000 ด้วย .range() จนหมด
// build ต้องคืน query builder "ตัวใหม่" ทุกครั้ง (builder ใช้ซ้ำข้ามหน้าไม่ได้)
// และต้องมี .order() ที่ลำดับนิ่ง (แนะนำปิดท้ายด้วยคอลัมน์ unique เช่น id) ไม่งั้นหน้าถัดไปอาจได้แถวซ้ำ/หลุด
// ‼️ 16ต.ค.69 เดิมขอทีละหน้าต่อคิว (ออเดอร์ 5 หน้า × ~0.5 วิ = เปิดหน้าครั้งแรก ~3 วิ) — หน้าแรกเต็มแล้ว
//    ขอหน้าถัดไปพร้อมกันทีละ PARALLEL หน้า · หน้าที่เกินมาได้แถวว่าง ทิ้งไป

type PageResult = { data: unknown[] | null; error: { message: string } | null }
type RangeableQuery = { range: (from: number, to: number) => PromiseLike<PageResult> }

const PAGE = 1000
const PARALLEL = 4

export async function fetchAllRows<T>(
  build: () => RangeableQuery,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = []
  const first = await build().range(0, PAGE - 1)
  if (first.error) return { data: rows, error: first.error }
  rows.push(...((first.data ?? []) as T[]))
  if (!first.data || first.data.length < PAGE) return { data: rows, error: null }
  for (let page = 1; ; page += PARALLEL) {
    const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => {
      const from = (page + i) * PAGE
      return build().range(from, from + PAGE - 1)
    }))
    for (const { data, error } of batch) {
      if (error) return { data: rows, error }
      rows.push(...((data ?? []) as T[]))
      if (!data || data.length < PAGE) return { data: rows, error: null }
    }
  }
}
