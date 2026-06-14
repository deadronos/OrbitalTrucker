import { describe, expect, it } from 'vitest'

import {
  getMissionById,
  getMissionCatalog,
  getMissionAtOrigin,
  getMissionAtDestination,
  getNextMissionStatus,
  isMissionCargoLoaded,
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
      (id) =>
        id.includes('callisto') ||
        id.includes('ganymede') ||
        id.includes('europa'),
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

describe('mission state machine', () => {
  const mars = getMissionById('mars-supply-run')!

  it('promotes active → in-transit when ship arrives at the origin', () => {
    expect(getNextMissionStatus(mars, 'active', 'arrived', mars.originId)).toBe(
      'in-transit',
    )
  })

  it('does not promote active → in-transit when ship has not arrived', () => {
    expect(
      getNextMissionStatus(mars, 'active', 'cruising', mars.originId),
    ).toBe('active')
  })

  it('does not promote active → in-transit at a non-origin location', () => {
    expect(getNextMissionStatus(mars, 'active', 'arrived', 'earth')).toBe(
      'active',
    )
  })

  it('promotes in-transit → completed when ship arrives at the destination', () => {
    expect(
      getNextMissionStatus(mars, 'in-transit', 'arrived', mars.destinationId),
    ).toBe('completed')
  })

  it('does not promote in-transit → completed when ship is still travelling', () => {
    expect(
      getNextMissionStatus(mars, 'in-transit', 'cruising', mars.destinationId),
    ).toBe('in-transit')
  })

  it('does not complete an in-transit mission at the origin', () => {
    expect(
      getNextMissionStatus(mars, 'in-transit', 'arrived', mars.originId),
    ).toBe('in-transit')
  })

  it('does not auto-transition out of completed', () => {
    expect(
      getNextMissionStatus(mars, 'completed', 'arrived', mars.destinationId),
    ).toBe('completed')
  })

  it('does not auto-transition out of failed', () => {
    expect(
      getNextMissionStatus(mars, 'failed', 'arrived', mars.destinationId),
    ).toBe('failed')
  })

  it('reports cargo loaded only for in-transit or completed statuses', () => {
    expect(isMissionCargoLoaded(mars, 'available')).toBe(false)
    expect(isMissionCargoLoaded(mars, 'active')).toBe(false)
    expect(isMissionCargoLoaded(mars, 'in-transit')).toBe(true)
    expect(isMissionCargoLoaded(mars, 'completed')).toBe(true)
  })

  it('detects when the selected location matches the origin', () => {
    expect(getMissionAtOrigin(mars, mars.originId)).toBe(true)
    expect(getMissionAtOrigin(mars, mars.destinationId)).toBe(false)
    expect(getMissionAtOrigin(mars, 'earth')).toBe(false)
  })

  it('detects when the selected location matches the destination', () => {
    expect(getMissionAtDestination(mars, mars.destinationId)).toBe(true)
    expect(getMissionAtDestination(mars, mars.originId)).toBe(false)
    expect(getMissionAtDestination(mars, 'earth')).toBe(false)
  })

  it('returns the unchanged status when no mission is provided', () => {
    expect(
      getNextMissionStatus(
        undefined,
        'active',
        'arrived',
        'earth-orbit-freight-ring',
      ),
    ).toBe('active')
    expect(
      getNextMissionStatus(
        undefined,
        'in-transit',
        'arrived',
        'mars-high-port',
      ),
    ).toBe('in-transit')
  })
})
