import { createClient } from '@supabase/supabase-js'
import { READ_ONLY } from './readOnly'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// accessToken เอง = ข้าม auth.getSession() (บน Safari ค้างได้ → ปุ่มบันทึกค้าง) — ดูเหตุผลในเว็บจริง
const raw = createClient(supabaseUrl, supabaseAnonKey, { accessToken: async () => supabaseAnonKey })

// ‼️ โคลนสำหรับลองดีไซน์เท่านั้น (donnaweb-design) — ต่อฐานข้อมูลจริงแบบ "อ่านได้ เขียนไม่ได้"
// insert/update/upsert/delete และการอัป/ลบไฟล์ จะไม่ถูกส่งออกไป คืน error ให้หน้าจอแสดงตามปกติ
// เปิดด้วย NEXT_PUBLIC_READ_ONLY=1 เท่านั้น (lib/readOnly.ts) — เว็บจริงไม่มีค่านี้ = เขียนได้ปกติ
const DENIED = 'โหมดลองดีไซน์: บันทึกข้อมูลถูกปิดไว้ (โคลน donnaweb-design ต่อฐานจริงแบบอ่านอย่างเดียว)'

// ตัวปลอมของ query builder — ต่อ .eq().select() ฯลฯ ได้เรื่อยๆ แล้วจบด้วย { data: null, error }
function deadBuilder(): Record<string, unknown> {
  const result = { data: null, error: { message: DENIED, code: 'READ_ONLY' } }
  const target = {
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    catch: () => Promise.resolve(result),
    finally: (fn: () => void) => Promise.resolve(result).finally(fn),
  }
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return (t as Record<string | symbol, unknown>)[prop]
      return () => proxied   // .eq/.select/.single/.maybeSingle/... คืนตัวเดิม
    },
  }) as Record<string, unknown>
}
const proxied = deadBuilder()

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])
const STORAGE_WRITES = new Set(['upload', 'update', 'remove', 'move', 'copy', 'createSignedUploadUrl', 'uploadToSignedUrl'])

export const supabase = READ_ONLY
  ? (new Proxy(raw, {
      get(target, prop, receiver) {
        if (prop === 'from') {
          return (table: string) => {
            const qb = target.from(table)
            return new Proxy(qb, {
              get(q, m, r) {
                if (typeof m === 'string' && WRITE_METHODS.has(m)) {
                  return () => { console.warn(`[read-only] ${m} ${table} ถูกปิดไว้`); return proxied }
                }
                return Reflect.get(q, m, r)
              },
            })
          }
        }
        if (prop === 'storage') {
          const st = target.storage
          return new Proxy(st, {
            get(s, m, r) {
              if (m === 'from') {
                return (bucket: string) => new Proxy(s.from(bucket), {
                  get(b, bm, br) {
                    if (typeof bm === 'string' && STORAGE_WRITES.has(bm)) {
                      return async () => ({ data: null, error: { message: DENIED } })
                    }
                    return Reflect.get(b, bm, br)
                  },
                })
              }
              return Reflect.get(s, m, r)
            },
          })
        }
        return Reflect.get(target, prop, receiver)
      },
    }) as typeof raw)
  : raw
