/**
 * orbital-mechanics.ts
 *
 * Backward-compatible facade over the ephemeris provider abstraction.
 *
 * All position and orbit-path calculations are delegated to the default
 * provider (`Vsop87EphemerisProvider`), which gives arc-minute accuracy for
 * dates within ±500 years of J2000.  See `src/ephemeris/` for the full
 * provider hierarchy.
 *
 * `getJulianDate` is kept as a public utility (used by tests).
 */
import type { Vector3 } from 'three'

import { defaultEphemerisProvider } from './ephemeris'
import type { SolarBodyDefinition } from './solar-data'

/** Converts a JavaScript Date to a Julian Date number. */
export function getJulianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5
}

/**
 * Returns the heliocentric position of `body` at `date` in AU, using the
 * default ephemeris provider (VSOP87D truncated).
 */
export function getHeliocentricPositionAu(
  body: SolarBodyDefinition,
  date: Date,
): Vector3 {
  return defaultEphemerisProvider.getHeliocentricPositionAu(body, date)
}

/**
 * Samples the full orbit of `body` at the epoch implied by `date`.
 * Returns an array of `samples` heliocentric positions in AU.
 */
export function buildOrbitPoints(
  body: SolarBodyDefinition,
  date: Date,
  samples = 320,
): Vector3[] {
  return defaultEphemerisProvider.buildOrbitPoints(body, date, samples)
}
