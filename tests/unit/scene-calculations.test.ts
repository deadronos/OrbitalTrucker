import { describe, expect, it } from 'vitest'

import {
  buildOrbitPoints,
  getHeliocentricPositionAu,
  getJulianDate,
} from '../../src/orbital-mechanics'
import { SOLAR_BODIES } from '../../src/solar-data'

const EPOCH = new Date('2026-03-29T00:00:00.000Z')
const J2000 = new Date('2000-01-01T12:00:00.000Z')

describe('getJulianDate', () => {
  it('advances by exactly 1.0 per calendar day', () => {
    const d1 = new Date('2026-03-29T12:00:00.000Z')
    const d2 = new Date('2026-03-30T12:00:00.000Z')
    expect(getJulianDate(d2) - getJulianDate(d1)).toBeCloseTo(1, 10)
  })

  it('returns a value greater than J2000 (2451545) for dates after 2000', () => {
    expect(getJulianDate(EPOCH)).toBeGreaterThan(2_451_545)
  })

  it('computes Julian date as unix_ms / 86400000 + 2440587.5', () => {
    const date = new Date('2010-07-01T00:00:00.000Z')
    const expected = date.getTime() / 86_400_000 + 2_440_587.5
    expect(getJulianDate(date)).toBeCloseTo(expected, 8)
  })

  it('returns a higher Julian date for a later calendar date', () => {
    const jd1 = getJulianDate(new Date('2020-01-01T00:00:00.000Z'))
    const jd2 = getJulianDate(new Date('2025-01-01T00:00:00.000Z'))
    expect(jd2).toBeGreaterThan(jd1)
  })

  it('J2000 epoch is exactly Julian date 2451545', () => {
    expect(getJulianDate(J2000)).toBe(2_451_545)
  })
})

describe('getHeliocentricPositionAu — all planets', () => {
  it('Mercury is between 0.30 and 0.48 AU from the Sun', () => {
    const mercury = SOLAR_BODIES.find((b) => b.name === 'Mercury')!
    const r = getHeliocentricPositionAu(mercury, EPOCH).length()
    expect(r).toBeGreaterThan(0.30)
    expect(r).toBeLessThan(0.48)
  })

  it('Venus is between 0.71 and 0.73 AU from the Sun', () => {
    const venus = SOLAR_BODIES.find((b) => b.name === 'Venus')!
    const r = getHeliocentricPositionAu(venus, EPOCH).length()
    expect(r).toBeGreaterThan(0.71)
    expect(r).toBeLessThan(0.73)
  })

  it('Uranus is between 18.2 and 20.2 AU from the Sun', () => {
    const uranus = SOLAR_BODIES.find((b) => b.name === 'Uranus')!
    const r = getHeliocentricPositionAu(uranus, EPOCH).length()
    expect(r).toBeGreaterThan(18.2)
    expect(r).toBeLessThan(20.2)
  })

  it('Neptune is between 29.7 and 30.5 AU from the Sun', () => {
    const neptune = SOLAR_BODIES.find((b) => b.name === 'Neptune')!
    const r = getHeliocentricPositionAu(neptune, EPOCH).length()
    expect(r).toBeGreaterThan(29.7)
    expect(r).toBeLessThan(30.5)
  })

  it('all bodies return finite, positive heliocentric distances', () => {
    for (const body of SOLAR_BODIES) {
      const r = getHeliocentricPositionAu(body, EPOCH).length()
      expect(Number.isFinite(r), `${body.name} radius must be finite`).toBe(
        true,
      )
      expect(r, `${body.name} must be > 0 AU`).toBeGreaterThan(0)
    }
  })

  it('body positions change as simulated time advances (Earth moves in 30 days)', () => {
    // Earth moves roughly 1° per day; 30 days should produce a measurable shift.
    const earth = SOLAR_BODIES.find((b) => b.name === 'Earth')!
    const laterDate = new Date(EPOCH.getTime() + 30 * 86_400_000)
    const pos1 = getHeliocentricPositionAu(earth, EPOCH)
    const pos2 = getHeliocentricPositionAu(earth, laterDate)
    expect(pos1.distanceTo(pos2)).toBeGreaterThan(0)
  })

  it('planet order by heliocentric distance matches the expected solar system arrangement', () => {
    // The orbital distance ranges for adjacent classical planets do not overlap,
    // so the snapshot ordering at any date is the same as the mean ordering.
    // Pluto is excluded: its highly eccentric orbit means it can be closer
    // to the Sun than Neptune near perihelion (e.g. ~1979–1999).
    const orderedNames = [
      'Mercury',
      'Venus',
      'Earth',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
    ]

    const distances = orderedNames.map((name) => {
      const body = SOLAR_BODIES.find((b) => b.name === name)!
      return getHeliocentricPositionAu(body, EPOCH).length()
    })

    for (let i = 1; i < distances.length; i++) {
      expect(
        distances[i],
        `${orderedNames[i]} should be farther than ${orderedNames[i - 1]}`,
      ).toBeGreaterThan(distances[i - 1])
    }
  })
})

describe('buildOrbitPoints — scene orbit paths', () => {
  it('returns exactly the requested number of samples for each body', () => {
    for (const body of SOLAR_BODIES) {
      expect(buildOrbitPoints(body, EPOCH, 32)).toHaveLength(32)
    }
  })

  it('all orbit-path points are finite for every solar body', () => {
    for (const body of SOLAR_BODIES) {
      const points = buildOrbitPoints(body, EPOCH, 32)
      for (const pt of points) {
        expect(Number.isFinite(pt.x), `${body.name} x must be finite`).toBe(
          true,
        )
        expect(Number.isFinite(pt.y), `${body.name} y must be finite`).toBe(
          true,
        )
        expect(Number.isFinite(pt.z), `${body.name} z must be finite`).toBe(
          true,
        )
      }
    }
  })

  it('Mars orbit points fall within the expected distance range', () => {
    const mars = SOLAR_BODIES.find((b) => b.name === 'Mars')!
    const points = buildOrbitPoints(mars, EPOCH, 64)
    for (const pt of points) {
      expect(pt.length()).toBeGreaterThan(1.35)
      expect(pt.length()).toBeLessThan(1.70)
    }
  })

  it('Jupiter orbit points fall within the expected distance range', () => {
    const jupiter = SOLAR_BODIES.find((b) => b.name === 'Jupiter')!
    const points = buildOrbitPoints(jupiter, EPOCH, 64)
    for (const pt of points) {
      expect(pt.length()).toBeGreaterThan(4.9)
      expect(pt.length()).toBeLessThan(5.5)
    }
  })

  it('orbit samples span distinct positions — midpoint differs from start', () => {
    // For Venus (nearly circular, 0.72 AU orbit), 64 samples over the full
    // period places the midpoint roughly opposite the start (~1.44 AU away).
    const venus = SOLAR_BODIES.find((b) => b.name === 'Venus')!
    const points = buildOrbitPoints(venus, EPOCH, 64)
    const first = points[0]
    const mid = points[Math.floor(points.length / 2)]
    expect(first.distanceTo(mid)).toBeGreaterThan(0.5)
  })
})
