/**
 * Vsop87EphemerisProvider
 *
 * High-fidelity ephemeris provider based on the truncated VSOP87D theory
 * (Bretagnon & Francou 1988). Positional accuracy is better than 1 arc-minute
 * for dates within ±500 years of J2000, a significant improvement over the
 * Keplerian approximation which can err by 1–2° for outer planets.
 *
 * Coverage: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.
 * Bodies not covered (e.g. Pluto) are handled by the Keplerian fallback so
 * that the approximation path is explicit rather than silent.
 */
import { Vector3 } from 'three'

import type { SolarBodyDefinition } from '../solar-data'
import { KeplerianEphemerisProvider } from './keplerian'
import type { EphemerisProvider } from './provider'
import { VSOP87_COEFFICIENTS } from './vsop87-coefficients'
import type { Vsop87Series } from './vsop87-coefficients'

/** Julian date of J2000.0 */
const J2000_JULIAN_DATE = 2_451_545

/**
 * Scaling factor: VSOP87 amplitudes are stored as integers in 10⁻⁸ units.
 * Dividing by SCALE gives radians (for L and B) or AU (for R).
 */
const VSOP87_SCALE = 1e8

const TAU = Math.PI * 2

/** Fallback for bodies not covered by VSOP87 (e.g. Pluto). */
const keplerianFallback = new KeplerianEphemerisProvider()

function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5
}

/**
 * Evaluates one VSOP87 power series for a given `tau` (Julian millennia
 * from J2000.0) and returns the raw sum before scaling.
 */
function evaluateSeries(
  powerSeries: Vsop87Series['L'] | Vsop87Series['B'] | Vsop87Series['R'],
  tau: number,
): number {
  let result = 0
  let tauPower = 1

  for (const terms of powerSeries) {
    let seriesSum = 0
    for (const [amplitude, phase, frequency] of terms) {
      seriesSum += amplitude * Math.cos(phase + frequency * tau)
    }
    result += seriesSum * tauPower
    tauPower *= tau
  }

  return result
}

/** Normalises an angle in radians to [0, 2π). */
function normalizeRadians(value: number): number {
  const wrapped = value % TAU
  return wrapped < 0 ? wrapped + TAU : wrapped
}

/**
 * Computes the heliocentric ecliptic L, B, R from VSOP87D series for the
 * given body name, then converts them to a Three.js-compatible Vector3 in AU.
 *
 * Coordinate mapping (J2000 ecliptic → Three.js Y-up):
 *   Three.js X  =  x_ecl  =  R · cos(B) · cos(L)
 *   Three.js Y  =  z_ecl  =  R · sin(B)
 *   Three.js Z  =  y_ecl  =  R · cos(B) · sin(L)
 */
function vsop87Position(bodyName: string, date: Date): Vector3 {
  const tau = (julianDate(date) - J2000_JULIAN_DATE) / 365_250

  const series = VSOP87_COEFFICIENTS[bodyName]

  const L = normalizeRadians(evaluateSeries(series.L, tau) / VSOP87_SCALE)
  const B = evaluateSeries(series.B, tau) / VSOP87_SCALE
  const R = evaluateSeries(series.R, tau) / VSOP87_SCALE

  const cosB = Math.cos(B)
  const xEcl = R * cosB * Math.cos(L)
  const yEcl = R * cosB * Math.sin(L)
  const zEcl = R * Math.sin(B)

  // Map ecliptic (x, y, z) to Three.js (x, y, z) where Three.js Y is north.
  return new Vector3(xEcl, zEcl, yEcl)
}

export class Vsop87EphemerisProvider implements EphemerisProvider {
  readonly label = 'VSOP87D (truncated, arc-minute accuracy)'

  getHeliocentricPositionAu(body: SolarBodyDefinition, date: Date): Vector3 {
    if (!(body.name in VSOP87_COEFFICIENTS)) {
      // Explicit approximation fallback for bodies not in VSOP87 (e.g. Pluto)
      return keplerianFallback.getHeliocentricPositionAu(body, date)
    }

    return vsop87Position(body.name, date)
  }

  buildOrbitPoints(
    body: SolarBodyDefinition,
    date: Date,
    samples = 320,
  ): Vector3[] {
    if (!(body.name in VSOP87_COEFFICIENTS)) {
      // Explicit approximation fallback for bodies not in VSOP87 (e.g. Pluto)
      return keplerianFallback.buildOrbitPoints(body, date, samples)
    }

    // Sample the orbit by distributing a full orbital period evenly.
    // We advance time in steps of (period / samples) days to get
    // positions around the full orbit.
    const periodDays = body.orbitalPeriodDays
    const stepDays = periodDays / samples
    const startMs = date.getTime()
    const points: Vector3[] = []

    for (let i = 0; i < samples; i += 1) {
      const sampleDate = new Date(startMs + i * stepDays * 86_400_000)
      points.push(vsop87Position(body.name, sampleDate))
    }

    return points
  }
}
