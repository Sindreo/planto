import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { uploadPlantPhoto } from '../lib/photos'
import { linkDiagnosisToPlant } from '../lib/diagnoses'
import { fillCareGuide, identifySpecies } from '../lib/ai'
import { upsertSpecies, speciesToGuide } from '../lib/species'
import { nextDueDate } from '../lib/care'
import { todayISO } from '../lib/format'
import { translateError } from '../lib/errors'
import {
  getPlantResponsibles,
  listHouseholdMembers,
  setPlantResponsibles,
  type HouseholdMember,
} from '../lib/household'
import type { Plant, Species } from '../types/db'
import type { CareGuideResult, DiagnosisResult, SpeciesCandidate } from '../types/ai'
import { Alert, Button, Checkbox, Input, Textarea } from './ui'
import { useToast } from './Toast'
import IdentifySpeciesButton from './IdentifySpeciesButton'
import CareGuideButton from './CareGuideButton'
import SpeciesSelect from './SpeciesSelect'
import { PlantMark } from './icons'

type Props = { initial?: Plant }

/** Skjema for å opprette eller redigere en plante (M1), med AI-knapper (M2). */
export default function PlantForm({ initial }: Props) {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const routerLocation = useLocation()
  // Satt når man oppretter en plante fra «Sjekk»-flyten – diagnosen kobles på
  // etterpå, og bildet + vurderingen tas med så feltene kan forhåndsutfylles.
  const navState = routerLocation.state as
    | { diagnosisId?: string; photoUrl?: string; diagnosis?: DiagnosisResult }
    | null
  const fromDiagnosisId = navState?.diagnosisId
  const carriedPhotoUrl = navState?.photoUrl ?? ''
  const carriedDiagnosis = navState?.diagnosis ?? null
  const isEdit = Boolean(initial)

  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [species, setSpecies] = useState(initial?.species ?? '')
  const [speciesId, setSpeciesId] = useState<string | null>(initial?.species_id ?? null)
  const [location, setLocation] = useState(initial?.location ?? '')
  const [lightNeeds, setLightNeeds] = useState(initial?.light_needs ?? '')
  const [waterDays, setWaterDays] = useState(
    numToStr(initial?.water_interval_days) ||
      (carriedDiagnosis?.watering_recommendation_days != null
        ? String(carriedDiagnosis.watering_recommendation_days)
        : ''),
  )
  const [fertDays, setFertDays] = useState(numToStr(initial?.fertilize_interval_days))
  const [repotMonths, setRepotMonths] = useState(numToStr(initial?.repot_interval_months))
  const [toxic, setToxic] = useState(initial?.toxic_to_pets ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  // Lar brukeren overstyre når planten skal vannes neste gang.
  const [nextWaterDue, setNextWaterDue] = useState(initial?.next_water_due?.slice(0, 10) ?? '')

  // Ansvarlige husstandsmedlemmer (flere mulig). Standard ved ny plante er
  // innlogget bruker. Kun de ansvarlige får vanne-varslingen på e-post.
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [responsibleIds, setResponsibleIds] = useState<string[]>(
    isEdit ? [] : session?.user?.id ? [session.user.id] : [],
  )

  function toggleResponsible(userId: string, on: boolean) {
    setResponsibleIds((prev) =>
      on ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId),
    )
  }

  // Gjenbruk det allerede opplastede diagnose-bildet som plantens bilde.
  const photoUrl = initial?.photo_url ?? carriedPhotoUrl
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url ?? carriedPhotoUrl)

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
   * fyll ut stellguiden automatisk, og legg/berik arten i det delte registeret.
   */
  async function handleSpeciesPicked(candidate: SpeciesCandidate) {
    const name = candidate.name
    setSpecies(name)
    if (!nickname.trim()) setNickname(name)
    try {
      setAutoFilling(true)
      // Registrer arten med en gang (uten stell), så vi har en id.
      if (candidate.latin_name?.trim()) {
        const id = await upsertSpecies({
          latinName: candidate.latin_name,
          commonName: name,
        })
        setSpeciesId(id)
      }
      const guide = await fillCareGuide(name, session?.access_token)
      applyGuide(guide)
      // Berik registeret med stellguiden, så neste gang slipper man AI-kallet.
      if (candidate.latin_name?.trim()) {
        await upsertSpecies({ latinName: candidate.latin_name, commonName: name, guide })
      }
    } catch {
      // Stille – brukeren kan trykke «Fyll ut med AI» manuelt ved behov.
    } finally {
      setAutoFilling(false)
    }
  }

  /** Når en art velges fra registeret: koble til og fyll stellguiden fra arten. */
  function handleSpeciesSelected(s: Species) {
    setSpecies(s.common_name ?? s.latin_name)
    setSpeciesId(s.id)
    if (!nickname.trim()) setNickname(s.common_name ?? s.latin_name)
    applyGuide(speciesToGuide(s))
  }

  function onPickPhoto(file: File | null) {
    setPhotoFile(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : photoUrl)
    // Ny plante: kjør artsgjenkjenning automatisk når et bilde velges, så
    // brukeren slipper å trykke «Finn art». Hopp over hvis art alt er satt.
    if (file && !isEdit && !species.trim()) {
      void runIdentify(file)
    }
  }

  /** Kjør AI-artsgjenkjenning på et bilde og fyll inn toppforslaget + stell. */
  const identifyingRef = useRef(false)
  async function runIdentify(image: Blob) {
    if (identifyingRef.current) return
    identifyingRef.current = true
    try {
      setIdentifying(true)
      const res = await identifySpecies(image, session?.access_token)
      const top = res.candidates?.[0]
      if (top) await handleSpeciesPicked(top)
    } catch {
      // Stille – brukeren kan trykke «Finn art» manuelt.
    } finally {
      setIdentifying(false)
      identifyingRef.current = false
    }
  }

  // Hent husstandsmedlemmer til ansvarlig-listen, og last inn plantens
  // nåværende ansvarlige ved redigering.
  useEffect(() => {
    let cancelled = false
    void listHouseholdMembers()
      .then((m) => {
        if (!cancelled) setMembers(m)
      })
      .catch(() => {
        // Stille – lista vises tom om medlemmene ikke kan hentes.
      })
    if (isEdit && initial) {
      void getPlantResponsibles(initial.id)
        .then((ids) => {
          if (!cancelled) setResponsibleIds(ids)
        })
        .catch(() => {
          // Stille – beholder tomt utvalg om henting feiler.
        })
    }
    return () => {
      cancelled = true
    }
  }, [isEdit, initial])

  // Kom man hit fra «Sjekk en plante» med et bilde, finn arten automatisk fra
  // bildet slik at art og stell er forhåndsutfylt (kan endres etterpå).
  useEffect(() => {
    if (isEdit || !carriedPhotoUrl) return
    let cancelled = false
    void (async () => {
      try {
        const blob = await fetch(carriedPhotoUrl).then((r) => r.blob())
        if (!cancelled) await runIdentify(blob)
      } catch {
        // Stille.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        species_id: speciesId,
        location: emptyToNull(location),
        light_needs: emptyToNull(lightNeeds),
        water_interval_days: water,
        fertilize_interval_days: strToNum(fertDays),
        repot_interval_months: strToNum(repotMonths),
        toxic_to_pets: toxic,
        notes: emptyToNull(notes),
        photo_url: finalPhotoUrl || null,
      }

      // Neste vanning: brukerens eksplisitte dato vinner, ellers behold/auto-beregn.
      let next: string | null
      if (nextWaterDue) {
        next = nextWaterDue
      } else if (isEdit && initial) {
        // Har intervall men ingen forfallsdato? Beregn fra sist vannet/i dag.
        next =
          water && !initial.next_water_due
            ? nextDueDate(initial.last_watered_at?.slice(0, 10) ?? todayISO(), water)
            : initial.next_water_due
      } else {
        next = water ? nextDueDate(todayISO(), water) : null
      }

      if (isEdit && initial) {
        const { error } = await supabase
          .from('plants')
          .update({ ...row, next_water_due: next })
          .eq('id', initial.id)
        if (error) throw error
        await setPlantResponsibles(initial.id, responsibleIds)
        toast({ message: 'Endringer lagret' })
        navigate(`/plants/${initial.id}`)
      } else {
        const { data, error } = await supabase
          .from('plants')
          .insert({ ...row, next_water_due: next })
          .select()
          .single()
        if (error) throw error
        await setPlantResponsibles(data.id, responsibleIds)
        // Kom man hit fra en løs diagnose, knytt den til den nye planten.
        if (fromDiagnosisId) {
          try {
            await linkDiagnosisToPlant(fromDiagnosisId, data.id)
          } catch {
            // Ikke kritisk – planten er opprettet uansett.
          }
        }
        toast({ message: `La til «${row.nickname}»` })
        navigate(`/plants/${data.id}`, { state: { justCreated: true } })
      }
    } catch (err) {
      setError(translateError(err))
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
            <PlantMark className="h-8 w-8 text-brand-500" />
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

      <SpeciesSelect
        value={species}
        onChange={(text) => {
          setSpecies(text)
          // Fri redigering bryter koblingen til registeret.
          setSpeciesId(null)
        }}
        onSelectSpecies={handleSpeciesSelected}
      />

      <Input
        label="Plassering / rom"
        placeholder="F.eks. Stue, vindu mot sør"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-gray-700">Ansvarlige</legend>
        <p className="mb-2 text-xs text-gray-500">
          Kun de ansvarlige får e-postvarsel når planten må vannes.
        </p>
        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-gray-500">Ingen husstandsmedlemmer funnet.</p>
          ) : (
            members.map((m) => (
              <Checkbox
                key={m.id}
                label={(m.display_name ?? 'Uten navn') + (m.id === session?.user?.id ? ' (meg)' : '')}
                checked={responsibleIds.includes(m.id)}
                onChange={(on) => toggleResponsible(m.id, on)}
              />
            ))
          )}
        </div>
      </fieldset>

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
          <div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Neste vanning</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={nextWaterDue}
                  onChange={(e) => setNextWaterDue(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setNextWaterDue(todayISO())}
                  className="shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  I dag
                </button>
              </div>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Overstyrer vanneplanen. La stå tom for å bruke vanne-intervallet automatisk.
            </p>
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
