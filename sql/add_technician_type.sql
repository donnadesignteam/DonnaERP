-- ============================================================================
-- คอลัมน์ "ช่าง" ในปฏิทินงานติดตั้ง (5 ส.ค. 2569)
--   ช่างร้าน / ช่างนอก — โซนกทมเว็บเติม "ช่างนอก" ให้เอง เชียงราย/เชียงใหม่ เลือกเอง
--   รันซ้ำได้ ปลอดภัย
-- ============================================================================

ALTER TABLE installations ADD COLUMN IF NOT EXISTS technician_type text;

-- งานเก่าโซนกทมที่ยังไม่มีค่า → ตั้งเป็นช่างนอกให้เลย (ตามกติกาที่ตกลงกัน)
UPDATE installations
   SET technician_type = 'ช่างนอก', updated_at = now()
 WHERE install_zone = 'กทม'
   AND COALESCE(technician_type, '') = '';

-- เช็กผล
SELECT install_zone, COALESCE(NULLIF(technician_type, ''), '(ยังไม่ระบุ)') AS ช่าง, count(*)
  FROM installations
 GROUP BY 1, 2
 ORDER BY 1, 2;
