import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Plant } from '../types/db'
import { Spinner } from '../components/ui'

/**
 * Oversiktsside. I M0 viser den en tom liste (eller eventuelle rader fra
 * databasen). Full CRUD og plantekort kommer i M1.
 */
export default function PlantsPage() {
  const { profile } = useAuth()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('plants')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setPlants(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile?.household_id])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Plantene mine</h1>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Spinner label="Henter planter…" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Klarte ikke å hente planter: {error}
        </div>
      ) : plants.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {plants.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
            >
              <p className="font-semibold text-gray-900">{p.nickname}</p>
              {p.species && <p className="text-sm text-gray-500">{p.species}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-white/60 p-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-3xl">
        🪴
      </div>
      <h2 className="text-lg font-semibold text-gray-800">Ingen planter ennå</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
        Her dukker plantene deres opp. Muligheten til å legge til planter kommer i
        neste milepæl (M1).
      </p>
    </div>
  )
}
