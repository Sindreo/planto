// Typer for AI-svar fra Edge Function `plant-ai` (Claude claude-sonnet-4-6).

import type { WaterAmount } from './db'

export type Confidence = 'høy' | 'middels' | 'lav'

export interface SpeciesCandidate {
  name: string
  latin_name: string
  confidence: Confidence
  note: string
}

export interface IdentifyResult {
  candidates: SpeciesCandidate[]
}

export interface DiagnosisIssue {
  issue: string
  confidence: Confidence
  evidence: string
}

export interface DiagnosisResult {
  /** Artsgjetning fra diagnose-bildet (når modellen er trygg nok). Lar oss
   *  hoppe over en separat artsgjenkjenning når man oppretter plante etterpå. */
  species?: { name: string; latin_name: string } | null
  likely_issues: DiagnosisIssue[]
  overall_health: string
  /** Valgfritt strukturert helsenivå. Brukes om det finnes; ellers utledes
   *  status fra overall_health-teksten og funnene. */
  health?: 'god' | 'middels' | 'dårlig' | null
  actions: string[]
  watering_recommendation_days: number | null
  notes: string
}

export interface CareGuideResult {
  light_needs: string | null
  water_interval_days: number | null
  fertilize_interval_days: number | null
  repot_interval_months: number | null
  toxic_to_pets: boolean | null
  /** Kort, konkret vannemåte (én setning): hvor grundig, jord vs. topp, blader tørre osv. */
  water_method: string | null
  /** Strukturert vannmengde. Modellen kan svare hva som helst – normaliser med
   *  `normalizeWaterAmount` før verdien brukes/lagres. */
  water_amount: WaterAmount | null
  notes: string | null
}
