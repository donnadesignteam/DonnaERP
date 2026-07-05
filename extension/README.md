# Donna Track — extension เช็คสถานะพัสดุ

ตัวช่วยของ donnaweb: หน้าเว็บสั่งเช็คเลขพัสดุ → extension เปิดแท็บเบื้องหลังไปหน้า tracking ของขนส่ง
→ ดึงสถานะ/timeline กลับมาให้หน้าเว็บบันทึกลง Supabase (เครื่องไหนลง extension ไว้ เครื่องนั้นเช็คได้เลย ไม่ต้องมีเครื่องเปิดทิ้งไว้)

## วิธีติดตั้ง (ทำครั้งเดียวต่อเครื่อง)

1. เปิด Chrome ไปที่ `chrome://extensions`
2. เปิดสวิตช์ **Developer mode** (มุมขวาบน)
3. กด **Load unpacked** → เลือกโฟลเดอร์ `extension` นี้
4. เสร็จแล้ว — เปิด donnaweb แล้วระบบเช็คสถานะอัตโนมัติจะทำงาน

**อัปเดตโค้ด extension แล้ว:** ไปที่ `chrome://extensions` → กดปุ่มรีโหลด (↻) ที่การ์ด Donna Track

## เจ้าที่รองรับ

| เจ้า | วิธีเช็ค |
|---|---|
| Flash Express | extension (แท็บเบื้องหลัง) |
| J&T Express | extension (แท็บจริง — J&T มีสไลด์ captcha ต้องเลื่อนเอง 1 ครั้ง แล้วแท็บปิดเอง) |
| SPX Express | ไม่ใช้ extension — API ตรงผ่าน `/api/track-spx` |
| Kerry Express | extension (แท็บเบื้องหลัง) — เว็บ Kerry กันหนัก อาจ timeout บ้าง |
| ไปรษณีย์ไทย | ไม่ใช้ extension — API ทางการผ่าน `/api/track-thailandpost` (ต้องตั้ง `THAILANDPOST_API_TOKEN`) |
| LEX TH / อื่นๆ | เช็คอัตโนมัติไม่ได้ — ปุ่ม "เปิดเว็บขนส่ง" |

## การทำงาน

- เช็คทีละเลข ใช้เวลาราวๆ 5–15 วินาทีต่อเลข (Flash ต้องรอผ่าน anti-bot เพิ่ม)
- URL หน้า tracking ของแต่ละเจ้าอยู่ที่ฝั่งเว็บ (`CARRIER_TRACK_URL` ใน OrderWorkspace.tsx) — extension เปิดตามที่เว็บส่งมา (จำกัด host ใน allowlist ของ background.js)
- ตัวแกะข้อมูล (`scraper.js`) เดาโครง JSON แบบกว้าง ไม่ผูกกับ field ตายตัว — ถ้าเจ้าไหนเช็คไม่ขึ้น ให้เปิดหน้า tracking เจ้านั้นเอง ดู JSON จริงใน DevTools → Network แล้วมาปรับ regex ใน `extractEvents()`
