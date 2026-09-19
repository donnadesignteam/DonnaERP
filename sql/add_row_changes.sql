-- ลด Egress ของ Supabase: เว็บจำออเดอร์ไว้ในเครื่อง แล้วขอเฉพาะ "ใบที่เปลี่ยนตั้งแต่ครั้งก่อน" (lib/rowCache.ts)
-- ตาราง row_changes = บันทึกว่าแถวไหนเปลี่ยน/ถูกลบเมื่อไหร่ (1 แถวต่อ 1 ออเดอร์ ทับของเดิม ไม่โตไม่รู้จบ)
-- ‼️ ไม่เพิ่มคอลัมน์ใน order_entries — trigger ประวัติการแก้ไข (log_activity) จะได้ไม่มีช่องใหม่โผล่ทุกครั้งที่แก้
-- รันใน Supabase → SQL Editor (รันซ้ำได้)

create table if not exists public.row_changes (
  table_name  text        not null,
  row_id      text        not null,
  changed_at  timestamptz not null default clock_timestamp(),
  deleted     boolean     not null default false,
  primary key (table_name, row_id)
);
create index if not exists row_changes_since_idx on public.row_changes (table_name, changed_at);

alter table public.row_changes enable row level security;
-- เว็บอ่านได้อย่างเดียว — เขียนผ่าน trigger เท่านั้น
drop policy if exists row_changes_read on public.row_changes;
create policy row_changes_read on public.row_changes for select to anon, authenticated using (true);

-- SECURITY DEFINER: ผู้แก้ออเดอร์เป็น anon ก็เขียนตารางนี้ได้ผ่าน trigger
create or replace function public.note_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into row_changes(table_name, row_id, changed_at, deleted)
    values (tg_table_name, old.id::text, clock_timestamp(), true)
    on conflict (table_name, row_id) do update set changed_at = excluded.changed_at, deleted = true;
    return old;
  end if;
  insert into row_changes(table_name, row_id, changed_at, deleted)
  values (tg_table_name, new.id::text, clock_timestamp(), false)
  on conflict (table_name, row_id) do update set changed_at = excluded.changed_at, deleted = false;
  return new;
end;
$$;

drop trigger if exists trg_row_changes on public.order_entries;
create trigger trg_row_changes
  after insert or update or delete on public.order_entries
  for each row execute function public.note_row_change();

-- ตรวจหลังรัน: ต้องขึ้น trigger 1 ตัว และตาราง row_changes ว่าง (0) — จะมีแถวเมื่อมีคนแก้ออเดอร์ครั้งถัดไป
select (select count(*) from pg_trigger where tgname = 'trg_row_changes') as trigger_ok,
       (select count(*) from public.row_changes) as rows_now;
