import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { diagnosePlant } from '../lib/ai'
import { uploadPlantPhoto } from '../lib/photos'
import type { Plant } from '../types/db'
import { Alert, Button, Spinner } from './ui'

/**
 * «Kjør ny bildediagnose» for en plante (4.3 i SPEC). Velg 1–3 bilder, send
 * til Planto (Edge Function), og resultatet lagres på planten. Selve
 * historikken vises i plantens tidslinje (onComplete laster den på nytt).
 */
export default function DiagnosePanel({
  plant,
  onComplete,
}: {
  plant: Plant
  onComplete?: () => void
}) {
  const { session } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onPick(list: FileList | null) {
    if (!list) return
    setFiles(Array.from(list).slice(0, 3))
  }

  async function run() {
    if (files.length === 0) {
      setError('Velg minst ett bilde av planten.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const imageUrls = await Promise.all(
        files.map((f) => uploadPlantPhoto(plant.household_id, f)),
      )
      await diagnosePlant(
        {
          imageUrls,
          plantId: plant.id,
          species: plant.species,
          location: plant.location,
          lastWatered: plant.last_watered_at,
        },
        session?.access_token,
      )
      setFiles([])
      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-4">
      <h2 className="font-semibold text-gray-900">Sjekk planten</h2>
      <p className="mt-1 text-sm text-gray-500">
        Ta eller last opp 1–3 bilder, så sjekker Planto tilstanden og foreslår tiltak.
      </p>

      {loading ? (
        <div className="grid place-items-center py-6">
          <Spinner label="Planto undersøker planten…" />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-block cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Velg bilder
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
          </label>
          {files.length > 0 && (
            <span className="text-sm text-gray-600">{files.length} bilde(r) valgt</span>
          )}
          <Button type="button" onClick={run} disabled={files.length === 0}>
            ✨ Kjør diagnose
          </Button>
        </div>
      )}

      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
    </section>
  )
}
