import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { diagnosePlant } from '../lib/ai'
import { uploadPlantPhoto } from '../lib/photos'
import { fetchLatestLooseDiagnosis, linkDiagnosisToPlant } from '../lib/diagnoses'
import type { Diagnosis, Plant } from '../types/db'
import { Alert, Button, Spinner } from '../components/ui'
import DiagnosisCard from '../components/DiagnosisCard'
import { ArrowLeft, Camera, Close, PlantMark, Sparkle } from '../components/icons'

/**
 * Standalone bildediagnose – «botaniker-støtte» uten å registrere planten først.
 * Etter vurderingen kan man knytte den til en eksisterende plante eller
 * opprette en ny plante med diagnosen som første tidslinje-element.
 */
export default function DiagnosePage() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<{ file: File; url: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)

  // Legg til bilder (opptil 3 totalt) – erstatter ikke de forrige. På mobil kan
  // man dermed ta ett kamerabilde av gangen og samle opp til tre.
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
    if (!profile?.household_id || !session?.user) return
    if (items.length === 0) {
      setError('Velg minst ett bilde av planten.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const imageUrls = await Promise.all(
        items.map((it) => uploadPlantPhoto(profile.household_id!, it.file)),
      )
      await diagnosePlant({ imageUrls, plantId: null }, session.access_token)
      // Hent den lagrede (løse) diagnosen så vi har id + bilder til kortet/lenking.
      const saved = await fetchLatestLooseDiagnosis(session.user.id)
      setDiagnosis(saved)
      setItems([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setDiagnosis(null)
    setItems([])
    setError(null)
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-gray-900">Sjekk plante</h1>
      <p className="mb-6 text-sm text-gray-500">
        Last opp bilde, så sjekker vi hvordan det står til med planten.
      </p>

      {!diagnosis ? (
        <div className="space-y-4">
          {items.length === 0 ? (
            <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-white/60 text-center">
              <Camera className="h-9 w-9 text-brand-600" />
              <span className="text-sm font-medium text-brand-800">Trykk for å velge 1–3 bilder</span>
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
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-2xl bg-brand-100"
                >
                  <img src={it.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    aria-label="Fjern bilde"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <Close className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {items.length < 3 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-brand-200 bg-white/60 text-center text-brand-700">
                  <Camera className="h-7 w-7" />
                  <span className="text-xs font-medium">Legg til</span>
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
          )}

          {error && <Alert tone="error">{error}</Alert>}

          {loading ? (
            <div className="grid place-items-center py-8">
              <Spinner label="Planto undersøker planten…" />
            </div>
          ) : (
            <Button onClick={run} disabled={items.length === 0} className="w-full">
              <Sparkle className="h-4 w-4" />
              Sjekk planten
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <DiagnosisCard diagnosis={diagnosis} defaultExpanded />
          <SaveOptions
            diagnosis={diagnosis}
            onLinked={(plantId) => navigate(`/plants/${plantId}`)}
            onCreateNew={() =>
              navigate('/plants/new', {
                state: {
                  diagnosisId: diagnosis.id,
                  // Ta med bildet og vurderingen videre, så den nye planten
                  // får bilde + forhåndsutfylt art og stell.
                  photoUrl: diagnosis.image_urls?.[0],
                  diagnosis: diagnosis.result_json,
                },
              })
            }
          />
          <button
            onClick={reset}
            className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Ny sjekk
          </button>
        </div>
      )}
    </div>
  )
}

function SaveOptions({
  diagnosis,
  onLinked,
  onCreateNew,
}: {
  diagnosis: Diagnosis
  onLinked: (plantId: string) => void
  onCreateNew: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [plants, setPlants] = useState<Plant[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!picking) return
    supabase
      .from('plants')
      .select('*')
      .order('nickname')
      .then(({ data }) => setPlants(data ?? []))
  }, [picking])

  async function link(plantId: string) {
    setBusy(true)
    try {
      await linkDiagnosisToPlant(diagnosis.id, plantId)
      onLinked(plantId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4">
      <p className="text-sm font-semibold text-gray-800">Lagre oppfølgingen</p>
      <p className="mt-1 text-xs text-gray-500">
        Knytt vurderingen til en plante, så havner den på plantens tidslinje.
      </p>

      {!picking ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => setPicking(true)}>Knytt til en plante</Button>
          <Button variant="ghost" onClick={onCreateNew}>
            Opprett ny plante
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          {plants.length === 0 ? (
            <p className="text-sm text-gray-500">
              Du har ingen planter ennå.{' '}
              <button onClick={onCreateNew} className="text-brand-700 hover:underline" type="button">
                Opprett ny plante
              </button>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {plants.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => link(p.id)}
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl border border-brand-100 bg-white p-2 text-left hover:border-brand-300 disabled:opacity-50"
                    type="button"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-100">
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PlantMark className="h-5 w-5 text-brand-500" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {p.nickname}
                      </span>
                      {p.species && (
                        <span className="block truncate text-xs text-gray-500">{p.species}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setPicking(false)}
            className="mt-2 text-xs text-gray-500 hover:underline"
            type="button"
          >
            Avbryt
          </button>
        </div>
      )}
    </div>
  )
}
