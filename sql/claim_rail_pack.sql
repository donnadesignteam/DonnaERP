-- ════════════════════════════════════════════════════════════════════════════
-- งานเคลม: แผนก "แพ็คราง" สแกนได้ + คอลัมน์สถานะราง (2026-10-01)
-- รันใน Supabase → SQL Editor → กด Run (รันซ้ำได้ ไม่พัง) — แทนที่ claim_scan_advance / claim_scan_join / claim_scan_undo เดิม
--
-- ที่มา: สแกนใบเคลมด้วยแผนกแพ็คราง ขึ้น "งานเคลมไม่มีขั้นนี้" (bad_stage) เพราะสายงานเคลมไม่มีขั้นแพ็คราง
-- ทำแบบเดียวกับหมวดออเดอร์: แพ็คราง = ติ๊ก rail_packed อย่างเดียว ไม่เปลี่ยนสถานะสายผลิต (claims.status)
-- ════════════════════════════════════════════════════════════════════════════

alter table claims add column if not exists rail_packed    boolean not null default false;
alter table claims add column if not exists rail_packed_at timestamptz;

-- ===== 1) เดินสถานะงานเคลม (ของเดิมใน sql/add_assistant_stage_claims.sql + ขั้นแพ็คราง) =====
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

-- ===== 2) ลงชื่อช่วยทำขั้นนี้ (ไม่เดินสถานะ) + ขั้นแพ็คราง =====
create or replace function public.claim_scan_join(
  p_claim_id  uuid,
  p_stage_key text,
  p_tech_code text,
  p_tech_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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

  if exists (
    select 1 from production_scans
     where order_number = v_scan_no and stage = v_label and tech_code = p_tech_code
  ) then
    return jsonb_build_object('ok', false, 'result', 'dup_self', 'stage', v_label);
  end if;

  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at, is_helper)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now, true);

  select coalesce(jsonb_agg(t.tech_name order by t.scanned_at), '[]'::jsonb) into v_people
    from production_scans t where t.order_number = v_scan_no and t.stage = v_label;

  return jsonb_build_object('ok', true, 'result', 'joined',
    'stage', v_label, 'status', v_status, 'at', v_iso, 'people', v_people);
end;
$$;

grant execute on function public.claim_scan_join(uuid, text, text, text) to anon, authenticated;

-- ===== 3) ยกเลิกสแกนล่าสุด (ของเดิมใน sql/claim_scan_undo.sql + ขั้นแพ็คราง) =====
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

  v_idx := array_position(flow, c.status);
  v_prev := case when v_idx is null or v_idx <= 1 then 'รอของคืน' else flow[v_idx - 1] end;

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
