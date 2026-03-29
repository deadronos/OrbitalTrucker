import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'

import {
  createEphemerisSolarBodyResolver,
  formatLocationKind,
  getLocationById,
  getLocationParent,
  resolveLocationPosition,
  type SolarBodyPositionResolver,
} from '../../src/world/locations'

describe('locations', () => {
  it('looks up destinations by stable id with parent relationships intact', () => {
    const location = getLocationById('mars-high-port')

    expect(location?.name).toBe('Mars High Port')
    expect(location?.kind).toBe('station')
    expect(getLocationParent(location! /* covered above */)?.id).toBe('mars')
  })

  it('resolves anchored locations recursively through the catalog', () => {
    const solarBodyResolver: SolarBodyPositionResolver = (bodyName) => {
      switch (bodyName) {
        case 'Earth':
          return new Vector3(1, 2, 3)
        case 'Mars':
          return new Vector3(4, 5, 6)
        case 'Jupiter':
          return new Vector3(7, 8, 9)
        default:
          return new Vector3(0, 0, 0)
      }
    }

    const moonPosition = resolveLocationPosition('moon', {
      date: new Date('2026-03-30T00:00:00.000Z'),
      resolveSolarBodyPosition: solarBodyResolver,
    })
    const colonyPosition = resolveLocationPosition('luna-logistics-base', {
      date: new Date('2026-03-30T00:00:00.000Z'),
      resolveSolarBodyPosition: solarBodyResolver,
    })

    expect(moonPosition.x).toBeCloseTo(1.00257, 6)
    expect(moonPosition.y).toBeCloseTo(2, 6)
    expect(colonyPosition.x).toBeCloseTo(1.00257, 6)
    expect(colonyPosition.y).toBeCloseTo(2.00005, 6)
  })

  it('can resolve future positions through the ephemeris-backed body resolver', () => {
    const resolver = createEphemerisSolarBodyResolver()
    const position = resolveLocationPosition('earth', {
      date: new Date('2027-01-01T00:00:00.000Z'),
      resolveSolarBodyPosition: resolver,
    })

    expect(position.length()).toBeGreaterThan(0.9)
    expect(position.length()).toBeLessThan(1.1)
  })

  it('formats human-readable kind labels for the destination UI', () => {
    expect(formatLocationKind('moon')).toBe('Moon')
    expect(formatLocationKind('dwarf-planet')).toBe('Dwarf planet')
  })
})
