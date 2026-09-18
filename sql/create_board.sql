-- กระดานสนทนา (หมวด "กระดานสนทนา") — หัวข้อ + ความคิดเห็น + กดถูกใจ
-- ‼️ ตอนนี้โคลน donnaweb-design ยังเก็บข้อมูลในเบราว์เซอร์ (lib/boardStore.ts) — ไฟล์นี้เตรียมไว้ตอนย้ายไปเว็บจริง
-- รันใน Supabase SQL Editor ครั้งเดียว (รันซ้ำได้ ไม่พัง)

create table if not exists board_topics (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,                 -- ประกาศ / งานทั่วไป / งานออเดอร์ / งานติดตั้ง / ปัญหา/แก้ไข / ลูกค้า / ไอเดีย
  title       text not null,
  body        text not null default '',
  author      text not null,                 -- ชื่อเล่นคนตั้ง (จาก staff session) หรือ "แอดมิน" ถ้าล็อกอินรหัสร้าน
  order_number text,                          -- ผูกกับออเดอร์ (กดเปิดรายละเอียดออเดอร์ได้)
  status      text,                          -- ใช้กับหมวดปัญหา: รอตอบ / กำลังทำ / ปิดแล้ว
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  last_activity_at timestamptz not null default now()   -- เรียงตามความเคลื่อนไหวล่าสุด (มีคอมเมนต์ใหม่ = ขึ้นบน)
);

create table if not exists board_comments (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references board_topics(id) on delete cascade,
  author      text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists board_comments_topic_idx on board_comments(topic_id, created_at);

create table if not exists board_likes (
  comment_id  uuid not null references board_comments(id) on delete cascade,
  author      text not null,
  primary key (comment_id, author)
);

-- เว็บใช้ anon key เหมือนตารางอื่นของร้าน
alter table board_topics   enable row level security;
alter table board_comments enable row level security;
alter table board_likes    enable row level security;
do $$ begin
  create policy board_topics_all   on board_topics   for all using (true) with check (true);
  create policy board_comments_all on board_comments for all using (true) with check (true);
  create policy board_likes_all    on board_likes    for all using (true) with check (true);
exception when duplicate_object then null; end $$;
