import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logWatering } from '../lib/care'
import { formatDateTime, relativeDay, waterStatus, waterStatusLabel } from '../lib/format'
import type { CareEvent, Diagnosis, Plant, Profile } from '../types/db'
import DiagnosePanel from '../components/DiagnosePanel'
import DiagnosisCard from '../components/DiagnosisCard'
import { Button, Spinner } from '../components/ui'
import { ArrowLeft, Drop, Leaf, Note, Pin, PlantMark } from '../components/icons'

export default function PlantDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [plant, setPlant] = useState<Plant | null>(null)
  const [events, setEvents] = useState<CareEvent[]>([])
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [members, setMembers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [watering, setWatering] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [{ data: p, error: pe }, { data: ev }, { data: dg }, { data: mem }] = await Promise.all([
      supabase.from('plants').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('care_events')
        .select('*')
        .eq('plant_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('diagnoses')
        .select('*')
        .eq('plant_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name'),
    ])
    if (pe) setError(pe.message)
    setPlant(p)
    setEvents(ev ?? [])
    setDiagnoses(dg ?? [])
    const map: Record<string, string> = {}
    ;(mem as Pick<Profile, 'id' | 'display_name'>[] | null)?.forEach((m) => {
      map[m.id] = m.display_name ?? 'Noen'
    })
    setMembers(map)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleWatered() {
    if (!plant || !session?.user) return
    setWatering(true)
    try {
      await logWatering({
        plantId: plant.id,
        userId: session.user.id,
        waterIntervalDays: plant.water_interval_days,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWatering(false)
    }
  }

  async function handleDelete() {
    if (!plant) return
    if (!confirm(`Slette «${plant.nickname}»? Dette kan ikke angres.`)) return
    const { error } = await supabase.from('plants').delete().eq('id', plant.id)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/planter')
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner label="Henter plante…" />
      </div>
    )
  }

  if (!plant) {
    return (
      <div>
        <Link to="/planter" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Link>
        <p className="mt-4 text-gray-600">Fant ikke planten.</p>
      </div>
    )
  }

  const status = waterStatus(plant)

  return (
    <div className="space-y-5">
      <Link to="/planter" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Alle planter
      </Link>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Topp-kort */}
      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="aspect-[16/10] w-full bg-brand-100">
          {plant.photo_url ? (
            <img src={plant.photo_url} alt={plant.nickname} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-brand-500">
              <PlantMark className="h-16 w-16" />
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{plant.nickname}</h1>
              {plant.species && <p className="text-sm text-gray-500">{plant.species}</p>}
              {plant.location && (
                <p className="inline-flex items-center gap-1 text-sm text-gray-500">
                  <Pin className="h-3.5 w-3.5" />
                  {plant.location}
                </p>
              )}
            </div>
            <Link
              to={`/plants/${plant.id}/rediger`}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Rediger
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                status === 'overdue'
                  ? 'bg-red-100 text-red-700'
                  : status === 'due_today'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-brand-50 text-brand-700'
              }`}
            >
              {waterStatusLabel(plant)}
            </span>
            <Button onClick={handleWatered} disabled={watering}>
              <Drop className="h-4 w-4" />
              {watering ? 'Lagrer…' : 'Vannet i dag'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stellguide */}
      <section className="rounded-2xl border border-brand-100 bg-white p-4">
        <h2 className="font-semibold text-gray-900">Stellguide</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="Lysbehov" value={plant.light_needs} />
          <Field
            label="Vanning"
            value={plant.water_interval_days ? `Hver ${plant.water_interval_days}. dag` : null}
          />
          <Field
            label="Gjødsling"
            value={plant.fertilize_interval_days ? `Hver ${plant.fertilize_interval_days}. dag` : null}
          />
          <Field
            label="Ompotting"
            value={plant.repot_interval_months ? `Hver ${plant.repot_interval_months}. mnd` : null}
          />
          <Field label="Sist vannet" value={plant.last_watered_at ? relativeDay(plant.last_watered_at) : null} />
          <Field
            label="Giftig for kjæledyr"
            value={plant.toxic_to_pets == null ? null : plant.toxic_to_pets ? 'Ja' : 'Nei'}
          />
        </dl>
        {plant.notes && (
          <div className="mt-3 rounded-xl bg-brand-50/60 p-3 text-sm text-gray-700">
            {plant.notes}
          </div>
        )}
      </section>

      {/* Kjør ny diagnose */}
      <DiagnosePanel plant={plant} onComplete={load} />

      {/* Tidslinje: vanning, stell og diagnoser samlet */}
      <section className="rounded-2xl border border-brand-100 bg-white p-4">
        <h2 className="font-semibold text-gray-900">Tidslinje</h2>
        <Timeline events={events} diagnoses={diagnoses} members={members} />
      </section>

      <button
        onClick={handleDelete}
        className="text-sm text-red-600 hover:underline"
        type="button"
      >
        Slett plante
      </button>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-800">{value ?? '–'}</dd>
    </div>
  )
}

function EventIcon({ type }: { type: CareEvent['type'] }) {
  const cls = 'h-4 w-4 shrink-0 text-brand-600'
  switch (type) {
    case 'watered':
      return <Drop className={cls} />
    case 'fertilized':
      return <Leaf className={cls} />
    case 'repotted':
      return <PlantMark className={cls} />
    case 'note':
      return <Note className={cls} />
  }
}
function eventLabel(type: CareEvent['type']): string {
  return { watered: 'Vannet', fertilized: 'Gjødslet', repotted: 'Ompottet', note: 'Notat' }[type]
}

type TimelineItem =
  | { id: string; created_at: string; kind: 'care'; event: CareEvent }
  | { id: string; created_at: string; kind: 'diagnosis'; diagnosis: Diagnosis }

function Timeline({
  events,
  diagnoses,
  members,
}: {
  events: CareEvent[]
  diagnoses: Diagnosis[]
  members: Record<string, string>
}) {
  const items: TimelineItem[] = [
    ...events.map((e): TimelineItem => ({ id: `c-${e.id}`, created_at: e.created_at, kind: 'care', event: e })),
    ...diagnoses.map((d): TimelineItem => ({ id: `d-${d.id}`, created_at: d.created_at, kind: 'diagnosis', diagnosis: d })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))

  if (items.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">Ingen aktivitet ennå.</p>
  }

  return (
    <ul className="mt-3 space-y-3">
      {items.map((it) =>
        it.kind === 'care' ? (
          <li key={it.id} className="flex items-center gap-2 text-sm">
            <EventIcon type={it.event.type} />
            <span className="text-gray-700">{eventLabel(it.event.type)}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{members[it.event.user_id] ?? 'Noen'}</span>
            <span className="ml-auto text-xs text-gray-400">{formatDateTime(it.event.created_at)}</span>
          </li>
        ) : (
          <li key={it.id}>
            <DiagnosisCard diagnosis={it.diagnosis} />
          </li>
        ),
      )}
    </ul>
  )
}
