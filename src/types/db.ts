// Database-typer som speiler Supabase-skjemaet (se supabase/migrations).
// Holdt enkelt og håndskrevet for M0; kan senere genereres med
// `supabase gen types typescript`.

export type CareEventType = 'watered' | 'fertilized' | 'repotted' | 'note'

export type Household = {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export type Species = {
  id: string
  latin_name: string
  common_name: string | null
  light_needs: string | null
  water_interval_days: number | null
  fertilize_interval_days: number | null
  repot_interval_months: number | null
  toxic_to_pets: boolean | null
  notes: string | null
  created_at: string
}

export type Profile = {
  id: string
  household_id: string | null
  display_name: string | null
  created_at: string
}

export type Plant = {
  id: string
  household_id: string
  nickname: string
  species: string | null
  species_id: string | null
  location: string | null
  photo_url: string | null
  light_needs: string | null
  water_interval_days: number | null
  fertilize_interval_days: number | null
  repot_interval_months: number | null
  toxic_to_pets: boolean | null
  notes: string | null
  last_watered_at: string | null
  last_fertilized_at: string | null
  next_water_due: string | null
  responsible_user_id: string | null
  created_at: string
}

export type CareEvent = {
  id: string
  plant_id: string
  user_id: string
  type: CareEventType
  note: string | null
  created_at: string
}

export type Diagnosis = {
  id: string
  plant_id: string | null
  user_id: string
  image_urls: string[]
  model: string | null
  result_json: unknown
  summary: string | null
  created_at: string
}

// Minimal Database-type for supabase-js generics.
export interface Database {
  public: {
    Tables: {
      households: { Row: Household; Insert: Partial<Household>; Update: Partial<Household>; Relationships: [] }
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] }
      plants: { Row: Plant; Insert: Partial<Plant>; Update: Partial<Plant>; Relationships: [] }
      care_events: { Row: CareEvent; Insert: Partial<CareEvent>; Update: Partial<CareEvent>; Relationships: [] }
      diagnoses: { Row: Diagnosis; Insert: Partial<Diagnosis>; Update: Partial<Diagnosis>; Relationships: [] }
      species: { Row: Species; Insert: Partial<Species>; Update: Partial<Species>; Relationships: [] }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_household: { Args: { p_name: string }; Returns: string }
      join_household: { Args: { p_invite_code: string }; Returns: string }
      upsert_species: {
        Args: {
          p_latin_name: string
          p_common_name?: string | null
          p_light_needs?: string | null
          p_water_interval_days?: number | null
          p_fertilize_interval_days?: number | null
          p_repot_interval_months?: number | null
          p_toxic_to_pets?: boolean | null
          p_notes?: string | null
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
