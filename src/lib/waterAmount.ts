import type { WaterAmount } from '../types/db'

/** Nivåene i stigende rekkefølge – indeksen gir antall fylte dråper. */
export const WATER_AMOUNTS: readonly WaterAmount[] = ['sparsom', 'moderat', 'rikelig']

/** Kort etikett til dråpe-badgen. */
export const WATER_AMOUNT_LABELS: Record<WaterAmount, string> = {
  sparsom: 'Lite',
  moderat: 'Middels',
  rikelig: 'Mye',
}

/** Én-linjes forklaring – brukes i skjemaet og som fallback der setning mangler. */
export const WATER_AMOUNT_HINTS: Record<WaterAmount, string> = {
  sparsom: 'La jorda tørke helt ut mellom hver vanning',
  moderat: 'Vann grundig når toppen av jorda er tørr',
  rikelig: 'Hold jorda jevnt fuktig',
}

/** Antall fylte dråper (1–3). */
export function waterAmountLevel(amount: WaterAmount): number {
  return WATER_AMOUNTS.indexOf(amount) + 1
}

/** Godta kun kjente verdier (AI-svar og DB er utenfor vår kontroll). */
export function normalizeWaterAmount(value: unknown): WaterAmount | null {
  return typeof value === 'string' && (WATER_AMOUNTS as readonly string[]).includes(value)
    ? (value as WaterAmount)
    : null
}
