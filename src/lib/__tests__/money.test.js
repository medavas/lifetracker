// src/lib/__tests__/money.test.js
import { describe, it, expect } from 'vitest'
import { parseAmount, formatCents, centsToInput } from '../money.js'

describe('parseAmount', () => {
  it('parses plain and decimal dollars to cents', () => {
    expect(parseAmount('14.50')).toBe(1450)
    expect(parseAmount('14.5')).toBe(1450)
    expect(parseAmount('14')).toBe(1400)
    expect(parseAmount('0.99')).toBe(99)
  })

  it('tolerates $ signs, commas, and whitespace', () => {
    expect(parseAmount(' $1,400.00 ')).toBe(140000)
    expect(parseAmount('$7')).toBe(700)
  })

  it('rejects non-positive and non-numeric input', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
    expect(parseAmount(null)).toBeNull()
    expect(parseAmount(undefined)).toBeNull()
  })

  it('rounds sub-cent input to the nearest cent', () => {
    expect(parseAmount('1.005')).toBe(101)
    expect(parseAmount('1.004')).toBe(100)
  })
})

describe('formatCents', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatCents(1450)).toBe('$14.50')
    expect(formatCents(140000)).toBe('$1,400.00')
    expect(formatCents(0)).toBe('$0.00')
  })

  it('formats negatives with a leading minus', () => {
    expect(formatCents(-320)).toBe('-$3.20')
  })

  it('treats null/undefined as zero', () => {
    expect(formatCents(null)).toBe('$0.00')
    expect(formatCents(undefined)).toBe('$0.00')
  })
})

describe('centsToInput', () => {
  it('renders a bare two-decimal string for edit fields', () => {
    expect(centsToInput(1450)).toBe('14.50')
    expect(centsToInput(140000)).toBe('1400.00')
  })
})
