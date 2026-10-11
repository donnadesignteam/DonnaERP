-- ════════════════════════════════════════════════════════════════════════════
-- แก้ scan_advance + scan_undo (11ต.ค.69 ตรวจโค้ดทั้งระบบ) — ต่อจาก sql/add_assistant_stage.sql (scan_join ไม่เปลี่ยน)
--
--  1) สแกน "จัดส่งแล้ว" ซ้ำใบที่จัดส่งไปแล้ว → เดิมเขียนวันที่จัดส่งทับเป็นวันนี้ + นับผลงานซ้ำ
--     ตอนนี้ไม่แตะอะไร แต่ยังไปต่อหน้าใส่เลขพัสดุได้ (สแกนซ้ำเพื่อเพิ่มเลขพัสดุ)
--  2) ใบที่ "ยกเลิก" แล้วสแกนได้ → เดิมสถานะเด้งออกจากหมวดยกเลิก · ตอนนี้ตอบ cancelled ไม่แตะอะไร
--  3) ยกเลิกการสแกน (สแกนผิด) → เดิมถอย 1 ขั้นตาม flow ตายตัว ถ้าสแกนข้ามขั้นมา (เช่น ตัดผ้าแล้ว → แพ็คแล้ว)
--     จะถอยไป "รีดแล้ว" ซึ่งไม่เคยเกิดขึ้น · ตอนนี้ถอยกลับเป็นสถานะก่อนหน้าจริงจากประวัติสถานะ
--
-- ‼️ รันใน Supabase → SQL Editor (รันซ้ำได้ ปลอดภัย) — โค้ดหน้าเว็บรองรับคำตอบใหม่แล้ว
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.scan_advance(
  p_order_id     uuid,
  p_stage_key    text,
  p_tech_code    text,
  p_tech_name    text,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ‼️ ต้องตรงกับ PROD_STATUS_FLOW ใน lib/staff.ts
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','ตรวจสอบแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
  v_label  text;
  v_status text;
  o        record;
  v_now    timestamptz := now();
  v_iso    text;
  v_scan_no text;
  v_hist   jsonb;
  v_people jsonb;
begin
  select m.l, m.s into v_label, v_status from (values
    ('cut','ตัด','ตัดผ้าแล้ว'),
    ('sew','เย็บ','เย็บแล้ว'),
    ('assist','ผู้ช่วยช่าง','ตรวจสอบแล้ว'),
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
    ('rail_pack','แพ็คราง','แพ็คราง'),
    ('shipped','จัดส่งแล้ว','จัดส่งแล้ว')
  ) as m(k, l, s) where m.k = p_stage_key;
  if v_status is null then
    return jsonb_build_object('ok', false, 'result', 'bad_stage');
  end if;

  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  -- (2) ใบยกเลิก → ไม่เดินสถานะ
  if o.order_status = 'ยกเลิก' then
    return jsonb_build_object('ok', false, 'result', 'cancelled', 'current_status', o.order_status);
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  if p_stage_key = 'rail_pack' then
    update order_entries set rail_packed = true, rail_packed_at = v_now, updated_at = v_now where id = o.id;
    insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
      values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);
    return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
  end if;

  -- (1) จัดส่งแล้วซ้ำ → ไม่แตะอะไร (ไม่ทับวันที่จัดส่ง ไม่นับผลงานซ้ำ) แต่ตอบ ok ให้หน้าสแกนไปต่อหน้าใส่เลขพัสดุได้เหมือนเดิม
  if p_stage_key = 'shipped' and o.order_status = 'จัดส่งแล้ว' then
    return jsonb_build_object('ok', true, 'result', 'already_shipped', 'status', o.order_status);
  end if;

  -- ด่านกันข้ามขั้น: เดินหน้าได้อย่างเดียว
  if p_stage_key <> 'shipped' and coalesce(array_position(flow, o.order_status), 0) >= array_position(flow, v_status) then
    select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
      from production_scans t where t.order_number = v_scan_no and t.stage = v_label;
    return jsonb_build_object('ok', false, 'result', 'already',
      'current_status', coalesce(nullif(o.order_status, ''), 'รอดำเนินการ'),
      'stage', v_label,
      'people', v_people,
      'mine', exists (
        select 1 from production_scans t
         where t.order_number = v_scan_no and t.stage = v_label and t.tech_code = p_tech_code));
  end if;

  if p_stage_key = 'shipped' then
    update order_entries
      set order_status = v_status, shipped_at = v_now, is_urgent = true, updated_at = v_now
      where id = o.id;
  else
    update order_entries set order_status = v_status, updated_at = v_now where id = o.id;
  end if;

  update work_status set status = v_status, status_updated_at = v_now
    where lower(order_number) = lower(coalesce(nullif(o.order_number, ''), '~ไม่มี~'))
       or lower(order_number) = lower(coalesce(nullif(o.customer_name, ''), '~ไม่มี~'));

  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);

  v_hist := coalesce(o.status_history, '[]'::jsonb);
  if jsonb_typeof(v_hist) <> 'array' then v_hist := '[]'::jsonb; end if;
  if (v_hist -> -1 ->> 'status') is distinct from v_status then
    update order_entries
      set status_history = v_hist || jsonb_build_object('status', v_status, 'at', v_iso, 'by', p_tech_name)
      where id = o.id;
  end if;

  return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
end;
$$;

grant execute on function public.scan_advance(uuid, text, text, text, text) to anon, authenticated;

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

-- ════════════════════════════════════════════════════════════════════════════
-- งานเคลม (ต่อจาก sql/claim_rail_pack.sql — claim_scan_join ไม่เปลี่ยน): แก้ข้อ (1) และ (3) แบบเดียวกัน
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.claim_scan_advance(
  p_claim_id  uuid,
  p_stage_key text,   -- cut | sew | assist | iron | pack | rail_pack | shipped
  p_tech_code text,
  p_tech_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอของคืน','ตัดผ้าแล้ว','เย็บแล้ว','ตรวจสอบแล้ว','รีดแล้ว','แพ็คแล้ว','ส่งแล้ว'];
  v_label   text;
  v_status  text;
  c         record;
  v_now     timestamptz := now();
  v_iso     text;
  v_scan_no text;
  v_people  jsonb;
begin
  select m.l, m.s into v_label, v_status from (values
    ('cut','ตัด','ตัดผ้าแล้ว'),
    ('sew','เย็บ','เย็บแล้ว'),
    ('assist','ผู้ช่วยช่าง','ตรวจสอบแล้ว'),
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
    ('rail_pack','แพ็คราง','แพ็คราง'),
    ('shipped','จัดส่งแล้ว','ส่งแล้ว')
  ) as m(k, l, s) where m.k = p_stage_key;
  if v_status is null then
    return jsonb_build_object('ok', false, 'result', 'bad_stage');
  end if;

  select * into c from claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := 'claim:' || c.id::text;

  -- แพ็คราง = ติ๊กสถานะรางอย่างเดียว ไม่เปลี่ยนสถานะสายผลิต · สแกนซ้ำ = ถามว่าช่วยกันทำไหม (เหมือนขั้นอื่น)
  if p_stage_key = 'rail_pack' then
    if c.rail_packed then
      select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
        from production_scans t where t.order_number = v_scan_no and t.stage = v_label;
      return jsonb_build_object('ok', false, 'result', 'already',
        'current_status', 'แพ็ครางแล้ว', 'stage', v_label, 'people', v_people,
        'mine', exists (select 1 from production_scans t
                         where t.order_number = v_scan_no and t.stage = v_label and t.tech_code = p_tech_code));
    end if;
    update claims set rail_packed = true, rail_packed_at = v_now, updated_at = v_now where id = c.id;
    insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
      values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);
    return jsonb_build_object('ok', true, 'result', 'done', 'status', coalesce(nullif(c.status, ''), 'รอของคืน'), 'at', v_iso);
  end if;

  -- (1) ส่งแล้วซ้ำ → ไม่แตะอะไร (ไม่ทับวันที่ส่ง ไม่นับผลงานซ้ำ) แต่ตอบ ok ให้ไปต่อหน้าใส่เลขพัสดุได้
  if p_stage_key = 'shipped' and c.status = 'ส่งแล้ว' then
    return jsonb_build_object('ok', true, 'result', 'already_shipped', 'status', c.status);
  end if;

  -- ด่านกันข้ามขั้น: เดินหน้าได้อย่างเดียว (ยกเว้น 'ส่งแล้ว' ที่กดปิดท้ายได้เสมอ)
  if p_stage_key <> 'shipped'
     and coalesce(array_position(flow, c.status), 0) >= array_position(flow, v_status) then
    select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
      from production_scans t where t.order_number = v_scan_no and t.stage = v_label;
    return jsonb_build_object('ok', false, 'result', 'already',
      'current_status', coalesce(nullif(c.status, ''), 'รอของคืน'),
      'stage', v_label,
      'people', v_people,
      'mine', exists (
        select 1 from production_scans t
         where t.order_number = v_scan_no and t.stage = v_label and t.tech_code = p_tech_code));
  end if;

  if p_stage_key = 'shipped' then
    update claims set status = v_status, shipped_at = v_now, updated_at = v_now where id = c.id;
  else
    update claims set status = v_status, updated_at = v_now where id = c.id;
  end if;

  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);

  return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
end;
$$;

grant execute on function public.claim_scan_advance(uuid, text, text, text) to anon, authenticated;

create or replace function public.claim_scan_undo(p_claim_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอของคืน','ตัดผ้าแล้ว','เย็บแล้ว','ตรวจสอบแล้ว','รีดแล้ว','แพ็คแล้ว','ส่งแล้ว'];
  c         record;
  v_now     timestamptz := now();
  v_scan_no text;
  v_stage   text;
  v_helper  boolean;
  v_ctid    tid;
  v_idx     int;
  v_prev    text;
begin
  select * into c from claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_scan_no := 'claim:' || c.id::text;

  select stage, coalesce(is_helper, false), ctid into v_stage, v_helper, v_ctid
    from production_scans where order_number = v_scan_no
    order by scanned_at desc limit 1;
  if v_stage is null then
    return jsonb_build_object('ok', false, 'result', 'no_scan');
  end if;

  if v_helper then
    delete from production_scans where ctid = v_ctid;
    return jsonb_build_object('ok', true, 'result', 'undone', 'status', c.status, 'helper', true);
  end if;

  if v_stage = 'แพ็คราง' then
    update claims set rail_packed = false, rail_packed_at = null, updated_at = v_now where id = c.id;
    delete from production_scans where ctid = v_ctid;
    return jsonb_build_object('ok', true, 'result', 'undone', 'status', c.status);
  end if;

  -- (3) ถอยกลับเป็นสถานะของการสแกนครั้งก่อนหน้าจริง (สแกนข้ามขั้นมาจะได้ไม่ถอยไปขั้นที่ไม่เคยเกิด)
  --     ไม่มีสแกนก่อนหน้า = ยังไม่เริ่มผลิต → รอของคืน
  v_idx := array_position(flow, c.status);
  select t.status into v_prev from production_scans t
   where t.order_number = v_scan_no and t.ctid <> v_ctid and not coalesce(t.is_helper, false)
     and t.stage <> 'แพ็คราง' and array_position(flow, t.status) is not null
     and (v_idx is null or array_position(flow, t.status) < v_idx)
   order by t.scanned_at desc limit 1;
  v_prev := coalesce(v_prev, 'รอของคืน');

  if c.status = 'ส่งแล้ว' then
    update claims set status = v_prev, shipped_at = null, updated_at = v_now where id = c.id;
  else
    update claims set status = v_prev, updated_at = v_now where id = c.id;
  end if;

  delete from production_scans where ctid = v_ctid;
  return jsonb_build_object('ok', true, 'result', 'undone', 'status', v_prev);
end;
$$;

grant execute on function public.claim_scan_undo(uuid) to anon, authenticated;
