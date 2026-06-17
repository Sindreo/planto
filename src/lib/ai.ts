import { supabase } from './supabase'
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
  action: 'identify' | 'diagnose' | 'careguide'
  images?: string[] // base64 (kun for identify)
  image_urls?: string[] // offentlige URL-er (for diagnose)
  species?: string | null
  context?: Record<string, unknown>
  plant_id?: string | null
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
