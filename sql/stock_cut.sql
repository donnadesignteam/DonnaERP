-- ตัดสต็อกผ้าอัตโนมัติตอนสแกนเข้าขั้นตัดผ้า (app/scan → lib/stockCut.ts)
-- เมตรคิดตามสูตรเดียวกับยอดตัดผ้าของพนักงาน (lib/fabricUsage.ts) แยกตามสีผ้า (รหัสสีในรายการ = fabric_code/shop_code ในสต็อก)
-- กติกา: มีคนสแกนขั้น "ตัด" ของออเดอร์นี้อยู่อย่างน้อย 1 คน = ต้องตัดสต็อกแล้ว (ครั้งเดียว ไม่ว่ากี่คน)
--        ยกเลิกสแกนตัดจนไม่เหลือใคร = คืนสต็อกเท่าที่ตัดไปจริง
-- รันซ้ำได้

-- เมตรคงเหลือต้องเก็บทศนิยมได้ (ปรับสต็อกเป็นหลาแปลงแล้วได้เศษ เช่น 10 หลา = 9.14 ม.)
alter table stock alter column remaining_meters type numeric using remaining_meters::numeric;

create table if not exists stock_cuts (
  scan_no    text not null,          -- เลขออเดอร์ (หรือ claim:<id> ของใบเคลม) = production_scans.order_number
  stock_id   text not null,
  meters     numeric not null,       -- เมตรที่ออเดอร์ใช้ตามสูตร
  created_at timestamptz not null default now(),
  primary key (scan_no, stock_id)
);
alter table stock_cuts add column if not exists deducted numeric not null default 0;  -- เมตรที่หักออกจากสต็อกจริง (สต็อกไม่พอ = หักได้แค่ที่มี · สต็อกไม่ได้ลงเมตรไว้ = 0)
alter table stock_cuts enable row level security;
do $$ begin
  create policy stock_cuts_all on stock_cuts for all using (true) with check (true);
exception when duplicate_object then null; end $$;

drop function if exists cut_stock_for_order(text, jsonb);
create or replace function sync_stock_cut(p_scan_no text, p_rows jsonb)
returns jsonb language plpgsql as $$
declare
  r jsonb; v_m numeric; v_cur numeric; v_take numeric; ins int;
  n_cut int := 0; n_back int := 0; c record;
begin
  if coalesce(p_scan_no, '') = '' then return jsonb_build_object('ok', false); end if;
  -- กันสองเครื่องทำออเดอร์เดียวกันพร้อมกัน
  perform pg_advisory_xact_lock(hashtext('stock_cut:' || p_scan_no));

  if exists (select 1 from production_scans where order_number = p_scan_no and stage = 'ตัด') then
    for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
      v_m := (r->>'meters')::numeric;
      if v_m is null or v_m <= 0 then continue; end if;
      insert into stock_cuts (scan_no, stock_id, meters) values (p_scan_no, r->>'stock_id', v_m)
        on conflict do nothing;
      get diagnostics ins = row_count;
      if ins = 0 then continue; end if;   -- ตัดไปแล้ว ไม่ตัดซ้ำ
      select remaining_meters into v_cur from stock where id::text = r->>'stock_id' for update;
      if v_cur is null then
        v_take := 0;                     -- สต็อกแถวนี้ไม่ได้ลงเมตรไว้ → ไม่แตะ
      else
        v_take := least(v_m, greatest(v_cur, 0));
        update stock set remaining_meters = v_cur - v_take, updated_at = now() where id::text = r->>'stock_id';
      end if;
      update stock_cuts set deducted = v_take where scan_no = p_scan_no and stock_id = r->>'stock_id';
      n_cut := n_cut + 1;
    end loop;
  else
    -- ไม่เหลือคนสแกนตัดแล้ว (ยกเลิกสแกน) → คืนเท่าที่หักไปจริง
    for c in select * from stock_cuts where scan_no = p_scan_no for update loop
      if c.deducted > 0 then
        update stock set remaining_meters = coalesce(remaining_meters, 0) + c.deducted, updated_at = now() where id::text = c.stock_id;
      end if;
      delete from stock_cuts where scan_no = p_scan_no and stock_id = c.stock_id;
      n_back := n_back + 1;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'cut', n_cut, 'returned', n_back);
end $$;
grant execute on function sync_stock_cut(text, jsonb) to anon, authenticated;
