import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ORBIT_EPOCH_REALTIME_CAP_SEC,
  ORBIT_EPOCH_THRESHOLD_DAYS,
  advanceOrbitEpochCadence,
  createOrbitEpochCadenceState,
  shouldEmitOrbitEpoch,
} from '../../src/simulation/orbit-epoch-cadence'

/**
 * Tests for the orbit-epoch cadence logic.
 *
 * Background (see issue #40 and ADR 016):
 *  - useTimeSimulation used to zero the orbit accumulator each time it
 *    crossed the 7-day threshold, dropping sub-threshold remainder.
 *  - At max warp the threshold was hit roughly every other frame, forcing
 *    near-every-frame rebuilds of all orbit polylines.
 *
 * The fix is split into two pure functions:
 *  - `advanceOrbitEpochCadence` — updates the simulated-day accumulator and
 *    reports how many threshold crossings happened this frame.
 *  - `shouldEmitOrbitEpoch`     — real-time cap so the redraw rate cannot
 *    spike at high warp.
 */

describe('ORBIT_EPOCH_THRESHOLD_DAYS', () => {
  it('is 7 simulated days (matches the historical threshold)', () => {
    expect(ORBIT_EPOCH_THRESHOLD_DAYS).toBe(7)
  })
})

describe('DEFAULT_ORBIT_EPOCH_REALTIME_CAP_SEC', () => {
  it('caps redraw rate at 5 Hz (0.2 s)', () => {
    expect(DEFAULT_ORBIT_EPOCH_REALTIME_CAP_SEC).toBeCloseTo(0.2)
  })
})

describe('createOrbitEpochCadenceState', () => {
  it('starts with a zero accumulator', () => {
    const state = createOrbitEpochCadenceState()
    expect(state.accumulatorDays).toBe(0)
  })
})

describe('advanceOrbitEpochCadence — remainder preservation', () => {
  it('returns the new accumulator and zero crossings below the threshold', () => {
    const state = createOrbitEpochCadenceState()
    const result = advanceOrbitEpochCadence(state, 3)
    expect(result.crossings).toBe(0)
    expect(result.nextState.accumulatorDays).toBeCloseTo(3)
  })

  it('preserves sub-threshold remainder across a single threshold crossing', () => {
    // 5 + 5 = 10 simulated days, threshold = 7.
    // 10 - 7 = 3 should be carried into the new accumulator, not zeroed.
    let state = createOrbitEpochCadenceState()
    let totalCrossings = 0

    const first = advanceOrbitEpochCadence(state, 5)
    state = first.nextState
    totalCrossings += first.crossings
    expect(state.accumulatorDays).toBeCloseTo(5)
    expect(totalCrossings).toBe(0)

    const second = advanceOrbitEpochCadence(state, 5)
    state = second.nextState
    totalCrossings += second.crossings

    expect(totalCrossings).toBe(1)
    expect(state.accumulatorDays).toBeCloseTo(3)
  })

  it('handles a single frame that crosses the threshold more than once', () => {
    // 16 simulated days in one frame: 16 - 2 * 7 = 2 leftover, 2 crossings.
    const state = createOrbitEpochCadenceState()
    const result = advanceOrbitEpochCadence(state, 16)
    expect(result.crossings).toBe(2)
    expect(result.nextState.accumulatorDays).toBeCloseTo(2)
  })

  it('produces no crossings for negative or zero advance', () => {
    const state = createOrbitEpochCadenceState()
    expect(advanceOrbitEpochCadence(state, 0).crossings).toBe(0)
    expect(advanceOrbitEpochCadence(state, -5).crossings).toBe(0)
  })

  it('matches the issue #40 example: 4.5 sim days/frame at max warp does not cross', () => {
    // The original bug description: at max warp a single frame advances up to
    // 4.5 simulated days, so the 7-day threshold is NOT crossed in one frame.
    const state = createOrbitEpochCadenceState()
    const result = advanceOrbitEpochCadence(state, 4.5)
    expect(result.crossings).toBe(0)
    expect(result.nextState.accumulatorDays).toBeCloseTo(4.5)
  })

  it('is exact: total remainder after N frames equals sum(advance) - crossings*7', () => {
    // Property test: 200 frames of 0.1 simulated days each = 20 sim days.
    // 20 / 7 = 2 crossings with 6 leftover.
    let state = createOrbitEpochCadenceState()
    let totalCrossings = 0
    for (let i = 0; i < 200; i++) {
      const result = advanceOrbitEpochCadence(state, 0.1)
      totalCrossings += result.crossings
      state = result.nextState
    }
    expect(totalCrossings).toBe(2)
    expect(state.accumulatorDays).toBeCloseTo(6)
  })

  it('is exact: 1000 frames of 0.013 simulated days produces consistent remainder', () => {
    // 1000 * 0.013 = 13 sim days → 1 crossing with 6 leftover.
    let state = createOrbitEpochCadenceState()
    let totalCrossings = 0
    for (let i = 0; i < 1000; i++) {
      const result = advanceOrbitEpochCadence(state, 0.013)
      totalCrossings += result.crossings
      state = result.nextState
    }
    expect(totalCrossings).toBe(1)
    expect(state.accumulatorDays).toBeCloseTo(6)
  })
})

describe('shouldEmitOrbitEpoch — real-time cap', () => {
  it('returns false when there are no crossings on this frame', () => {
    expect(shouldEmitOrbitEpoch(0, null, 0.05)).toBe(false)
    expect(shouldEmitOrbitEpoch(0, 0, 0.5)).toBe(false)
  })

  it('allows the first emission when crossings > 0 and lastUpdateSec is null', () => {
    expect(shouldEmitOrbitEpoch(1, null, 0.05)).toBe(true)
  })

  it('blocks an emission that is faster than the cap', () => {
    // Cap is 0.2 s. Last update 0.05 s ago → blocked.
    expect(shouldEmitOrbitEpoch(1, 0, 0.05)).toBe(false)
  })

  it('allows an emission at or beyond the cap', () => {
    // Last update 0.2 s ago → allowed.
    expect(shouldEmitOrbitEpoch(1, 0, 0.2)).toBe(true)
    // Last update 0.21 s ago → allowed.
    expect(shouldEmitOrbitEpoch(1, 0, 0.21)).toBe(true)
  })

  it('uses the provided cap rather than the default', () => {
    // With a 1 s cap, 0.5 s after the last update is still blocked.
    expect(shouldEmitOrbitEpoch(1, 0, 0.5, 1.0)).toBe(false)
    // 1.0 s after the last update is allowed.
    expect(shouldEmitOrbitEpoch(1, 0, 1.0, 1.0)).toBe(true)
  })

  it('always emits the first threshold crossing even with a tight cap', () => {
    // Crossings > 0 + null lastUpdateSec → always emit, regardless of cap.
    expect(shouldEmitOrbitEpoch(1, null, 0.0001)).toBe(true)
    expect(shouldEmitOrbitEpoch(5, null, 0.0001, 1000)).toBe(true)
  })

  it('respects negative real-time deltas (clock skew) as never-reaching the cap', () => {
    // Defensive: if `nowSec` is somehow behind `lastUpdateSec`, treat it as
    // not having reached the cap yet.
    expect(shouldEmitOrbitEpoch(1, 1.0, 0.5)).toBe(false)
  })
})

describe('issue #40 — max-warp rebuild count', () => {
  it('emits far fewer epoch updates than frames at max warp thanks to the real-time cap', () => {
    // Simulate 300 frames at 0.05 s each (15 s of real time) at max warp.
    // Max-warp advance per frame = 0.05 * 90 = 4.5 simulated days.
    // Without a real-time cap the threshold would be crossed every 2 frames
    // (~150 updates). With the 0.2 s cap the update rate is bounded to ~5 Hz,
    // so 15 s of real time gives at most 75 updates — and in practice
    // 60–70 because the first emission happens on frame 2 and subsequent
    // ones wait for the cap to elapse.
    let state = createOrbitEpochCadenceState()
    let lastUpdateSec: number | null = null
    let totalEmissions = 0
    const frameDelta = 0.05
    const frames = 300
    let realTime = 0

    for (let i = 0; i < frames; i++) {
      const advance = frameDelta * 90
      const advanceResult = advanceOrbitEpochCadence(state, advance)
      state = advanceResult.nextState

      if (
        shouldEmitOrbitEpoch(advanceResult.crossings, lastUpdateSec, realTime)
      ) {
        totalEmissions++
        lastUpdateSec = realTime
      }

      realTime += frameDelta
    }

    // 15 s of real time, 0.2 s cap → ≤ 75 emissions maximum.
    expect(totalEmissions).toBeLessThanOrEqual(75)
    // And it must still be well below the no-cap estimate of ~150.
    expect(totalEmissions).toBeLessThan(150)
    // The accumulator must still carry its leftover (< 7 days).
    expect(state.accumulatorDays).toBeGreaterThanOrEqual(0)
    expect(state.accumulatorDays).toBeLessThan(ORBIT_EPOCH_THRESHOLD_DAYS)
  })

  it('still emits at least once during a max-warp run', () => {
    // The cap is a real-time cap, not a "never update" cap. The threshold
    // fires on every other frame at max warp, so even with the cap we expect
    // a meaningful number of emissions.
    let state = createOrbitEpochCadenceState()
    let lastUpdateSec: number | null = null
    let totalEmissions = 0
    const frameDelta = 0.05
    const frames = 300
    let realTime = 0

    for (let i = 0; i < frames; i++) {
      const advance = frameDelta * 90
      const advanceResult = advanceOrbitEpochCadence(state, advance)
      state = advanceResult.nextState

      if (
        shouldEmitOrbitEpoch(advanceResult.crossings, lastUpdateSec, realTime)
      ) {
        totalEmissions++
        lastUpdateSec = realTime
      }

      realTime += frameDelta
    }

    expect(totalEmissions).toBeGreaterThan(0)
  })
})
