-- พัสดุส่งกลับ: ช่องรายการเปลี่ยนจากข้อความ → JSON array แบบเดียวกับออเดอร์
-- ใบเก่าที่เป็นข้อความ: แยกบรรทัดละ 1 รายการ (ข้อความเดิมอยู่ในช่องประเภท) · ที่บันทึกเป็นข้อความ JSON ไว้แล้ว แปลงตรงๆ
-- (alter ... using ใช้ subquery ไม่ได้ → ทำคอลัมน์ใหม่ เติมข้อมูล แล้วสลับชื่อแทน)
begin;

alter table return_parcels add column items_new jsonb;

update return_parcels set items_new = case
  when items is null or btrim(items) = '' then null
  when btrim(items) like '[%' then items::jsonb
  else (
    select jsonb_agg(jsonb_build_object('type', btrim(l), 'quantity', '', 'unit', ''))
    from unnest(string_to_array(replace(items, E'\r', ''), E'\n')) as l
    where btrim(l) <> ''
  )
end;

alter table return_parcels drop column items;
alter table return_parcels rename column items_new to items;

commit;

notify pgrst, 'reload schema';
