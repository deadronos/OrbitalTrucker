import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'

import {
  getMoonEphemerisDefinition,
  getMoonHeliocentricPositionAu,
  getMoonRelativePositionAu,
  type MoonEphemerisId,
} from '../../src/ephemeris/moons'

const EPOCH = new Date('2000-01-01T12:00:00.000Z')

const TEST_MOONS: readonly MoonEphemerisId[] = [
  'moon',
  'europa',
  'ganymede',
  'callisto',
]

describe('moon ephemerides', () => {
  it('returns plausible parent-relative orbital radii for the curated moon set', () => {
    for (const moonId of TEST_MOONS) {
      const definition = getMoonEphemerisDefinition(moonId)
      const radius = getMoonRelativePositionAu(moonId, EPOCH).length()
      const semiMajorAxisAu = definition.semiMajorAxisKm / 149_597_870.7

      expect(
        radius,
        `${definition.name} radius must be finite`,
      ).toBeGreaterThan(0)
      expect(radius).toBeGreaterThan(semiMajorAxisAu * 0.9)
      expect(radius).toBeLessThan(semiMajorAxisAu * 1.1)
    }
  })

  it('advances moon positions over time', () => {
    for (const moonId of TEST_MOONS) {
      const definition = getMoonEphemerisDefinition(moonId)
      const start = getMoonRelativePositionAu(moonId, EPOCH)
      const later = getMoonRelativePositionAu(
        moonId,
        new Date(
          EPOCH.getTime() + definition.orbitalPeriodDays * 0.25 * 86_400_000,
        ),
      )

      expect(
        start.distanceTo(later),
        `${definition.name} should move over a quarter orbit`,
      ).toBeGreaterThan(0.001)
    }
  })

  it('composes moon positions on top of the resolved parent body position', () => {
    const parent = new Vector3(4, 5, 6)
    const moonRelative = getMoonRelativePositionAu('europa', EPOCH)
    const heliocentric = getMoonHeliocentricPositionAu('europa', EPOCH, () =>
      parent.clone(),
    )

    expect(heliocentric.x).toBeCloseTo(parent.x + moonRelative.x, 8)
    expect(heliocentric.y).toBeCloseTo(parent.y + moonRelative.y, 8)
    expect(heliocentric.z).toBeCloseTo(parent.z + moonRelative.z, 8)
  })
})
