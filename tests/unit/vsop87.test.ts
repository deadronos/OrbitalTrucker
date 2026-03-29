import { describe, expect, it } from 'vitest'

import { KeplerianEphemerisProvider } from '../../src/ephemeris/keplerian'
import { Vsop87EphemerisProvider } from '../../src/ephemeris/vsop87'
import { SOLAR_BODIES } from '../../src/solar-data'

// Reference dates
const J2000 = new Date('2000-01-01T12:00:00.000Z')
const SIM_DATE = new Date('2026-03-29T00:00:00.000Z')

const vsop87 = new Vsop87EphemerisProvider()
const keplerian = new KeplerianEphemerisProvider()

const earth = SOLAR_BODIES.find((b) => b.name === 'Earth')!
const mars = SOLAR_BODIES.find((b) => b.name === 'Mars')!
const jupiter = SOLAR_BODIES.find((b) => b.name === 'Jupiter')!
const saturn = SOLAR_BODIES.find((b) => b.name === 'Saturn')!
const pluto = SOLAR_BODIES.find((b) => b.name === 'Pluto')!

describe('EphemerisProvider labels', () => {
  it('Vsop87EphemerisProvider carries the VSOP87D label', () => {
    expect(vsop87.label).toContain('VSOP87D')
  })

  it('KeplerianEphemerisProvider carries the approximation label', () => {
    expect(keplerian.label).toContain('approximation')
  })
})

describe('Vsop87EphemerisProvider – Earth', () => {
  it('returns ~0.983 AU at J2000.0 (perihelion)', () => {
    // Earth is near perihelion on January 3 each year.
    // At J2000.0 (January 1, 2000 12:00 UTC) the distance should be ≈ 0.983 AU.
    const pos = vsop87.getHeliocentricPositionAu(earth, J2000)
    const r = pos.length()
    expect(r).toBeGreaterThan(0.980)
    expect(r).toBeLessThan(0.988)
  })

  it('returns a physically plausible distance for the simulation start date', () => {
    // March 29 is past perihelion (Jan 3); Earth is receding slightly.
    const pos = vsop87.getHeliocentricPositionAu(earth, SIM_DATE)
    const r = pos.length()
    expect(r).toBeGreaterThan(0.985)
    expect(r).toBeLessThan(1.005)
  })

  it('agrees with the Keplerian fallback within 0.01 AU for Earth', () => {
    const vsop = vsop87.getHeliocentricPositionAu(earth, SIM_DATE)
    const kepl = keplerian.getHeliocentricPositionAu(earth, SIM_DATE)
    expect(Math.abs(vsop.length() - kepl.length())).toBeLessThan(0.01)
  })
})

describe('Vsop87EphemerisProvider – other bodies', () => {
  it('returns ~1.52 AU for Mars near J2000.0', () => {
    const pos = vsop87.getHeliocentricPositionAu(mars, J2000)
    const r = pos.length()
    expect(r).toBeGreaterThan(1.38)
    expect(r).toBeLessThan(1.67)
  })

  it('returns ~5.2 AU for Jupiter near J2000.0', () => {
    const pos = vsop87.getHeliocentricPositionAu(jupiter, J2000)
    const r = pos.length()
    expect(r).toBeGreaterThan(4.95)
    expect(r).toBeLessThan(5.46)
  })

  it('returns ~9.5 AU for Saturn near J2000.0', () => {
    const pos = vsop87.getHeliocentricPositionAu(saturn, J2000)
    const r = pos.length()
    expect(r).toBeGreaterThan(9.0)
    expect(r).toBeLessThan(10.1)
  })

  it('returns finite, non-zero positions for all VSOP87-covered bodies', () => {
    const covered = SOLAR_BODIES.filter((b) => b.name !== 'Pluto')
    for (const body of covered) {
      const pos = vsop87.getHeliocentricPositionAu(body, SIM_DATE)
      const r = pos.length()
      expect(Number.isFinite(r), `${body.name} radius must be finite`).toBe(
        true,
      )
      expect(r, `${body.name} must be > 0 AU`).toBeGreaterThan(0)
    }
  })
})

describe('Vsop87EphemerisProvider – Pluto fallback', () => {
  it('falls back to the Keplerian approximation for Pluto', () => {
    // Both providers should return the same result for Pluto since VSOP87
    // does not cover it and the VSOP87 provider delegates to Keplerian.
    const vsopPos = vsop87.getHeliocentricPositionAu(pluto, SIM_DATE)
    const keplPos = keplerian.getHeliocentricPositionAu(pluto, SIM_DATE)
    expect(vsopPos.x).toBeCloseTo(keplPos.x, 10)
    expect(vsopPos.y).toBeCloseTo(keplPos.y, 10)
    expect(vsopPos.z).toBeCloseTo(keplPos.z, 10)
  })

  it('Pluto radius is in the expected range (~29-50 AU)', () => {
    const pos = vsop87.getHeliocentricPositionAu(pluto, SIM_DATE)
    expect(pos.length()).toBeGreaterThan(29)
    expect(pos.length()).toBeLessThan(50)
  })
})

describe('buildOrbitPoints', () => {
  it('returns the requested number of samples for a VSOP87-covered body', () => {
    const points = vsop87.buildOrbitPoints(earth, SIM_DATE, 64)
    expect(points).toHaveLength(64)
    expect(points.every((p) => Number.isFinite(p.length()))).toBe(true)
  })

  it('returns the requested number of samples for Pluto (Keplerian fallback)', () => {
    const points = vsop87.buildOrbitPoints(pluto, SIM_DATE, 32)
    expect(points).toHaveLength(32)
    expect(points.every((p) => Number.isFinite(p.length()))).toBe(true)
  })

  it('all orbit points for Earth are within expected distance range', () => {
    const points = vsop87.buildOrbitPoints(earth, SIM_DATE, 36)
    for (const point of points) {
      const r = point.length()
      expect(r).toBeGreaterThan(0.97)
      expect(r).toBeLessThan(1.03)
    }
  })
})
