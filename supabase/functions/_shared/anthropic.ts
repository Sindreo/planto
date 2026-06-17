// Hjelpere for å kalle Claude (claude-sonnet-4-6) og hente ut JSON-svar.
// Nøkkelen leses fra miljøvariabelen ANTHROPIC_API_KEY – aldri fra frontend.

export const MODEL = 'claude-sonnet-4-6'

const API_URL = 'https://api.anthropic.com/v1/messages'

export type ImageBlock =
  | { type: 'image'; source: { type: 'url'; url: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

interface CallParams {
  system: string
  text: string
  images?: ImageBlock[]
  maxTokens?: number
}

export async function callClaude(params: CallParams): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('Mangler ANTHROPIC_API_KEY i Edge Function-miljøet')

  const content: unknown[] = [...(params.images ?? []), { type: 'text', text: params.text }]

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Claude-feil (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Uventet svar fra Claude')
  return text
}

/** Henter ut det første JSON-objektet fra en tekst (tåler ```-kodeblokker). */
export function extractJson<T>(text: string): T {
  let s = text.trim()
  // Fjern eventuelle markdown-kodegjerder.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Fant ikke JSON i AI-svaret')
  return JSON.parse(s.slice(start, end + 1)) as T
}
