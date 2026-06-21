import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logWatering, undoWatering } from '../lib/care'
import { formatDateTime, relativeDay, waterStatus, waterStatusLabel } from '../lib/format'
import { useRefetchOnFocus } from '../lib/useRefetchOnFocus'
import { translateError } from '../lib/errors'
import { useToast } from '../components/Toast'
import type { CareEvent, Diagnosis, Plant, Profile } from '../types/db'
import DiagnosePanel from '../components/DiagnosePanel'
import DiagnosisCard from '../components/DiagnosisCard'
import ConfirmDialog from '../components/ConfirmDialog'
import { Button, Skeleton } from '../components/ui'
import { ArrowLeft, Close, Drop, Leaf, Note, Person, Pin, PlantMark } from '../components/icons'

export default function PlantDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [plant, setPlant] = useState<Plant | null>(null)
  const [events, setEvents] = useState<CareEvent[]>([])
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [members, setMembers] = useState<Record<string, string>>({})
  const [responsibleIds, setResponsibleIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [watering, setWatering] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [{ data: p, error: pe }, { data: ev }, { data: dg }, { data: mem }, { data: resp }] =
      await Promise.all([
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
        supabase.from('plant_responsibles').select('user_id').eq('plant_id', id),
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
    setResponsibleIds(((resp as { user_id: string }[] | null) ?? []).map((r) => r.user_id))
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])
  useRefetchOnFocus(load)

  // Lukk fullskjerm-bildet med Escape.
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightbox])

  async function handleWatered() {
    if (!plant || !session?.user) return
    const prev = { last: plant.last_watered_at, next: plant.next_water_due }
    setWatering(true)
    try {
      const { eventId } = await logWatering({
        plantId: plant.id,
        userId: session.user.id,
        waterIntervalDays: plant.water_interval_days,
      })
      await load()
      toast({
        message: `Vannet ${plant.nickname}`,
        action: {
          label: 'Angre',
          onClick: async () => {
            await undoWatering({
              plantId: plant.id,
              eventId,
              prevLastWateredAt: prev.last,
              prevNextWaterDue: prev.next,
            })
            await load()
          },
        },
      })
    } catch (err) {
      setError(translateError(err))
    } finally {
      setWatering(false)
    }
  }

  async function handleDelete() {
    if (!plant) return
    setConfirmDelete(false)
    const { error } = await supabase.from('plants').delete().eq('id', plant.id)
    if (error) {
      setError(translateError(error))
      return
    }
    toast({ message: `Slettet «${plant.nickname}»` })
    navigate('/planter')
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
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
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="block h-full w-full"
              aria-label="Vis bildet i full størrelse"
            >
              <img src={plant.photo_url} alt={plant.nickname} className="h-full w-full object-cover" />
            </button>
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
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                <Person className="h-3.5 w-3.5 shrink-0" />
                {responsibleIds.length > 0
                  ? `Ansvarlige: ${responsibleIds.map((uid) => members[uid] ?? 'Noen').join(', ')}`
                  : 'Ingen ansvarlige'}
              </p>
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
        onClick={() => setConfirmDelete(true)}
        className="text-sm text-red-600 hover:underline"
        type="button"
      >
        Slett plante
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title={`Slette «${plant.nickname}»?`}
        message="Planten og hele tidslinjen dens fjernes. Dette kan ikke angres."
        confirmLabel="Slett"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      {lightbox && plant.photo_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Bilde av ${plant.nickname}`}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Lukk"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            <Close className="h-5 w-5" />
          </button>
          <img
            src={plant.photo_url}
            alt={plant.nickname}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
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
            <span className="ml-auto text-xs text-gray-500">{formatDateTime(it.event.created_at)}</span>
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
