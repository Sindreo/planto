import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { diagnosePlant } from '../lib/ai'
import { uploadPlantPhoto } from '../lib/photos'
import { formatDateTime } from '../lib/format'
import type { Diagnosis, Plant } from '../types/db'
import type { DiagnosisResult } from '../types/ai'
import { Alert, Button } from './ui'

/**
 * Bildediagnose for en plante (4.3 i SPEC). Bruker velger 1–3 bilder, sender
 * til Claude via Edge Function, og resultatet lagres på planten.
 */
export default function DiagnosePanel({ plant }: { plant: Plant }) {
  const { session } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Diagnosis[]>([])

  async function loadHistory() {
    const { data } = await supabase
      .from('diagnoses')
      .select('*')
      .eq('plant_id', plant.id)
      .order('created_at', { ascending: false })
    setHistory(data ?? [])
  }

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plant.id])

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
      // Last opp (komprimerte) bilder til Storage først; send URL-ene til AI.
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
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-4">
      <h2 className="font-semibold text-gray-900">AI-bildediagnose</h2>
      <p className="mt-1 text-sm text-gray-500">
        Ta eller last opp 1–3 bilder, så tolker Claude tilstanden og foreslår tiltak.
      </p>

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
        <Button type="button" onClick={run} disabled={loading}>
          ✨ {loading ? 'Analyserer…' : 'Kjør diagnose'}
        </Button>
      </div>

      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

      {history.length > 0 && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Tidligere diagnoser</h3>
          {history.map((d) => (
            <DiagnosisCard key={d.id} diagnosis={d} />
          ))}
        </div>
      )}
    </section>
  )
}

function DiagnosisCard({ diagnosis }: { diagnosis: Diagnosis }) {
  const result = diagnosis.result_json as DiagnosisResult | null
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{formatDateTime(diagnosis.created_at)}</p>
      {diagnosis.summary && (
        <p className="mt-1 text-sm font-medium text-gray-800">{diagnosis.summary}</p>
      )}
      {result && (
        <div className="mt-2 space-y-2 text-sm">
          {result.overall_health && (
            <p className="text-gray-600">
              Generell helse: <span className="font-medium">{result.overall_health}</span>
            </p>
          )}
          {result.likely_issues?.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-gray-700">
              {result.likely_issues.map((iss, i) => (
                <li key={i}>
                  <span className="font-medium">{iss.issue}</span> ({iss.confidence}) – {iss.evidence}
                </li>
              ))}
            </ul>
          )}
          {result.actions?.length > 0 && (
            <div>
              <p className="font-medium text-gray-800">Tiltak:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-gray-700">
                {result.actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {result.notes && <p className="text-gray-500">{result.notes}</p>}
        </div>
      )}
      {diagnosis.image_urls?.length > 0 && (
        <div className="mt-2 flex gap-2">
          {diagnosis.image_urls.map((url, i) => (
            <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  )
}
