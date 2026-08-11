import { NextRequest, NextResponse } from 'next/server'

// อ่านข้อความจากไฟล์ PDF (ใบเสนอราคาที่ระบบร้านออกให้) → ส่งข้อความกลับให้หน้าเว็บเอาไปเข้าตัวแปลงข้อความต่อ
// แยกเป็น 2 ขั้น (ดึงข้อความ → แปลง) เพราะถูกกว่าส่ง PDF ทั้งไฟล์เข้า AI และแอดมินเห็นข้อความก่อนกดแปลงได้
export const maxDuration = 60

// ฟอนต์ในใบเสนอราคาทำให้ข้อความที่ดึงออกมาเพี้ยน 3 แบบ — ล้างก่อนส่งเข้า AI จะแม่นขึ้นมาก
const cleanPdfText = (raw: string) =>
  raw
    .replace(/ำา/g, 'ำ')                        // สระอำ ออกมาเป็น "ำ" + "า" ซ้อนกัน (จำานวน → จำนวน)
    .replace(/(\d)\s+([.,])\s*(\d)/g, '$1$2$3')  // ตัวเลขมีช่องว่างคั่นจุด/ลูกน้ำ (1 .70 → 1.70 · 2 ,675 → 2,675)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'ไม่มีไฟล์' }, { status: 400 })
  if (!/\.pdf$/i.test(file.name)) return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ .pdf' }, { status: 400 })

  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: true })
    const cleaned = cleanPdfText(String(text ?? ''))
    if (!cleaned) return NextResponse.json({ error: 'อ่านข้อความจากไฟล์นี้ไม่ได้ (อาจเป็นไฟล์สแกนเป็นรูป)' }, { status: 400 })
    return NextResponse.json({ text: cleaned })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ' }, { status: 500 })
  }
}
