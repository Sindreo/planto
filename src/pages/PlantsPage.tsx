import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { waterStatus, waterStatusLabel } from '../lib/format'
import { useRefetchOnFocus } from '../lib/useRefetchOnFocus'
import type { Plant } from '../types/db'
import { Button, Skeleton } from '../components/ui'
import { PlantMark, Plus } from '../components/icons'

const PAGE = 30

export default function PlantsPage() {
  const { profile } = useAuth()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE)
    if (error) setError(error.message)
    else {
      setPlants(data ?? [])
      setHasMore((data?.length ?? 0) === PAGE)
    }
    setLoading(false)
  }, [])

  // Henter neste side og legger den til. Holder lista liten ved mange planter.
  async function showMore() {
    setLoadingMore(true)
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .order('created_at', { ascending: false })
      .range(plants.length, plants.length + PAGE - 1)
    if (!error && data) {
      setPlants((prev) => [...prev, ...data])
      setHasMore(data.length === PAGE)
    }
    setLoadingMore(false)
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [load, profile?.household_id])
  useRefetchOnFocus(load)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Plantene mine</h1>
        <Link to="/plants/new">
          <Button>
            <Plus className="h-4 w-4" />
            Ny plante
          </Button>
        </Link>
      </div>

      {loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm"
            >
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Klarte ikke å hente planter: {error}
        </div>
      ) : plants.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {plants.map((p) => (
            <li key={p.id}>
              <Link
                to={`/plants/${p.id}`}
                className="block overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-square w-full bg-brand-100">
                  {p.photo_url ? (
                    <img
                      src={p.photo_url}
                      alt={p.nickname}
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
                <div className="p-3">
                  <p className="truncate font-semibold text-gray-900">{p.nickname}</p>
                  {p.species && <p className="truncate text-xs text-gray-500">{p.species}</p>}
                  <StatusBadge plant={p} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-5 text-center">
          <Button variant="ghost" onClick={showMore} disabled={loadingMore}>
            {loadingMore ? 'Henter…' : 'Vis flere'}
          </Button>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ plant }: { plant: Plant }) {
  const status = waterStatus(plant)
  const styles: Record<string, string> = {
    overdue: 'bg-red-100 text-red-700',
    due_today: 'bg-amber-100 text-amber-800',
    upcoming: 'bg-brand-50 text-brand-700',
    none: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}>
      {waterStatusLabel(plant)}
    </span>
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
        Legg til den første planten deres – ta et bilde, så kan AI gjette arten og
        fylle ut stellguiden.
      </p>
      <Link to="/plants/new" className="mt-4 inline-block">
        <Button>
          <Plus className="h-4 w-4" />
          Legg til plante
        </Button>
      </Link>
    </div>
  )
}
