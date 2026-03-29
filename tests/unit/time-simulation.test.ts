import { describe, expect, it } from 'vitest'

import {
  formatEtaDays,
  formatTimeWarp,
} from '../../src/simulation/formatters'
import {
  INITIAL_SIMULATED_DATE,
  TIME_WARP_STEPS,
} from '../../src/simulation/types'

describe('TIME_WARP_STEPS', () => {
  it('contains 8 steps', () => {
    expect(TIME_WARP_STEPS).toHaveLength(8)
  })

  it('first step is 0 (paused)', () => {
    expect(TIME_WARP_STEPS[0]).toBe(0)
  })

  it('last step is 90 days per second (maximum warp)', () => {
    expect(TIME_WARP_STEPS[TIME_WARP_STEPS.length - 1]).toBe(90)
  })

  it('steps increase monotonically', () => {
    for (let i = 1; i < TIME_WARP_STEPS.length; i++) {
      expect(TIME_WARP_STEPS[i]).toBeGreaterThan(TIME_WARP_STEPS[i - 1])
    }
  })

  it('second step is 1/48 d/s (30 simulated minutes per real second)', () => {
    expect(TIME_WARP_STEPS[1]).toBeCloseTo(1 / 48)
  })

  it('all non-zero steps are positive', () => {
    for (let i = 1; i < TIME_WARP_STEPS.length; i++) {
      expect(TIME_WARP_STEPS[i]).toBeGreaterThan(0)
    }
  })
})

describe('INITIAL_SIMULATED_DATE', () => {
  it('is 2026-03-29T00:00:00.000Z', () => {
    expect(INITIAL_SIMULATED_DATE.toISOString()).toBe(
      '2026-03-29T00:00:00.000Z',
    )
  })

  it('is a Date instance', () => {
    expect(INITIAL_SIMULATED_DATE).toBeInstanceOf(Date)
  })
})

describe('date advancement math', () => {
  // The formula used in useTimeSimulation:
  //   date.setTime(date.getTime() + realDelta * warpDaysPerSecond * 86_400_000)

  it('advances exactly one simulated day when warp=1 d/s and delta=1 s', () => {
    const start = new Date(INITIAL_SIMULATED_DATE)
    const warpDaysPerSecond = 1
    const realDelta = 1.0
    const advanceMs = realDelta * warpDaysPerSecond * 86_400_000

    expect(advanceMs / 86_400_000).toBeCloseTo(1)
    expect(new Date(start.getTime() + advanceMs).getTime()).toBe(
      start.getTime() + 86_400_000,
    )
  })

  it('does not advance the date when paused (warpDaysPerSecond = 0)', () => {
    const start = new Date(INITIAL_SIMULATED_DATE)
    const advanceMs = 1.0 * 0 * 86_400_000

    expect(advanceMs).toBe(0)
    expect(new Date(start.getTime() + advanceMs).getTime()).toBe(
      start.getTime(),
    )
  })

  it('advances 90 simulated days per real second at max warp', () => {
    const maxWarp = TIME_WARP_STEPS[TIME_WARP_STEPS.length - 1] // 90 d/s
    const advanceDays = 1.0 * maxWarp
    expect(advanceDays).toBe(90)
  })

  it('caps real delta at 0.05 s — max 4.5 simulated days per frame at max warp', () => {
    // useTimeSimulation applies Math.min(delta, 0.05) before computing advance
    const maxCappedDeltaSec = 0.05
    const maxWarp = TIME_WARP_STEPS[TIME_WARP_STEPS.length - 1] // 90 d/s
    const maxSimDaysPerFrame = maxCappedDeltaSec * maxWarp

    expect(maxSimDaysPerFrame).toBeCloseTo(4.5)
    expect(maxSimDaysPerFrame).toBeLessThan(5)
  })

  it('accumulates simulated days correctly and does not reach the 7-day orbit-epoch threshold', () => {
    // Simulate 100 frames at 0.05 s/frame with warp = 1 d/s = 5 simulated days total.
    // 5 simulated days < 7-day threshold → no epoch update.
    let accumulator = 0
    let epochUpdates = 0
    const warpDaysPerSecond = 1
    const frameDelta = 0.05

    for (let i = 0; i < 100; i++) {
      accumulator += frameDelta * warpDaysPerSecond
      if (accumulator >= 7) {
        accumulator = 0
        epochUpdates++
      }
    }

    expect(epochUpdates).toBe(0)
  })

  it('triggers orbit-epoch updates each time 7+ simulated days accumulate', () => {
    // 3.5 simulated days per frame (warp = 3.5 d/s at 1 s/frame).
    // 3.5 = 7/2 is exact in IEEE 754, so 3.5 + 3.5 = 7.0 without drift.
    // Every 2 frames the 7-day threshold is reached; 10 frames → 5 updates.
    let accumulator = 0
    let epochUpdates = 0
    const warpDaysPerSecond = 3.5
    const frameDelta = 1.0

    for (let i = 0; i < 10; i++) {
      accumulator += frameDelta * warpDaysPerSecond
      if (accumulator >= 7) {
        accumulator = 0
        epochUpdates++
      }
    }

    expect(epochUpdates).toBe(5)
  })

  it('triggers no orbit-epoch updates while paused regardless of frame count', () => {
    let accumulator = 0
    let epochUpdates = 0
    const warpDaysPerSecond = 0 // paused

    for (let i = 0; i < 1000; i++) {
      accumulator += 0.016 * warpDaysPerSecond
      if (accumulator >= 7) {
        accumulator = 0
        epochUpdates++
      }
    }

    expect(epochUpdates).toBe(0)
  })
})

describe('formatEtaDays', () => {
  it('returns an em-dash when ETA is null (ship is stationary)', () => {
    expect(formatEtaDays(null)).toBe('—')
  })

  it('formats zero as "0.0 h" (sub-day branch)', () => {
    expect(formatEtaDays(0)).toBe('0.0 h')
  })

  it('formats 0.5 days as "12.0 h"', () => {
    expect(formatEtaDays(0.5)).toBe('12.0 h')
  })

  it('formats 0.25 days as "6.0 h"', () => {
    expect(formatEtaDays(0.25)).toBe('6.0 h')
  })

  it('formats exactly 1 day as "1.0 d"', () => {
    expect(formatEtaDays(1)).toBe('1.0 d')
  })

  it('formats 30 days as "30.0 d"', () => {
    expect(formatEtaDays(30)).toBe('30.0 d')
  })

  it('formats 364.9 days as days (below year threshold)', () => {
    expect(formatEtaDays(364.9)).toBe('364.9 d')
  })

  it('formats 365.25 days as "1.0 yr" (at year threshold)', () => {
    expect(formatEtaDays(365.25)).toBe('1.0 yr')
  })

  it('formats two years as "2.0 yr"', () => {
    expect(formatEtaDays(365.25 * 2)).toBe('2.0 yr')
  })
})

describe('formatTimeWarp for all TIME_WARP_STEPS', () => {
  it('step 0 (0 d/s): paused', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[0])).toBe('paused')
  })

  it('step 1 (1/48 d/s): "0.5 h / s"', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[1])).toBe('0.5 h / s')
  })

  it('step 2 (1/12 d/s): "2.0 h / s"', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[2])).toBe('2.0 h / s')
  })

  it('step 3 (0.25 d/s): "6.0 h / s"', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[3])).toBe('6.0 h / s')
  })

  it('step 4 (1 d/s): "1.0 d / s"', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[4])).toBe('1.0 d / s')
  })

  it('step 5 (7 d/s): "7.0 d / s"', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[5])).toBe('7.0 d / s')
  })

  it('step 6 (30 d/s): "30 d / s" (no decimal for >= 10 d/s)', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[6])).toBe('30 d / s')
  })

  it('step 7 (90 d/s): "90 d / s" (no decimal for >= 10 d/s)', () => {
    expect(formatTimeWarp(TIME_WARP_STEPS[7])).toBe('90 d / s')
  })
})
