-- ════════════════════════════════════════════════════════════════════
-- ตรวจสอบ RLS ทุกตารางใน schema public
-- รันใน Supabase → SQL Editor → ดูผลในตาราง
-- rls_enabled = false คือตารางที่ "เปิดโล่ง" (anon key อ่าน/เขียนได้ตรงๆ จาก browser)
-- ════════════════════════════════════════════════════════════════════

select
  c.relname                                   as table_name,
  c.relrowsecurity                            as rls_enabled,   -- ต้องเป็น true ทุกตาราง
  coalesce(p.policy_count, 0)                 as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select schemaname, tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
) p on p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'          -- ตารางจริงเท่านั้น
order by c.relrowsecurity asc, c.relname;   -- ตารางที่ปิด RLS โผล่ขึ้นก่อน
