-- RPC ยกเลิกการสแกนล่าสุดของออเดอร์ (undo) — คู่กับ scan_advance
-- ใช้ตอนสแกนผิด (ผิดออเดอร์/ผิดขั้น) จะได้กดย้อนจากมือถือได้เอง ไม่ต้องรอแอดมิน
-- ทำใน transaction เดียว all-or-nothing เหมือน scan_advance:
--   ถอยสถานะกลับหนึ่งขั้น + sync กระดานงาน + ตัดประวัติสถานะรายการล่าสุด + ลบแถว log สแกนล่าสุด
--
-- รันใน Supabase → SQL Editor (ก๊อปจากไฟล์ ไม่ใช่จากแชท กันตัวอักษรเพี้ยน)

create or replace function public.scan_undo(
  p_order_id     uuid,           -- order_entries.id
  p_scanned_term text default '' -- เลขที่อ่านได้จาก QR (fallback ตอน order_number ว่าง) — ให้ match production_scans ตัวเดียวกับ scan_advance
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ลำดับสถานะงานผลิต — ต้องตรงกับ PROD_STATUS_FLOW ใน lib/staff.ts และ scan_advance
  flow constant text[] := array['รอดำเนินการ','ตัดผ้าแล้ว','เย็บแล้ว','รีดแล้ว','แพ็คแล้ว','รอจัดส่ง','จัดส่งแล้ว'];
  o          record;
  v_now      timestamptz := now();
  v_scan_no  text;
  v_stage    text;
  v_ctid     tid;
  v_idx      int;
  v_prev     text;
  v_hist     jsonb;
begin
  -- ล็อกแถวกันชนกับสแกนอื่น
  select * into o from order_entries where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'result', 'not_found');
  end if;

  v_scan_no := coalesce(nullif(o.order_number, ''), nullif(p_scanned_term, ''), 'id:' || o.id::text);

  -- หาแถวสแกนล่าสุดของออเดอร์นี้ (ใช้ ctid เพราะ production_scans อาจไม่มี primary key)
  select stage, ctid into v_stage, v_ctid
    from production_scans where order_number = v_scan_no
    order by scanned_at desc limit 1;
  if v_stage is null then
    return jsonb_build_object('ok', false, 'result', 'no_scan');
  end if;

  if v_stage = 'แพ็คราง' then
    -- undo แพ็คราง: ปลดธง ไม่แตะสถานะหลัก (ตรงข้ามกับ scan_advance ขั้น rail_pack)
    update order_entries set rail_packed = false, rail_packed_at = null, updated_at = v_now where id = o.id;
    v_prev := o.order_status;
  else
    -- ถอยสถานะกลับหนึ่งขั้นตามสายงาน
    v_idx := array_position(flow, o.order_status);
    if v_idx is null or v_idx <= 1 then
      v_prev := 'รอดำเนินการ';
    else
      v_prev := flow[v_idx - 1];
    end if;

    if o.order_status = 'จัดส่งแล้ว' then
      -- undo จัดส่ง: ล้างเวลาจัดส่งด้วย
      update order_entries set order_status = v_prev, shipped_at = null, updated_at = v_now where id = o.id;
    else
      update order_entries set order_status = v_prev, updated_at = v_now where id = o.id;
    end if;

    -- sync กระดานงานกลับ (เทียบตรงตัวเหมือน scan_advance)
    update work_status set status = v_prev, status_updated_at = v_now
      where lower(order_number) = lower(coalesce(nullif(o.order_number, ''), '~ไม่มี~'))
         or lower(order_number) = lower(coalesce(nullif(o.customer_name, ''), '~ไม่มี~'));

    -- ตัดประวัติสถานะรายการสุดท้ายทิ้ง (best-effort)
    v_hist := coalesce(o.status_history, '[]'::jsonb);
    if jsonb_typeof(v_hist) = 'array' and jsonb_array_length(v_hist) > 0 then
      update order_entries set status_history = v_hist - (jsonb_array_length(v_hist) - 1) where id = o.id;
    end if;
  end if;

  -- ลบแถว log สแกนล่าสุด
  delete from production_scans where ctid = v_ctid;

  return jsonb_build_object('ok', true, 'result', 'undone', 'status', v_prev);
end;
$$;

grant execute on function public.scan_undo(uuid, text) to anon, authenticated;
