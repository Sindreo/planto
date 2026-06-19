import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { logWatering, undoWatering } from '../lib/care'
import { todayISO, waterStatus } from '../lib/format'
import { useRefetchOnFocus } from '../lib/useRefetchOnFocus'
import type { Plant } from '../types/db'
import { Skeleton } from '../components/ui'
import { useToast } from '../components/Toast'
import { Check, Drop, PlantMark } from '../components/icons'

/**
 * «I dag»-skjerm (4.2 i SPEC): planter som forfaller i dag eller er på
 * etterskudd, for hele husstanden, med en rask «Vannet»-knapp.
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
      .not('next_water_due', 'is', null)
      .lte('next_water_due', todayISO())
      .order('next_water_due', { ascending: true })
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

  const overdue = plants.filter((p) => waterStatus(p) === 'overdue')
  const dueToday = plants.filter((p) => waterStatus(p) === 'due_today')

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-gray-900">I dag</h1>
      <p className="mb-6 text-sm text-gray-500">Hva som trenger vann nå.</p>

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
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
      ) : plants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 bg-white/60 p-10 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-600">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Alt er à jour!</h2>
          <p className="mt-1 text-sm text-gray-500">Ingen planter trenger vann i dag.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <Section title="På etterskudd" tone="red">
              {overdue.map((p) => (
                <PlantRow key={p.id} plant={p} busy={busy === p.id} onWater={() => water(p)} />
              ))}
            </Section>
          )}
          {dueToday.length > 0 && (
            <Section title="Forfaller i dag" tone="amber">
              {dueToday.map((p) => (
                <PlantRow key={p.id} plant={p} busy={busy === p.id} onWater={() => water(p)} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'red' | 'amber'
  children: React.ReactNode
}) {
  const dot = tone === 'red' ? 'bg-red-500' : 'bg-amber-500'
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

function PlantRow({
  plant,
  busy,
  onWater,
}: {
  plant: Plant
  busy: boolean
  onWater: () => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
      <Link to={`/plants/${plant.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-brand-100">
          {plant.photo_url ? (
            <img src={plant.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-brand-500">
              <PlantMark className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{plant.nickname}</p>
          {plant.location && <p className="truncate text-xs text-gray-500">{plant.location}</p>}
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
