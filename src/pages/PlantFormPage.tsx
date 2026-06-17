import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Plant } from '../types/db'
import PlantForm from '../components/PlantForm'
import { Spinner } from '../components/ui'
import { ArrowLeft } from '../components/icons'

export default function PlantFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [plant, setPlant] = useState<Plant | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .from('plants')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setPlant(data)
        setLoading(false)
      })
  }, [id])

  return (
    <div>
      <Link
        to={isEdit ? `/plants/${id}` : '/planter'}
        className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Tilbake
      </Link>
      <h1 className="mb-5 mt-2 text-xl font-bold text-gray-900">
        {isEdit ? 'Rediger plante' : 'Ny plante'}
      </h1>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Spinner label="Henter plante…" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <PlantForm initial={plant ?? undefined} />
      )}
    </div>
  )
}
