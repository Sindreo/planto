import { supabase } from './supabase'

/**
 * Logger en feil til konsollen og til error_logs-tabellen (beste forsøk – kaster
 * aldri selv). Lar oss se klientfeil i Supabase uten en ekstern leverandør.
 * RLS krever innlogget bruker, så feil før innlogging logges kun til konsollen.
 */
export async function logError(context: string, error: unknown): Promise<void> {
  console.error(`[${context}]`, error)
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const message = error instanceof Error ? error.message : String(error)
    const detail = error instanceof Error ? error.stack ?? null : null
    await supabase.from('error_logs').insert({
      user_id: data.user.id,
      source: 'client',
      context,
      message: message.slice(0, 1000),
      detail: detail ? detail.slice(0, 4000) : null,
    })
  } catch {
    // svelg – logging skal aldri velte appen
  }
}
