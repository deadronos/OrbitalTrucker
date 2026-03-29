import type { Vector3 } from 'three'

import type { SolarBodyDefinition } from '../solar-data'

/**
 * Abstraction over a heliocentric ephemeris source.
 *
 * Implementations may range from a fast Keplerian approximation (suitable for
 * real-time use with large time steps) to a high-fidelity VSOP87 series
 * (arc-minute accuracy for dates within ±500 years of J2000).
 *
 * Positions are always returned in AU, using the Three.js Y-up convention
 * that maps heliocentric ecliptic axes as follows:
 *   Three.js X  →  ecliptic X  (towards vernal equinox)
 *   Three.js Y  →  ecliptic Z  (north ecliptic pole)
 *   Three.js Z  →  ecliptic Y  (90° east in ecliptic plane)
 */
export interface EphemerisProvider {
  /**
   * A short human-readable label identifying this provider and its fidelity
   * level, e.g. `"Keplerian (approximation)"` or `"VSOP87D (truncated)"`.
   */
  readonly label: string

  /**
   * Returns the heliocentric position of `body` at `date` in AU.
   *
   * Implementations that do not natively support a given body should either
   * fall back to a documented lower-fidelity approximation or throw a
   * descriptive error. Any fallback path must be explicit and documented so
   * callers are not silently given less-accurate results.
   */
  getHeliocentricPositionAu(body: SolarBodyDefinition, date: Date): Vector3

  /**
   * Samples the full orbit of `body` at the epoch implied by `date`.
   *
   * Returns an array of `samples` heliocentric positions evenly distributed
   * around the orbit, suitable for drawing a closed orbit path.
   */
  buildOrbitPoints(
    body: SolarBodyDefinition,
    date: Date,
    samples?: number,
  ): Vector3[]
}
