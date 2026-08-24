# เปิดไฟล์ SQL ที่ค้างอยู่ → คัดลอกใส่คลิปบอร์ดของเครื่องนี้ → เปิดหน้า SQL Editor ของ Supabase ให้เลย
# ใช้ตอนรีโมทเข้ามาจากไอแพด/มือถือ แล้วกด copy จากในแชทไม่ได้ — เปิดไฟล์นี้แล้วกด Ctrl+V ในหน้าเว็บอย่างเดียว
# เรียกผ่าน "รัน SQL.bat" (ดับเบิลคลิก) ไม่ต้องพิมพ์คำสั่งเอง

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRef = 'cdraaxrczmqiljiswqwn'
$editorUrl = "https://supabase.com/dashboard/project/$projectRef/sql/new"

$files = @(Get-ChildItem -Path $dir -Filter *.sql | Sort-Object LastWriteTime -Descending)
if ($files.Count -eq 0) {
  Write-Host "ไม่เจอไฟล์ .sql ในโฟลเดอร์นี้" -ForegroundColor Yellow
  return
}

Write-Host ""
Write-Host "  ไฟล์ SQL ในโฟลเดอร์ sql (ใหม่สุดอยู่บน)" -ForegroundColor Cyan
Write-Host "  ----------------------------------------"
for ($i = 0; $i -lt $files.Count; $i++) {
  $f = $files[$i]
  $no = ($i + 1).ToString().PadLeft(2)
  $when = $f.LastWriteTime.ToString('dd/MM/yyyy HH:mm')
  Write-Host ("  [{0}] {1}" -f $no, $f.Name) -NoNewline
  Write-Host ("   ({0})" -f $when) -ForegroundColor DarkGray
}
Write-Host ""

$pick = Read-Host "  พิมพ์เลขไฟล์ที่จะรัน แล้วกด Enter (ไม่พิมพ์อะไร = ไฟล์ใหม่สุด)"
if ([string]::IsNullOrWhiteSpace($pick)) { $idx = 0 }
elseif ($pick -match '^\d+$' -and [int]$pick -ge 1 -and [int]$pick -le $files.Count) { $idx = [int]$pick - 1 }
else {
  Write-Host "  เลขไม่ถูกต้อง — ยกเลิก" -ForegroundColor Yellow
  return
}

$file = $files[$idx]
$sql = Get-Content -Path $file.FullName -Raw -Encoding UTF8
Set-Clipboard -Value $sql

Write-Host ""
Write-Host ("  คัดลอก {0} ใส่คลิปบอร์ดแล้ว" -f $file.Name) -ForegroundColor Green
Write-Host "  กำลังเปิดหน้า SQL Editor ของ Supabase ..." -ForegroundColor Green
Start-Process $editorUrl

Write-Host ""
Write-Host "  ต่อไปทำแค่นี้:" -ForegroundColor Cyan
Write-Host "    1) คลิกในช่องเขียน SQL"
Write-Host "    2) กด Ctrl+V"
Write-Host "    3) กดปุ่ม Run (หรือ Ctrl+Enter)"
Write-Host ""
