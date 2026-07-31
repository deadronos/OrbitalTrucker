import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { computeAutonomousGuidance } from '../../src/simulation/autonomous-guidance'
import {
  createInitialShipState,
  getShipOrientationFromAngles,
  stepShipPhysics,
} from '../../src/simulation/physics'
import {
  planTransfer,
  type TransferPlannerResult,
} from '../../src/simulation/transfer-planner'

describe('computeAutonomousGuidance', () => {
  it('acquires heading before applying cruise thrust', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(0, 0, -1), 90, 1),
    )

    expect(guidance.phase).toBe('acquiring')
    expect(guidance.controls.forward).toBe(0)
    expect(guidance.controls.yaw).toBeGreaterThan(0)
  })

  it('cruises forward once aligned with the planner course', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 1.5),
    )

    expect(guidance.phase).toBe('cruising')
    expect(guidance.controls.forward).toBeGreaterThan(0.9)
    expect(guidance.controls.brakeTranslation).toBe(false)
  })

  it('treats pitch-aligned elevated targets as cruise-ready', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.yaw = 0
    state.pitch = Math.PI / 4

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 1, 0), 45, 1.5),
    )

    expect(guidance.phase).toBe('cruising')
    expect(guidance.alignmentErrorDeg).toBeLessThan(0.001)
    expect(guidance.controls.forward).toBeGreaterThan(0.9)
  })

  it('tapers cruise thrust as stopping distance approaches remaining range', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0
    state.velocity.set(Math.sqrt(2 * 0.000016 * 0.6), 0, 0)

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 1),
    )

    expect(guidance.phase).toBe('cruising')
    expect(guidance.controls.forward).toBeGreaterThan(0)
    expect(guidance.controls.forward).toBeLessThan(0.7)
    expect(guidance.controls.brakeTranslation).toBe(false)
  })

  it('switches to braking when the ship is moving too fast for the remaining range', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    state.velocity.set(0.00003, 0, 0)

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 0.00002),
    )

    expect(guidance.phase).toBe('braking')
    expect(guidance.controls.brakeTranslation).toBe(true)
  })

  it('holds station once effectively arrived', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    state.velocity.set(1e-7, 0, 0)

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 0.0004),
    )

    expect(guidance.phase).toBe('arrived')
    expect(guidance.controls.brakeTranslation).toBe(true)
    expect(guidance.controls.brakeRotation).toBe(true)
  })

  it('changes steering command when the destination changes', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const initialGuidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 1),
    )
    const retargetedGuidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(0, 0, -1), 90, 1),
    )

    expect(initialGuidance.controls.yaw).toBe(0)
    expect(retargetedGuidance.controls.yaw).toBeGreaterThan(0)
  })
})

describe('lead-pursuit blend', () => {
  function makeLeadPursuitPlan(overrides: {
    status:
      | 'current-position'
      | 'future-intercept'
      | 'intercept-overrun'
      | 'lead-chase'
      | 'no-solution'
    targetMotion: number
    requiredArrivalVelocity: Vector3
    interceptTimeSeconds: number | null
    aimPosition: Vector3
    currentPosition: Vector3
  }): TransferPlannerResult {
    return {
      destinationId: 'target',
      status: overrides.status,
      destination: {
        currentPosition: overrides.currentPosition,
        predictedPosition: overrides.aimPosition,
        predictedDate: new Date('2026-04-01T00:00:00.000Z'),
        estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
      },
      guidance: {
        aimPosition: overrides.aimPosition,
        direction: new Vector3(1, 0, 0),
        bearingAngleDeg: 0,
        requiredArrivalVelocity: overrides.requiredArrivalVelocity,
      },
      travel: {
        currentDistanceAu: 1,
        plannedDistanceAu: 1.5,
        etaDays: 0.01,
        interceptTimeSeconds: overrides.interceptTimeSeconds,
        targetMotionDuringInterceptAu: overrides.targetMotion,
        planningSpeedAuPerSec: 1,
      },
      solver: { iterations: 1, solutionErrorSeconds: null },
    }
  }

  it('uses the planner aim when target motion is below the lead-pursuit full-scale', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    const plan = makeLeadPursuitPlan({
      status: 'future-intercept',
      targetMotion: 0.001, // < 0.05 threshold
      requiredArrivalVelocity: new Vector3(0, 0, 0),
      interceptTimeSeconds: 60,
      aimPosition: new Vector3(1.5, 0, 0),
      currentPosition: new Vector3(1, 0, 0),
    })
    const result = computeAutonomousGuidance(state, plan)
    // Static aim at +X dominates; desiredDirection should be near +X.
    expect(result.desiredDirection.x).toBeGreaterThan(0.99)
    expect(result.desiredDirection.y).toBeLessThan(0.05)
  })

  it('blends toward the live lead when target motion exceeds the threshold', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    const plan = makeLeadPursuitPlan({
      status: 'future-intercept',
      targetMotion: 1, // >> 0.05 threshold
      requiredArrivalVelocity: new Vector3(0, 1, 0),
      interceptTimeSeconds: 60,
      aimPosition: new Vector3(1, 0, 0), // static aim at +X
      currentPosition: new Vector3(0, 0, 0), // live lead = (0, 60, 0)
    })
    const result = computeAutonomousGuidance(state, plan)
    // Live lead dominates; desiredDirection should be near +Y.
    expect(result.desiredDirection.y).toBeGreaterThan(0.5)
    expect(result.desiredDirection.x).toBeLessThan(0.5)
  })

  it('forces leadWeight=1 for intercept-overrun status', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    const plan = makeLeadPursuitPlan({
      status: 'intercept-overrun',
      targetMotion: 0.0001, // below threshold
      requiredArrivalVelocity: new Vector3(0, 1, 0),
      interceptTimeSeconds: 60,
      aimPosition: new Vector3(1, 0, 0), // static aim at +X
      currentPosition: new Vector3(0, 0, 0), // live lead = (0, 60, 0)
    })
    const result = computeAutonomousGuidance(state, plan)
    // Status forces live lead to dominate.
    expect(result.desiredDirection.y).toBeGreaterThan(0.5)
  })

  it('forces leadWeight=1 for lead-chase status', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    const plan = makeLeadPursuitPlan({
      status: 'lead-chase',
      targetMotion: 0.0001, // below threshold
      requiredArrivalVelocity: new Vector3(0, 1, 0),
      interceptTimeSeconds: 60,
      aimPosition: new Vector3(1, 0, 0), // static aim at +X
      currentPosition: new Vector3(0, 0, 0), // live lead = (0, 60, 0)
    })
    const result = computeAutonomousGuidance(state, plan)
    expect(result.desiredDirection.y).toBeGreaterThan(0.5)
  })
})

describe('autonomous guidance with ship physics', () => {
  it('reduces range to a static destination when guidance commands the backend', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const target = new Vector3(0.2, 0, 0)
    const initialDistance = state.position.distanceTo(target)
    let previousPhase:
      ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    for (let step = 0; step < 180; step += 1) {
      const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
      const plan = planTransfer({
        date: new Date('2026-03-29T00:00:00.000Z'),
        shipPosition: state.position,
        shipVelocity: state.velocity,
        shipForward: forward,
        destinationId: 'target',
        resolveDestinationPosition: () => target.clone(),
      })
      const guidance = computeAutonomousGuidance(state, plan, previousPhase)
      previousPhase = guidance.phase

      stepShipPhysics(state, guidance.controls, 0.016)
    }

    expect(state.position.distanceTo(target)).toBeLessThan(initialDistance)
  })

  it('reduces range to an elevated destination after turning onto the course', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = -Math.PI / 2
    state.pitch = 0

    const target = new Vector3(0.2, 0.05, 0)
    const initialDistance = state.position.distanceTo(target)
    let previousPhase:
      ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    for (let step = 0; step < 720; step += 1) {
      const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
      const plan = planTransfer({
        date: new Date('2026-03-29T00:00:00.000Z'),
        shipPosition: state.position,
        shipVelocity: state.velocity,
        shipForward: forward,
        destinationId: 'target',
        resolveDestinationPosition: () => target.clone(),
      })
      const guidance = computeAutonomousGuidance(state, plan, previousPhase)
      previousPhase = guidance.phase

      stepShipPhysics(state, guidance.controls, 0.016)
    }

    expect(state.position.distanceTo(target)).toBeLessThan(initialDistance)
    expect(state.velocity.length()).toBeGreaterThan(0)
  })

  it('approaches a straight-in destination without excessive brake chatter', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const target = new Vector3(0.2, 0, 0)
    let previousPhase:
      ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined
    let cruiseBrakeTransitions = 0
    let arrived = false

    for (let step = 0; step < 20_000; step += 1) {
      const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
      const plan = planTransfer({
        date: new Date('2026-03-29T00:00:00.000Z'),
        shipPosition: state.position,
        shipVelocity: state.velocity,
        shipForward: forward,
        destinationId: 'target',
        resolveDestinationPosition: () => target.clone(),
      })
      const guidance = computeAutonomousGuidance(state, plan, previousPhase)

      if (
        previousPhase &&
        previousPhase !== guidance.phase &&
        ((previousPhase === 'cruising' && guidance.phase === 'braking') ||
          (previousPhase === 'braking' && guidance.phase === 'cruising'))
      ) {
        cruiseBrakeTransitions += 1
      }

      previousPhase = guidance.phase

      if (guidance.phase === 'arrived') {
        arrived = true
        break
      }

      stepShipPhysics(state, guidance.controls, 0.016)
    }

    expect(arrived).toBe(true)
    expect(cruiseBrakeTransitions).toBeLessThan(200)
  })
})

function createPlan(
  direction: Vector3,
  bearingAngleDeg: number,
  plannedDistanceAu: number,
): TransferPlannerResult {
  const aimPosition = direction
    .clone()
    .normalize()
    .multiplyScalar(plannedDistanceAu)

  return {
    destinationId: 'target',
    status: 'future-intercept',
    destination: {
      currentPosition: aimPosition.clone(),
      predictedPosition: aimPosition.clone(),
      predictedDate: new Date('2026-03-30T00:00:00.000Z'),
      estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
    },
    guidance: {
      aimPosition,
      direction: direction.clone().normalize(),
      bearingAngleDeg,
      requiredArrivalVelocity: new Vector3(0, 0, 0),
    },
    travel: {
      currentDistanceAu: plannedDistanceAu,
      plannedDistanceAu,
      etaDays: null,
      interceptTimeSeconds: null,
      targetMotionDuringInterceptAu: 0,
      planningSpeedAuPerSec: 0,
    },
    solver: {
      iterations: 1,
      solutionErrorSeconds: null,
    },
  }
}
