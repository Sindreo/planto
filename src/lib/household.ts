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
