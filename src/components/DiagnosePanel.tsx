import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { diagnosePlant } from '../lib/ai'
import { uploadPlantPhoto } from '../lib/photos'
import type { Plant } from '../types/db'
import { Alert, Button, Spinner } from './ui'
import { Camera, Close, Sparkle } from './icons'

/**
 * «Kjør ny bildediagnose» for en plante (4.3 i SPEC). Legg til 1–3 bilder, send
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
  const [items, setItems] = useState<{ file: File; url: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Legg til bilder (opptil 3) – erstatter ikke de forrige. På mobil kan man ta
  // ett kamerabilde av gangen og samle opp til tre.
  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setItems((prev) => {
      const room = 3 - prev.length
      if (room <= 0) return prev
      const incoming = Array.from(list)
        .slice(0, room)
        .map((file) => ({ file, url: URL.createObjectURL(file) }))
      return [...prev, ...incoming]
    })
  }

  function removeItem(index: number) {
    setItems((prev) => {
      const it = prev[index]
      if (it) URL.revokeObjectURL(it.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function run() {
    if (items.length === 0) {
      setError('Velg minst ett bilde av planten.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const imageUrls = await Promise.all(
        items.map((it) => uploadPlantPhoto(plant.household_id, it.file)),
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
      setItems([])
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
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            {items.map((it, i) => (
              <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl bg-brand-100">
                <img src={it.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label="Fjern bilde"
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <Close className="h-3 w-3" />
                </button>
              </div>
            ))}
            {items.length < 3 && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 bg-white/60 text-center text-brand-700 hover:bg-gray-50">
                <Camera className="h-5 w-5" />
                <span className="text-[11px] font-medium">
                  {items.length === 0 ? 'Velg bilde' : 'Legg til'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
          <Button type="button" onClick={run} disabled={items.length === 0}>
            <Sparkle className="h-4 w-4" />
            Kjør diagnose
          </Button>
        </div>
      )}

      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
    </section>
  )
}
