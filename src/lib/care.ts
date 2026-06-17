import { supabase } from './supabase'
import { todayISO } from './format'
import type { CareEventType } from '../types/db'

/**
 * Beregner neste forfallsdato (YYYY-MM-DD) fra et utgangspunkt + intervall.
 */
export function nextDueDate(fromISODate: string, intervalDays: number): string {
  const d = new Date(fromISODate + 'T00:00:00')
  d.setDate(d.getDate() + intervalDays)
  return d.toISOString().slice(0, 10)
}

/**
 * Registrerer at en plante er vannet i dag: oppdaterer last_watered_at og
 * next_water_due, og logger en care_event. Brukes av «Vannet i dag»-knappen.
 */
export async function logWatering(params: {
  plantId: string
  userId: string
  waterIntervalDays: number | null
}): Promise<void> {
  const now = new Date().toISOString()
  const today = todayISO()
  const next = params.waterIntervalDays
    ? nextDueDate(today, params.waterIntervalDays)
    : null

  const { error: updateError } = await supabase
    .from('plants')
    .update({ last_watered_at: now, next_water_due: next })
    .eq('id', params.plantId)
  if (updateError) throw updateError

  await logCareEvent({ plantId: params.plantId, userId: params.userId, type: 'watered' })
}

export async function logCareEvent(params: {
  plantId: string
  userId: string
  type: CareEventType
  note?: string
}): Promise<void> {
  const { error } = await supabase.from('care_events').insert({
    plant_id: params.plantId,
    user_id: params.userId,
    type: params.type,
    note: params.note ?? null,
  })
  if (error) throw error
}
