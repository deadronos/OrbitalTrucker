import { describe, expect, it } from 'vitest'

import {
  getMissionById,
  getMissionCatalog,
  isMissionCompleted,
  MISSION_CATALOG,
} from '../../src/world/missions'

describe('missions', () => {
  it('catalogs at least three freight contracts with stable ids', () => {
    const catalog = getMissionCatalog()

    expect(catalog.length).toBeGreaterThanOrEqual(3)

    for (const mission of catalog) {
      expect(mission.id).toBeTruthy()
      expect(mission.originId).toBeTruthy()
      expect(mission.destinationId).toBeTruthy()
      expect(mission.rewardCredits).toBeGreaterThan(0)
    }
  })

  it('covers all three destination regions defined in ADR 005', () => {
    const ids = MISSION_CATALOG.map((m) => m.destinationId)

    const hasMarsDestination = ids.some((id) => id.startsWith('mars'))
    const hasEarthSphereDestination = ids.some(
      (id) => id === 'luna-logistics-base' || id === 'earth-orbit-freight-ring',
    )
    const hasJovianDestination = ids.some(
      (id) => id.includes('callisto') || id.includes('ganymede') || id.includes('europa'),
    )

    expect(hasMarsDestination).toBe(true)
    expect(hasEarthSphereDestination).toBe(true)
    expect(hasJovianDestination).toBe(true)
  })

  it('looks up missions by stable id', () => {
    const mission = getMissionById('mars-supply-run')

    expect(mission?.title).toBe('Mars Supply Run')
    expect(mission?.originId).toBe('earth-orbit-freight-ring')
    expect(mission?.destinationId).toBe('mars-high-port')
  })

  it('returns undefined for unknown mission ids', () => {
    expect(getMissionById('does-not-exist')).toBeUndefined()
  })

  it('completes when ship arrives at the mission destination', () => {
    const mission = getMissionById('mars-supply-run')!

    expect(isMissionCompleted(mission, 'arrived', 'mars-high-port')).toBe(true)
  })

  it('does not complete when ship arrives at a different location', () => {
    const mission = getMissionById('mars-supply-run')!

    expect(isMissionCompleted(mission, 'arrived', 'earth')).toBe(false)
  })

  it('does not complete when ship is still travelling to the correct destination', () => {
    const mission = getMissionById('mars-supply-run')!

    expect(isMissionCompleted(mission, 'cruising', 'mars-high-port')).toBe(
      false,
    )
    expect(isMissionCompleted(mission, 'braking', 'mars-high-port')).toBe(false)
    expect(isMissionCompleted(mission, 'acquiring', 'mars-high-port')).toBe(
      false,
    )
  })

  it('returns false when no mission is provided', () => {
    expect(isMissionCompleted(undefined, 'arrived', 'mars-high-port')).toBe(
      false,
    )
  })
})
