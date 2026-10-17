-- ════════════════════════════════════════════════════════════════════════════
-- สแกนแผนก "ช่างติดตั้ง" (17ต.ค.69 user ขอ) — สแกนได้เฉพาะงานติดตั้ง → สถานะติดตั้งสำเร็จ
--   ใบออเดอร์: install_status = 'ติดตั้งแล้ว' + is_dropoff = true (แบบเดียวกับเลือก "ติดตั้งแล้ว" ในหมวดออเดอร์)
--   ปฏิทินงานติดตั้ง: installation_status = 'ติดตั้งเสร็จ' (แถวที่ผูกด้วย source_order_id)
--   ไม่แตะสถานะผลิต (order_status) · บันทึกชื่อช่างลง production_scans ขั้น 'ช่างติดตั้ง'
-- + scan_undo (ต่อจาก sql/scan_guard_20261011.sql) รู้จักขั้น 'ช่างติดตั้ง' — ยกเลิกแล้วถอดสถานะติดตั้งกลับ
-- ‼️ รันใน Supabase → SQL Editor (รันซ้ำได้ ปลอดภัย)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.install_scan_advance(
  p_order_id     uuid,
  p_tech_code    text,
  p_tech_name    text,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o         record;
  v_now     timestamptz := now();
  v_scan_no text;
  v_people  jsonb;
begin
  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;
  if not coalesce(o.is_installation, false) then
    return jsonb_build_object('ok', false, 'result', 'not_install');
  end if;
  if o.order_status = 'ยกเลิก' then
    return jsonb_build_object('ok', false, 'result', 'cancelled', 'current_status', o.order_status);
  end if;

  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  if o.install_status = 'ติดตั้งแล้ว' then
    select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
      from production_scans t where t.order_number = v_scan_no and t.stage = 'ช่างติดตั้ง';
    return jsonb_build_object('ok', false, 'result', 'already', 'people', v_people);
  end if;

  update order_entries set install_status = 'ติดตั้งแล้ว', is_dropoff = true, updated_at = v_now where id = o.id;
  update installations set installation_status = 'ติดตั้งเสร็จ', updated_at = v_now where source_order_id = o.id;
  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
    values (v_scan_no, 'ช่างติดตั้ง', 'ติดตั้งแล้ว', p_tech_code, p_tech_name, v_now);

  return jsonb_build_object('ok', true, 'result', 'done', 'status', 'ติดตั้งสำเร็จ');
end;
$$;

grant execute on function public.install_scan_advance(uuid, text, text, text) to anon, authenticated;

create or replace function public.scan_undo(
  p_order_id     uuid,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','ตรวจสอบแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
  o          record;
  v_now      timestamptz := now();
  v_scan_no  text;
  v_stage    text;
  v_helper   boolean;
  v_ctid     tid;
  v_idx      int;
  v_prev     text;
  v_hist     jsonb;
  v_len      int;
  i          int;
  v_s        text;
begin
  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  select stage, is_helper, ctid into v_stage, v_helper, v_ctid
    from production_scans where order_number = v_scan_no
    order by scanned_at desc limit 1;
  if v_stage is null then
    return jsonb_build_object('ok', false, 'result', 'no_scan');
  end if;

  v_hist := coalesce(o.status_history, '[]'::jsonb);
  if jsonb_typeof(v_hist) <> 'array' then v_hist := '[]'::jsonb; end if;
  v_len := jsonb_array_length(v_hist);

  if v_helper then
    if v_len > 0 and (v_hist -> -1 ->> 'helper') = 'true' then
      update order_entries set status_history = v_hist - (v_len - 1) where id = o.id;
    end if;
    delete from production_scans where ctid = v_ctid;
    return jsonb_build_object('ok', true, 'result', 'undone', 'status', o.order_status, 'helper', true);
  end if;

  if v_stage = 'แพ็คราง' then
    update order_entries set rail_packed = false, rail_packed_at = null, updated_at = v_now where id = o.id;
    v_prev := o.order_status;
  elsif v_stage = 'ช่างติดตั้ง' then
    -- ยกเลิกสแกนช่างติดตั้ง → ถอดสถานะติดตั้ง (ใบออเดอร์ + ปฏิทินงานติดตั้ง) ไม่แตะสถานะผลิต
    update order_entries set install_status = null, is_dropoff = false, updated_at = v_now where id = o.id;
    update installations set installation_status = 'รอนัดหมาย', updated_at = v_now
      where source_order_id = o.id and installation_status = 'ติดตั้งเสร็จ';
    v_prev := o.order_status;
  else
    -- (3) สถานะก่อนหน้าจริง = รายการก่อนตัวสุดท้ายในประวัติ (ข้ามรายการของคนช่วย) ที่อยู่ก่อนสถานะปัจจุบันใน flow
    v_idx := array_position(flow, o.order_status);
    v_prev := null;
    if v_len >= 2 and (v_hist -> -1 ->> 'status') = o.order_status then
      i := v_len - 2;
      while i >= 0 loop
        v_s := v_hist -> i ->> 'status';
        if coalesce(v_hist -> i ->> 'helper', '') <> 'true' and array_position(flow, v_s) is not null
           and (v_idx is null or array_position(flow, v_s) < v_idx) then
          v_prev := v_s;
          exit;
        end if;
        i := i - 1;
      end loop;
    end if;
    -- ประวัติใช้ไม่ได้ → สถานะของการสแกนครั้งก่อนหน้า
    if v_prev is null then
      select t.status into v_prev from production_scans t
       where t.order_number = v_scan_no and t.ctid <> v_ctid and not coalesce(t.is_helper, false)
         and t.stage <> 'แพ็คราง' and array_position(flow, t.status) is not null
         and (v_idx is null or array_position(flow, t.status) < v_idx)
       order by t.scanned_at desc limit 1;
    end if;
    -- ไม่มีอะไรให้อ้างเลย (ใบเก่า) → ถอย 1 ขั้นแบบเดิม
    if v_prev is null then
      if v_idx is null or v_idx <= 1 then v_prev := 'รอดำเนินการ'; else v_prev := flow[v_idx - 1]; end if;
    end if;

    if o.order_status = 'จัดส่งแล้ว' then
      update order_entries set order_status = v_prev, shipped_at = null, updated_at = v_now where id = o.id;
    else
      update order_entries set order_status = v_prev, updated_at = v_now where id = o.id;
    end if;

    update work_status set status = v_prev, status_updated_at = v_now
      where lower(order_number) = lower(coalesce(nullif(o.order_number, ''), '~ไม่มี~'))
         or lower(order_number) = lower(coalesce(nullif(o.customer_name, ''), '~ไม่มี~'));

    -- ลบรายการประวัติตัวสุดท้ายเฉพาะเมื่อเป็นของสถานะที่กำลังถอย (กันลบผิดตัว)
    if v_len > 0 and (v_hist -> -1 ->> 'status') = o.order_status then
      update order_entries set status_history = v_hist - (v_len - 1) where id = o.id;
    end if;
  end if;

  delete from production_scans where ctid = v_ctid;

  return jsonb_build_object('ok', true, 'result', 'undone', 'status', v_prev);
end;
$$;

grant execute on function public.scan_undo(uuid, text) to anon, authenticated;
