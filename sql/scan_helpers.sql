-- ช่วยกันทำออเดอร์เดียวกัน (หลายคนใน 1 ขั้น) — ตัด/เย็บ/รีด/แพ็ค บางออเดอร์แบ่งกันทำ 2-3 คน
-- เดิม: คนแรกสแกนได้ คนที่สองสแกนแล้วขึ้น "ไม่อัปเดต (กันข้ามขั้น)" แล้วจบ → ชื่อคนที่ 2 ไม่ถูกบันทึกที่ไหนเลย
-- ใหม่: คนที่สองสแกนซ้ำ → เว็บถามว่า "ออเดอร์นี้สแกนไปแล้วโดย X ต้องการลงชื่อเพิ่มไหม"
--       กดยืนยัน → เรียก scan_join บันทึกว่าช่วยทำขั้นนี้ (ไม่เปลี่ยนสถานะออเดอร์ ไม่เดินขั้น)
--
-- ‼️ รันไฟล์นี้ใน Supabase → SQL Editor "ก่อน" deploy โค้ดหน้า /scan ใหม่ (ก๊อปจากไฟล์ ไม่ใช่จากแชท)
-- ไฟล์นี้ทำ 4 อย่าง: เพิ่มคอลัมน์ is_helper → สร้าง scan_join → แก้ scan_advance → แก้ scan_undo

-- ===== 1) คอลัมน์แยกว่าแถวสแกนนั้นเป็น "คนช่วย" หรือ "คนที่เดินสถานะ" =====
alter table production_scans add column if not exists is_helper boolean not null default false;

-- ===== 2) RPC ลงชื่อช่วยทำ =====
create or replace function public.scan_join(
  p_order_id     uuid,
  p_stage_key    text,   -- cut | sew | iron | pack | rail_pack | shipped
  p_tech_code    text,
  p_tech_name    text,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label   text;
  v_status  text;
  o         record;
  v_now     timestamptz := now();
  v_iso     text;
  v_scan_no text;
  v_hist    jsonb;
  v_people  jsonb;
begin
  -- stage map — ต้องตรงกับ scan_advance / lib/staff.ts (แก้ที่ไหนแก้ให้ครบทุกที่)
  select m.l, m.s into v_label, v_status from (values
    ('cut','ตัด','ตัดผ้าแล้ว'),
    ('sew','เย็บ','เย็บแล้ว'),
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

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  -- คนเดิมกดซ้ำ (สแกนซ้ำเครื่องเดียวกัน) → ไม่ต้องบันทึกเพิ่ม กันนับผลงานซ้ำในหน้าวิเคราะห์ข้อมูล
  if exists (
    select 1 from production_scans
     where order_number = v_scan_no and stage = v_label and tech_code = p_tech_code
  ) then
    return jsonb_build_object('ok', false, 'result', 'dup_self', 'stage', v_label);
  end if;

  -- ‼️ ไม่แตะ order_status / work_status — คนช่วยไม่ได้เดินสถานะ แค่บันทึกว่าร่วมทำขั้นนี้
  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at, is_helper)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now, true);

  -- ต่อประวัติสถานะ: เขียนเป็นรายการ "ช่วยทำ" (helper = true) เพื่อให้โฟลเดอร์ลูกค้า/ประวัติเห็นว่ามีใครช่วย
  v_hist := coalesce(o.status_history, '[]'::jsonb);
  if jsonb_typeof(v_hist) <> 'array' then v_hist := '[]'::jsonb; end if;
  update order_entries
     set status_history = v_hist || jsonb_build_object(
           'status', v_status, 'at', v_iso, 'by', p_tech_name, 'helper', true),
         updated_at = v_now
   where id = o.id;

  -- รายชื่อทุกคนที่ทำขั้นนี้ (คนเดินสถานะ + คนช่วย) เรียงตามเวลาสแกน
  select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
    from production_scans t where t.order_number = v_scan_no and t.stage = v_label;

  return jsonb_build_object('ok', true, 'result', 'joined',
    'stage', v_label, 'status', v_status, 'at', v_iso, 'people', v_people);
end;
$$;

grant execute on function public.scan_join(uuid, text, text, text, text) to anon, authenticated;

-- ===== 3) scan_advance: ตอนตอบ 'already' ให้บอกด้วยว่าขั้นนี้ใครสแกนไปแล้วบ้าง =====
-- (เหมือนเดิมทุกอย่าง เปลี่ยนเฉพาะก้อน return ของ 'already')
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
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
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

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  if p_stage_key = 'rail_pack' then
    update order_entries set rail_packed = true, rail_packed_at = v_now, updated_at = v_now where id = o.id;
    insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
      values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);
    return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
  end if;

  if p_stage_key = 'shipped' then
    update order_entries
      set order_status = v_status, shipped_at = v_now, is_urgent = true, updated_at = v_now
      where id = o.id;
  else
    -- ด่านกันข้ามขั้น: เดินหน้าได้อย่างเดียว
    if coalesce(array_position(flow, o.order_status), 0) >= array_position(flow, v_status) then
      -- บอกกลับไปด้วยว่าขั้นของคนที่สแกนนี้ มีใครสแกนไปแล้วบ้าง → หน้าเว็บถามต่อว่าจะลงชื่อช่วยไหม
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

-- ===== 4) scan_undo: ถ้าแถวล่าสุดเป็น "คนช่วย" ให้ลบแค่แถวนั้น ห้ามถอยสถานะ =====
-- (ไม่งั้นคนช่วยกดยกเลิก แล้วสถานะออเดอร์ถอยหลังทั้งที่ขั้นนั้นทำเสร็จจริง)
create or replace function public.scan_undo(
  p_order_id     uuid,
  p_scanned_term text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
  o          record;
  v_now      timestamptz := now();
  v_scan_no  text;
  v_stage    text;
  v_helper   boolean;
  v_ctid     tid;
  v_idx      int;
  v_prev     text;
  v_hist     jsonb;
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

  if v_helper then
    -- ยกเลิกการ "ลงชื่อช่วย" — ลบแถว log + ตัดรายการ helper ท้ายสุดออกจากประวัติ สถานะออเดอร์คงเดิม
    v_hist := coalesce(o.status_history, '[]'::jsonb);
    if jsonb_typeof(v_hist) = 'array' and jsonb_array_length(v_hist) > 0
       and (v_hist -> -1 ->> 'helper') = 'true' then
      update order_entries set status_history = v_hist - (jsonb_array_length(v_hist) - 1) where id = o.id;
    end if;
    delete from production_scans where ctid = v_ctid;
    return jsonb_build_object('ok', true, 'result', 'undone', 'status', o.order_status, 'helper', true);
  end if;

  if v_stage = 'แพ็คราง' then
    update order_entries set rail_packed = false, rail_packed_at = null, updated_at = v_now where id = o.id;
    v_prev := o.order_status;
  else
    v_idx := array_position(flow, o.order_status);
    if v_idx is null or v_idx <= 1 then
      v_prev := 'รอดำเนินการ';
    else
      v_prev := flow[v_idx - 1];
    end if;

    if o.order_status = 'จัดส่งแล้ว' then
      update order_entries set order_status = v_prev, shipped_at = null, updated_at = v_now where id = o.id;
    else
      update order_entries set order_status = v_prev, updated_at = v_now where id = o.id;
    end if;

    update work_status set status = v_prev, status_updated_at = v_now
      where lower(order_number) = lower(coalesce(nullif(o.order_number, ''), '~ไม่มี~'))
         or lower(order_number) = lower(coalesce(nullif(o.customer_name, ''), '~ไม่มี~'));

    v_hist := coalesce(o.status_history, '[]'::jsonb);
    if jsonb_typeof(v_hist) = 'array' and jsonb_array_length(v_hist) > 0 then
      update order_entries set status_history = v_hist - (jsonb_array_length(v_hist) - 1) where id = o.id;
    end if;
  end if;

  delete from production_scans where ctid = v_ctid;

  return jsonb_build_object('ok', true, 'result', 'undone', 'status', v_prev);
end;
$$;

grant execute on function public.scan_undo(uuid, text) to anon, authenticated;
