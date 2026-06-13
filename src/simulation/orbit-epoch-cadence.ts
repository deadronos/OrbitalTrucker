/**
 * orbit-epoch-cadence.ts
 *
 * Pure, testable logic that decides when the orbit-epoch (i.e. the date used
 * to sample heliocentric orbit polylines) should be re-emitted.
 *
 * Background (see issue #40 and ADR 016):
 *  - The orbit polylines in the R3F scene are sampled from
 *    `buildOrbitPoints(body, orbitEpoch)` and memoized on the epoch date.
 *  - At max warp (90 simulated days per real second) the previous
 *    implementation reset the simulated-day accumulator to zero every time
 *    it crossed the 7-day threshold, which both dropped sub-threshold
 *    remainder and triggered a full polyline rebuild roughly every other
 *    frame.
 *
 * This module splits that cadence into two independent decisions:
 *
 *   1. `advanceOrbitEpochCadence` — a pure accumulator that adds the
 *      simulated days advanced this frame, counts how many times the
 *      threshold was crossed, and returns the **new** accumulator with the
 *      remainder carried forward.
 *
 *   2. `shouldEmitOrbitEpoch` — a real-time gate that lets the hook throttle
 *      `setOrbitEpoch` calls at high warp. Even if the threshold is hit on
 *      every other frame, the cap keeps the actual React rerenders bounded.
 *
 * Keeping these as pure functions means the cadence rule can be unit-tested
 * without an R3F canvas, and the `useTimeSimulation` hook stays a small
 * adapter that wires the rules to the React lifecycle.
 */

/** Simulated-day threshold at which an orbit-epoch update is due. */
export const ORBIT_EPOCH_THRESHOLD_DAYS = 7

/**
 * Default real-time cap on orbit-epoch emissions. With this cap the worst-case
 * rerender rate of the orbit polylines is 5 Hz, well below the 60 fps frame
 * rate of the simulation.
 */
export const DEFAULT_ORBIT_EPOCH_REALTIME_CAP_SEC = 0.2

export type OrbitEpochCadenceState = {
  /** Accumulated simulated days since the last orbit-epoch emission. */
  accumulatorDays: number
}

/**
 * Returns a fresh cadence state. The state is intentionally tiny: it is
 * stored in a `useRef` and never read by React directly.
 */
export function createOrbitEpochCadenceState(): OrbitEpochCadenceState {
  return { accumulatorDays: 0 }
}

export type AdvanceOrbitEpochCadenceResult = {
  nextState: OrbitEpochCadenceState
  /**
   * Number of times the threshold was crossed in this frame. Usually 0 or 1
   * because the frame delta is bounded, but the function is correct for any
   * non-negative `simulatedDaysAdvanced` value.
   */
  crossings: number
}

/**
 * Advances the simulated-day accumulator by `simulatedDaysAdvanced` and
 * returns how many threshold crossings happened, plus the new state with the
 * remainder preserved (NOT zeroed).
 *
 * Negative or zero advances are a no-op: the function returns the same state
 * unchanged with `crossings: 0`. This makes it safe to call every frame
 * regardless of the active warp.
 */
export function advanceOrbitEpochCadence(
  state: OrbitEpochCadenceState,
  simulatedDaysAdvanced: number,
): AdvanceOrbitEpochCadenceResult {
  if (!(simulatedDaysAdvanced > 0)) {
    return { nextState: state, crossings: 0 }
  }

  const next = state.accumulatorDays + simulatedDaysAdvanced
  const crossings = Math.floor(next / ORBIT_EPOCH_THRESHOLD_DAYS)
  const remainder = next - crossings * ORBIT_EPOCH_THRESHOLD_DAYS

  return {
    nextState: { accumulatorDays: remainder },
    crossings,
  }
}

/**
 * Returns true when the caller should actually call `setOrbitEpoch` for the
 * current frame. The cap exists so that the orbit polylines do not rebuild
 * on every frame at high warp.
 *
 *   - `crossings` — number of threshold crossings reported by
 *     `advanceOrbitEpochCadence` for this frame. With `crossings <= 0` the
 *     function returns false unconditionally: there is nothing to emit.
 *   - `lastUpdateSec` — the real-time clock value at the previous emission,
 *     or `null` if no emission has happened yet. The first emission always
 *     passes regardless of the cap, because we cannot compute an elapsed
 *     time without a baseline.
 *   - `nowSec` — the real-time clock value for the current frame, in the
 *     same unit as `lastUpdateSec`.
 *   - `capSec` — optional override for the real-time cap. Defaults to
 *     `DEFAULT_ORBIT_EPOCH_REALTIME_CAP_SEC`.
 *
 * At high warp the simulated-time threshold fires on most frames; the cap is
 * what keeps the actual React rerenders bounded. With the default 0.2 s cap
 * the worst-case rerender rate of the orbit polylines is 5 Hz, well below
 * the 60 fps frame rate of the simulation.
 */
export function shouldEmitOrbitEpoch(
  crossings: number,
  lastUpdateSec: number | null,
  nowSec: number,
  capSec: number = DEFAULT_ORBIT_EPOCH_REALTIME_CAP_SEC,
): boolean {
  // No crossings on this frame: nothing to emit, period.
  if (crossings <= 0) {
    return false
  }

  // The very first emission always goes through regardless of the cap. The
  // caller is responsible for tracking `lastUpdateSec`; until the first
  // emission, it is `null` and we cannot compute an elapsed time.
  if (lastUpdateSec === null) {
    return true
  }

  // Otherwise, the cap is in effect: even though the simulated-time threshold
  // fired, we hold the emission back until enough real time has passed.
  return nowSec - lastUpdateSec >= capSec
}
