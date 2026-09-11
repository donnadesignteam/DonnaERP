// จุดเดียวที่คุยกับ Claude สำหรับ route แปลงข้อความทั้งหมด (parse-order / parse-items / parse-claim / parse-po / parse-installation)
//
// มี 2 ทาง เลือกด้วย env:
//   1) CLAUDE_BRIDGE_URL  -> ยิงไปที่ "สะพาน" บนเครื่องที่ร้าน ซึ่งเรียก claude CLI (ใช้โควตา Claude Max)
//                            ใช้ชั่วคราวตอนเครดิต Anthropic API หมด — ช้ากว่า (~20-45 วิ)
//   2) ANTHROPIC_API_KEY  -> ยิง Anthropic API ตรง (ทางปกติ เร็วกว่า)
// ถ้าตั้ง CLAUDE_BRIDGE_URL ไว้จะใช้สะพานก่อนเสมอ ลบ env ตัวนี้ทิ้งเมื่อเติมเครดิตแล้ว

const MODEL = 'claude-haiku-4-5-20251001'

// ── Prompt caching ──
// กติกาแปลงรายการ (~8-11K token) เหมือนกันทุกครั้ง แต่เดิมส่งเต็มราคาทุกรอบ = ~85% ของค่า API
// ส่งกติกาเป็น cachePrefix → Anthropic จำไว้ 1 ชม. (อ่านซ้ำคิด 10% · เขียนครั้งแรก 2 เท่า · ทุกครั้งที่อ่านต่ออายุอีก 1 ชม.)
// ‼️ cachePrefix ต้องเป็นข้อความตายตัว ห้ามมีวันที่/ชื่อลูกค้า/ข้อความออเดอร์ปน ไม่งั้นไม่มีวันตรงกัน
// ‼️ Haiku 4.5 จำได้เฉพาะก้อน ≥ 4096 token — route ที่พรอมป์สั้นกว่านี้ (claim/installation/po) ไม่ต้องใช้
// ปิดฉุกเฉิน: ตั้ง env CLAUDE_PROMPT_CACHE=off → กลับไปส่งแบบเดิม
const cacheOn = () => process.env.CLAUDE_PROMPT_CACHE !== 'off'

export type AskUsage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
export type AskResult = { text: string; stopReason?: string; usage?: AskUsage }

type ContentBlock = { type: string; text?: string }
type AnthropicResponse = { content: ContentBlock[]; stop_reason?: string; usage?: AskUsage }

/** ตัดรั้ว markdown ```json ... ``` ที่ CLI ชอบใส่มาให้ออก */
function stripFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (m ? m[1] : s).trim()
}

async function viaBridge(prompt: string): Promise<AskResult> {
  const base = process.env.CLAUDE_BRIDGE_URL!.replace(/\/+$/, '')
  const token = process.env.CLAUDE_BRIDGE_TOKEN || ''

  let res: Response
  try {
    res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-token': token },
      body: JSON.stringify({ prompt, model: 'haiku' }),
      signal: AbortSignal.timeout(55000),
    })
  } catch {
    throw new Error('ต่อเครื่องที่ร้านไม่ได้ (สะพาน Claude ปิดอยู่หรือเน็ตร้านหลุด) ลองใหม่อีกครั้ง')
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`สะพาน Claude ตอบผิดพลาด: ${err.slice(0, 300)}`)
  }
  const data = (await res.json()) as { text?: string }
  return { text: stripFences(data.text ?? '') }
}

async function viaApi(prompt: string, maxTokens: number, cachePrefix?: string): Promise<AskResult> {
  // มี cachePrefix → แยกเป็น 2 ก้อนใน user turn เดียวกัน (โมเดลเห็นข้อความต่อกันเหมือนเดิม) ก้อนแรกติดป้ายให้จำ
  const content = !cachePrefix ? prompt
    : cacheOn() ? [
        { type: 'text', text: cachePrefix, cache_control: { type: 'ephemeral', ttl: '1h' } },
        { type: 'text', text: prompt },
      ]
    : cachePrefix + prompt
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${err}`)
  }

  const data: AnthropicResponse = await res.json()
  const text = (Array.isArray(data.content) ? data.content : []).find(c => c.type === 'text')?.text ?? ''
  const u = data.usage
  // โชว์ใน log ของเซิร์ฟเวอร์ (Vercel Logs) ไว้เช็กว่าจำได้จริง: read สูง = ประหยัด · write = เพิ่งจำใหม่
  if (cachePrefix && u) console.log(`[askClaude] in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`)
  return { text: stripFences(text), stopReason: data.stop_reason, usage: u }
}

// cachePrefix = ส่วนกติกาที่ไม่เปลี่ยน (อยู่หน้าสุด) · prompt = ส่วนที่เปลี่ยนทุกครั้ง (ข้อความออเดอร์) — โมเดลเห็นต่อกันเป็น cachePrefix + prompt
export async function askClaude(prompt: string, maxTokens = 2048, cachePrefix?: string): Promise<AskResult> {
  // สะพาน (claude CLI) จำพรอมป์ไม่ได้ → ต่อกันส่งไปทั้งก้อนเหมือนเดิม
  if (process.env.CLAUDE_BRIDGE_URL) return viaBridge((cachePrefix ?? '') + prompt)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY หรือ CLAUDE_BRIDGE_URL')
  }
  return viaApi(prompt, maxTokens, cachePrefix)
}
