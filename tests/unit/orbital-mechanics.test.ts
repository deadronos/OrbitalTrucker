import { describe, expect, it } from 'vitest'

import {
  buildOrbitPoints,
  getHeliocentricPositionAu,
  getJulianDate,
} from '../../src/orbital-mechanics'
import { SOLAR_BODIES } from '../../src/solar-data'

describe('orbital mechanics', () => {
  it('calculates the J2000 Julian date correctly', () => {
    expect(getJulianDate(new Date('2000-01-01T12:00:00.000Z'))).toBe(2451545)
  })

  it('returns a plausible heliocentric distance for Earth', () => {
    const earth = SOLAR_BODIES.find((body) => body.name === 'Earth')

    expect(earth).toBeDefined()

    const earthPosition = getHeliocentricPositionAu(
      earth!,
      new Date('2026-03-29T00:00:00.000Z'),
    )
    const radius = earthPosition.length()

    expect(radius).toBeGreaterThan(0.97)
    expect(radius).toBeLessThan(1.03)
  })

  it('samples a stable orbit path for Pluto', () => {
    const pluto = SOLAR_BODIES.find((body) => body.name === 'Pluto')

    expect(pluto).toBeDefined()

    const points = buildOrbitPoints(
      pluto!,
      new Date('2026-03-29T00:00:00.000Z'),
      64,
    )

    expect(points).toHaveLength(64)
    expect(points.every((point) => Number.isFinite(point.length()))).toBe(true)
  })
})
