import type { WaterAmount } from '../types/db'
import {
  WATER_AMOUNT_HINTS,
  WATER_AMOUNT_LABELS,
  waterAmountLevel,
} from '../lib/waterAmount'
import { Drop } from './icons'

/**
 * Dråpeskala for vannmengde: tre dråper der 1–3 er fylt (lite/middels/mye).
 * Brukes frittstående i lister og inne i pille-badgen på detaljsiden.
 */
export function WaterDrops({ amount, className = '' }: { amount: WaterAmount; className?: string }) {
  const level = waterAmountLevel(amount)
  return (
    <span
      className={`inline-flex items-center ${className}`}
      role="img"
      aria-label={`Vannmengde: ${WATER_AMOUNT_LABELS[amount].toLowerCase()}`}
    >
      {[1, 2, 3].map((n) => (
        <Drop
          key={n}
          className={`h-3.5 w-3.5 ${n <= level ? 'fill-current text-sky-500' : 'text-sky-300'}`}
        />
      ))}
    </span>
  )
}

/** Pille-badge med dråpeskala + kort etikett («Lite», «Middels», «Mye»). */
export default function WaterAmountBadge({
  amount,
  className = '',
}: {
  amount: WaterAmount
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-800 ring-1 ring-inset ring-sky-100 ${className}`}
      title={WATER_AMOUNT_HINTS[amount]}
    >
      {/* Dråpene skjules for skjermleser – etiketten under sier det samme. */}
      <span aria-hidden="true" className="inline-flex items-center">
        <WaterDrops amount={amount} />
      </span>
      <span className="sr-only">Vannmengde: </span>
      {WATER_AMOUNT_LABELS[amount]}
    </span>
  )
}
