// Supabase ตัดผลลัพธ์ที่ 1,000 แถวต่อ query — ดึงเป็นหน้าละ 1,000 ด้วย .range() จนหมด
// build ต้องคืน query builder "ตัวใหม่" ทุกครั้ง (builder ใช้ซ้ำข้ามหน้าไม่ได้)
// และต้องมี .order() ที่ลำดับนิ่ง (แนะนำปิดท้ายด้วยคอลัมน์ unique เช่น id) ไม่งั้นหน้าถัดไปอาจได้แถวซ้ำ/หลุด

type PageResult = { data: unknown[] | null; error: { message: string } | null }
type RangeableQuery = { range: (from: number, to: number) => PromiseLike<PageResult> }

export async function fetchAllRows<T>(
  build: () => RangeableQuery,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) return { data: rows, error }
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return { data: rows, error: null }
}
