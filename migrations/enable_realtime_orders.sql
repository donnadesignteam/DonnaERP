-- เปิด Realtime ให้ตารางออเดอร์ (รันใน Supabase SQL editor)
-- ถ้าขึ้น error ว่าเป็นสมาชิกอยู่แล้ว = เปิดไว้แล้ว ไม่ต้องทำอะไร
alter publication supabase_realtime add table order_entries;
