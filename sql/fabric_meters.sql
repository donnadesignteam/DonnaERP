-- ════════════════════════════════════════════════════════════════════════════
-- "ช่างตัดผ้าไปกี่เมตร" — เก็บเมตรที่ตัดไว้กับแถวสแกนของแผนกตัด
--
-- ทำไมเก็บกับ production_scans (ไม่สร้างตารางใหม่):
--   · แถวสแกนผูกกับ "ใครสแกน + ออเดอร์ไหน + เมื่อไหร่" อยู่แล้ว
--   · ยกเลิกสแกน (scan_undo) ลบแถวทิ้ง → เมตรหายตามอัตโนมัติ ไม่ต้องตามลบ
--   · ตัวเลขนิ่งตั้งแต่ตอนสแกน ถึงจะไปแก้รายการสินค้าย้อนหลังก็ไม่กระทบผลงานช่าง
--
-- ‼️ รันไฟล์นี้ใน Supabase → SQL Editor "ก่อน" ใช้หน้า /scan ตัวใหม่ (รันซ้ำได้)
-- ════════════════════════════════════════════════════════════════════════════

-- ===== 1) คอลัมน์เก็บเมตร + วิธีคิด =====
alter table production_scans add column if not exists meters      numeric;
alter table production_scans add column if not exists meters_calc jsonb;

comment on column production_scans.meters is 'เมตรผ้าที่คนนี้ตัดในออเดอร์นี้ (คิดจาก lib/fabricUsage.ts ตอนสแกน)';
comment on column production_scans.meters_calc is 'รายละเอียดการคิด: {total, lines:[{i,type,width,qty,rule,meters}], warns:[]}';

create index if not exists production_scans_stage_time_idx on production_scans (stage, scanned_at desc);

-- ===== 2) RPC บันทึกเมตรของขั้น "ตัด" ทั้งออเดอร์ในครั้งเดียว =====
-- p_rows = [{"tech_code":"DN003","meters":12.5,"calc":{...}}, ...]
-- ใช้ตอนช่างช่วยกันตัด: คนที่ 2 เลือกว่าตัดรายการไหน → เมตรของ "ทุกคน" ในออเดอร์นี้ถูกเขียนใหม่พร้อมกัน
-- (เว็บคำนวณให้ครบทุกคนแล้วส่งมาทีเดียว จะได้ไม่มีทางนับซ้ำ)
create or replace function public.set_cut_meters(
  p_scan_no text,
  p_rows    jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r         jsonb;
  v_updated int := 0;
  v_hit     int;
begin
  if p_scan_no is null or p_scan_no = '' then
    return jsonb_build_object('ok', false, 'result', 'bad_scan_no');
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'result', 'bad_rows');
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    update production_scans
       set meters      = nullif(r->>'meters', '')::numeric,
           meters_calc = r->'calc'
     where order_number = p_scan_no
       and stage        = 'ตัด'
       and tech_code    = r->>'tech_code';
    get diagnostics v_hit = row_count;
    v_updated := v_updated + v_hit;
  end loop;

  return jsonb_build_object('ok', true, 'updated', v_updated);
end;
$$;

grant execute on function public.set_cut_meters(text, jsonb) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- เสร็จ — สแกนขั้น "ตัด" ครั้งต่อไปจะบันทึกเมตรเอง
-- ดูผลได้ที่ พนักงาน → ยอดตัดผ้า (/staff/cutting)
-- ════════════════════════════════════════════════════════════════════════════
