import type { Plant } from '../types/db'

const dateFmt = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(value: string | null): string {
  if (!value) return '–'
  return dateFmt.format(new Date(value))
}

export function formatDateTime(value: string | null): string {
  if (!value) return '–'
  return dateTimeFmt.format(new Date(value))
}

/** Dagens dato som YYYY-MM-DD i lokal tid (for sammenligning med next_water_due). */
export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

export type WaterStatus = 'overdue' | 'due_today' | 'upcoming' | 'none'

export function waterStatus(plant: Pick<Plant, 'next_water_due'>): WaterStatus {
  if (!plant.next_water_due) return 'none'
  const today = todayISO()
  if (plant.next_water_due < today) return 'overdue'
  if (plant.next_water_due === today) return 'due_today'
  return 'upcoming'
}

export function waterStatusLabel(plant: Pick<Plant, 'next_water_due'>): string {
  switch (waterStatus(plant)) {
    case 'overdue': {
      const days = daysBetween(plant.next_water_due!, todayISO()) // i dag − forfall
      return `På etterskudd (${days} ${days === 1 ? 'dag' : 'dager'})`
    }
    case 'due_today':
      return 'Skal vannes i dag'
    case 'upcoming':
      return `Vannes ${relativeDay(plant.next_water_due)}`
    default:
      return 'Ingen vanneplan'
  }
}

/** Antall dager mellom to ISO-datoer (b - a). */
export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO.slice(0, 10) + 'T00:00:00')
  const b = new Date(bISO.slice(0, 10) + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Vennlig, relativ dag-tekst: «i dag», «i morgen», «i går», «om 3 dager»,
 * «for 2 dager siden». Tar både YYYY-MM-DD og full ISO-tidsstempel.
 */
export function relativeDay(value: string | null): string {
  if (!value) return '–'
  const diff = daysBetween(todayISO(), value) // mål − i dag
  if (diff === 0) return 'i dag'
  if (diff === 1) return 'i morgen'
  if (diff === -1) return 'i går'
  if (diff > 1) return `om ${diff} dager`
  return `for ${Math.abs(diff)} dager siden`
}
