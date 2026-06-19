import { useState, type ComponentType } from 'react'
import { formatDateTime } from '../lib/format'
import type { Diagnosis } from '../types/db'
import type { DiagnosisResult } from '../types/ai'
import { Alert as WarnIcon, Drop, Leaf, Lens, PlantMark } from './icons'

type IconComponent = ComponentType<{ className?: string }>

/**
 * Viser én lagret diagnose. Det viktigste (frisk/syk + neste tiltak) vises
 * stort og blikkfangende; resten ligger bak «Vis hele vurderingen».
 * Gjenbrukes på plante- og diagnose-siden.
 */
export default function DiagnosisCard({
  diagnosis,
  defaultExpanded = false,
}: {
  diagnosis: Diagnosis
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const result = diagnosis.result_json as DiagnosisResult | null

  const status = statusFor(result)
  const primaryIssue = result?.likely_issues?.[0]
  const nextAction = result?.actions?.[0]
  const waterDays = result?.watering_recommendation_days

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Blikkfanger: status */}
      <div className={`flex items-center gap-3 px-4 py-3 ${status.bg}`}>
        <status.Icon className={`h-6 w-6 shrink-0 ${status.text}`} />
        <div className="min-w-0">
          <p className={`text-base font-bold leading-tight ${status.text}`}>{status.label}</p>
          {primaryIssue && (
            <p className={`truncate text-sm ${status.text} opacity-80`}>
              {primaryIssue.issue}
            </p>
          )}
        </div>
        <span className="ml-auto shrink-0 text-xs text-gray-500">
          {formatDateTime(diagnosis.created_at)}
        </span>
      </div>

      <div className="space-y-3 p-4">
        {/* Det viktigste: neste tiltak + når */}
        {(nextAction || waterDays != null) && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Neste steg
            </p>
            {nextAction && <p className="mt-1 text-sm text-gray-800">{nextAction}</p>}
            {waterDays != null && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-800">
                <Drop className="h-4 w-4" />
                Vann igjen om ca. {waterDays} {waterDays === 1 ? 'dag' : 'dager'}
              </p>
            )}
          </div>
        )}

        {/* Miniatyrbilder */}
        {diagnosis.image_urls?.length > 0 && (
          <div className="flex gap-2">
            {diagnosis.image_urls.map((url, i) => (
              <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
            ))}
          </div>
        )}

        {/* Ekspander for detaljer */}
        {result && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              {expanded ? 'Skjul detaljer ▴' : 'Vis hele vurderingen ▾'}
            </button>

            {expanded && (
              <div className="space-y-3 border-t border-gray-100 pt-3 text-sm">
                {result.likely_issues?.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-800">Funn:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-700">
                      {result.likely_issues.map((iss, i) => (
                        <li key={i}>
                          <span className="font-medium">{iss.issue}</span> ({iss.confidence}) – {iss.evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.actions?.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-800">Alle tiltak:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-700">
                      {result.actions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.notes && <p className="text-gray-500">{result.notes}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type StatusInfo = { label: string; Icon: IconComponent; bg: string; text: string }

const RED: StatusInfo = { label: 'Trenger hjelp', Icon: WarnIcon, bg: 'bg-red-50', text: 'text-red-700' }
const AMBER: StatusInfo = { label: 'Følg med', Icon: Lens, bg: 'bg-amber-50', text: 'text-amber-800' }
const GREEN: StatusInfo = { label: 'Ser frisk ut', Icon: Leaf, bg: 'bg-brand-50', text: 'text-brand-800' }
const NEUTRAL: StatusInfo = { label: 'Vurdert', Icon: PlantMark, bg: 'bg-gray-50', text: 'text-gray-700' }

/**
 * Utleder status robust: bruker et eksplisitt `health`-felt om det finnes,
 * ellers matcher den bredt mot helse-teksten og faller til slutt tilbake på
 * antall/alvorlighet av funn. Slik havner den sjelden på nøytral «Vurdert».
 */
function statusFor(result: DiagnosisResult | null): StatusInfo {
  if (!result) return NEUTRAL

  const fields = [result.health ?? '', result.overall_health ?? '']
    .join(' ')
    .toLowerCase()

  if (/dårlig|darlig|syk|kritisk|alvorlig|døende|visn/.test(fields)) return RED
  if (/middels|moderat|følg med|begynnende|tegn til|noe stress|lett/.test(fields)) return AMBER
  if (/god|frisk|sunn|fin form|bra|sterk|trives/.test(fields)) return GREEN

  // Ingen tydelige ord – utled fra funnene.
  const issues = result.likely_issues ?? []
  if (issues.some((i) => i.confidence === 'høy')) return RED
  if (issues.length > 0) return AMBER
  if (result.overall_health) return GREEN
  return NEUTRAL
}
