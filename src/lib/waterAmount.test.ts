import { describe, expect, it } from 'vitest'
import { normalizeWaterAmount, waterAmountLevel } from './waterAmount'

describe('normalizeWaterAmount', () => {
  it('godtar de tre kjente nivåene', () => {
    expect(normalizeWaterAmount('sparsom')).toBe('sparsom')
    expect(normalizeWaterAmount('moderat')).toBe('moderat')
    expect(normalizeWaterAmount('rikelig')).toBe('rikelig')
  })

  it('avviser alt annet', () => {
    expect(normalizeWaterAmount('mye')).toBeNull()
    expect(normalizeWaterAmount('')).toBeNull()
    expect(normalizeWaterAmount(null)).toBeNull()
    expect(normalizeWaterAmount(undefined)).toBeNull()
    expect(normalizeWaterAmount(2)).toBeNull()
  })
})

describe('waterAmountLevel', () => {
  it('gir 1–3 dråper i stigende rekkefølge', () => {
    expect(waterAmountLevel('sparsom')).toBe(1)
    expect(waterAmountLevel('moderat')).toBe(2)
    expect(waterAmountLevel('rikelig')).toBe(3)
  })
})
