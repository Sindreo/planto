import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/db'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True når frontend er konfigurert med Supabase-nøkler. Brukes til å vise en
 * hjelpsom melding i stedet for en kryptisk feil hvis .env.local mangler.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Ikke kast – vi vil heller vise en pen «mangler oppsett»-skjerm i appen.
  console.warn(
    'Mangler VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Kopier .env.example til .env.local og fyll inn verdiene fra Supabase.',
  )
}

// Faller tilbake til trygge dummy-verdier slik at appen kan rendre «mangler
// oppsett»-skjermen uten å krasje under import.
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
)
