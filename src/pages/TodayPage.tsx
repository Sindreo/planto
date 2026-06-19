import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logWatering, undoWatering } from '../lib/care'
import { relativeDay, todayISO, waterStatus } from '../lib/format'
import { useRefetchOnFocus } from '../lib/useRefetchOnFocus'
import type { Plant } from '../types/db'
import { Skeleton } from '../components/ui'
import { useToast } from '../components/Toast'
import { Check, Drop, PlantMark } from '../components/icons'

/**
 * Forsiden som dashboard: det som haster øverst (vann nå), så en oversikt
 * over kommende vanninger gruppert i denne uka / neste uke / senere denne
 * måneden, og til slutt et bla-felt med plantekortene. Mobil-først.
 */
export default function TodayPage() {
  const { profile, session } = useAuth()
  const toast = useToast()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('plants')
      .select('*')
      .order('next_water_due', { ascending: true, nullsFirst: false })
    setPlants(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load, profile?.household_id])
  useRefetchOnFocus(load)

  async function water(plant: Plant) {
    if (!session?.user) return
    const userId = session.user.id
    const prev = { last: plant.last_watered_at, next: plant.next_water_due }
    setBusy(plant.id)
    try {
      const { eventId } = await logWatering({
        plantId: plant.id,
        userId,
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
    } catch {
      toast({ message: 'Klarte ikke å lagre vanning', tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const groups = groupByDue(plants)
  const firstName = profile?.display_name?.split(' ')[0]

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-gray-500 first-letter:uppercase">{formatToday()}</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-gray-900">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        {!loading && (
          <p className="mt-1 text-sm text-gray-500">{summaryLine(groups.now.length)}</p>
        )}
      </header>

      {loading ? (
        <LoadingState />
      ) : plants.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Det som haster */}
          {groups.now.length > 0 ? (
            <section>
              <SectionHeader title="Trenger vann nå" count={groups.now.length} urgent />
              <ul className="space-y-2">
                {groups.now.map((p) => (
                  <WaterRow key={p.id} plant={p} busy={busy === p.id} onWater={() => water(p)} />
                ))}
              </ul>
            </section>
          ) : (
            <AllClear />
          )}

          {/* Kommende vanninger */}
          {(groups.thisWeek.length > 0 ||
            groups.nextWeek.length > 0 ||
            groups.laterMonth.length > 0) && (
            <section className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Kommende vanninger
              </h2>
              <UpcomingGroup title="Denne uka" plants={groups.thisWeek} />
              <UpcomingGroup title="Neste uke" plants={groups.nextWeek} />
              <UpcomingGroup title="Senere denne måneden" plants={groups.laterMonth} />
            </section>
          )}

          {/* Plantekort */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Plantene dine
              </h2>
              <Link to="/planter" className="text-sm font-medium text-brand-700 hover:underline">
                Se alle
              </Link>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {plants.map((p) => (
                <PlantCard key={p.id} plant={p} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/* ---------- grupperinger og datoer ---------- */

type Groups = {
  now: Plant[]
  thisWeek: Plant[]
  nextWeek: Plant[]
  laterMonth: Plant[]
}

function groupByDue(plants: Plant[]): Groups {
  const today = todayISO()
  // Mandag=0 … søndag=6
  const dow = (new Date(today + 'T00:00:00').getDay() + 6) % 7
  const endOfWeek = addDaysISO(today, 6 - dow)
  const endOfNextWeek = addDaysISO(endOfWeek, 7)
  const endOfMonth = endOfMonthISO(today)

  const groups: Groups = { now: [], thisWeek: [], nextWeek: [], laterMonth: [] }
  for (const p of plants) {
    const due = p.next_water_due
    if (!due) continue
    if (due <= today) groups.now.push(p)
    else if (due <= endOfWeek) groups.thisWeek.push(p)
    else if (due <= endOfNextWeek) groups.nextWeek.push(p)
    else if (due <= endOfMonth) groups.laterMonth.push(p)
  }
  return groups
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return isoOf(d)
}
function endOfMonthISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
function isoOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const todayFmt = new Intl.DateTimeFormat('nb-NO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
function formatToday(): string {
  return todayFmt.format(new Date())
}
function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'God natt'
  if (h < 10) return 'God morgen'
  if (h < 18) return 'Hei'
  return 'God kveld'
}
function summaryLine(nowCount: number): string {
  if (nowCount === 0) return 'Alt er à jour – ingenting trenger vann akkurat nå.'
  return `${nowCount} ${nowCount === 1 ? 'plante' : 'planter'} trenger vann nå.`
}

/* ---------- delkomponenter ---------- */

function SectionHeader({
  title,
  count,
  urgent = false,
}: {
  title: string
  count: number
  urgent?: boolean
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <span
        className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold ${
          urgent ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-800'
        }`}
      >
        {count}
      </span>
    </div>
  )
}

function Avatar({ plant, size = 'h-12 w-12' }: { plant: Plant; size?: string }) {
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-xl bg-brand-100`}>
      {plant.photo_url ? (
        <img
          src={plant.photo_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-brand-500">
          <PlantMark className="h-6 w-6" />
        </div>
      )}
    </div>
  )
}

function WaterRow({
  plant,
  busy,
  onWater,
}: {
  plant: Plant
  busy: boolean
  onWater: () => void
}) {
  const overdue = waterStatus(plant) === 'overdue'
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
      <Link to={`/plants/${plant.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar plant={plant} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{plant.nickname}</p>
          <p className={`truncate text-xs ${overdue ? 'font-medium text-red-600' : 'text-gray-500'}`}>
            {overdue ? `På etterskudd · ${relativeDay(plant.next_water_due)}` : 'Skal vannes i dag'}
          </p>
        </div>
      </Link>
      <button
        onClick={onWater}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        type="button"
      >
        <Drop className="h-4 w-4" />
        {busy ? '…' : 'Vannet'}
      </button>
    </li>
  )
}

function UpcomingGroup({ title, plants }: { title: string; plants: Plant[] }) {
  if (plants.length === 0) return null
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <span className="text-xs text-gray-500">{plants.length}</span>
      </div>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        {plants.map((p) => (
          <li key={p.id}>
            <Link to={`/plants/${p.id}`} className="flex items-center gap-3 p-2.5 hover:bg-brand-50/40">
              <Avatar plant={p} size="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{p.nickname}</p>
                {p.location && <p className="truncate text-xs text-gray-500">{p.location}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                {relativeDay(p.next_water_due)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlantCard({ plant }: { plant: Plant }) {
  const status = waterStatus(plant)
  const pill =
    status === 'overdue'
      ? { text: 'På etterskudd', cls: 'bg-red-100 text-red-700' }
      : status === 'due_today'
        ? { text: 'Vannes i dag', cls: 'bg-amber-100 text-amber-800' }
        : status === 'upcoming'
          ? { text: relativeDay(plant.next_water_due), cls: 'bg-brand-50 text-brand-700' }
          : { text: 'Ingen plan', cls: 'bg-gray-100 text-gray-500' }

  return (
    <Link
      to={`/plants/${plant.id}`}
      className="flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="aspect-square w-full bg-brand-100">
        {plant.photo_url ? (
          <img
            src={plant.photo_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-brand-500">
            <PlantMark className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-gray-900">{plant.nickname}</p>
        <span
          className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${pill.cls}`}
        >
          {pill.text}
        </span>
      </div>
    </Link>
  )
}

function AllClear() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-brand-600">
        <Check className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold text-gray-900">Alt er à jour</p>
        <p className="text-sm text-gray-500">Ingen planter trenger vann akkurat nå.</p>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-white/60 p-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-500">
        <PlantMark className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-semibold text-gray-800">Ingen planter ennå</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        Legg til den første planten deres, så dukker vanneplanen opp her.
      </p>
      <Link
        to="/plants/new"
        className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Legg til plante
      </Link>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm"
          >
            <Skeleton className="h-12 w-12 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-9 w-20 shrink-0" />
          </li>
        ))}
      </ul>
      <div className="-mx-4 flex gap-3 overflow-hidden px-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-36 shrink-0">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
