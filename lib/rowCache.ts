// จำแถวของตารางใหญ่ไว้ในเครื่อง (IndexedDB) แล้วขอจาก Supabase เฉพาะ "แถวที่เปลี่ยนตั้งแต่ครั้งก่อน"
// ‼️ ทำเพราะ Egress ของ Supabase (แพลนฟรี 5 GB/เดือน) เกินโควตา — หมวดออเดอร์เปิดทีไรดึงออเดอร์ทั้งตาราง ~1.4 MB
//    วันละ ~400 ครั้ง · แบบนี้เครื่องที่เคยเปิดแล้วดึงแค่ไม่กี่ KB
//
// อาศัยตาราง row_changes (sql/add_row_changes.sql) ที่ trigger จดว่าแถวไหนเปลี่ยน/ถูกลบเมื่อไหร่ (เวลาเครื่องเซิร์ฟเวอร์)
//   ครั้งแรก / แคชเก่าเกิน 3 วัน / เปลี่ยนชุดคอลัมน์ → ดึงเต็มแบบเดิม
//   ครั้งถัดไป → row_changes ที่ใหม่กว่าเวลาครั้งก่อน (ย้อนเผื่อ 2 นาที) → ดึงเฉพาะแถวนั้นมาทับ + ลบแถวที่ถูกลบ
// ยังไม่ได้รัน SQL (อ่าน row_changes ไม่ได้) → ดึงเต็มทุกครั้งเหมือนเดิม ไม่พัง
import { supabase } from './supabase'
import { fetchAllRows } from './fetchAll'

const DB_NAME = 'donna-row-cache'
const STORE = 'kv'
const FORMAT = 1                       // เปลี่ยนเลขนี้ = ทุกเครื่องทิ้งแคชแล้วดึงเต็มใหม่
const MAX_AGE_MS = 3 * 24 * 3600 * 1000 // ดึงเต็มอย่างน้อยทุก 3 วัน กันแคชเพี้ยนสะสม
const OVERLAP_MS = 2 * 60 * 1000       // ย้อนเผื่อแถวที่ commit ช้ากว่าเวลาที่ trigger จด
const CHUNK = 150                      // จำนวน id ต่อคำขอ (กัน URL ยาวเกิน)
const MAX_DELTA = 1500                 // เปลี่ยนเยอะกว่านี้ ดึงเต็มคุ้มกว่า

type Saved<T> = { format: number; table: string; select: string; syncedAt: string; savedAt: number; rows: T[] }
type PageResult = { data: unknown[] | null; error: { message: string } | null }
type RangeableQuery = { range: (from: number, to: number) => PromiseLike<PageResult> }
export type SyncResult<T> = { data: T[]; error: { message: string } | null; mode: 'full' | 'delta' }

// ── IndexedDB แบบบางที่สุด (key → value) — เปิดไม่ได้ (โหมดส่วนตัว/บราวเซอร์เก่า) ก็แค่ไม่มีแคช ──
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  if (!db) return undefined
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => resolve(undefined)
    } catch { resolve(undefined) }
  })
}
async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch { resolve() }
  })
}

// ออกจากระบบ → ล้างข้อมูลที่จำไว้ในเครื่อง (มีชื่อ/ที่อยู่/เบอร์ลูกค้า)
export function clearRowCache() {
  try { if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(DB_NAME) } catch {}
}

// เวลาเปลี่ยนล่าสุดของตารางนี้ (เวลาเซิร์ฟเวอร์) — null = ยังไม่มีการเปลี่ยนเลย · undefined = อ่าน row_changes ไม่ได้ (ยังไม่รัน SQL)
async function latestChange(table: string): Promise<string | null | undefined> {
  const { data, error } = await supabase.from('row_changes').select('changed_at')
    .eq('table_name', table).order('changed_at', { ascending: false }).limit(1)
  if (error) return undefined
  return (data?.[0] as { changed_at?: string } | undefined)?.changed_at ?? null
}

export async function syncRows<T extends { id: string }>(opts: {
  key: string                       // ชื่อชุดข้อมูลในเครื่อง (แต่ละหน้าที่ดึงคนละคอลัมน์ใช้คนละชื่อ)
  table: string
  select: string
  full: () => RangeableQuery        // คิวรีดึงเต็มแบบเดิม (มี .order() ปิดท้ายด้วย id)
  sort: (a: T, b: T) => number      // เรียงให้เหมือนคิวรีดึงเต็ม (แถวที่ดึงเพิ่มจะได้อยู่ที่เดิม)
}): Promise<SyncResult<T>> {
  const cacheKey = `${opts.table}:${opts.key}`
  const saved = await idbGet<Saved<T>>(cacheKey)
  const usable = saved && saved.format === FORMAT && saved.table === opts.table && saved.select === opts.select
    && Date.now() - saved.savedAt < MAX_AGE_MS && Array.isArray(saved.rows)

  const fullLoad = async (): Promise<SyncResult<T>> => {
    const since = await latestChange(opts.table)   // จดเวลา "ก่อน" ดึง — อะไรเปลี่ยนระหว่างดึงจะติดมารอบหน้า
    const { data, error } = await fetchAllRows<T>(opts.full)
    if (!error && since !== undefined) {
      void idbSet(cacheKey, { format: FORMAT, table: opts.table, select: opts.select,
        syncedAt: since ?? '1970-01-01T00:00:00Z', savedAt: Date.now(), rows: data } satisfies Saved<T>)
    }
    return { data, error, mode: 'full' }
  }

  if (!usable) return fullLoad()

  const since = new Date(Date.parse(saved.syncedAt) - OVERLAP_MS).toISOString()
  const ch = await fetchAllRows<{ row_id: string; deleted: boolean; changed_at: string }>(() =>
    supabase.from('row_changes').select('row_id, deleted, changed_at')
      .eq('table_name', opts.table).gt('changed_at', since)
      .order('changed_at', { ascending: true }).order('row_id', { ascending: true }))
  if (ch.error || ch.data.length > MAX_DELTA) return fullLoad()

  const byId = new Map(saved.rows.map(r => [r.id, r]))
  const want = [...new Set(ch.data.filter(c => !c.deleted).map(c => c.row_id))]
  for (const c of ch.data) if (c.deleted) byId.delete(c.row_id)
  for (let i = 0; i < want.length; i += CHUNK) {
    const ids = want.slice(i, i + CHUNK)
    const { data, error } = await supabase.from(opts.table).select(opts.select).in('id', ids)
    if (error) return fullLoad()
    const got = new Set<string>()
    for (const r of (data ?? []) as unknown as T[]) { byId.set(r.id, r); got.add(r.id) }
    for (const id of ids) if (!got.has(id)) byId.delete(id)   // หาไม่เจอ = ถูกลบไปแล้ว
  }
  const rows = [...byId.values()].sort(opts.sort)
  const newest = ch.data.length ? ch.data[ch.data.length - 1].changed_at : saved.syncedAt
  // ไม่ต่ออายุ savedAt — ครบ 3 วันนับจากดึงเต็มครั้งล่าสุดจะดึงเต็มใหม่ (กันพลาดสะสม)
  void idbSet(cacheKey, { ...saved, syncedAt: newest > saved.syncedAt ? newest : saved.syncedAt, rows } satisfies Saved<T>)
  return { data: rows, error: null, mode: 'delta' }
}

// ตัวเรียงที่ใช้บ่อย — ต้องให้ผลเหมือน .order() ของ Postgres (uuid เรียงตามตัวอักษร hex ได้ผลเท่ากัน)
const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
// entry_date ใหม่→เก่า (ไม่มีวันที่ไว้ท้าย) แล้ว id น้อย→มาก
export const byEntryDateDesc = <T extends { id: string; entry_date?: string | null }>(a: T, b: T) => {
  const da = a.entry_date ?? null, db = b.entry_date ?? null
  if (da !== db) { if (da === null) return 1; if (db === null) return -1; return cmpStr(db, da) }
  return cmpStr(a.id, b.id)
}
// created_at เก่า→ใหม่ แล้ว id น้อย→มาก
export const byCreatedAsc = <T extends { id: string; created_at?: string | null }>(a: T, b: T) =>
  cmpStr(a.created_at ?? '', b.created_at ?? '') || cmpStr(a.id, b.id)
// id มาก→น้อย
export const byIdDesc = <T extends { id: string }>(a: T, b: T) => cmpStr(b.id, a.id)
