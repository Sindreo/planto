import { supabase, supabaseAnonKey, supabaseUrl } from './supabase'
import { compressImage } from './photos'
import type { CareGuideResult, DiagnosisResult, IdentifyResult } from '../types/ai'

const FUNCTION = 'plant-ai'

async function fileToBase64(file: Blob): Promise<string> {
  const blob = await compressImage(file)
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

interface InvokeBody {
  action: 'identify' | 'diagnose' | 'careguide' | 'chat'
  images?: string[] // base64 (kun for identify)
  image_urls?: string[] // offentlige URL-er (for diagnose)
  species?: string | null
  context?: Record<string, unknown>
  plant_id?: string | null
  message?: string // kun for chat
}

async function invoke<T>(body: InvokeBody, accessToken?: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION, {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  })
  if (error) {
    // FunctionsHttpError legger selve responsen i .context – hent ut vår
    // lesbare norske feilmelding derfra hvis den finnes.
    let detail = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const bodyJson = await ctx.json()
        if (bodyJson?.error) detail = bodyJson.error
      } catch {
        // ignorer – behold standardmeldingen
      }
    }
    throw new Error(detail)
  }
  return data as T
}

/**
 * Plante-ID fra ett bilde → liste med artskandidater.
 * Tar imot enten en nyvalgt fil eller et allerede lagret bilde (Blob).
 */
export async function identifySpecies(
  image: Blob,
  accessToken?: string,
): Promise<IdentifyResult> {
  const data = await fileToBase64(image)
  return invoke<IdentifyResult>({ action: 'identify', images: [data] }, accessToken)
}

/**
 * Bildediagnose av 1–3 bilder + kontekst. Bildene er allerede lastet opp til
 * Storage (URL-er sendes inn). Resultatet lagres på planten i backend.
 */
export async function diagnosePlant(
  params: {
    imageUrls: string[]
    plantId?: string | null
    species?: string | null
    location?: string | null
    lastWatered?: string | null
  },
  accessToken?: string,
): Promise<DiagnosisResult> {
  return invoke<DiagnosisResult>(
    {
      action: 'diagnose',
      image_urls: params.imageUrls,
      plant_id: params.plantId ?? null,
      species: params.species ?? null,
      context: {
        species: params.species ?? null,
        location: params.location ?? null,
        last_watered_at: params.lastWatered ?? null,
      },
    },
    accessToken,
  )
}

/** AI fyller ut stellguide basert på art (uten bilde). */
export async function fillCareGuide(
  species: string,
  accessToken?: string,
): Promise<CareGuideResult> {
  return invoke<CareGuideResult>({ action: 'careguide', species }, accessToken)
}

/**
 * Strømmer et chat-svar om en konkret plante token for token via en direkte
 * fetch mot Edge-funksjonen. Backend lagrer både brukermeldingen og svaret.
 * Faller tilbake til å vise hele svaret samtidig hvis funksjonen ennå svarer
 * med JSON (dvs. ikke er redeployet med strømming).
 */
export async function streamChatAboutPlant(
  params: { plantId: string; message: string; context?: Record<string, unknown> },
  accessToken: string | undefined,
  onToken: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey ?? '',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      action: 'chat',
      plant_id: params.plantId,
      message: params.message,
      context: params.context,
    }),
  })

  if (!res.ok) {
    let detail = `Feil (${res.status})`
    try {
      const j = await res.json()
      if (j?.error) detail = j.error
    } catch {
      // behold standardmeldingen
    }
    throw new Error(detail)
  }

  // Eldre funksjon (uten strømming) svarer med JSON {reply}: vis hele svaret.
  const ctype = res.headers.get('content-type') ?? ''
  if (ctype.includes('application/json')) {
    const j = await res.json()
    if (j?.reply) onToken(j.reply as string)
    return
  }

  if (!res.body) throw new Error('Tomt svar fra Planto')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (chunk) onToken(chunk)
  }
}
