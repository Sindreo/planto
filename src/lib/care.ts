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
}): Promise<{ eventId: string }> {
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

  const eventId = await logCareEvent({
    plantId: params.plantId,
    userId: params.userId,
    type: 'watered',
  })
  return { eventId }
}

/**
 * Angrer en nettopp loggført vanning: sletter care_event-en og setter
 * plantens forrige tilstand tilbake.
 */
export async function undoWatering(params: {
  plantId: string
  eventId: string
  prevLastWateredAt: string | null
  prevNextWaterDue: string | null
}): Promise<void> {
  await supabase.from('care_events').delete().eq('id', params.eventId)
  const { error } = await supabase
    .from('plants')
    .update({
      last_watered_at: params.prevLastWateredAt,
      next_water_due: params.prevNextWaterDue,
    })
    .eq('id', params.plantId)
  if (error) throw error
}

export async function logCareEvent(params: {
  plantId: string
  userId: string
  type: CareEventType
  note?: string
}): Promise<string> {
  const { data, error } = await supabase
    .from('care_events')
    .insert({
      plant_id: params.plantId,
      user_id: params.userId,
      type: params.type,
      note: params.note ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
