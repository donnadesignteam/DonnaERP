-- ตามงาน: แนบรูป/คลิป (ลิงก์ R2 เก็บเป็น jsonb) + เปิด realtime ให้เด้งแจ้งเตือนเมื่อมีคนโพสต์
-- รันซ้ำได้
alter table board_topics   add column if not exists media jsonb not null default '[]'::jsonb;
alter table board_comments add column if not exists media jsonb not null default '[]'::jsonb;

do $$ begin
  alter publication supabase_realtime add table board_topics;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table board_comments;
exception when duplicate_object then null; end $$;

select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename like 'board_%';
