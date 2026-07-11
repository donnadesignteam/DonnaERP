-- RPC สแกนอัปเดตสถานะผลิต — รวม 4 การบันทึกไว้ใน transaction เดียว
-- (เดิมหน้า /scan ยิง 4 คำสั่งแยกจากมือถือ: อัปเดต order_entries → sync work_status
--  → insert production_scans → ต่อ status_history โดย 3 ตัวหลังกลืน error เงียบ
--  เน็ตสะดุดแล้วพนักงานเห็น ✅ แต่ log หาย)
-- หลังรันไฟล์นี้: สำเร็จ = บันทึกครบทุกตาราง / ล้มเหลว = ไม่บันทึกอะไรเลย + โชว์ error ให้สแกนซ้ำ
--
-- แถมแก้การ sync work_status จากเดิม ilike %ชื่อลูกค้า% (จับผิดแถวได้) → เทียบตรงตัวเท่านั้น
--
-- รันใน Supabase → SQL Editor (ต้องรัน "ก่อน" deploy โค้ดหน้า /scan เวอร์ชันใหม่)

create or replace function public.scan_advance(
  p_order_id     uuid,   -- order_entries.id (หน้าเว็บหาออเดอร์เจอแล้วค่อยเรียก)
  p_stage_key    text,   -- cut | sew | iron | pack | rail_pack | shipped (ตรงกับ lib/staff.ts)
  p_tech_code    text,   -- รหัสพนักงานที่สแกน เช่น DN003
  p_tech_name    text,   -- ชื่อที่โชว์ เช่น "ดาว (DN003)"
  p_scanned_term text default ''  -- เลขออเดอร์ที่อ่านได้จาก QR (ใช้เป็น fallback ตอน order_number ว่าง)
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ลำดับสถานะงานผลิต — ต้องตรงกับ PROD_STATUS_FLOW ใน lib/staff.ts
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
  v_label  text;
  v_status text;
  o        record;
  v_now    timestamptz := now();
  v_iso    text;   -- เวลา ISO แบบเดียวกับที่หน้าเว็บเคยเขียน (หน้าวิเคราะห์ข้อมูล parse รูปแบบนี้)
  v_scan_no text;
  v_hist   jsonb;
begin
  -- map แผนก → ป้าย + สถานะที่จะตั้ง (ตรงกับ STAGES + SPECIAL_STAGES ใน lib/staff.ts / app/scan)
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

  -- ล็อกแถวกันสแกนชนกัน 2 เครื่องพร้อมกัน
  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  -- เลขที่ลง production_scans — ห้ามว่าง (ตรรกะเดิมของ scanOrderNo ในหน้าเว็บ)
  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  -- ===== งานพิเศษ: แพ็คราง — ติ๊ก rail_packed + log สแกน (ไม่แตะสถานะหลัก ตามเดิม) =====
  if p_stage_key = 'rail_pack' then
    update order_entries set rail_packed = true, rail_packed_at = v_now, updated_at = v_now where id = o.id;
    insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
      values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);
    return jsonb_build_object('ok', true, 'result', 'done', 'status', v_status, 'at', v_iso);
  end if;

  if p_stage_key = 'shipped' then
    -- จัดส่งแล้ว: ไม่ผ่านด่านกันข้ามขั้น (ตามเดิม)
    update order_entries
      set order_status = v_status, shipped_at = v_now, is_urgent = true, updated_at = v_now
      where id = o.id;
  else
    -- ด่านกันข้ามขั้น: เดินหน้าได้อย่างเดียว (ตรรกะเดียวกับ canAdvance ใน lib/staff.ts)
    if coalesce(array_position(flow, o.order_status), 0) >= array_position(flow, v_status) then
      return jsonb_build_object('ok', false, 'result', 'already',
        'current_status', coalesce(nullif(o.order_status, ''), 'รอดำเนินการ'));
    end if;
    update order_entries set order_status = v_status, updated_at = v_now where id = o.id;
  end if;

  -- sync กระดานสถานะงาน (work_status) — เทียบตรงตัวไม่สนตัวพิมพ์ ไม่ใช้ %contains% แล้ว
  -- (บางแถวเก่าใส่ชื่อลูกค้าในช่อง order_number เลยเทียบกับชื่อลูกค้าด้วย)
  update work_status set status = v_status, status_updated_at = v_now
    where lower(order_number) = lower(coalesce(nullif(o.order_number, ''), '~ไม่มี~'))
       or lower(order_number) = lower(coalesce(nullif(o.customer_name, ''), '~ไม่มี~'));

  -- log การสแกน (หน้าวิเคราะห์ข้อมูลใช้คำนวณผลงานพนักงาน)
  insert into production_scans (order_number, stage, status, tech_code, tech_name, scanned_at)
    values (v_scan_no, v_label, v_status, p_tech_code, p_tech_name, v_now);

  -- ต่อประวัติสถานะ (ข้ามถ้าสถานะล่าสุดซ้ำ — ตรรกะเดิมของ logHistory)
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

-- เว็บฝั่ง client เรียกด้วย anon key
grant execute on function public.scan_advance(uuid, text, text, text, text) to anon, authenticated;
