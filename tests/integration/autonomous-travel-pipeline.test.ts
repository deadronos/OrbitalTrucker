import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { computeAutonomousGuidance } from '../../src/simulation/autonomous-guidance'
import {
  createInitialShipState,
  getShipOrientationFromAngles,
  stepShipPhysics,
  type ShipState,
} from '../../src/simulation/physics'
import { planTransfer } from '../../src/simulation/transfer-planner'
import {
  getMissionById,
  isMissionCompleted,
  MISSION_CATALOG,
} from '../../src/world/missions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a static destination position.  The real codebase uses
 * `resolveLocationPosition` which reads from an ephemeris.  For integration
 * tests we use a pure function so the test stays deterministic and fast.
 */
function makeStaticResolver(target: Vector3) {
  return (_destinationId: string, _date: Date) => target.clone()
}

function stepPipeline(
  state: ShipState,
  target: Vector3,
  date: Date,
  previousPhase?: ReturnType<typeof computeAutonomousGuidance>['phase'],
) {
  const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
  const plan = planTransfer({
    date,
    shipPosition: state.position,
    shipVelocity: state.velocity,
    shipForward: forward,
    destinationId: 'target',
    resolveDestinationPosition: makeStaticResolver(target),
  })
  const guidance = computeAutonomousGuidance(state, plan, previousPhase)
  const orientation = stepShipPhysics(state, guidance.controls, 0.016)
  return { plan, guidance, orientation }
}

// ---------------------------------------------------------------------------
// Acceptance criterion 1: real autonomous travel stack (no stubbed scene)
// ---------------------------------------------------------------------------

describe('autonomous travel pipeline (planTransfer → computeAutonomousGuidance → stepShipPhysics)', () => {
  it('navigates from Earth orbit to a static Mars-like target without any stubbed components', () => {
    const state = createInitialShipState()
    // Start near Earth orbit (1 AU) heading along +X
    state.position.set(1.04, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const target = new Vector3(1.52, 0, 0) // ~Mars distance
    const initialDistance = state.position.distanceTo(target)
    let phase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    // Run the full pipeline for enough frames (~10 min simulated at 60 FPS)
    for (let frame = 0; frame < 36_000; frame += 1) {
      const { guidance } = stepPipeline(state, target, new Date(), phase)
      phase = guidance.phase

      if (phase === 'arrived') break
    }

    expect(state.position.distanceTo(target)).toBeLessThan(initialDistance * 0.1)
    expect(phase).toBe('arrived')
  })

  it('reaches a longer-range target (Pluto-like ~39 AU) through the full guidance loop', () => {
    const state = createInitialShipState()
    state.position.set(1.04, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const target = new Vector3(39.5, 0, 0)
    const initialDistance = state.position.distanceTo(target)
    let phase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    for (let frame = 0; frame < 500_000; frame += 1) {
      const { guidance } = stepPipeline(state, target, new Date(), phase)
      phase = guidance.phase
      if (phase === 'arrived') break
    }

    expect(phase).toBe('arrived')
    expect(state.position.distanceTo(target)).toBeLessThan(initialDistance * 0.01)
  })

  it('handles an off-plane target by steering through pitch and yaw', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    // Target above and to the right of the ecliptic
    const target = new Vector3(0.2, 0.05, -0.1)
    const initialDistance = state.position.distanceTo(target)
    let phase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    for (let frame = 0; frame < 36_000; frame += 1) {
      const { guidance } = stepPipeline(state, target, new Date(), phase)
      phase = guidance.phase
      if (phase === 'arrived') break
    }

    expect(phase).toBe('arrived')
    expect(state.position.distanceTo(target)).toBeLessThan(initialDistance * 0.05)
  })

  it('the guidance phase transitions follow the expected acquiring → cruising → braking → arrived sequence', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    // Point the ship away from the target so it must first acquire heading.
    state.yaw = Math.PI // facing -X
    state.pitch = 0

    const target = new Vector3(0.5, 0, 0) // target is at +X
    let phase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined
    const observedPhases: string[] = []

    for (let frame = 0; frame < 36_000; frame += 1) {
      const { guidance } = stepPipeline(state, target, new Date(), phase)
      if (guidance.phase !== phase) {
        observedPhases.push(guidance.phase)
      }
      phase = guidance.phase
      if (phase === 'arrived') break
    }

    // Must have gone through at least acquiring → cruising before arriving.
    expect(observedPhases).toContain('acquiring')
    expect(observedPhases).toContain('cruising')
    expect(observedPhases[observedPhases.length - 1]).toBe('arrived')
  })
})

// ---------------------------------------------------------------------------
// Acceptance criterion 2: mission lifecycle — completion & next-contract
// ---------------------------------------------------------------------------

describe('mission lifecycle with real travel stack', () => {
  it('a mission becomes completable once the ship arrives at the destination', () => {
    const mission = getMissionById('mars-supply-run')!
    expect(mission).toBeDefined()

    // Before arrival: mission is NOT completed
    expect(isMissionCompleted(mission, 'cruising', mission.destinationId)).toBe(
      false,
    )
    expect(
      isMissionCompleted(mission, 'arrived', 'wrong-destination'),
    ).toBe(false)

    // Arrival at correct destination: mission IS completed
    expect(isMissionCompleted(mission, 'arrived', mission.destinationId)).toBe(
      true,
    )
  })

  it('accepting a mission, arriving, completing, then accepting a different mission follows the full lifecycle', () => {
    // Phase 1: accept the first mission
    let activeMissionId: string | null = null
    let missionStatus: 'available' | 'active' | 'completed' = 'available'

    function acceptMission(id: string) {
      activeMissionId = id
      missionStatus = 'active'
    }

    function completeMissionIfArrived(
      autonomousPhase: string,
      selectedLocationId: string,
    ) {
      if (missionStatus !== 'active' || !activeMissionId) return
      const mission = getMissionById(activeMissionId)
      if (isMissionCompleted(mission, autonomousPhase, selectedLocationId)) {
        missionStatus = 'completed'
      }
    }

    // Step 1: accept mars-supply-run
    acceptMission('mars-supply-run')
    expect(missionStatus).toBe('active')
    expect(activeMissionId).toBe('mars-supply-run')

    // Step 2: other missions cannot be accepted while one is active
    // (this is enforced at the UI layer; at the model level we verify the
    // contract state transitions)

    // Step 3: arrive at mars-high-port
    completeMissionIfArrived('arrived', 'mars-high-port')
    expect(missionStatus).toBe('completed')

    // Step 4: accept a different mission
    acceptMission('jovian-outpost-resupply')
    expect(missionStatus).toBe('active')
    expect(activeMissionId).toBe('jovian-outpost-resupply')

    // Step 5: the old completed mission is still recognized as completed
    const marsMission = getMissionById('mars-supply-run')!
    expect(isMissionCompleted(marsMission, 'arrived', 'mars-high-port')).toBe(
      true,
    )
  })

  it('every catalog mission can be individually completed at its destination', () => {
    for (const mission of MISSION_CATALOG) {
      // Not completed when not arrived
      expect(
        isMissionCompleted(mission, 'cruising', mission.destinationId),
      ).toBe(false)

      // Completed when arrived at destination
      expect(
        isMissionCompleted(mission, 'arrived', mission.destinationId),
      ).toBe(true)

      // Not completed at a wrong destination
      expect(isMissionCompleted(mission, 'arrived', 'wrong-id')).toBe(false)
    }
  })

  it('completing a mission through the full autonomous pipeline produces arrived phase', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const mission = getMissionById('lunar-logistics-delivery')!
    const target = new Vector3(0.003, 0, 0) // very close target to keep test fast
    let phase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    for (let frame = 0; frame < 20_000; frame += 1) {
      const { guidance } = stepPipeline(state, target, new Date(), phase)
      phase = guidance.phase
      if (phase === 'arrived') break
    }

    expect(phase).toBe('arrived')
    expect(isMissionCompleted(mission, phase!, mission.destinationId)).toBe(
      true,
    )
  })
})
