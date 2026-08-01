// จุดเดียวที่คุยกับ Claude สำหรับ route แปลงข้อความทั้งหมด (parse-order / parse-items / parse-claim / parse-po / parse-installation)
//
// มี 2 ทาง เลือกด้วย env:
//   1) CLAUDE_BRIDGE_URL  -> ยิงไปที่ "สะพาน" บนเครื่องที่ร้าน ซึ่งเรียก claude CLI (ใช้โควตา Claude Max)
//                            ใช้ชั่วคราวตอนเครดิต Anthropic API หมด — ช้ากว่า (~20-45 วิ)
//   2) ANTHROPIC_API_KEY  -> ยิง Anthropic API ตรง (ทางปกติ เร็วกว่า)
// ถ้าตั้ง CLAUDE_BRIDGE_URL ไว้จะใช้สะพานก่อนเสมอ ลบ env ตัวนี้ทิ้งเมื่อเติมเครดิตแล้ว

const MODEL = 'claude-haiku-4-5-20251001'

export type AskResult = { text: string; stopReason?: string }

type ContentBlock = { type: string; text?: string }
type AnthropicResponse = { content: ContentBlock[]; stop_reason?: string }

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

async function viaApi(prompt: string, maxTokens: number): Promise<AskResult> {
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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${err}`)
  }

  const data: AnthropicResponse = await res.json()
  const text = (Array.isArray(data.content) ? data.content : []).find(c => c.type === 'text')?.text ?? ''
  return { text: stripFences(text), stopReason: data.stop_reason }
}

export async function askClaude(prompt: string, maxTokens = 2048): Promise<AskResult> {
  if (process.env.CLAUDE_BRIDGE_URL) return viaBridge(prompt)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error('ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY หรือ CLAUDE_BRIDGE_URL')
  }
  return viaApi(prompt, maxTokens)
}
