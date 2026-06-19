/**
 * Oversetter vanlige Supabase/Postgres-feil til vennlig, forståelig norsk.
 * Brukes ved skjema-lagring og andre mutasjoner så brukeren ikke møter rå
 * tekniske feilmeldinger.
 */
export function translateError(err: unknown): string {
  const msg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err)
  const low = msg.toLowerCase()

  if (/failed to fetch|networkerror|network request failed|load failed/.test(low))
    return 'Nettverksfeil – sjekk tilkoblingen og prøv igjen.'
  if (/row-level security|permission denied|not authorized|violates .*policy/.test(low))
    return 'Du har ikke tilgang til å gjøre dette.'
  if (/duplicate key|already exists|unique constraint/.test(low))
    return 'Dette finnes allerede.'
  if (/timeout|timed out/.test(low)) return 'Det tok for lang tid. Prøv igjen.'
  if (/jwt|token|not authenticated|session/.test(low))
    return 'Økten er utløpt. Logg inn på nytt.'

  return msg || 'Noe gikk galt. Prøv igjen.'
}
