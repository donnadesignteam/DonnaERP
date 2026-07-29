-- ════════════════════════════════════════════════════════════════════════════
-- สแกน QR ใบเคลม → เดินสถานะงานเคลม (2026-07-29)
-- คู่กับ sql/scan_helpers.sql ของหมวดออเดอร์ แต่ทำงานกับตาราง claims แทน order_entries
--
-- ‼️ รันไฟล์นี้ใน Supabase → SQL Editor "ก่อน" ใช้ QR บนใบเคลม (รันซ้ำได้ ไม่พัง)
--
-- สายงานเคลม: รอของคืน → ตัดผ้าแล้ว → เย็บแล้ว → รีดแล้ว → แพ็คแล้ว → ส่งแล้ว
--   (ชุดเดียวกับ WORKFLOW ใน components/ClaimsWorkspace.tsx — แก้ที่ไหนต้องแก้ให้ตรงกัน)
--
-- การบันทึกผลงาน: ลง production_scans เหมือนออเดอร์ปกติ แต่ order_number = 'claim:<uuid>'
--   → นับผลงานช่าง/หน้าวิเคราะห์ได้เหมือนกัน และไม่ชนกับเลขออเดอร์จริง
-- ════════════════════════════════════════════════════════════════════════════

-- ===== 1) เดินสถานะงานเคลม =====
create or replace function public.claim_scan_advance(
  p_claim_id  uuid,
  p_stage_key text,   -- cut | sew | iron | pack | shipped
  p_tech_code text,
  p_tech_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  flow constant text[] := array['รอของคืน','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','ส่งแล้ว'];
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
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
    ('shipped','จัดส่งแล้ว','ส่งแล้ว')
  ) as m(k, l, s) where m.k = p_stage_key;
  if v_status is null then
    -- แผนกที่ไม่มีในสายงานเคลม (เช่น แพ็คราง) — บอกกลับไปให้หน้าเว็บแจ้งช่าง
    return jsonb_build_object('ok', false, 'result', 'bad_stage');
  end if;

  select * into c from claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_scan_no := 'claim:' || c.id::text;

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


-- ===== 2) ลงชื่อช่วยทำขั้นนี้ (ไม่เดินสถานะ) =====
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
    ('iron','รีด','รีดแล้ว'),
    ('pack','แพ็ค','แพ็คแล้ว'),
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

  -- คนเดิมสแกนซ้ำ → ไม่บันทึกซ้ำ กันนับผลงานเกินจริง
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

-- ════════════════════════════════════════════════════════════════════════════
-- เสร็จ — ปริ้นใบเคลมจะมี QR ให้ทีมผลิตสแกนเดินสถานะได้เหมือนใบออเดอร์
-- ════════════════════════════════════════════════════════════════════════════
