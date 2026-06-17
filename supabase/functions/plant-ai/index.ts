// Edge Function: plant-ai
// Tre handlinger som deler oppsett (SPEC M2):
//   - identify : plante-ID fra ett bilde (base64) → artskandidater
//   - diagnose : 1–3 bilde-URL-er + kontekst → diagnose, lagres i `diagnoses`
//   - careguide: art (uten bilde) → forslag til stellguide
//
// Anthropic-nøkkelen ligger KUN som hemmelig miljøvariabel her, aldri i frontend.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { callClaude, extractJson, MODEL, type ImageBlock } from '../_shared/anthropic.ts'

const MAX_AI_PER_DAY = Number(Deno.env.get('MAX_AI_PER_DAY') ?? '40')

interface Body {
  action: 'identify' | 'diagnose' | 'careguide'
  images?: string[]
  image_urls?: string[]
  species?: string | null
  context?: Record<string, unknown>
  plant_id?: string | null
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

    if (body.action === 'identify') {
      return await handleIdentify(body)
    }
    if (body.action === 'careguide') {
      return await handleCareGuide(body)
    }
    if (body.action === 'diagnose') {
      return await handleDiagnose(body, admin, user.id)
    }
    return jsonResponse({ error: 'Ukjent handling' }, 400)
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

async function handleIdentify(body: Body): Promise<Response> {
  const b64 = body.images?.[0]
  if (!b64) return jsonResponse({ error: 'Mangler bilde' }, 400)
  const images: ImageBlock[] = [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
  ]
  const system =
    'Du er en ekspert på stueplanter. Identifiser planten på bildet. ' +
    'Svar KUN med gyldig JSON på norsk i formatet: ' +
    '{"candidates":[{"name":"vanlig norsk navn","latin_name":"latinsk navn","confidence":"høy|middels|lav","note":"kort begrunnelse"}]}. ' +
    'Maks 4 kandidater, mest sannsynlig først. Vær ærlig om usikkerhet – ikke påstå én art med falsk selvtillit.'
  const text = await callClaude({
    system,
    text: 'Hvilken stueplante er dette? Returner JSON.',
    images,
    maxTokens: 700,
  })
  const result = extractJson<unknown>(text)
  return jsonResponse(result)
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
  const result = extractJson<unknown>(text)
  return jsonResponse(result)
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
    'Du er en ekspert på stueplanter og plantehelse. Vurder plantens tilstand ut fra bildene. ' +
    'Svar KUN med gyldig JSON på norsk i formatet: ' +
    '{"likely_issues":[{"issue":"kort navn","confidence":"høy|middels|lav","evidence":"hva i bildet tyder på dette"}],' +
    '"overall_health":"god|middels|dårlig","actions":["konkret tiltak", "..."],' +
    '"watering_recommendation_days":tall_eller_null,"notes":"kort oppfølging"}. ' +
    'Vær konkret og ærlig om usikkerhet.'

  const text = await callClaude({
    system,
    text:
      `Vurder denne stueplanten og foreslå tiltak.${ctxText ? ' Kontekst: ' + ctxText + '.' : ''} Returner JSON.`,
    images,
    maxTokens: 1024,
  })

  const result = extractJson<{
    likely_issues?: { issue: string }[]
    overall_health?: string
  }>(text)

  // Kort menneskelesbar oppsummering.
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
