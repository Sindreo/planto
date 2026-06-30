// Edge Function: plant-ai
// Handlinger som deler oppsett (SPEC M2):
//   - identify : plante-ID fra ett bilde (base64) → artskandidater
//   - diagnose : 1–3 bilde-URL-er + kontekst → diagnose, lagres i `diagnoses`
//   - careguide: art (uten bilde) → forslag til stellguide
//   - chat     : samtale om en konkret plante → svar, lagres i `plant_chat_messages`
//
// Anthropic-nøkkelen ligger KUN som hemmelig miljøvariabel her, aldri i frontend.
// Selvstendig fil – kan limes rett inn i Supabase-dashbordets Edge Function-editor.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Modellene er konfigurerbare via miljøvariabler, så de kan byttes (f.eks. til
// Opus for bildeoppgaver) uten kodeendring. Standardene under er trygge fallbacks.
const MODEL = Deno.env.get('AI_VISION_MODEL') ?? 'claude-sonnet-4-6'
// Chat er ren tekst-rådgivning – Haiku er raskt og rimelig og holder godt her.
const MODEL_CHAT = Deno.env.get('AI_CHAT_MODEL') ?? 'claude-haiku-4-5-20251001'
const MAX_AI_PER_DAY = Number(Deno.env.get('MAX_AI_PER_DAY') ?? '40')
const MAX_CHAT_PER_DAY = Number(Deno.env.get('MAX_CHAT_PER_DAY') ?? '60')
// Stopp henging mot Anthropic så tilkoblinger ikke holdes åpne i det uendelige.
const AI_TIMEOUT_MS = Number(Deno.env.get('AI_TIMEOUT_MS') ?? '90000')

/** fetch med timeout via AbortController. */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  ms: number,
): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type ImageBlock =
  | { type: 'image'; source: { type: 'url'; url: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

async function callClaude(params: {
  system: string
  text: string
  images?: ImageBlock[]
  maxTokens?: number
}): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('Mangler ANTHROPIC_API_KEY i Edge Function-miljøet')

  const content: unknown[] = [...(params.images ?? []), { type: 'text', text: params.text }]

  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
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
    },
    AI_TIMEOUT_MS,
  )

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Claude-feil (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Uventet svar fra Claude')
  return text
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

/** Henter ut det første JSON-objektet fra en tekst (tåler ```-kodeblokker). */
function extractJson<T>(text: string): T {
  let s = text.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Fant ikke JSON i AI-svaret')
  return JSON.parse(s.slice(start, end + 1)) as T
}

interface Body {
  action: 'identify' | 'diagnose' | 'careguide' | 'chat'
  images?: string[]
  image_urls?: string[]
  species?: string | null
  context?: Record<string, unknown>
  plant_id?: string | null
  message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // Verifiser brukeren ut fra JWT-en.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return jsonResponse({ error: 'Ikke innlogget' }, 401)
    const user = userData.user

    const admin = createClient(supabaseUrl, serviceKey)

    // Enkel kostnadssikring: maks antall AI-kall per bruker per døgn.
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count } = await admin
      .from('diagnoses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)
    if ((count ?? 0) >= MAX_AI_PER_DAY) {
      return jsonResponse(
        { error: `Dagsgrensen for AI-kall (${MAX_AI_PER_DAY}) er nådd. Prøv igjen i morgen.` },
        429,
      )
    }

    const body = (await req.json()) as Body

    if (body.action === 'identify') return await handleIdentify(body)
    if (body.action === 'careguide') return await handleCareGuide(body)
    if (body.action === 'diagnose') return await handleDiagnose(body, admin, user.id)
    if (body.action === 'chat') return await handleChat(body, admin, userClient, user.id)
    return jsonResponse({ error: 'Ukjent handling' }, 400)
  } catch (err) {
    console.error(err)
    await logError('plant-ai', err)
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** Beste forsøk på å logge en feil til error_logs (uten å kaste selv). */
async function logError(source: string, err: unknown): Promise<void> {
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    await admin.from('error_logs').insert({
      source,
      message: err instanceof Error ? err.message : String(err),
      detail: err instanceof Error ? (err.stack ?? '').slice(0, 4000) : null,
    })
  } catch {
    // ignorer – logging skal aldri velte funksjonen
  }
}

async function handleIdentify(body: Body): Promise<Response> {
  const b64 = body.images?.[0]
  if (!b64) return jsonResponse({ error: 'Mangler bilde' }, 400)
  const images: ImageBlock[] = [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
  ]
  const system =
    'Du er en ekspert på stueplanter. Identifiser planten på bildet. ' +
    'Svar KUN med gyldig JSON på norsk i formatet: ' +
    '{"candidates":[{"name":"vanlig hverdagsnavn","latin_name":"latinsk navn","confidence":"høy|middels|lav","note":"kort begrunnelse"}]}. ' +
    '"name" skal være navnet folk flest faktisk bruker til daglig og ville søkt etter – ' +
    'foretrekk det innarbeidede populærnavnet (ofte slektsnavnet, f.eks. «Monstera», «Pilea», «Calathea») ' +
    'fremfor en formell norsk oversettelse (som «Vindusblad») når det er det vanligste. ' +
    'Maks 4 kandidater, mest sannsynlig først. Vær ærlig om usikkerhet – ikke påstå én art med falsk selvtillit.'
  const text = await callClaude({
    system,
    text: 'Hvilken stueplante er dette? Returner JSON.',
    images,
    maxTokens: 700,
  })
  return jsonResponse(extractJson<unknown>(text))
}

async function handleCareGuide(body: Body): Promise<Response> {
  const species = (body.species ?? '').trim()
  if (!species) return jsonResponse({ error: 'Mangler art' }, 400)
  const system =
    'Du er en ekspert på stueplanter. Gi en stellguide for den oppgitte arten. ' +
    'Svar KUN med gyldig JSON på norsk i formatet: ' +
    '{"light_needs":"kort tekst","water_interval_days":tall,"fertilize_interval_days":tall,' +
    '"repot_interval_months":tall,"toxic_to_pets":true|false,"notes":"kort stelltips"}. ' +
    'Bruk null for felt du er usikker på. Tallene er typiske intervaller i dager/måneder.'
  const text = await callClaude({
    system,
    text: `Lag en stellguide for: ${species}. Returner JSON.`,
    maxTokens: 600,
  })
  return jsonResponse(extractJson<unknown>(text))
}

async function handleDiagnose(
  body: Body,
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const urls = (body.image_urls ?? []).slice(0, 3)
  if (urls.length === 0) return jsonResponse({ error: 'Mangler bilder' }, 400)

  const images: ImageBlock[] = urls.map((url) => ({
    type: 'image',
    source: { type: 'url', url },
  }))

  const ctx = body.context ?? {}
  const ctxText = [
    ctx.species ? `Art: ${ctx.species}` : null,
    ctx.location ? `Plassering: ${ctx.location}` : null,
    ctx.last_watered_at ? `Sist vannet: ${ctx.last_watered_at}` : null,
  ]
    .filter(Boolean)
    .join('. ')

  const system =
    'Du er en ekspert på stueplanter og plantehelse. Vurder plantens tilstand ut fra bildene, ' +
    'og gjett samtidig hvilken art det er. ' +
    'Svar KUN med gyldig JSON på norsk i formatet: ' +
    '{"species":{"name":"vanlig hverdagsnavn (det folk flest bruker, ofte slektsnavnet som «Monstera» fremfor «Vindusblad»)","latin_name":"latinsk navn"} eller null hvis usikker,' +
    '"likely_issues":[{"issue":"kort navn","confidence":"høy|middels|lav","evidence":"hva i bildet tyder på dette"}],' +
    '"overall_health":"god|middels|dårlig","actions":["konkret tiltak", "..."],' +
    '"watering_recommendation_days":tall_eller_null,"notes":"kort oppfølging"}. ' +
    'Vær konkret og ærlig om usikkerhet.'

  const text = await callClaude({
    system,
    text: `Vurder denne stueplanten og foreslå tiltak.${ctxText ? ' Kontekst: ' + ctxText + '.' : ''} Returner JSON.`,
    images,
    maxTokens: 1024,
  })

  const result = extractJson<{
    likely_issues?: { issue: string }[]
    overall_health?: string
  }>(text)

  const summary =
    result.likely_issues && result.likely_issues.length > 0
      ? `${result.likely_issues[0].issue} – helse: ${result.overall_health ?? 'ukjent'}`
      : `Helse: ${result.overall_health ?? 'ukjent'}`

  const { error } = await admin.from('diagnoses').insert({
    plant_id: body.plant_id ?? null,
    user_id: userId,
    image_urls: urls,
    model: MODEL,
    result_json: result,
    summary,
  })
  if (error) throw new Error(`Kunne ikke lagre diagnose: ${error.message}`)

  return jsonResponse(result)
}

async function handleChat(
  body: Body,
  admin: ReturnType<typeof createClient>,
  userClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const plantId = body.plant_id
  const message = (body.message ?? '').trim()
  if (!plantId) return jsonResponse({ error: 'Mangler plante' }, 400)
  if (!message) return jsonResponse({ error: 'Mangler melding' }, 400)
  if (message.length > 2000) return jsonResponse({ error: 'Meldingen er for lang' }, 400)

  // Bekreft at brukeren har tilgang til planten (RLS via brukerklienten).
  const { data: plant, error: pErr } = await userClient
    .from('plants')
    .select('id')
    .eq('id', plantId)
    .maybeSingle()
  if (pErr || !plant) return jsonResponse({ error: 'Ingen tilgang til planten' }, 403)

  // Egen dagsgrense for chat.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await admin
    .from('plant_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_CHAT_PER_DAY) {
    return jsonResponse(
      { error: `Dagsgrensen for chat (${MAX_CHAT_PER_DAY}) er nådd. Prøv igjen i morgen.` },
      429,
    )
  }

  // Lagre brukerens melding, og hent samtalehistorikken (siste 20).
  await admin
    .from('plant_chat_messages')
    .insert({ plant_id: plantId, user_id: userId, role: 'user', content: message })
  const { data: rows } = await admin
    .from('plant_chat_messages')
    .select('role, content')
    .eq('plant_id', plantId)
    .order('created_at', { ascending: true })
    .limit(20)

  const system =
    'Du er Planto – en vennlig, kunnskapsrik hjelper for stueplanter. Svar kort, ' +
    'konkret og praktisk på norsk, som en hjelpsom gartner. Skriv naturlig (ikke JSON). ' +
    'Bruk informasjonen om planten under når den er relevant. Er noe usikkert eller ' +
    'avhengig av forhold (lys, årstid, potte), så si det framfor å gjette skråsikkert.\n\n' +
    'Om planten brukeren spør om:\n' +
    buildPlantContext(body.context ?? {})

  const messages = normalizeMessages((rows ?? []) as ChatMsg[])

  // Strøm svaret token for token fra Claude videre til klienten, og samle opp
  // hele teksten så vi kan lagre den når strømmen er ferdig.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'Mangler ANTHROPIC_API_KEY i Edge Function-miljøet' }, 500)

  const upstream = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL_CHAT, max_tokens: 800, stream: true, system, messages }),
    },
    AI_TIMEOUT_MS,
  )
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    return jsonResponse({ error: `Claude-feil (${upstream.status}): ${detail.slice(0, 200)}` }, 502)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          // Server-Sent Events skilles med tom linje.
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data:'))
            if (!dataLine) continue
            const payload = dataLine.slice(5).trim()
            if (!payload || payload === '[DONE]') continue
            try {
              const evt = JSON.parse(payload)
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                const text = evt.delta.text as string
                if (text) {
                  full += text
                  controller.enqueue(encoder.encode(text))
                }
              }
            } catch {
              // hopp over ufullstendige/ukjente hendelser
            }
          }
        }
      } catch {
        // strømmen ble brutt – vi lagrer det vi rakk å motta
      } finally {
        if (full.trim()) {
          await admin
            .from('plant_chat_messages')
            .insert({ plant_id: plantId, user_id: userId, role: 'assistant', content: full })
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/** Bygger en lesbar kontekstblokk om planten til chat-systemprompten. */
function buildPlantContext(ctx: Record<string, unknown>): string {
  const v = (k: string) => {
    const x = ctx[k]
    return x === null || x === undefined || x === '' ? null : String(x)
  }
  const lines = [
    v('nickname') ? `- Kallenavn: ${v('nickname')}` : null,
    v('species') ? `- Art: ${v('species')}` : null,
    v('latin_name') ? `- Latinsk navn: ${v('latin_name')}` : null,
    v('location') ? `- Plassering: ${v('location')}` : null,
    v('light_needs') ? `- Lysbehov: ${v('light_needs')}` : null,
    v('water_interval_days') ? `- Vanneintervall: hver ${v('water_interval_days')}. dag` : null,
    v('fertilize_interval_days')
      ? `- Gjødslingsintervall: hver ${v('fertilize_interval_days')}. dag`
      : null,
    v('repot_interval_months') ? `- Ompotting: hver ${v('repot_interval_months')}. måned` : null,
    ctx['toxic_to_pets'] === true
      ? '- Giftig for kjæledyr: ja'
      : ctx['toxic_to_pets'] === false
        ? '- Giftig for kjæledyr: nei'
        : null,
    v('last_watered_at') ? `- Sist vannet: ${v('last_watered_at')}` : null,
    v('next_water_due') ? `- Neste vanning forfaller: ${v('next_water_due')}` : null,
    v('latest_diagnosis') ? `- Siste helsevurdering: ${v('latest_diagnosis')}` : null,
  ].filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : '- (ingen ekstra detaljer registrert)'
}

/**
 * Sørger for at meldingene veksler bruker/assistent og starter med bruker, som
 * Claude krever. Slår sammen påfølgende meldinger med samme rolle (kan oppstå
 * hvis et tidligere svar feilet etter at brukermeldingen ble lagret).
 */
function normalizeMessages(msgs: ChatMsg[]): ChatMsg[] {
  const out: ChatMsg[] = []
  for (const m of msgs) {
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += '\n\n' + m.content
    else out.push({ role: m.role, content: m.content })
  }
  while (out.length > 0 && out[0].role !== 'user') out.shift()
  return out
}
