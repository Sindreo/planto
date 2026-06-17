import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { uploadPlantPhoto } from '../lib/photos'
import { linkDiagnosisToPlant } from '../lib/diagnoses'
import { fillCareGuide } from '../lib/ai'
import { nextDueDate } from '../lib/care'
import { todayISO } from '../lib/format'
import type { Plant } from '../types/db'
import type { CareGuideResult } from '../types/ai'
import { Alert, Button, Checkbox, Input, Textarea } from './ui'
import IdentifySpeciesButton from './IdentifySpeciesButton'
import CareGuideButton from './CareGuideButton'

type Props = { initial?: Plant }

/** Skjema for å opprette eller redigere en plante (M1), med AI-knapper (M2). */
export default function PlantForm({ initial }: Props) {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  // Satt når man oppretter en plante fra «Sjekk»-flyten – diagnosen kobles på etterpå.
  const fromDiagnosisId = (routerLocation.state as { diagnosisId?: string } | null)?.diagnosisId
  const isEdit = Boolean(initial)

  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [species, setSpecies] = useState(initial?.species ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [lightNeeds, setLightNeeds] = useState(initial?.light_needs ?? '')
  const [waterDays, setWaterDays] = useState(numToStr(initial?.water_interval_days))
  const [fertDays, setFertDays] = useState(numToStr(initial?.fertilize_interval_days))
  const [repotMonths, setRepotMonths] = useState(numToStr(initial?.repot_interval_months))
  const [toxic, setToxic] = useState(initial?.toxic_to_pets ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const photoUrl = initial?.photo_url ?? ''
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)

  /** Fyll inn et stellguide-felt kun hvis brukeren ikke alt har skrevet noe. */
  function applyGuide(g: CareGuideResult) {
    if (g.light_needs && !lightNeeds) setLightNeeds(g.light_needs)
    if (g.water_interval_days != null && !waterDays) setWaterDays(String(g.water_interval_days))
    if (g.fertilize_interval_days != null && !fertDays) setFertDays(String(g.fertilize_interval_days))
    if (g.repot_interval_months != null && !repotMonths) setRepotMonths(String(g.repot_interval_months))
    if (g.toxic_to_pets != null) setToxic(g.toxic_to_pets)
    if (g.notes && !notes) setNotes(g.notes)
  }

  /**
   * Når en art velges fra «Finn art»: sett arten, foreslå kallenavn hvis tomt,
   * og fyll ut stellguiden automatisk – minst mulig manuelt arbeid.
   */
  async function handleSpeciesPicked(name: string) {
    setSpecies(name)
    if (!nickname.trim()) setNickname(name)
    try {
      setAutoFilling(true)
      const guide = await fillCareGuide(name, session?.access_token)
      applyGuide(guide)
    } catch {
      // Stille – brukeren kan trykke «Fyll ut med AI» manuelt ved behov.
    } finally {
      setAutoFilling(false)
    }
  }

  function onPickPhoto(file: File | null) {
    setPhotoFile(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : photoUrl)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile?.household_id) return
    setError(null)
    setSaving(true)
    try {
      let finalPhotoUrl = photoUrl
      if (photoFile) {
        finalPhotoUrl = await uploadPlantPhoto(profile.household_id, photoFile)
      }

      const water = strToNum(waterDays)
      const row = {
        household_id: profile.household_id,
        nickname: nickname.trim(),
        species: emptyToNull(species),
        location: emptyToNull(location),
        light_needs: emptyToNull(lightNeeds),
        water_interval_days: water,
        fertilize_interval_days: strToNum(fertDays),
        repot_interval_months: strToNum(repotMonths),
        toxic_to_pets: toxic,
        notes: emptyToNull(notes),
        photo_url: finalPhotoUrl || null,
      }

      if (isEdit && initial) {
        // Hvis vanneintervall finnes men ingen forfallsdato er satt, beregn en.
        const next =
          water && !initial.next_water_due
            ? nextDueDate(initial.last_watered_at?.slice(0, 10) ?? todayISO(), water)
            : initial.next_water_due
        const { error } = await supabase
          .from('plants')
          .update({ ...row, next_water_due: next })
          .eq('id', initial.id)
        if (error) throw error
        navigate(`/plants/${initial.id}`)
      } else {
        // Ny plante: regn forfallsdato fra i dag hvis intervall er satt.
        const next = water ? nextDueDate(todayISO(), water) : null
        const { data, error } = await supabase
          .from('plants')
          .insert({ ...row, next_water_due: next })
          .select()
          .single()
        if (error) throw error
        // Kom man hit fra en løs diagnose, knytt den til den nye planten.
        if (fromDiagnosisId) {
          try {
            await linkDiagnosisToPlant(fromDiagnosisId, data.id)
          } catch {
            // Ikke kritisk – planten er opprettet uansett.
          }
        }
        navigate(`/plants/${data.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Bilde + plante-ID */}
      <div className="flex items-center gap-4">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-100 text-3xl">
          {photoPreview ? (
            <img src={photoPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            '🪴'
          )}
          {identifying && (
            <div className="absolute inset-0 bg-brand-900/25">
              <div className="absolute inset-x-0 top-0 h-7 animate-scan bg-gradient-to-b from-transparent via-white/85 to-transparent" />
              <div className="absolute inset-0 ring-2 ring-inset ring-brand-300/70" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="inline-block cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {photoPreview ? 'Bytt bilde' : 'Velg bilde'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <IdentifySpeciesButton
            file={photoFile}
            existingUrl={photoUrl || undefined}
            accessToken={session?.access_token}
            onPick={handleSpeciesPicked}
            onLoadingChange={setIdentifying}
          />
        </div>
      </div>

      <Input
        label="Kallenavn *"
        placeholder="F.eks. Monstera på soverommet"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
      />

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Art / type"
            placeholder="F.eks. Monstera deliciosa"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          />
        </div>
      </div>

      <Input
        label="Plassering / rom"
        placeholder="F.eks. Stue, vindu mot sør"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            Stellguide
            {autoFilling && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-brand-600">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                fyller ut…
              </span>
            )}
          </h3>
          <CareGuideButton
            species={species}
            accessToken={session?.access_token}
            onResult={(g) => {
              if (g.light_needs) setLightNeeds(g.light_needs)
              if (g.water_interval_days != null) setWaterDays(String(g.water_interval_days))
              if (g.fertilize_interval_days != null) setFertDays(String(g.fertilize_interval_days))
              if (g.repot_interval_months != null) setRepotMonths(String(g.repot_interval_months))
              if (g.toxic_to_pets != null) setToxic(g.toxic_to_pets)
              if (g.notes) setNotes((prev) => (prev ? prev : g.notes ?? ''))
            }}
          />
        </div>
        <div className="space-y-4">
          <Input
            label="Lysbehov"
            placeholder="F.eks. Mye indirekte lys"
            value={lightNeeds}
            onChange={(e) => setLightNeeds(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Vanning (dager)"
              type="number"
              min={1}
              placeholder="7"
              value={waterDays}
              onChange={(e) => setWaterDays(e.target.value)}
            />
            <Input
              label="Gjødsling (dager)"
              type="number"
              min={1}
              placeholder="30"
              value={fertDays}
              onChange={(e) => setFertDays(e.target.value)}
            />
            <Input
              label="Ompotting (mnd)"
              type="number"
              min={1}
              placeholder="12"
              value={repotMonths}
              onChange={(e) => setRepotMonths(e.target.value)}
            />
          </div>
          <Checkbox label="Giftig for kjæledyr" checked={toxic} onChange={setToxic} />
          <Textarea
            label="Notater"
            rows={3}
            placeholder="Egne notater om planten"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving || !nickname.trim()} className="flex-1">
          {saving ? 'Lagrer…' : isEdit ? 'Lagre endringer' : 'Legg til plante'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          Avbryt
        </Button>
      </div>
    </form>
  )
}

function numToStr(n: number | null | undefined): string {
  return n == null ? '' : String(n)
}
function strToNum(s: string): number | null {
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
function emptyToNull(s: string): string | null {
  const t = s.trim()
  return t === '' ? null : t
}
