import { supabase } from './supabase'
import type { Profile } from '../types/db'

export type HouseholdMember = Pick<Profile, 'id' | 'display_name'>

/**
 * Henter medlemmene i innlogget brukers husstand (inkludert en selv). RLS på
 * profiles begrenser allerede resultatet til egen husstand, så vi trenger ikke
 * filtrere på household_id her.
 */
export async function listHouseholdMembers(): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as HouseholdMember[]
}

/** Henter bruker-id-ene som er ansvarlige for en plante. */
export async function getPlantResponsibles(plantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('plant_responsibles')
    .select('user_id')
    .eq('plant_id', plantId)
  if (error) throw error
  return (data ?? []).map((r) => r.user_id as string)
}

/**
 * Synkroniserer de ansvarlige for en plante til nøyaktig settet userIds:
 * fjerner dem som ikke lenger står oppført og legger til nye.
 */
export async function setPlantResponsibles(plantId: string, userIds: string[]): Promise<void> {
  const { error: delErr } = await supabase
    .from('plant_responsibles')
    .delete()
    .eq('plant_id', plantId)
  if (delErr) throw delErr
  if (userIds.length === 0) return
  const rows = userIds.map((user_id) => ({ plant_id: plantId, user_id }))
  const { error: insErr } = await supabase.from('plant_responsibles').insert(rows)
  if (insErr) throw insErr
}
