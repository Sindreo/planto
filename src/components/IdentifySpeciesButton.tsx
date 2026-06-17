import { useState } from 'react'
import { identifySpecies } from '../lib/ai'
import type { SpeciesCandidate } from '../types/ai'
import { Alert } from './ui'

/**
 * Knapp som sender det valgte bildet til Claude og viser artskandidater.
 * Bruker velger et forslag, som fylles inn i art-feltet (4.5 i SPEC).
 */
export default function IdentifySpeciesButton({
  file,
  existingUrl,
  accessToken,
  onPick,
}: {
  file: File | null
  /** Allerede lagret bilde på planten – brukes hvis ingen ny fil er valgt. */
  existingUrl?: string
  accessToken?: string
  onPick: (name: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<SpeciesCandidate[] | null>(null)

  async function run() {
    setError(null)
    setLoading(true)
    setCandidates(null)
    try {
      // Bruk nyvalgt fil hvis den finnes, ellers det allerede lagrede bildet.
      let image: Blob | null = file
      if (!image && existingUrl) {
        image = await fetch(existingUrl).then((r) => r.blob())
      }
      if (!image) {
        setError('Velg et bilde først, så kan AI gjette arten.')
        return
      }
      const res = await identifySpecies(image, accessToken)
      setCandidates(res.candidates ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-100 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-200 disabled:opacity-50"
      >
        ✨ {loading ? 'Analyserer…' : 'Gjett art fra bilde'}
      </button>

      {error && <Alert tone="error">{error}</Alert>}

      {candidates && candidates.length === 0 && (
        <Alert tone="info">Fant ingen tydelige forslag. Prøv et skarpere bilde, eller skriv arten selv.</Alert>
      )}

      {candidates && candidates.length > 0 && (
        <ul className="space-y-1.5">
          {candidates.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onPick(c.name)
                  setCandidates(null)
                }}
                className="w-full rounded-xl border border-brand-100 bg-white px-3 py-2 text-left text-sm hover:border-brand-300"
              >
                <span className="font-semibold text-gray-900">{c.name}</span>
                {c.latin_name && <span className="text-gray-500"> · {c.latin_name}</span>}
                <span className="ml-1 text-xs text-brand-700">({c.confidence})</span>
                {c.note && <p className="mt-0.5 text-xs text-gray-500">{c.note}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
