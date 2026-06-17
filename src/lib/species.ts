import { supabase } from './supabase'
import type { CareGuideResult } from '../types/ai'
import type { Species } from '../types/db'

/** Fjerner tegn som har spesiell betydning i PostgREST-filtre. */
function sanitize(q: string): string {
  return q.replace(/[,()%*\\]/g, ' ').trim()
}

/** Søk i det delte arts-registeret (norsk eller latinsk navn). */
export async function searchSpecies(query: string): Promise<Species[]> {
  const q = sanitize(query)
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .or(`common_name.ilike.%${q}%,latin_name.ilike.%${q}%`)
    .order('common_name', { nullsFirst: false })
    .limit(8)
  if (error) {
    console.error('Artssøk feilet:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Legg til (eller berik) en art i registeret. Eksisterende kanoniske verdier
 * beholdes; tomme felter fylles inn. Returnerer artens id.
 */
export async function upsertSpecies(input: {
  latinName: string
  commonName?: string | null
  guide?: CareGuideResult | null
}): Promise<string> {
  const g = input.guide
  const { data, error } = await supabase.rpc('upsert_species', {
    p_latin_name: input.latinName,
    p_common_name: input.commonName ?? null,
    p_light_needs: g?.light_needs ?? null,
    p_water_interval_days: g?.water_interval_days ?? null,
    p_fertilize_interval_days: g?.fertilize_interval_days ?? null,
    p_repot_interval_months: g?.repot_interval_months ?? null,
    p_toxic_to_pets: g?.toxic_to_pets ?? null,
    p_notes: g?.notes ?? null,
  })
  if (error) throw error
  return data as string
}

/** Gjør en registrert art om til stellguide-form (for å fylle skjemaet). */
export function speciesToGuide(s: Species): CareGuideResult {
  return {
    light_needs: s.light_needs,
    water_interval_days: s.water_interval_days,
    fertilize_interval_days: s.fertilize_interval_days,
    repot_interval_months: s.repot_interval_months,
    toxic_to_pets: s.toxic_to_pets,
    notes: s.notes,
  }
}
