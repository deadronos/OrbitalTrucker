import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  awardCredits,
  CREDITS_STORAGE_KEY,
  loadCredits,
  saveCredits,
} from '../../src/world/credits'

describe('credits', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('uses a stable storage key', () => {
    expect(CREDITS_STORAGE_KEY).toBe('orbitaltrucker.credits')
  })

  it('loadCredits returns 0 when storage is empty', () => {
    expect(loadCredits()).toBe(0)
  })

  it('loadCredits reads a stored integer value', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, '12500')
    expect(loadCredits()).toBe(12500)
  })

  it('loadCredits returns 0 for non-numeric values', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, 'twelve thousand')
    expect(loadCredits()).toBe(0)
  })

  it('loadCredits returns 0 for negative values', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, '-1')
    expect(loadCredits()).toBe(0)
  })

  it('loadCredits returns 0 for fractional values', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, '12.5')
    expect(loadCredits()).toBe(0)
  })

  it('saveCredits writes a sanitized integer to storage', () => {
    saveCredits(4200)
    expect(window.localStorage.getItem(CREDITS_STORAGE_KEY)).toBe('4200')
  })

  it('saveCredits clamps negative values to zero', () => {
    saveCredits(-5)
    expect(window.localStorage.getItem(CREDITS_STORAGE_KEY)).toBe('0')
  })

  it('saveCredits truncates fractional values', () => {
    saveCredits(12.7)
    expect(window.localStorage.getItem(CREDITS_STORAGE_KEY)).toBe('12')
  })

  it('awardCredits adds the reward to the current balance', () => {
    expect(awardCredits(1200, 4200)).toBe(5400)
  })

  it('awardCredits returns the reward when balance is zero', () => {
    expect(awardCredits(0, 1800)).toBe(1800)
  })
})
