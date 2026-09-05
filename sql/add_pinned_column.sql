-- ปักหมุดออเดอร์สำคัญ — แถวที่ปักหมุดจะลอยขึ้นบนสุดของทุกแท็บในหมวดออเดอร์ (เห็นร่วมกันทั้งทีม)
-- ใบออเดอร์ปกติ = order_entries · งานเคลมที่โผล่ในหมวดออเดอร์ = claims
alter table order_entries add column if not exists pinned boolean not null default false;
alter table order_entries add column if not exists pinned_at timestamptz;
alter table claims        add column if not exists pinned boolean not null default false;
alter table claims        add column if not exists pinned_at timestamptz;

-- ตรวจผล
select (select count(*) from order_entries where pinned) as ออเดอร์ที่ปักหมุด,
       (select count(*) from claims        where pinned) as งานเคลมที่ปักหมุด;
