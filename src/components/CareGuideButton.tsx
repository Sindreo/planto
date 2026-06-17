import { useState } from 'react'
import { fillCareGuide } from '../lib/ai'
import type { CareGuideResult } from '../types/ai'
import { Sparkle } from './icons'

/**
 * Knapp som ber Claude fylle ut stellguiden basert på art (uten bilde).
 * Resultatet fylles inn i skjemafeltene (bruker kan justere etterpå).
 */
export default function CareGuideButton({
  species,
  accessToken,
  onResult,
}: {
  species: string
  accessToken?: string
  onResult: (guide: CareGuideResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!species.trim()) {
      setError('Fyll inn art først.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const guide = await fillCareGuide(species.trim(), accessToken)
      onResult(guide)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-brand-800 shadow-sm hover:bg-brand-50 disabled:opacity-50"
      >
        <Sparkle className="h-3.5 w-3.5" />
        {loading ? 'Henter…' : 'Fyll ut med AI'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
