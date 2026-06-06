-- บันทึกประวัติการเปลี่ยนสถานะออเดอร์ (สำหรับวิเคราะห์เวลาที่ใช้ในแต่ละแผนก)
-- 1 แถว = 1 ครั้งที่ออเดอร์เข้าสถานะใหม่
-- เก็บอัตโนมัติด้วย trigger — ครอบทุกจุดที่แอปอัปเดต order_status

create table if not exists order_status_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references order_entries(id) on delete cascade,
  order_number text,
  status       text not null,
  entered_at   timestamptz not null default now()
);

create index if not exists idx_status_events_order  on order_status_events(order_id);
create index if not exists idx_status_events_status on order_status_events(status, entered_at);

-- ฟังก์ชัน log: insert เมื่อสร้างออเดอร์ใหม่ หรือเมื่อ order_status เปลี่ยนค่า
create or replace function log_order_status_event()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if new.order_status is not null then
      insert into order_status_events(order_id, order_number, status, entered_at)
      values (new.id, new.order_number, new.order_status, coalesce(new.created_at, now()));
    end if;
  elsif (tg_op = 'UPDATE') then
    if new.order_status is distinct from old.order_status and new.order_status is not null then
      insert into order_status_events(order_id, order_number, status, entered_at)
      values (new.id, new.order_number, new.order_status, now());
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_log_order_status on order_entries;
create trigger trg_log_order_status
  after insert or update of order_status on order_entries
  for each row execute function log_order_status_event();

-- (ทางเลือก) seed สถานะปัจจุบันของออเดอร์ที่มีอยู่แล้ว เป็นจุดเริ่มต้น
-- ใช้ updated_at เป็นเวลาโดยประมาณที่เข้าสถานะปัจจุบัน (ไม่แม่นย้อนหลัง แต่ได้ baseline)
-- เอา comment ออกถ้าต้องการ seed:
-- insert into order_status_events(order_id, order_number, status, entered_at)
-- select id, order_number, order_status, coalesce(updated_at, created_at, now())
-- from order_entries
-- where order_status is not null;
