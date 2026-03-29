/**
 * KeplerianEphemerisProvider
 *
 * Low-precision approximation using J2000 Keplerian orbital element series.
 * Accurate to roughly 1–2° for most planets within ±50 years of J2000.
 *
 * This provider is the explicit **approximation fallback** used when VSOP87
 * coefficients are unavailable for a body (e.g. Pluto).
 *
 * Source: Standish et al. (1992), "Orbital Ephemerides of the Sun, Moon, and
 * Planets", Explanatory Supplement to the Astronomical Almanac, Table 5.8.1.
 */
import { Vector3 } from 'three'

import type { OrbitalElementSet, SolarBodyDefinition } from '../solar-data'
import type { EphemerisProvider } from './provider'

type EvaluatedElements = {
  semiMajorAxisAu: number
  eccentricity: number
  inclinationRad: number
  meanLongitudeRad: number
  longitudeOfPerihelionRad: number
  longitudeOfAscendingNodeRad: number
}

const J2000_JULIAN_DATE = 2_451_545
const DEG_TO_RAD = Math.PI / 180
const TAU = Math.PI * 2

function getJulianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5
}

function normalizeRadians(value: number): number {
  const wrapped = value % TAU
  return wrapped < 0 ? wrapped + TAU : wrapped
}

function evaluateSeries(
  series: OrbitalElementSet,
  centuriesSinceJ2000: number,
): EvaluatedElements {
  const evaluate = (entry: { base: number; rate: number }) =>
    entry.base + entry.rate * centuriesSinceJ2000

  return {
    semiMajorAxisAu: evaluate(series.semiMajorAxisAu),
    eccentricity: evaluate(series.eccentricity),
    inclinationRad: evaluate(series.inclinationDeg) * DEG_TO_RAD,
    meanLongitudeRad: evaluate(series.meanLongitudeDeg) * DEG_TO_RAD,
    longitudeOfPerihelionRad:
      evaluate(series.longitudeOfPerihelionDeg) * DEG_TO_RAD,
    longitudeOfAscendingNodeRad:
      evaluate(series.longitudeOfAscendingNodeDeg) * DEG_TO_RAD,
  }
}

function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  let eccentricAnomaly = meanAnomalyRad

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const delta =
      (eccentricAnomaly -
        eccentricity * Math.sin(eccentricAnomaly) -
        meanAnomalyRad) /
      (1 - eccentricity * Math.cos(eccentricAnomaly))

    eccentricAnomaly -= delta

    if (Math.abs(delta) < 1e-8) {
      break
    }
  }

  return eccentricAnomaly
}

function keplerianPosition(body: SolarBodyDefinition, date: Date): Vector3 {
  const centuriesSinceJ2000 =
    (getJulianDate(date) - J2000_JULIAN_DATE) / 36_525
  const elements = evaluateSeries(body.elements, centuriesSinceJ2000)
  const meanAnomaly = normalizeRadians(
    elements.meanLongitudeRad - elements.longitudeOfPerihelionRad,
  )
  const eccentricAnomaly = solveKepler(meanAnomaly, elements.eccentricity)
  const trueAnomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 + elements.eccentricity) * Math.sin(eccentricAnomaly / 2),
      Math.sqrt(1 - elements.eccentricity) * Math.cos(eccentricAnomaly / 2),
    )

  const argumentOfPerihelion =
    elements.longitudeOfPerihelionRad - elements.longitudeOfAscendingNodeRad
  const orbitalRadius =
    elements.semiMajorAxisAu *
    (1 - elements.eccentricity * Math.cos(eccentricAnomaly))
  const angle = argumentOfPerihelion + trueAnomaly

  const cosAscending = Math.cos(elements.longitudeOfAscendingNodeRad)
  const sinAscending = Math.sin(elements.longitudeOfAscendingNodeRad)
  const cosInclination = Math.cos(elements.inclinationRad)
  const sinInclination = Math.sin(elements.inclinationRad)
  const cosAngle = Math.cos(angle)
  const sinAngle = Math.sin(angle)

  const xStandard =
    orbitalRadius *
    (cosAscending * cosAngle - sinAscending * sinAngle * cosInclination)
  const yStandard =
    orbitalRadius *
    (sinAscending * cosAngle + cosAscending * sinAngle * cosInclination)
  const zStandard = orbitalRadius * (sinAngle * sinInclination)

  return new Vector3(xStandard, zStandard, yStandard)
}

export class KeplerianEphemerisProvider implements EphemerisProvider {
  readonly label = 'Keplerian (approximation)'

  getHeliocentricPositionAu(body: SolarBodyDefinition, date: Date): Vector3 {
    return keplerianPosition(body, date)
  }

  buildOrbitPoints(
    body: SolarBodyDefinition,
    date: Date,
    samples = 320,
  ): Vector3[] {
    const centuriesSinceJ2000 =
      (getJulianDate(date) - J2000_JULIAN_DATE) / 36_525
    const elements = evaluateSeries(body.elements, centuriesSinceJ2000)
    const argumentOfPerihelion =
      elements.longitudeOfPerihelionRad - elements.longitudeOfAscendingNodeRad
    const cosAscending = Math.cos(elements.longitudeOfAscendingNodeRad)
    const sinAscending = Math.sin(elements.longitudeOfAscendingNodeRad)
    const cosInclination = Math.cos(elements.inclinationRad)
    const sinInclination = Math.sin(elements.inclinationRad)
    const points: Vector3[] = []

    for (let index = 0; index < samples; index += 1) {
      const eccentricAnomaly = (index / samples) * TAU
      const trueAnomaly =
        2 *
        Math.atan2(
          Math.sqrt(1 + elements.eccentricity) *
            Math.sin(eccentricAnomaly / 2),
          Math.sqrt(1 - elements.eccentricity) *
            Math.cos(eccentricAnomaly / 2),
        )
      const orbitalRadius =
        elements.semiMajorAxisAu *
        (1 - elements.eccentricity * Math.cos(eccentricAnomaly))
      const angle = argumentOfPerihelion + trueAnomaly
      const cosAngle = Math.cos(angle)
      const sinAngle = Math.sin(angle)

      const xStandard =
        orbitalRadius *
        (cosAscending * cosAngle - sinAscending * sinAngle * cosInclination)
      const yStandard =
        orbitalRadius *
        (sinAscending * cosAngle + cosAscending * sinAngle * cosInclination)
      const zStandard = orbitalRadius * (sinAngle * sinInclination)

      points.push(new Vector3(xStandard, zStandard, yStandard))
    }

    return points
  }
}
