import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysBetween, relativeDay, waterStatus, waterStatusLabel } from './format'

describe('daysBetween', () => {
  it('teller dager fremover og bakover', () => {
    expect(daysBetween('2025-01-01', '2025-01-08')).toBe(7)
    expect(daysBetween('2025-01-08', '2025-01-01')).toBe(-7)
    expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0)
  })

  it('er upåvirket av sommertid-overgang', () => {
    expect(daysBetween('2025-03-29', '2025-03-31')).toBe(2)
  })

  it('ignorerer klokkeslett i fullt ISO-tidsstempel', () => {
    expect(daysBetween('2025-01-01T23:00:00Z', '2025-01-03T01:00:00Z')).toBe(2)
  })
})

// Fast «nå» midt på dagen (UTC), så dagens dato er 2025-06-15 i alle rimelige
// tidssoner – testene er dermed uavhengige av kjøremiljøets tidssone.
describe('today-avhengige hjelpere', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('waterStatus', () => {
    it('klassifiserer i forhold til i dag', () => {
      expect(waterStatus({ next_water_due: null })).toBe('none')
      expect(waterStatus({ next_water_due: '2025-06-14' })).toBe('overdue')
      expect(waterStatus({ next_water_due: '2025-06-15' })).toBe('due_today')
      expect(waterStatus({ next_water_due: '2025-06-16' })).toBe('upcoming')
    })
  })

  describe('relativeDay', () => {
    it('gir vennlig relativ tekst', () => {
      expect(relativeDay(null)).toBe('–')
      expect(relativeDay('2025-06-15')).toBe('i dag')
      expect(relativeDay('2025-06-16')).toBe('i morgen')
      expect(relativeDay('2025-06-14')).toBe('i går')
      expect(relativeDay('2025-06-18')).toBe('om 3 dager')
      expect(relativeDay('2025-06-13')).toBe('for 2 dager siden')
    })
  })

  describe('waterStatusLabel', () => {
    it('formaterer status med riktig entall/flertall', () => {
      expect(waterStatusLabel({ next_water_due: null })).toBe('Ingen vanneplan')
      expect(waterStatusLabel({ next_water_due: '2025-06-15' })).toBe('Skal vannes i dag')
      expect(waterStatusLabel({ next_water_due: '2025-06-16' })).toBe('Vannes i morgen')
      expect(waterStatusLabel({ next_water_due: '2025-06-14' })).toBe('På etterskudd (1 dag)')
      expect(waterStatusLabel({ next_water_due: '2025-06-13' })).toBe('På etterskudd (2 dager)')
    })
  })
})
