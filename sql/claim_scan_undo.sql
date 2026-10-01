-- ════════════════════════════════════════════════════════════════════════════
-- ยกเลิกสแกนล่าสุดของ "งานเคลม" (2026-10-01)
-- รันใน Supabase → SQL Editor → กด Run (รันซ้ำได้ ไม่พัง)
--
-- ที่มา: ปุ่ม "ยกเลิก (สแกนผิด)" ในหน้าสแกนเรียก scan_undo ของออเดอร์ (หาในตาราง order_entries)
--        พอเป็นใบเคลมเลยหาไม่เจอ → ขึ้น "เกิดข้อผิดพลาด not_found"
-- ฟังก์ชันนี้ทำแบบเดียวกับ scan_undo แต่กับตาราง claims (สายงานเดียวกับ sql/add_assistant_stage_claims.sql)
-- ════════════════════════════════════════════════════════════════════════════

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

  -- คนที่ลงชื่อช่วยทำ → ลบแค่ชื่อ ไม่ถอยสถานะ
  if v_helper then
    delete from production_scans where ctid = v_ctid;
    return jsonb_build_object('ok', true, 'result', 'undone', 'status', c.status, 'helper', true);
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
