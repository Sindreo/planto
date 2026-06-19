import { useEffect, useRef, useState } from 'react'
import { searchSpecies } from '../lib/species'
import type { Species } from '../types/db'

/**
 * Art-felt med søk i det delte registeret. Skriver man fritt, brukes teksten
 * som art (fritekst). Velger man et treff, kobles planten til registeret og
 * stellguiden kan fylles fra den lagrede arten.
 */
export default function SpeciesSelect({
  value,
  onChange,
  onSelectSpecies,
}: {
  value: string
  onChange: (text: string) => void
  onSelectSpecies: (species: Species) => void
}) {
  const [results, setResults] = useState<Species[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const r = await searchSpecies(value)
      if (active) setResults(r)
    }, 200)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [value])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Art / type</span>
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Søk i registeret eller skriv selv"
          autoComplete="off"
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:text-sm"
        />
      </label>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-brand-100 bg-white shadow-lg">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectSpecies(s)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">
                    {s.common_name ?? s.latin_name}
                  </span>
                  {s.common_name && (
                    <span className="ml-1 text-gray-500">· {s.latin_name}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-brand-600">fra registeret</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
