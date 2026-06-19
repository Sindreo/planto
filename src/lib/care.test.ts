import { describe, expect, it } from 'vitest'
import { nextDueDate } from './care'

describe('nextDueDate', () => {
  it('legger til intervallet', () => {
    expect(nextDueDate('2025-01-08', 7)).toBe('2025-01-15')
    expect(nextDueDate('2025-06-01', 3)).toBe('2025-06-04')
  })

  it('ruller over måned og år', () => {
    expect(nextDueDate('2025-01-31', 1)).toBe('2025-02-01')
    expect(nextDueDate('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('håndterer skuddår', () => {
    expect(nextDueDate('2024-02-28', 1)).toBe('2024-02-29')
    expect(nextDueDate('2025-02-28', 1)).toBe('2025-03-01')
  })

  it('er upåvirket av tidssone-overgang (sommertid)', () => {
    // EU stiller til sommertid natt til 30. mars 2025; UTC-regning unngår skift.
    expect(nextDueDate('2025-03-29', 7)).toBe('2025-04-05')
  })

  it('tolererer fullt ISO-tidsstempel som inndata', () => {
    expect(nextDueDate('2025-01-08T13:45:00Z', 7)).toBe('2025-01-15')
  })
})
