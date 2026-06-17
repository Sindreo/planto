// Typer for AI-svar fra Edge Function `plant-ai` (Claude claude-sonnet-4-6).

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
  likely_issues: DiagnosisIssue[]
  overall_health: string
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
  notes: string | null
}
