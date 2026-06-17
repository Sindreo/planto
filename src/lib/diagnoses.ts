import { supabase } from './supabase'
import type { Diagnosis } from '../types/db'

/** Henter den nyeste «løse» diagnosen (uten plante) for en bruker. */
export async function fetchLatestLooseDiagnosis(
  userId: string,
): Promise<Diagnosis | null> {
  const { data } = await supabase
    .from('diagnoses')
    .select('*')
    .is('plant_id', null)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

/** Knytter en diagnose til en plante (gjør en løs diagnose om til oppfølging). */
export async function linkDiagnosisToPlant(
  diagnosisId: string,
  plantId: string,
): Promise<void> {
  const { error } = await supabase
    .from('diagnoses')
    .update({ plant_id: plantId })
    .eq('id', diagnosisId)
  if (error) throw error
}
