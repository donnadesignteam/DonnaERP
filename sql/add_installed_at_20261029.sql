-- 29ต.ค.69 ยอดติดตั้งนับตามวันที่ติดตั้งเสร็จจริง (installed_at) แทนเดือนวันนัด
-- ‼️ ลำดับรัน: fix_installed_status_20261029.sql ก่อน แล้วค่อยไฟล์นี้ (ไม่งั้น trigger ประทับวันนี้ให้ใบเก่าที่เพิ่งเปลี่ยนเป็น ติดตั้งเสร็จ — 29ต.ค. แก้ด้วย set installed_at = appointment_datetime แล้ว)
-- trigger ประทับเวลาเองทุกทางที่เปลี่ยนเป็น ติดตั้งเสร็จ (เว็บคอม/มือถือ/หมวดออเดอร์/บอท) · เปลี่ยนออกจาก ติดตั้งเสร็จ = ล้าง

alter table installations add column if not exists installed_at timestamptz;

create or replace function set_installed_at() returns trigger language plpgsql as $$
begin
  if new.installation_status = 'ติดตั้งเสร็จ' then
    if tg_op = 'INSERT' or old.installation_status is distinct from 'ติดตั้งเสร็จ' then
      new.installed_at := coalesce(new.installed_at, now());
    end if;
  else
    new.installed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_set_installed_at on installations;
create trigger trg_set_installed_at before insert or update of installation_status on installations
  for each row execute function set_installed_at();

-- งานเก่าที่เสร็จแล้ว: ใช้วันนัดเดิม (ยอดเดือนเก่าไม่เปลี่ยน)
update installations set installed_at = appointment_datetime
where installation_status = 'ติดตั้งเสร็จ' and installed_at is null and appointment_datetime is not null;

-- ยอดตุลาที่ user ส่งมา 29ต.ค.69: ใบที่วันนัดไม่อยู่ในตุลา → ย้ายเข้าตุลา
update installations set installed_at = '2026-10-29T09:00:00+07:00' where serial_no in ('0141', '0120');  -- T-Ra (นัด 29ก.ย.) · Custard Apple 92 (ตกหล่น นัด 21ก.ย.)
update installations set installed_at = '2026-10-06T09:57:00+07:00' where serial_no = '0142';             -- ปักกิ่ง (ไม่มีวันนัด ใช้วันติ๊กงานเสร็จ)
