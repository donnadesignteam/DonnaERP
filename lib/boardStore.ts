// กระดานสนทนา — ที่เก็บข้อมูล
// ‼️ โคลน donnaweb-design ต่อฐานจริงแบบอ่านอย่างเดียว + ยังไม่มีตาราง → เก็บในเบราว์เซอร์ (localStorage) ไปก่อน
// ย้ายไปเว็บจริง: รัน sql/create_board.sql แล้วเปลี่ยนฟังก์ชันในไฟล์นี้ให้ยิง Supabase (หน้าจอไม่ต้องแก้ — ชื่อฟังก์ชัน/ชนิดข้อมูลเหมือนเดิม)
import { readStaffSession } from './staffSession'

export const BOARD_CATEGORIES = ['ประกาศ', 'งานทั่วไป', 'งานออเดอร์', 'งานติดตั้ง', 'ปัญหา/แก้ไข', 'ลูกค้า', 'ไอเดีย'] as const
// หมวดพิมพ์เองได้ — BOARD_CATEGORIES เป็นแค่หมวดตั้งต้นที่แนะนำ
export type BoardCategory = string

// สถานะใช้กับหมวดปัญหา/แก้ไข — จะได้รู้ว่าเรื่องไหนยังค้าง
export const BOARD_STATUSES = ['รอตอบ', 'กำลังทำ', 'ปิดแล้ว'] as const
export type BoardStatus = typeof BOARD_STATUSES[number]

export type BoardComment = { id: string; author: string; body: string; created_at: string; likes: string[] }
export type BoardTopic = {
  id: string
  category: BoardCategory
  title: string
  body: string
  author: string
  order_number: string | null
  order_id?: string | null      // ออเดอร์ที่ผูก (order_entries.id) — ใช้เปิดรายละเอียด · หัวข้อเก่าที่มีแค่ order_number ยังเปิดได้
  order_label?: string | null   // ข้อความโชว์บนปุ่ม เช่น "DR0042 · คุณเอ · #2609…"
  status: BoardStatus | null
  pinned: boolean
  created_at: string
  last_activity_at: string
  comments: BoardComment[]
}

const KEY = 'dn-board-v1'
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

// ชื่อคนที่ใช้อยู่ตอนนี้ — ล็อกอินรหัสพนักงาน = ชื่อเล่น · รหัสรวมของร้าน = "แอดมิน"
export const currentAuthor = () => readStaffSession()?.nickname || 'แอดมิน'

function seed(): BoardTopic[] {
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
  const t = (category: BoardCategory, title: string, body: string, author: string, h: number, extra: Partial<BoardTopic> = {}, comments: [string, string, number, number][] = []): BoardTopic => ({
    id: uid(), category, title, body, author, order_number: null, status: category === 'ปัญหา/แก้ไข' ? 'รอตอบ' : null, pinned: false,
    created_at: ago(h), last_activity_at: ago(comments.length ? comments[comments.length - 1][2] : h),
    comments: comments.map(([a, b, ch, likes]) => ({ id: uid(), author: a, body: b, created_at: ago(ch), likes: Array.from({ length: likes }, (_, i) => `คน${i}`) })),
    ...extra,
  })
  return [
    t('ประกาศ', 'แจ้งเปลี่ยนเวลาจัดส่งสินค้า / เทศกาลสงกรานต์', 'แจ้งเปลี่ยนเวลาจัดส่งสินค้าในช่วงเทศกาลสงกรานต์ ระหว่างวันที่ 10–16 เม.ย. งดส่งของ ออเดอร์ที่เข้ามาช่วงนี้จะเริ่มส่งวันที่ 17 เม.ย.', 'แอดมิน', 2, { pinned: true },
      [['ฟิล์ม', 'รับทราบครับ', 1.5, 2]]),
    t('งานออเดอร์', 'ออเดอร์ 260917A0G1W0VS – ผ้าม่านห้องนอน', 'ลูกค้าต้องการเปลี่ยนสีผ้าม่านจาก S01 เป็น S03 รบกวนทีมผลิตตรวจสอบด้วยครับ ขอบคุณค่ะ', 'เฟิร์น', 3, { order_number: '260917A0G1W0VS' },
      [['ช่างหนึ่ง', 'ผมตรวจสอบแล้วครับ สี S03 ยังมีสต็อก สามารถผลิตได้ตามปกติครับ', 2.5, 3], ['แพท', 'รับทราบค่ะ จะอัปเดตให้ลูกค้าทราบเลยค่ะ', 2.3, 2], ['เฟิร์น', 'ขอบคุณมากค่ะ 🙏', 2, 1]]),
    t('ปัญหา/แก้ไข', 'ปัญหาการติดตั้ง – เชียงใหม่', 'หน้างานมีปัญหาผนังเอียง ต้องใช้วิธีติดตั้งแบบพิเศษ รบกวนช่างแจ้งแนวทางด้วยครับ', 'ช่างหนึ่ง', 5, { status: 'กำลังทำ' },
      [['ช่างบัวบาน', 'ใช้ขาเสริมตัว L แล้วรองแผ่นชิมครับ เดี๋ยวส่งรูปวิธีทำให้', 4, 1]]),
    t('ลูกค้า', 'สอบถามเรื่องรางม่านลอนเทป', 'ลูกค้าสอบถามว่ารางแบบนี้สามารถติดตั้งกับผ้า S01 ได้ไหม รบกวนแอดมินช่วยตอบด้วยค่ะ', 'พลอย', 6),
    t('งานทั่วไป', 'สรุปยอดขายประจำสัปดาห์ (8–14 เม.ย. 69)', 'ยอดขายรวม 2,580,000 บาท เพิ่มขึ้นจากสัปดาห์ก่อน 12% รายละเอียดอยู่ในไฟล์แนบค่ะ', 'แพท', 8),
    t('ไอเดีย', 'ไอเดียโปรโมท – Flash Sale เดือนเมษายน', 'เสนอจัด Flash Sale กลางเดือน + คูปองส่วนลด 10% สำหรับม่านยอดนิยม', 'มายด์', 12,
      {}, [['แพท', 'เห็นด้วยค่ะ เลือกเป็นม่านตาไก่ blackout ดีไหม', 11, 2]]),
  ]
}

function load(): BoardTopic[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as BoardTopic[]
  } catch { /* เบราว์เซอร์ปิดที่เก็บข้อมูล → ใช้ตัวอย่าง */ }
  const s = seed()
  save(s)
  return s
}
function save(list: BoardTopic[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* เต็ม/ถูกปิด — ข้อมูลอยู่แค่รอบนี้ */ }
}
function mutate(fn: (list: BoardTopic[]) => void): BoardTopic[] {
  const list = load()
  fn(list)
  save(list)
  return list
}

export async function listTopics(): Promise<BoardTopic[]> { return load() }

export async function createTopic(t: { category: BoardCategory; title: string; body: string; order_number?: string | null; order_id?: string | null; order_label?: string | null }): Promise<BoardTopic> {
  const now = new Date().toISOString()
  const topic: BoardTopic = {
    id: uid(), category: t.category.trim() || 'งานทั่วไป', title: t.title.trim(), body: t.body.trim(), author: currentAuthor(),
    order_number: t.order_number?.trim() || null, order_id: t.order_id || null, order_label: t.order_label || null, status: t.category === 'ปัญหา/แก้ไข' ? 'รอตอบ' : null,
    pinned: false, created_at: now, last_activity_at: now, comments: [],
  }
  mutate(list => { list.unshift(topic) })
  return topic
}

export async function addComment(topicId: string, body: string): Promise<BoardTopic[]> {
  const now = new Date().toISOString()
  return mutate(list => {
    const t = list.find(x => x.id === topicId)
    if (!t) return
    t.comments.push({ id: uid(), author: currentAuthor(), body: body.trim(), created_at: now, likes: [] })
    t.last_activity_at = now
  })
}

export async function toggleLike(topicId: string, commentId: string): Promise<BoardTopic[]> {
  const me = currentAuthor()
  return mutate(list => {
    const c = list.find(x => x.id === topicId)?.comments.find(x => x.id === commentId)
    if (!c) return
    c.likes = c.likes.includes(me) ? c.likes.filter(n => n !== me) : [...c.likes, me]
  })
}

export async function updateTopic(topicId: string, patch: Partial<Pick<BoardTopic, 'pinned' | 'status' | 'title' | 'body' | 'category'>>): Promise<BoardTopic[]> {
  return mutate(list => {
    const t = list.find(x => x.id === topicId)
    if (t) Object.assign(t, patch)
  })
}

export async function deleteTopic(topicId: string): Promise<BoardTopic[]> {
  return mutate(list => { const i = list.findIndex(x => x.id === topicId); if (i >= 0) list.splice(i, 1) })
}

export async function deleteComment(topicId: string, commentId: string): Promise<BoardTopic[]> {
  return mutate(list => {
    const t = list.find(x => x.id === topicId)
    if (t) t.comments = t.comments.filter(c => c.id !== commentId)
  })
}

// ล้างข้อมูลทดลองทั้งหมด กลับไปใช้ตัวอย่าง
export async function resetBoard(): Promise<BoardTopic[]> { const s = seed(); save(s); return s }
